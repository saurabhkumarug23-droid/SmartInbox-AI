import { NextRequest } from "next/server";
import Account from "@/lib/account";
import { db } from "@/server/db";
import { waitUntil } from "@vercel/functions";

/**
 * Gmail Pub/Sub push notification webhook.
 *
 * Google Cloud Pub/Sub sends POST requests with a JSON body containing:
 * {
 *   "message": {
 *     "data": "<base64-encoded data>",
 *     "messageId": "...",
 *     "publishTime": "..."
 *   },
 *   "subscription": "projects/..."
 * }
 *
 * The decoded `data` contains:
 * {
 *   "emailAddress": "user@gmail.com",
 *   "historyId": "12345"
 * }
 */

type PubSubPushBody = {
    message: {
        data: string;
        messageId: string;
        publishTime: string;
    };
    subscription: string;
};

type GmailNotification = {
    emailAddress: string;
    historyId: string;
};

export const POST = async (req: NextRequest) => {
    console.log("Gmail Pub/Sub webhook received");

    // Optional: verify the bearer token if GOOGLE_PUBSUB_VERIFICATION_TOKEN is set
    const verificationToken = process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN;
    if (verificationToken) {
        const authHeader = req.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        if (token !== verificationToken) {
            return new Response("Unauthorized", { status: 401 });
        }
    }

    let body: PubSubPushBody;
    try {
        body = await req.json() as PubSubPushBody;
    } catch {
        return new Response("Bad Request: invalid JSON", { status: 400 });
    }

    if (!body.message?.data) {
        return new Response("Bad Request: missing message data", { status: 400 });
    }

    // Decode the base64-encoded Pub/Sub message data
    let notification: GmailNotification;
    try {
        const decoded = Buffer.from(body.message.data, "base64").toString("utf-8");
        notification = JSON.parse(decoded) as GmailNotification;
    } catch {
        return new Response("Bad Request: invalid message data", { status: 400 });
    }

    console.log("Gmail notification:", JSON.stringify(notification, null, 2));

    // Look up the account by email address
    const account = await db.account.findFirst({
        where: {
            emailAddress: notification.emailAddress,
        },
    });

    if (!account) {
        console.log(`Account not found for email: ${notification.emailAddress}`);
        // Return 200 to acknowledge the message and prevent retries
        return new Response(null, { status: 200 });
    }

    const acc = new Account(account.accessToken);
    waitUntil(
        acc.syncEmails().then(() => {
            console.log("Synced emails for", notification.emailAddress);
        })
    );

    return new Response(null, { status: 200 });
};
