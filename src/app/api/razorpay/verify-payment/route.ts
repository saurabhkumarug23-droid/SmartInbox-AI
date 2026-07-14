import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAndActivateSubscription } from "@/lib/razorpay-actions";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json() as {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
        };

        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
        }

        const success = await verifyAndActivateSubscription({
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
        });

        if (!success) {
            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error verifying Razorpay payment:", error);
        return NextResponse.json(
            { error: error?.message || "Verification failed" },
            { status: 500 }
        );
    }
}
