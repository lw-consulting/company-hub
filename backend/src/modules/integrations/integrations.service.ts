import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../config/database.js';
import { webhooks, apiKeys, webhookDeliveries } from '../../db/schema/integrations.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { NotFoundError } from '../../lib/errors.js';

// ============== WEBHOOKS ==============

const WEBHOOK_EVENTS = [
  'user.created', 'user.updated',
  'leave.requested', 'leave.approved', 'leave.rejected',
  'task.created', 'task.updated', 'task.completed',
  'time.clock_in', 'time.clock_out',
  'community.post_created',
  'course.enrolled', 'course.completed',
];

export { WEBHOOK_EVENTS };

export async function listWebhooks(orgId: string) {
  return db.select({
    id: webhooks.id,
    name: webhooks.name,
    url: webhooks.url,
    events: webhooks.events,
    isActive: webhooks.isActive,
    lastTriggeredAt: webhooks.lastTriggeredAt,
    failCount: webhooks.failCount,
    createdAt: webhooks.createdAt,
  }).from(webhooks).where(eq(webhooks.orgId, orgId)).orderBy(desc(webhooks.createdAt));
}

export async function createWebhook(orgId: string, userId: string, data: { name: string; url: string; events: string[] }) {
  const secret = crypto.randomBytes(32).toString('hex');

  const [webhook] = await db.insert(webhooks).values({
    orgId,
    name: data.name,
    url: data.url,
    events: data.events,
    secretEncrypted: encrypt(secret),
    createdBy: userId,
  }).returning();

  return { ...webhook, secret }; // Return secret once on creation
}

export async function updateWebhook(webhookId: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.events !== undefined) updateData.events = data.events;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [updated] = await db.update(webhooks).set(updateData).where(eq(webhooks.id, webhookId)).returning();
  if (!updated) throw new NotFoundError('Webhook nicht gefunden');
  return updated;
}

export async function deleteWebhook(webhookId: string) {
  await db.delete(webhooks).where(eq(webhooks.id, webhookId));
}

export async function getWebhookDeliveries(webhookId: string, limit = 20) {
  return db.select().from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.deliveredAt))
    .limit(limit);
}

/** Dispatch event to all matching webhooks */
export async function dispatchWebhookEvent(orgId: string, event: string, payload: any) {
  const activeWebhooks = await db.select().from(webhooks)
    .where(and(eq(webhooks.orgId, orgId), eq(webhooks.isActive, true)));

  for (const webhook of activeWebhooks) {
    const events = (webhook.events as string[]) || [];
    if (!events.includes(event) && !events.includes('*')) continue;

    try {
      const secret = decrypt(webhook.secretEncrypted);
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        event,
        payload,
        statusCode: String(response.status),
        success: response.ok,
      });

      await db.update(webhooks).set({
        lastTriggeredAt: new Date(),
        failCount: response.ok ? '0' : String(Number(webhook.failCount) + 1),
      }).where(eq(webhooks.id, webhook.id));

    } catch (err: any) {
      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        event,
        payload,
        statusCode: '0',
        responseBody: err.message,
        success: false,
      });

      await db.update(webhooks).set({
        failCount: String(Number(webhook.failCount) + 1),
      }).where(eq(webhooks.id, webhook.id));
    }
  }
}

// ============== API KEYS ==============

const AVAILABLE_SCOPES = [
  'read:users', 'write:users',
  'read:tasks', 'write:tasks',
  'read:leave', 'write:leave',
  'read:time-tracking', 'write:time-tracking',
  'read:community', 'write:community',
  'read:courses', 'write:courses',
  'read:calendar', 'write:calendar',
];

export { AVAILABLE_SCOPES };

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function listApiKeys(orgId: string) {
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes,
    isActive: apiKeys.isActive,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.orgId, orgId)).orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(orgId: string, userId: string, data: { name: string; scopes: string[]; expiresAt?: string }) {
  // Generate key: ch_live_ + 32 random chars
  const rawKey = `ch_live_${crypto.randomBytes(24).toString('base64url')}`;
  const keyPrefix = rawKey.substring(0, 12);
  const keyHashValue = hashApiKey(rawKey);

  const [key] = await db.insert(apiKeys).values({
    orgId,
    name: data.name,
    keyHash: keyHashValue,
    keyPrefix,
    scopes: data.scopes,
    createdBy: userId,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
  }).returning();

  return { ...key, key: rawKey }; // Return raw key once on creation
}

export async function revokeApiKey(keyId: string) {
  await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, keyId));
}

export async function deleteApiKey(keyId: string) {
  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
}

/** Validate an API key from request header */
export async function validateApiKey(rawKey: string): Promise<{ orgId: string; scopes: string[] } | null> {
  const keyHashValue = hashApiKey(rawKey);

  const [key] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHashValue), eq(apiKeys.isActive, true)))
    .limit(1);

  if (!key) return null;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;

  // Update last used
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  return { orgId: key.orgId, scopes: (key.scopes as string[]) || [] };
}
