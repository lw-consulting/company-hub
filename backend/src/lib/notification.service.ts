import { db } from '../config/database.js';
import { notificationDevices } from '../db/schema/notification-devices.js';
import { notifications } from '../db/schema/notifications.js';
import { users } from '../db/schema/users.js';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from './email.js';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  isChannelEnabled,
  mergeNotificationPreferences,
  normalizeNotificationPreferences,
} from './notification-preferences.js';
import { getPublicPushConfig, sendPushNotifications } from './push.js';
import type {
  NotificationCategory,
  NotificationPreferences,
} from '@company-hub/shared';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  moduleId?: string;
  category?: NotificationCategory;
  sendEmailNotification?: boolean;
  sendPushNotification?: boolean;
}

const MODULE_CATEGORY_MAP: Record<string, NotificationCategory> = {
  chat: 'chat',
  community: 'community',
  tasks: 'tasks',
  calendar: 'calendar',
  leave: 'leave',
  'time-tracking': 'time_tracking',
  'ai-assistants': 'ai_assistants',
};

function getCategory(input: CreateNotificationInput): NotificationCategory {
  if (input.category) return input.category;
  if (input.moduleId && MODULE_CATEGORY_MAP[input.moduleId]) return MODULE_CATEGORY_MAP[input.moduleId];
  return 'system';
}

/**
 * Central notification service - creates in-app notification
 * and optionally sends email.
 */
export async function createNotification(input: CreateNotificationInput) {
  const category = getCategory(input);
  const [user] = await db
    .select({
      email: users.email,
      notificationPreferences: users.notificationPreferences,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) return null;

  let notification = null;

  if (isChannelEnabled(user.notificationPreferences, category, 'inApp')) {
    [notification] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link || null,
        moduleId: input.moduleId || null,
      })
      .returning();
  }

  if (
    input.sendEmailNotification !== false &&
    isChannelEnabled(user.notificationPreferences, category, 'email')
  ) {
    await sendEmail({
      to: user.email,
      subject: input.title,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px;">
          <h2 style="color: #1e293b;">${input.title}</h2>
          <p style="color: #64748b;">${input.body}</p>
          ${input.link ? `<p><a href="${input.link}" style="color: #6366f1;">Im Portal ansehen</a></p>` : ''}
        </div>
      `,
    });
  }

  if (
    input.sendPushNotification !== false &&
    isChannelEnabled(user.notificationPreferences, category, 'push')
  ) {
    await sendPushNotifications(input.userId, {
      title: input.title,
      body: input.body,
      url: input.link,
      category,
    });
  }

  return notification;
}

export async function listNotificationDevices(userId: string) {
  return db
    .select({
      id: notificationDevices.id,
      platform: notificationDevices.platform,
      endpoint: notificationDevices.endpoint,
      enabled: notificationDevices.enabled,
      createdAt: notificationDevices.createdAt,
      updatedAt: notificationDevices.updatedAt,
    })
    .from(notificationDevices)
    .where(eq(notificationDevices.userId, userId));
}

export async function upsertNotificationDevice(input: {
  userId: string;
  orgId: string;
  platform: 'web' | 'expo';
  endpoint: string;
  subscription: Record<string, any>;
  userAgent?: string;
}) {
  const [existing] = await db
    .select({ id: notificationDevices.id })
    .from(notificationDevices)
    .where(
      and(
        eq(notificationDevices.userId, input.userId),
        eq(notificationDevices.endpoint, input.endpoint),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(notificationDevices)
      .set({
        platform: input.platform,
        subscription: input.subscription,
        userAgent: input.userAgent || null,
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(notificationDevices.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(notificationDevices)
    .values({
      userId: input.userId,
      orgId: input.orgId,
      platform: input.platform,
      endpoint: input.endpoint,
      subscription: input.subscription,
      userAgent: input.userAgent || null,
    })
    .returning();

  return created;
}

export async function updateNotificationDevice(
  userId: string,
  deviceId: string,
  data: { enabled: boolean },
) {
  const [device] = await db
    .update(notificationDevices)
    .set({ enabled: data.enabled, updatedAt: new Date() })
    .where(and(eq(notificationDevices.id, deviceId), eq(notificationDevices.userId, userId)))
    .returning({
      id: notificationDevices.id,
      platform: notificationDevices.platform,
      endpoint: notificationDevices.endpoint,
      enabled: notificationDevices.enabled,
      createdAt: notificationDevices.createdAt,
      updatedAt: notificationDevices.updatedAt,
    });

  return device || null;
}

export function getDefaultNotificationPreferences() {
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function normalizeUserNotificationPreferences(preferences: unknown) {
  return normalizeNotificationPreferences(preferences);
}

export function mergeUserNotificationPreferences(
  current: unknown,
  update: Partial<NotificationPreferences> | undefined,
) {
  return mergeNotificationPreferences(current, update);
}

export function getPushDeliveryConfig() {
  return getPublicPushConfig();
}
