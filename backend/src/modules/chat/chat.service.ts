import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import {
  chatAttachments,
  chatConversations,
  chatMessages,
  chatParticipants,
  fileUploads,
  users,
} from '../../db/schema/index.js';
import { createNotification } from '../../lib/notification.service.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { publishChatEvent } from './chat-realtime.js';

const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export interface ChatUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  department: string | null;
  position: string | null;
}

export interface ChatAttachmentPayload {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface ChatMessagePayload {
  id: string;
  conversationId: string;
  content: string;
  messageType: string;
  createdAt: string;
  editedAt: string | null;
  sender: ChatUserSummary;
  attachments: ChatAttachmentPayload[];
}

function mapUserSummary(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  department: string | null;
  position: string | null;
}): ChatUserSummary {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    department: user.department,
    position: user.position,
  };
}

async function assertConversationAccess(conversationId: string, userId: string, orgId: string) {
  const [participant] = await db
    .select({
      conversationId: chatParticipants.conversationId,
      role: chatParticipants.role,
      type: chatConversations.type,
      title: chatConversations.title,
      orgId: chatConversations.orgId,
    })
    .from(chatParticipants)
    .innerJoin(chatConversations, eq(chatConversations.id, chatParticipants.conversationId))
    .where(
      and(
        eq(chatParticipants.conversationId, conversationId),
        eq(chatParticipants.userId, userId),
        eq(chatConversations.orgId, orgId)
      )
    )
    .limit(1);

  if (!participant) {
    throw new ForbiddenError('Kein Zugriff auf diese Unterhaltung');
  }

  return participant;
}

async function getConversationParticipantIds(conversationId: string) {
  const rows = await db
    .select({ userId: chatParticipants.userId })
    .from(chatParticipants)
    .where(eq(chatParticipants.conversationId, conversationId));

  return rows.map((row) => row.userId);
}

async function getConversationParticipants(conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return [];
  }

  return db
    .select({
      conversationId: chatParticipants.conversationId,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      department: users.department,
      position: users.position,
      role: chatParticipants.role,
      joinedAt: chatParticipants.joinedAt,
    })
    .from(chatParticipants)
    .innerJoin(users, eq(users.id, chatParticipants.userId))
    .where(inArray(chatParticipants.conversationId, conversationIds))
    .orderBy(asc(users.firstName), asc(users.lastName));
}

async function hydrateMessages(messageRows: Array<{
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  createdAt: Date;
  editedAt: Date | null;
}>) {
  if (messageRows.length === 0) {
    return [];
  }

  const senderIds = [...new Set(messageRows.map((message) => message.senderId))];
  const messageIds = messageRows.map((message) => message.id);

  const [senderRows, attachmentRows] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        department: users.department,
        position: users.position,
      })
      .from(users)
      .where(inArray(users.id, senderIds)),
    db
      .select()
      .from(chatAttachments)
      .where(inArray(chatAttachments.messageId, messageIds)),
  ]);

  const senderMap = new Map(senderRows.map((row) => [row.id, mapUserSummary(row)]));
  const attachmentMap = new Map<string, ChatAttachmentPayload[]>();

  for (const attachment of attachmentRows) {
    const list = attachmentMap.get(attachment.messageId) ?? [];
    list.push({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      url: attachment.url,
    });
    attachmentMap.set(attachment.messageId, list);
  }

  return messageRows.map((message) => ({
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    messageType: message.messageType,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    sender: senderMap.get(message.senderId)!,
    attachments: attachmentMap.get(message.id) ?? [],
  }));
}

export async function listChatUsers(orgId: string, currentUserId: string) {
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      department: users.department,
      position: users.position,
    })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.isActive, true)))
    .orderBy(asc(users.firstName), asc(users.lastName));

  return rows
    .filter((row) => row.id !== currentUserId)
    .map(mapUserSummary);
}

