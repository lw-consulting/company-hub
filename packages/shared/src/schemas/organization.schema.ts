import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültiger Hex-Farbcode');
const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM');

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  timezone: z.string().max(50).optional(),
  locale: z.enum(['de', 'en']).optional(),
  coreHoursStart: timeString.nullable().optional(),
  coreHoursEnd: timeString.nullable().optional(),
  breakAfterMinutes: z.number().int().min(0).max(720).optional(),
  breakDurationMinutes: z.number().int().min(0).max(120).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
