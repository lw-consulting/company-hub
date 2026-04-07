import { eq } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { organizations } from '../../db/schema/organizations.js';
import { NotFoundError } from '../../lib/errors.js';
import type { UpdateOrganizationInput } from '@company-hub/shared';

export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) throw new NotFoundError('Organisation nicht gefunden');
  return org;
}

export async function updateOrganization(orgId: string, input: UpdateOrganizationInput) {
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
  if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
  if (input.secondaryColor !== undefined) updateData.secondaryColor = input.secondaryColor;
  if (input.accentColor !== undefined) updateData.accentColor = input.accentColor;
  if (input.timezone !== undefined) updateData.timezone = input.timezone;
  if (input.locale !== undefined) updateData.locale = input.locale;
  if (input.coreHoursStart !== undefined) updateData.coreHoursStart = input.coreHoursStart;
  if (input.coreHoursEnd !== undefined) updateData.coreHoursEnd = input.coreHoursEnd;
  if (input.breakAfterMinutes !== undefined) updateData.breakAfterMinutes = input.breakAfterMinutes;
  if (input.breakDurationMinutes !== undefined) updateData.breakDurationMinutes = input.breakDurationMinutes;

  const [updated] = await db
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, orgId))
    .returning();

  if (!updated) throw new NotFoundError('Organisation nicht gefunden');
  return updated;
}

/** Public branding endpoint (no auth needed for theming) */
export async function getOrganizationBranding(orgId: string) {
  const org = await getOrganization(orgId);
  return {
    name: org.name,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    secondaryColor: org.secondaryColor,
    accentColor: org.accentColor,
    locale: org.locale,
  };
}
