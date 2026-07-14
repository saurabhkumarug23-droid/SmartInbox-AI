import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const signature = req.headers.get("x-razorpay-signature");

        if (!signature) {
            return new NextResponse("Missing signature", { status: 400 });
        }

        // Verify HMAC signature
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        if (expectedSignature !== signature) {
            console.error("Razorpay webhook signature mismatch");
            return new NextResponse("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(body) as {
            event: string;
            payload: {
                subscription?: {
                    entity: {
                        id: string;
                        plan_id: string;
                        customer_id: string;
                        current_end: number;
                        notes?: { userId?: string };
                    };
                };
                payment?: { entity: { id: string } };
            };
        };

        const sub = event.payload.subscription?.entity;

        console.log("Razorpay webhook event:", event.event);

        // ── Subscription Activated ───────────────────────────────────────────
        if (event.event === "subscription.activated" && sub) {
            const userId = sub.notes?.userId;
            if (!userId) {
                console.warn("No userId in subscription notes, skipping");
                return NextResponse.json({ received: true });
            }

            await db.subscription.upsert({
                where: { subscriptionId: sub.id },
                create: {
                    userId,
                    subscriptionId: sub.id,
                    customerId: sub.customer_id,
                    priceId: sub.plan_id,
                    currentPeriodEnd: new Date(sub.current_end * 1000),
                },
                update: {
                    currentPeriodEnd: new Date(sub.current_end * 1000),
                    priceId: sub.plan_id,
                },
            });
        }

        // ── Subscription Charged (renewal) ───────────────────────────────────
        if (event.event === "subscription.charged" && sub) {
            await db.subscription.updateMany({
                where: { subscriptionId: sub.id },
                data: {
                    currentPeriodEnd: new Date(sub.current_end * 1000),
                    updatedAt: new Date(),
                },
            });
        }

        // ── Subscription Cancelled ───────────────────────────────────────────
        if (event.event === "subscription.cancelled" && sub) {
            await db.subscription.updateMany({
                where: { subscriptionId: sub.id },
                data: {
                    currentPeriodEnd: new Date(), // expire immediately
                    updatedAt: new Date(),
                },
            });
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Razorpay webhook error:", error);
        return new NextResponse("Webhook error", { status: 500 });
    }
}
