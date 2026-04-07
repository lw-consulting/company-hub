import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { crmContacts, crmCompanies, crmDeals, crmActivities } from '../../db/schema/crm.js';
import { users } from '../../db/schema/users.js';
import { NotFoundError } from '../../lib/errors.js';

// ============== CONTACTS ==============

export async function listContacts(orgId: string, opts: { page?: number; search?: string } = {}) {
  const page = opts.page || 1;
  const offset = (page - 1) * 25;

  const data = await db.select({
    id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName,
    email: crmContacts.email, phone: crmContacts.phone, position: crmContacts.position,
    companyId: crmContacts.companyId, tags: crmContacts.tags, createdAt: crmContacts.createdAt,
    companyName: crmCompanies.name,
  }).from(crmContacts)
    .leftJoin(crmCompanies, eq(crmContacts.companyId, crmCompanies.id))
    .where(eq(crmContacts.orgId, orgId))
    .orderBy(desc(crmContacts.createdAt))
    .limit(25).offset(offset);

  return data;
}

export async function createContact(orgId: string, userId: string, data: any) {
  const [contact] = await db.insert(crmContacts).values({
    orgId, ownerId: userId, ...data,
  }).returning();
  return contact;
}

export async function updateContact(id: string, data: any) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  for (const f of ['firstName', 'lastName', 'email', 'phone', 'position', 'companyId', 'notes', 'tags']) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  const [updated] = await db.update(crmContacts).set(updateData).where(eq(crmContacts.id, id)).returning();
  if (!updated) throw new NotFoundError('Kontakt nicht gefunden');
  return updated;
}

export async function deleteContact(id: string) {
  await db.delete(crmContacts).where(eq(crmContacts.id, id));
}

// ============== COMPANIES ==============

export async function listCompanies(orgId: string) {
  return db.select().from(crmCompanies).where(eq(crmCompanies.orgId, orgId)).orderBy(crmCompanies.name);
}

export async function createCompany(orgId: string, userId: string, data: any) {
  const [company] = await db.insert(crmCompanies).values({ orgId, ownerId: userId, ...data }).returning();
  return company;
}

export async function updateCompany(id: string, data: any) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  for (const f of ['name', 'website', 'industry', 'size', 'address', 'phone', 'notes']) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  const [updated] = await db.update(crmCompanies).set(updateData).where(eq(crmCompanies.id, id)).returning();
  if (!updated) throw new NotFoundError('Unternehmen nicht gefunden');
  return updated;
}

export async function deleteCompany(id: string) {
  await db.delete(crmCompanies).where(eq(crmCompanies.id, id));
}

// ============== DEALS ==============

const PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
export { PIPELINE_STAGES };

export async function listDeals(orgId: string, opts: { stage?: string } = {}) {
  const conditions = [eq(crmDeals.orgId, orgId)];
  if (opts.stage) conditions.push(eq(crmDeals.stage, opts.stage));

  return db.select({
    id: crmDeals.id, title: crmDeals.title, value: crmDeals.value, currency: crmDeals.currency,
    stage: crmDeals.stage, probability: crmDeals.probability,
    contactId: crmDeals.contactId, companyId: crmDeals.companyId,
    expectedCloseDate: crmDeals.expectedCloseDate, createdAt: crmDeals.createdAt,
    contactName: sql<string>`concat(${crmContacts.firstName}, ' ', ${crmContacts.lastName})`,
    companyName: crmCompanies.name,
  }).from(crmDeals)
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(...conditions))
    .orderBy(desc(crmDeals.createdAt));
}

export async function createDeal(orgId: string, userId: string, data: any) {
  const [deal] = await db.insert(crmDeals).values({ orgId, ownerId: userId, ...data }).returning();
  return deal;
}

export async function updateDeal(id: string, data: any) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  for (const f of ['title', 'value', 'currency', 'stage', 'probability', 'contactId', 'companyId', 'expectedCloseDate', 'notes']) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (data.stage === 'won' || data.stage === 'lost') updateData.closedAt = new Date();
  const [updated] = await db.update(crmDeals).set(updateData).where(eq(crmDeals.id, id)).returning();
  if (!updated) throw new NotFoundError('Deal nicht gefunden');
  return updated;
}

export async function deleteDeal(id: string) {
  await db.delete(crmDeals).where(eq(crmDeals.id, id));
}

export async function getPipelineSummary(orgId: string) {
  const deals = await listDeals(orgId);
  const summary = PIPELINE_STAGES.map(stage => ({
    stage,
    count: deals.filter(d => d.stage === stage).length,
    totalValue: deals.filter(d => d.stage === stage).reduce((sum, d) => sum + parseFloat(String(d.value || '0')), 0),
  }));
  return summary;
}

// ============== ACTIVITIES ==============

export async function listActivities(orgId: string, opts: { contactId?: string; dealId?: string } = {}) {
  const conditions = [eq(crmActivities.orgId, orgId)];
  if (opts.contactId) conditions.push(eq(crmActivities.contactId, opts.contactId));
  if (opts.dealId) conditions.push(eq(crmActivities.dealId, opts.dealId));

  return db.select({
    id: crmActivities.id, type: crmActivities.type, title: crmActivities.title,
    description: crmActivities.description, activityDate: crmActivities.activityDate,
    createdByName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
  }).from(crmActivities)
    .leftJoin(users, eq(crmActivities.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(crmActivities.activityDate));
}

export async function createActivity(orgId: string, userId: string, data: any) {
  const [activity] = await db.insert(crmActivities).values({
    orgId, createdBy: userId, ...data,
  }).returning();
  return activity;
}
