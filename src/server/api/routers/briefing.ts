import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { generateDailyBriefing } from "@/lib/briefing-service";

export const briefingRouter = createTRPCRouter({
  getDailyBriefing: protectedProcedure
    .input(z.object({ 
      accountId: z.string(),
      date: z.string().optional()
    }))
    .query(async ({ input }) => {
      return await generateDailyBriefing(input.accountId, input.date);
    }),
});
