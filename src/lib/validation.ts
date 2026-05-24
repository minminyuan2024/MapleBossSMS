import { z } from "zod";

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{9,14}$/, "Use international format, e.g. +15551234567");

const hm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24h), e.g. 20:00");

export const bossScheduleSchema = z.object({
  id: z.string().min(1).max(120),
  bossName: z.string().min(1).max(120),
  wikiTitle: z.string().min(1).max(200),
  bossId: z.string().min(1).max(120),
  reminderWeekday: z.number().int().min(0).max(6),
  reminderTimeLocal: hm,
});

export const subscribeSchema = z.object({
  phone: e164,
  timezone: z.string().min(1).max(100),
  schedules: z
    .array(bossScheduleSchema)
    .min(1, "Add at least one boss with a reminder time."),
  subscriptionId: z.string().uuid().optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type BossScheduleInput = z.infer<typeof bossScheduleSchema>;
