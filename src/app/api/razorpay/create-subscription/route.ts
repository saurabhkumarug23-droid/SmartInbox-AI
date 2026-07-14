import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createRazorpaySubscription } from "@/lib/razorpay-actions";

export async function POST() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { subscriptionId, keyId } = await createRazorpaySubscription();

        return NextResponse.json({ subscriptionId, keyId });
    } catch (error: any) {
        console.error("Error creating Razorpay subscription:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to create subscription" },
            { status: 500 }
        );
    }
}
