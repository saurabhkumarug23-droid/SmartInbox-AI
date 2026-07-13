import { db } from "@/server/db";

export const POST = async (req: Request) => {
    try {
        const payload = await req.json();
        const { data } = payload;
        if (!data) return new Response('No data in payload', { status: 400 });
        
        const emailAddress = data.email_addresses?.[0]?.email_address;
        const firstName = data.first_name;
        const lastName = data.last_name;
        const imageUrl = data.image_url;
        const id = data.id;

        if (payload.type === 'user.created' || payload.type === 'user.updated') {
            if (!emailAddress) {
                console.error('No email address provided by Clerk for user', id);
                return new Response('No email address provided', { status: 400 });
            }
            await db.user.upsert({
                where: { id },
                update: { emailAddress, firstName, lastName, imageUrl },
                create: { id, emailAddress, firstName, lastName, imageUrl },
            });
        }

        return new Response('Webhook received', { status: 200 });
    } catch (error) {
        console.error('Webhook processing failed:', error);
        return new Response('Webhook failed: ' + (error as Error).message, { status: 500 });
    }
}