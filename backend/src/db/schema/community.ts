import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/** Forum Category Groups (e.g. "Allgemein", "Strategie & Mindset") */
export const communityForumGroups = pgTable(
  'community_forum_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 7 }).default('#6366f1'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_forum_groups_org').on(table.orgId)]
);

/** Forum Channels within a group (e.g. "Ankündigungen", "Training-Updates") */
export const communityForums = pgTable(
  'community_forums',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').notNull().references(() => communityForumGroups.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 50 }),
    isAnnouncement: boolean('is_announcement').notNull().default(false), // Only admins can post
    sortOrder: integer('sort_order').notNull().default(0),
    postCount: integer('post_count').notNull().default(0),
    lastPostAt: timestamp('last_post_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_forums_group').on(table.groupId),
    index('idx_forums_org').on(table.orgId),
  ]
);

/** Posts — now with optional forum assignment */
export const communityPosts = pgTable(
  'community_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    forumId: uuid('forum_id').references(() => communityForums.id, { onDelete: 'set null' }),
    authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    mediaUrls: jsonb('media_urls').$type<string[]>().default([]),
    isPinned: boolean('is_pinned').notNull().default(false),
    isHighlight: boolean('is_highlight').notNull().default(false),
    savedCount: integer('saved_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_community_posts_org').on(table.orgId),
    index('idx_community_posts_forum').on(table.forumId),
    index('idx_community_posts_author').on(table.authorId),
    index('idx_community_posts_created').on(table.createdAt),
  ]
);

export const communityComments = pgTable(
  'community_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: uuid('parent_id'),
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
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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

/** Post bookmarks / saves */
export const communityBookmarks = pgTable(
  'community_bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_bookmarks_user').on(table.userId)]
);

/** User follows */
export const communityFollows = pgTable(
  'community_follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_follows_follower').on(table.followerId),
    index('idx_follows_following').on(table.followingId),
  ]
);

/** User community profile (bio, social links) */
export const communityProfiles = pgTable(
  'community_profiles',
  {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    bio: text('bio'),
    headline: varchar('headline', { length: 200 }), // e.g. "Geschäftsführer LWA Holding GmbH"
    socialLinks: jsonb('social_links').$type<Record<string, string>>().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
);
