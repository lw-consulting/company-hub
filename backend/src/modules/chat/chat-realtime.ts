type Subscriber = (event: Record<string, unknown>) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribeToChatEvents(userId: string, subscriber: Subscriber) {
  const set = subscribers.get(userId) ?? new Set<Subscriber>();
  set.add(subscriber);
  subscribers.set(userId, set);

  return () => {
    const current = subscribers.get(userId);
    if (!current) {
      return;
    }
    current.delete(subscriber);
    if (current.size === 0) {
      subscribers.delete(userId);
    }
  };
}

export function publishChatEvent(userIds: string[], event: Record<string, unknown>) {
  for (const userId of new Set(userIds)) {
    const userSubscribers = subscribers.get(userId);
    if (!userSubscribers) {
      continue;
    }

    for (const subscriber of userSubscribers) {
      subscriber(event);
    }
  }
}
