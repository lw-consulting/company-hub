import webpush from 'web-push';
import { eq, and } from 'drizzle-orm';
import type { NotificationCategory } from '@company-hub/shared';
import { env } from '../config/env.js';
import { db } from '../config/database.js';
import { notificationDevices } from '../db/schema/notification-devices.js';

let vapidConfigured = false;

function ensureWebPushConfigured() {
  if (vapidConfigured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

interface PushPayloadInput {
  title: string;
  body: string;
  url?: string;
  category: NotificationCategory;
}

export function getPublicPushConfig() {
  return {
    webPushEnabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
    expoPushEnabled: Boolean(env.EXPO_ACCESS_TOKEN),
    expoProjectId: env.EXPO_PROJECT_ID || null,
  };
}

export async function sendPushNotifications(userId: string, payload: PushPayloadInput) {
  const devices = await db
    .select()
    .from(notificationDevices)
    .where(and(eq(notificationDevices.userId, userId), eq(notificationDevices.enabled, true)));

  if (devices.length === 0) return;

  await Promise.all(
    devices.map(async (device) => {
      try {
        if (device.platform === 'web') {
          if (!ensureWebPushConfigured()) return;

          await webpush.sendNotification(
            device.subscription as webpush.PushSubscription,
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              url: payload.url,
              category: payload.category,
            }),
          );
        }

        if (device.platform === 'expo') {
          await sendExpoPush(device.endpoint, payload);
        }

        await db
          .update(notificationDevices)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(eq(notificationDevices.id, device.id));
      } catch (error: any) {
        console.error('[Push] Failed to send notification', {
          userId,
          deviceId: device.id,
          platform: device.platform,
          error: error?.message || String(error),
        });

        if (String(error?.statusCode || '').startsWith('4') || error?.statusCode === 410) {
          await db
            .update(notificationDevices)
            .set({ enabled: false, updatedAt: new Date() })
            .where(eq(notificationDevices.id, device.id));
        }
      }
    }),
  );
}

async function sendExpoPush(token: string, payload: PushPayloadInput) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: {
        url: payload.url || '/',
        category: payload.category,
      },
    }),
  });
}
