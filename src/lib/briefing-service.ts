import { db } from "@/server/db";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const briefingSchema = z.object({
  overallSummary: z.string().describe("A 1-2 sentence summary of the inbox activity for today."),
  topPriorities: z.array(z.string()).describe("A list of the top 2-3 most important emails/priorities today."),
});

export type DailyBriefing = z.infer<typeof briefingSchema>;

export async function generateDailyBriefing(accountId: string, dateStr?: string) {
  // Fetch emails for the target date
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const emails = await db.email.findMany({
    where: {
      thread: {
        accountId: accountId,
      },
      receivedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      from: true,
      to: true,
    },
    orderBy: {
      receivedAt: 'desc',
    },
  });

  if (emails.length === 0) {
    return {
      stats: { total: 0, unread: 0, important: 0, requiresReply: 0, attachments: 0 },
      briefing: null,
    };
  }

  const unreadCount = emails.filter(e => e.sysLabels.includes('UNREAD')).length;
  const importantCount = emails.filter(e => e.sysLabels.includes('IMPORTANT')).length;
  const attachmentsCount = emails.filter(e => e.hasAttachments).length;

  const stats = {
    total: emails.length,
    unread: unreadCount,
    important: importantCount,
    requiresReply: emails.filter(e => e.sysLabels.includes('IMPORTANT')).length, // Appx mapping
    attachments: attachmentsCount,
  };

  const payload = emails.map(e => ({
    id: e.id,
    threadId: e.threadId,
    subject: e.subject,
    from: e.from.address,
    date: e.receivedAt.toISOString(),
    snippet: e.bodySnippet,
  }));

  const prompt = `You are an executive AI assistant. Analyze the following emails received today and generate a structured daily briefing.
Emails:
${JSON.stringify(payload, null, 2)}`;

  const { object } = await generateObject({
    model: openai("gpt-4o") as any,
    schema: briefingSchema,
    prompt: prompt,
  });

  return {
    stats,
    briefing: object,
  };
}
