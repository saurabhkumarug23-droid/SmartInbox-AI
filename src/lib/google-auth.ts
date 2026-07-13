'use server'

import { google } from 'googleapis'
import { auth } from '@clerk/nextjs/server'
import { getSubscriptionStatus } from './stripe-actions'
import { db } from '@/server/db'
import { FREE_ACCOUNTS_PER_USER, PRO_ACCOUNTS_PER_USER } from '@/app/constants'
import {
    createGoogleOAuth2Client,
    getRedirectUri,
    mapGmailMessageToEmailMessage,
} from './gmail-utils'

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
] as const

export type GoogleTokenResponse = {
    accountId: string
    accessToken: string
    refreshToken?: string
    expiryDate: Date
    userId: string
    userSession: string
}

async function assertAccountLimit(userId: string) {
    let user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
    })

    if (!user) {
        const { clerkClient } = await import('@clerk/nextjs/server')
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(userId)
        if (!clerkUser) throw new Error('User not found')
        
        user = await db.user.upsert({
            where: { id: userId },
            update: {
                emailAddress: clerkUser.emailAddresses[0]?.emailAddress ?? '',
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
            },
            create: {
                id: userId,
                emailAddress: clerkUser.emailAddresses[0]?.emailAddress ?? '',
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
            },
            select: { role: true },
        })
    }

    const isSubscribed = await getSubscriptionStatus()
    const accounts = await db.account.count({ where: { userId } })

    if (user.role === 'user') {
        const maxAccounts = isSubscribed ? PRO_ACCOUNTS_PER_USER : FREE_ACCOUNTS_PER_USER
        if (accounts >= maxAccounts) {
            throw new Error('You have reached the maximum number of accounts for your subscription')
        }
    }
}

export const getAuthorizationUrl = async (serviceType: 'Google' | 'Office365' = 'Google') => {
    if (serviceType !== 'Google') {
        throw new Error('Only Google accounts are supported')
    }

    const { userId } = await auth()
    if (!userId) throw new Error('User not found')

    await assertAccountLimit(userId)

    const oauth2Client = createGoogleOAuth2Client()

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [...GMAIL_SCOPES],
        state: userId,
        include_granted_scopes: true,
    })
}

export const exchangeCodeForTokens = async (code: string): Promise<GoogleTokenResponse | undefined> => {
    try {
        const oauth2Client = createGoogleOAuth2Client()
        const { tokens } = await oauth2Client.getToken(code)

        if (!tokens.access_token) {
            throw new Error('Google OAuth did not return an access token')
        }

        oauth2Client.setCredentials(tokens)

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const { data: userInfo } = await oauth2.userinfo.get()

        const accountId = userInfo.id ?? userInfo.email
        if (!accountId) {
            throw new Error('Unable to resolve Google account id')
        }

        const expiryDate = tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000)

        return {
            accountId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? undefined,
            expiryDate,
            userId: userInfo.id ?? '',
            userSession: tokens.id_token ?? '',
        }
    } catch (error) {
        console.error('Error exchanging Google OAuth code for tokens:', error)
        return undefined
    }
}

export const getAccountDetails = async (accessToken: string) => {
    try {
        const oauth2Client = createGoogleOAuth2Client()
        oauth2Client.setCredentials({ access_token: accessToken })
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const { data } = await oauth2.userinfo.get()

        return {
            email: data.email ?? '',
            name: data.name ?? data.email ?? '',
        }
    } catch (error) {
        console.error('Error fetching Google account details:', error)
        throw error
    }
}

export const getEmailDetails = async (accessToken: string, emailId: string) => {
    try {
        const oauth2Client = createGoogleOAuth2Client()
        oauth2Client.setCredentials({ access_token: accessToken })
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

        const { data } = await gmail.users.messages.get({
            userId: 'me',
            id: emailId,
            format: 'full',
        })

        return mapGmailMessageToEmailMessage(data)
    } catch (error) {
        console.error('Error fetching Gmail message details:', error)
        throw error
    }
}

export { getRedirectUri }
