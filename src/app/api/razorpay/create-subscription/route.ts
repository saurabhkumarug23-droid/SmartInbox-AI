import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay-actions";

export async function POST() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const order = await createRazorpayOrder();
        return NextResponse.json(order);
    } catch (error: any) {
        console.error("Error creating Razorpay order:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to create order" },
            { status: 500 }
        );
    }
}