export async function listConversations(userId: string, orgId: string) {
  const participantRows = await db
    .select({
      conversationId: chatParticipants.conversationId,
      lastReadAt: chatParticipants.lastReadAt,
      role: chatParticipants.role,
      isMuted: chatParticipants.isMuted,
    })
    .from(chatParticipants)
    .innerJoin(chatConversations, eq(chatConversations.id, chatParticipants.conversationId))
    .where(and(eq(chatParticipants.userId, userId), eq(chatConversations.orgId, orgId)));

  const conversationIds = participantRows.map((row) => row.conversationId);
  if (conversationIds.length === 0) {
    return [];
  }

  const [conversationRows, allParticipants, allMessageRows] = await Promise.all([
    db
      .select()
      .from(chatConversations)
      .where(inArray(chatConversations.id, conversationIds))
      .orderBy(desc(chatConversations.lastMessageAt)),
    getConversationParticipants(conversationIds),
    db
      .select()
      .from(chatMessages)
      .where(inArray(chatMessages.conversationId, conversationIds))
      .orderBy(desc(chatMessages.createdAt)),
  ]);

  const participantState = new Map(participantRows.map((row) => [row.conversationId, row]));
  const participantsByConversation = new Map<string, ReturnType<typeof mapUserSummary>[]>();

  for (const participant of allParticipants) {
    const list = participantsByConversation.get(participant.conversationId) ?? [];
    list.push(
      mapUserSummary({
        id: participant.userId,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: participant.email,
        avatarUrl: participant.avatarUrl,
        department: participant.department,
        position: participant.position,
      })
    );
    participantsByConversation.set(participant.conversationId, list);
  }

  const latestMessagePerConversation = new Map<string, (typeof allMessageRows)[number]>();
  for (const message of allMessageRows) {
    if (!latestMessagePerConversation.has(message.conversationId)) {
      latestMessagePerConversation.set(message.conversationId, message);
    }
  }

  const lastMessages = await hydrateMessages([...latestMessagePerConversation.values()]);
  const lastMessageMap = new Map(lastMessages.map((message) => [message.conversationId, message]));

  return conversationRows.map((conversation) => {
    const participants = participantsByConversation.get(conversation.id) ?? [];
    const otherParticipants = participants.filter((participant) => participant.id !== userId);
    const state = participantState.get(conversation.id)!;
    const unreadCount = allMessageRows.filter((row) => (
      row.conversationId === conversation.id &&
      row.senderId !== userId &&
      (!state.lastReadAt || row.createdAt > state.lastReadAt)
    )).length;

    return {
      id: conversation.id,
      type: conversation.type,
      title:
        conversation.type === 'group'
          ? conversation.title || 'Gruppenchat'
          : otherParticipants.map((participant) => `${participant.firstName} ${participant.lastName}`).join(', '),
      participants,
      lastMessage: lastMessageMap.get(conversation.id) ?? null,
      unreadCount,
      isMuted: state.isMuted,
      role: state.role,
      updatedAt: conversation.updatedAt.toISOString(),
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    };
  });
}

export async function getOrCreateDirectConversation(userId: string, orgId: string, targetUserId: string) {
  if (targetUserId === userId) {
    throw new ValidationError({ userId: ['Ein Chat mit dir selbst ist nicht erlaubt'] });
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId), eq(users.isActive, true)))
    .limit(1);

  if (!targetUser) {
    throw new NotFoundError('Benutzer nicht gefunden');
  }

  const existing = await db
    .select({
      conversationId: chatParticipants.conversationId,
    })
    .from(chatParticipants)
    .innerJoin(chatConversations, eq(chatConversations.id, chatParticipants.conversationId))
    .where(
      and(
        eq(chatConversations.type, 'direct'),
        eq(chatConversations.orgId, orgId),
        inArray(chatParticipants.userId, [userId, targetUserId])
      )
    );

  const possibleConversationIds = [...new Set(existing.map((row) => row.conversationId))];
  if (possibleConversationIds.length > 0) {
    const participants = await db
      .select({ conversationId: chatParticipants.conversationId, userId: chatParticipants.userId })
      .from(chatParticipants)
      .where(inArray(chatParticipants.conversationId, possibleConversationIds));

    const conversationMembership = new Map<string, Set<string>>();
    for (const row of participants) {
      const set = conversationMembership.get(row.conversationId) ?? new Set<string>();
      set.add(row.userId);
      conversationMembership.set(row.conversationId, set);
    }

    for (const [conversationId, memberIds] of conversationMembership.entries()) {
      if (memberIds.size === 2 && memberIds.has(userId) && memberIds.has(targetUserId)) {
        return conversationId;
      }
    }
  }

  const [conversation] = await db
    .insert(chatConversations)
    .values({
      orgId,
      type: 'direct',
      createdBy: userId,
    })
    .returning();

  await db.insert(chatParticipants).values([
    { conversationId: conversation.id, userId, role: 'admin', lastReadAt: new Date() },
    { conversationId: conversation.id, userId: targetUserId, role: 'member' },
  ]);

  return conversation.id;
}

export async function createGroupConversation(
  userId: string,
  orgId: string,
  input: { title: string; participantIds: string[] }
) {
  const participantIds = [...new Set(input.participantIds.filter(Boolean).filter((id) => id !== userId))];

  if (participantIds.length === 0) {
    throw new ValidationError({ participantIds: ['Mindestens eine weitere Person auswählen'] });
  }

  if (!input.title?.trim()) {
    throw new ValidationError({ title: ['Ein Gruppenname ist erforderlich'] });
  }

  const validUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.isActive, true), inArray(users.id, participantIds)));

  if (validUsers.length !== participantIds.length) {
    throw new ValidationError({ participantIds: ['Ein oder mehrere Benutzer sind ungültig'] });
  }

  const [conversation] = await db
    .insert(chatConversations)
    .values({
      orgId,
      type: 'group',
      title: input.title.trim(),
      createdBy: userId,
    })
    .returning();

  await db.insert(chatParticipants).values([
    { conversationId: conversation.id, userId, role: 'admin', lastReadAt: new Date() },
    ...participantIds.map((participantId) => ({
      conversationId: conversation.id,
      userId: participantId,
      role: 'member',
    })),
  ]);

  return conversation.id;
}

