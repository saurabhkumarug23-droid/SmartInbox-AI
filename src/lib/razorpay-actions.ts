'use server'

import { auth } from "@clerk/nextjs/server";
import { razorpay } from "./razorpay";
import { db } from "@/server/db";
import crypto from "crypto";

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

// ─── Create Razorpay Subscription ─────────────────────────────────────────────
// Called from the API route so we can return JSON to the client-side JS popup.

export async function createRazorpaySubscription(): Promise<{
    subscriptionId: string;
    keyId: string;
}> {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const planId = process.env.RAZORPAY_PLAN_ID;
    if (!planId) throw new Error("RAZORPAY_PLAN_ID is not configured");

    // Cancel any existing active subscription first
    const existing = await db.subscription.findUnique({ where: { userId } });
    if (existing?.subscriptionId) {
        try {
            await razorpay.subscriptions.cancel(existing.subscriptionId, false);
        } catch {
            // Ignore if already cancelled
        }
    }

    const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        quantity: 1,
        total_count: 12, // 12 billing cycles (1 year for monthly plan)
    });

    return {
        subscriptionId: subscription.id,
        keyId: process.env.RAZORPAY_KEY_ID ?? "",
    };
}

// ─── Verify Payment & Activate Subscription ────────────────────────────────────

export async function verifyAndActivateSubscription({
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
}: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
}): Promise<boolean> {
    const { userId } = await auth();
    if (!userId) return false;

    // Verify HMAC signature
    const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        console.error("Razorpay payment signature mismatch");
        return false;
    }

    // Fetch subscription details from Razorpay
    const rzpSub = await razorpay.subscriptions.fetch(razorpay_subscription_id);

    const currentPeriodEnd = rzpSub.current_end
        ? new Date((rzpSub.current_end as number) * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // fallback: 30 days

    // Upsert subscription in DB
    await db.subscription.upsert({
        where: { userId },
        create: {
            userId,
            subscriptionId: razorpay_subscription_id,
            customerId: rzpSub.customer_id as string ?? null,
            priceId: rzpSub.plan_id as string ?? null,
            currentPeriodEnd,
        },
        update: {
            subscriptionId: razorpay_subscription_id,
            customerId: rzpSub.customer_id as string ?? null,
            priceId: rzpSub.plan_id as string ?? null,
            currentPeriodEnd,
        },
    });

    return true;
}

// ─── Cancel Subscription (Billing Portal equivalent) ──────────────────────────

export async function cancelSubscription(): Promise<void> {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const subscription = await db.subscription.findUnique({
        where: { userId },
    });
    if (!subscription?.subscriptionId) {
        throw new Error("No active subscription found");
    }

    // cancel_at_cycle_end = true → cancels at end of current billing period
    await razorpay.subscriptions.cancel(subscription.subscriptionId, true);

    // Mark as expired immediately for UI purposes
    await db.subscription.update({
        where: { userId },
        data: { currentPeriodEnd: new Date() },
    });
}
