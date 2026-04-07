import { pgTable, uuid, text, boolean, timestamp, index, jsonb, check } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const communityPosts = pgTable(
  'community_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    mediaUrls: jsonb('media_urls').$type<string[]>().default([]),
    isPinned: boolean('is_pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_community_posts_org').on(table.orgId),
    index('idx_community_posts_author').on(table.authorId),
    index('idx_community_posts_created').on(table.createdAt),
  ]
);

export const communityComments = pgTable(
  'community_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => communityPosts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: uuid('parent_id'), // For threaded replies
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_community_comments_post').on(table.postId),
    index('idx_community_comments_parent').on(table.parentId),
  ]
);

export const communityLikes = pgTable(
  'community_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').references(() => communityPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => communityComments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_community_likes_post').on(table.postId),
    index('idx_community_likes_comment').on(table.commentId),
    index('idx_community_likes_user').on(table.userId),
  ]
);