export async function listMessages(
  conversationId: string,
  userId: string,
  orgId: string,
  options?: { before?: string; limit?: number }
) {
  await assertConversationAccess(conversationId, userId, orgId);

  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        options?.before ? lt(chatMessages.createdAt, new Date(options.before)) : undefined
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(Math.min(options?.limit ?? 50, 100));

  const hydrated = await hydrateMessages([...rows].reverse());
  await markConversationRead(conversationId, userId, orgId);
  return hydrated;
}

async function buildAndPublishConversationPayload(conversationId: string, message: ChatMessagePayload, actorUserId: string) {
  const participantIds = await getConversationParticipantIds(conversationId);
  publishChatEvent(participantIds, {
    type: 'message.created',
    conversationId,
    message,
  });

  await Promise.all(
    participantIds
      .filter((participantId) => participantId !== actorUserId)
      .map((participantId) =>
        createNotification({
          userId: participantId,
          type: 'chat_message',
          title: `${message.sender.firstName} ${message.sender.lastName}`,
          body: message.content ? message.content.slice(0, 140) : 'Hat einen Anhang gesendet',
          link: '/chat',
          moduleId: 'chat',
          sendEmailNotification: false,
        })
      )
  );
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  orgId: string,
  input: { content?: string }
) {
  await assertConversationAccess(conversationId, userId, orgId);

  const content = input.content?.trim() ?? '';
  if (!content) {
    throw new ValidationError({ content: ['Nachricht darf nicht leer sein'] });
  }

  const [message] = await db
    .insert(chatMessages)
    .values({
      conversationId,
      senderId: userId,
      content,
      messageType: 'text',
    })
    .returning();

  await Promise.all([
    db
      .update(chatConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId)),
    db
      .update(chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(chatParticipants.conversationId, conversationId), eq(chatParticipants.userId, userId))),
  ]);

  const [hydrated] = await hydrateMessages([message]);
  await buildAndPublishConversationPayload(conversationId, hydrated, userId);
  return hydrated;
}

export async function uploadAttachmentMessage(
  conversationId: string,
  userId: string,
  orgId: string,
  file: { filename: string; mimetype: string; data: Buffer },
  content?: string
) {
  await assertConversationAccess(conversationId, userId, orgId);

  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
    throw new ValidationError({ file: [`Dateityp ${file.mimetype} ist nicht erlaubt`] });
  }
  if (file.data.length > MAX_ATTACHMENT_SIZE) {
    throw new ValidationError({ file: ['Maximale Dateigröße: 25MB'] });
  }

  const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedFilename = `${randomUUID()}-${safeName}`;
  const dir = path.join(env.UPLOAD_DIR, 'chat');
  const storageKey = path.join(dir, storedFilename);

  await mkdir(dir, { recursive: true });
  await writeFile(storageKey, file.data);

  const [message] = await db
    .insert(chatMessages)
    .values({
      conversationId,
      senderId: userId,
      content: content?.trim() || '',
      messageType: 'attachment',
    })
    .returning();

  const url = `/uploads/chat/${storedFilename}`;

  await Promise.all([
    db.insert(chatAttachments).values({
      messageId: message.id,
      orgId,
      uploadedBy: userId,
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.data.length,
      url,
      storageKey,
    }),
    db.insert(fileUploads).values({
      orgId,
      uploadedBy: userId,
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.data.length,
      storageKey,
      entityType: 'chat',
      entityId: message.id,
    }),
    db
      .update(chatConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId)),
    db
      .update(chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(chatParticipants.conversationId, conversationId), eq(chatParticipants.userId, userId))),
  ]);

  const [hydrated] = await hydrateMessages([message]);
  await buildAndPublishConversationPayload(conversationId, hydrated, userId);
  return hydrated;
}

export async function markConversationRead(conversationId: string, userId: string, orgId: string) {
  await assertConversationAccess(conversationId, userId, orgId);

  await db
    .update(chatParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatParticipants.conversationId, conversationId), eq(chatParticipants.userId, userId)));

  const participantIds = await getConversationParticipantIds(conversationId);
  publishChatEvent(participantIds, {
    type: 'conversation.read',
    conversationId,
    userId,
    readAt: new Date().toISOString(),
  });
}

export async function renameConversation(conversationId: string, userId: string, orgId: string, title: string) {
  const access = await assertConversationAccess(conversationId, userId, orgId);
  if (access.type !== 'group') {
    throw new ValidationError({ title: ['Nur Gruppenchats können umbenannt werden'] });
  }
  if (access.role !== 'admin') {
    throw new ForbiddenError('Nur Gruppen-Admins dürfen den Titel ändern');
  }

  if (!title.trim()) {
    throw new ValidationError({ title: ['Titel darf nicht leer sein'] });
  }

  await db
    .update(chatConversations)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  const participantIds = await getConversationParticipantIds(conversationId);
  publishChatEvent(participantIds, {
    type: 'conversation.updated',
    conversationId,
    title: title.trim(),
  });
}
