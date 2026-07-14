'use server'

import { auth } from "@clerk/nextjs/server";
import { razorpay } from "./razorpay";
import { db } from "@/server/db";
import crypto from "crypto";

// ─── Config ───────────────────────────────────────────────────────────────────
// Price in paise (1 INR = 100 paise). Change this to your desired price.
const PRO_PRICE_PAISE = 49900   // ₹499
const PRO_PERIOD_DAYS = 365     // 1 year access per payment

// ─── Subscription Status ───────────────────────────────────────────────────────

export async function getSubscriptionStatus(): Promise<boolean> {
    const { userId } = await auth();
    if (!userId) return false;

    const subscription = await db.subscription.findUnique({
        where: { userId },
    });
    if (!subscription) return false;

    return subscription.currentPeriodEnd > new Date();
}

// ─── Create Razorpay Order ─────────────────────────────────────────────────────
// No Plan ID needed — just creates a one-time payment order.

export async function createRazorpayOrder(): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
}> {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const order = await razorpay.orders.create({
        amount: PRO_PRICE_PAISE,
        currency: "INR",
        receipt: `order_${userId}_${Date.now()}`,
        notes: { userId },
    });

    return {
        orderId: order.id,
        amount: PRO_PRICE_PAISE,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID ?? "",
    };
}

// ─── Verify Payment & Activate Access ─────────────────────────────────────────

export async function verifyAndActivateSubscription({
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
}: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}): Promise<boolean> {
    const { userId } = await auth();
    if (!userId) return false;

    // Verify HMAC signature (order-based format)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        console.error("Razorpay payment signature mismatch");
        return false;
    }

    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + PRO_PERIOD_DAYS);

    // Upsert subscription in DB
    await db.subscription.upsert({
        where: { userId },
        create: {
            userId,
            subscriptionId: razorpay_order_id,
            customerId: razorpay_payment_id,
            priceId: `₹${PRO_PRICE_PAISE / 100}`,
            currentPeriodEnd,
        },
        update: {
            subscriptionId: razorpay_order_id,
            customerId: razorpay_payment_id,
            currentPeriodEnd,
        },
    });

    return true;
}

// ─── Cancel Access ─────────────────────────────────────────────────────────────

export async function cancelSubscription(): Promise<void> {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    await db.subscription.updateMany({
        where: { userId },
        data: { currentPeriodEnd: new Date() },
    });
}
