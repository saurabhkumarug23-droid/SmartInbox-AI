import { exchangeCodeForTokens, getAccountDetails } from "@/lib/google-auth";
import { waitUntil } from '@vercel/functions'
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest) => {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const params = req.nextUrl.searchParams
    const error = params.get('error');
    if (error) return NextResponse.json({ error: "Account connection failed" }, { status: 400 });

    const code = params.get('code');
    if (!code) return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });

    const state = params.get('state');
    if (state && state !== userId) {
        return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    const token = await exchangeCodeForTokens(code)
    if (!token) return NextResponse.json({ error: "Failed to fetch token" }, { status: 400 });

    const accountDetails = await getAccountDetails(token.accessToken)

    await db.account.upsert({
        where: { id: token.accountId },
        create: {
            id: token.accountId,
            userId,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiryDate: token.expiryDate,
            provider: 'Google',
            emailAddress: accountDetails.email,
            name: accountDetails.name,
        },
        update: {
            accessToken: token.accessToken,
            expiryDate: token.expiryDate,
            ...(token.refreshToken ? { refreshToken: token.refreshToken } : {}),
        },
    })

    waitUntil(
        axios.post(`${process.env.NEXT_PUBLIC_URL}/api/initial-sync`, {
            accountId: token.accountId,
            userId,
        }).then((res) => {
            console.log(res.data)
        }).catch((err) => {
            console.log(err.response?.data ?? err.message)
        })
    )

    return NextResponse.redirect(new URL('/mail', req.url))
}
