import type {
  NotificationCategory,
  NotificationCategoryPreference,
  NotificationPreferences,
} from '@company-hub/shared';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  chat: { inApp: true, email: false, push: true },
  community: { inApp: true, email: false, push: false },
  tasks: { inApp: true, email: true, push: true },
  calendar: { inApp: true, email: true, push: true },
  leave: { inApp: true, email: true, push: true },
  time_tracking: { inApp: true, email: true, push: false },
  ai_assistants: { inApp: true, email: false, push: false },
  system: { inApp: true, email: true, push: true },
};

const CATEGORY_KEYS = Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as NotificationCategory[];
const CHANNEL_KEYS = ['inApp', 'email', 'push'] as const;

export function normalizeNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  const source = typeof value === 'object' && value ? (value as Record<string, any>) : {};
  const result = {} as NotificationPreferences;

  for (const category of CATEGORY_KEYS) {
    const base = DEFAULT_NOTIFICATION_PREFERENCES[category];
    const raw = source[category];
    const normalized = {} as NotificationCategoryPreference;

    for (const channel of CHANNEL_KEYS) {
      normalized[channel] =
        typeof raw?.[channel] === 'boolean' ? raw[channel] : base[channel];
    }

    result[category] = normalized;
  }

  return result;
}

export function mergeNotificationPreferences(
  current: unknown,
  update: Partial<NotificationPreferences> | undefined,
): NotificationPreferences {
  const base = normalizeNotificationPreferences(current);
  if (!update) return base;

  const result = { ...base } as NotificationPreferences;

  for (const category of CATEGORY_KEYS) {
    const categoryUpdate = update[category];
    if (!categoryUpdate) continue;

    result[category] = {
      ...base[category],
      ...Object.fromEntries(
        CHANNEL_KEYS
          .filter((channel) => typeof categoryUpdate[channel] === 'boolean')
          .map((channel) => [channel, categoryUpdate[channel]]),
      ),
    };
  }

  return result;
}

export function isChannelEnabled(
  preferences: unknown,
  category: NotificationCategory,
  channel: 'inApp' | 'email' | 'push',
) {
  const normalized = normalizeNotificationPreferences(preferences);
  return normalized[category][channel];
}
