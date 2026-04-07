import { db } from '../config/database.js';
import { notifications } from '../db/schema/notifications.js';
import { users } from '../db/schema/users.js';
import { eq } from 'drizzle-orm';
import { sendEmail } from './email.js';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  moduleId?: string;
  sendEmailNotification?: boolean;
}

/**
 * Central notification service - creates in-app notification
 * and optionally sends email.
 */
export async function createNotification(input: CreateNotificationInput) {
  // Create in-app notification
  const [notification] = await db
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

  // Optionally send email
  if (input.sendEmailNotification !== false) {
    const [user] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (user) {
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
  }

  return notification;
}
