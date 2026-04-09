import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/** Forum Category Groups */
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

/** Forum Channels */
export const communityForums = pgTable(
  'community_forums',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').notNull().references(() => communityForumGroups.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 50 }),
    isAnnouncement: boolean('is_announcement').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    postCount: integer('post_count').notNull().default(0),
    lastPostAt: timestamp('last_post_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_forums_group').on(table.groupId), index('idx_forums_org').on(table.orgId)]
);

/** Posts */
export const communityPosts = pgTable(
  'community_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    forumId: uuid('forum_id').references(() => communityForums.id, { onDelete: 'set null' }),
    authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    postType: varchar('post_type', { length: 20 }).notNull().default('post'),
    background: varchar('background', { length: 50 }),
    mediaUrls: jsonb('media_urls').$type<string[]>().default([]),
    isPinned: boolean('is_pinned').notNull().default(false),
    tags: jsonb('tags').$type<string[]>().default([]),
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

/** Comments */
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
  (table) => [index('idx_community_comments_post').on(table.postId)]
);

/** Reactions — 7 types */
export const communityReactions = pgTable(
  'community_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').references(() => communityPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => communityComments.id, { onDelete: 'cascade' }),
    reactionType: varchar('reaction_type', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_reactions_post').on(table.postId),
    index('idx_reactions_user').on(table.userId),
    // Lookup "did user X react to post Y" + toggle
    index('idx_reactions_post_user').on(table.postId, table.userId),
  ]
);

/** Polls */
export const communityPolls = pgTable(
  'community_polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    multipleChoice: boolean('multiple_choice').notNull().default(false),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_polls_post').on(table.postId)]
);

export const communityPollOptions = pgTable(
  'community_poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id').notNull().references(() => communityPolls.id, { onDelete: 'cascade' }),
    text: varchar('text', { length: 300 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('idx_poll_options_poll').on(table.pollId)]
);

export const communityPollVotes = pgTable(
  'community_poll_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    optionId: uuid('option_id').notNull().references(() => communityPollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_poll_votes_option').on(table.optionId),
    index('idx_poll_votes_user').on(table.userId),
    // Lookup "did user X vote for option Y" + toggle
    index('idx_poll_votes_option_user').on(table.optionId, table.userId),
  ]
);

/** Bookmarks */
export const communityBookmarks = pgTable(
  'community_bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_bookmarks_user').on(table.userId),
    // Lookup "did user X bookmark post Y"
    index('idx_bookmarks_user_post').on(table.userId, table.postId),
  ]
);

/** Follows */
export const communityFollows = pgTable(
  'community_follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_follows_follower').on(table.followerId), index('idx_follows_following').on(table.followingId)]
);

/** Community Profiles */
export const communityProfiles = pgTable(
  'community_profiles',
  {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    bio: text('bio'),
    headline: varchar('headline', { length: 200 }),
    socialLinks: jsonb('social_links').$type<Record<string, string>>().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
);

// Backward compat alias
export const communityLikes = communityReactions;
