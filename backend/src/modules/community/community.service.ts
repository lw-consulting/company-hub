import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { communityForumGroups, communityForums, communityPosts, communityComments, communityReactions, communityPolls, communityPollOptions, communityPollVotes, communityBookmarks, communityFollows, communityProfiles } from '../../db/schema/community.js';
import { users } from '../../db/schema/users.js';
import { NotFoundError } from '../../lib/errors.js';

// ============== FORUM GROUPS & FORUMS ==============

export async function getForumStructure(orgId: string) {
  const groups = await db.select().from(communityForumGroups)
    .where(eq(communityForumGroups.orgId, orgId))
    .orderBy(communityForumGroups.sortOrder);

  const result = await Promise.all(groups.map(async (group) => {
    const forums = await db.select().from(communityForums)
      .where(eq(communityForums.groupId, group.id))
      .orderBy(communityForums.sortOrder);
    return { ...group, forums };
  }));

  return result;
}

export async function createForumGroup(orgId: string, data: { name: string; icon?: string; color?: string }) {
  const [group] = await db.insert(communityForumGroups).values({ orgId, ...data }).returning();
  return group;
}

export async function createForum(orgId: string, groupId: string, data: { name: string; description?: string; icon?: string; isAnnouncement?: boolean }) {
  const [forum] = await db.insert(communityForums).values({ orgId, groupId, ...data }).returning();
  return forum;
}

export async function deleteForum(forumId: string) {
  await db.delete(communityForums).where(eq(communityForums.id, forumId));
}

export async function deleteForumGroup(groupId: string) {
  await db.delete(communityForumGroups).where(eq(communityForumGroups.id, groupId));
}

// ============== POSTS ==============

export async function getFeed(orgId: string, opts: { page?: number; pageSize?: number; forumId?: string; userId?: string } = {}) {
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(communityPosts.orgId, orgId)];
  if (opts.forumId) conditions.push(eq(communityPosts.forumId, opts.forumId));
  if (opts.userId) conditions.push(eq(communityPosts.authorId, opts.userId));

  const posts = await db
    .select({
      id: communityPosts.id,
      content: communityPosts.content,
      mediaUrls: communityPosts.mediaUrls,
      isPinned: communityPosts.isPinned,
      isHighlight: communityPosts.isHighlight,
      createdAt: communityPosts.createdAt,
      forumId: communityPosts.forumId,
      authorId: communityPosts.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarUrl: users.avatarUrl,
      authorPosition: users.position,
      authorDepartment: users.department,
    })
    .from(communityPosts)
    .innerJoin(users, eq(communityPosts.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Get forum names + counts for each post
  const postsWithMeta = await Promise.all(posts.map(async (post) => {
    const [likeCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(communityLikes).where(eq(communityLikes.postId, post.id));
    const [commentCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(communityComments).where(eq(communityComments.postId, post.id));

    let forumName = null;
    if (post.forumId) {
      const [forum] = await db.select({ name: communityForums.name })
        .from(communityForums).where(eq(communityForums.id, post.forumId)).limit(1);
      forumName = forum?.name || null;
    }

    return {
      ...post,
      forumName,
      likeCount: likeCount?.count || 0,
      commentCount: commentCount?.count || 0,
    };
  }));

  const [totalResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(communityPosts).where(and(...conditions));

  return { data: postsWithMeta, total: totalResult?.count || 0, page, pageSize };
}

export async function createPost(userId: string, orgId: string, data: {
  content: string; forumId?: string; mediaUrls?: string[]; postType?: string; background?: string; tags?: string[];
  poll?: { question: string; options: string[]; multipleChoice?: boolean };
}) {
  const [post] = await db.insert(communityPosts).values({
    orgId, authorId: userId, content: data.content, forumId: data.forumId || null,
    mediaUrls: data.mediaUrls || [], postType: data.postType || 'post',
    background: data.background || null, tags: data.tags || [],
  }).returning();

  // Create poll if provided
  if (data.poll && data.poll.question && data.poll.options?.length >= 2) {
    const [poll] = await db.insert(communityPolls).values({
      postId: post.id, question: data.poll.question, multipleChoice: data.poll.multipleChoice || false,
    }).returning();
    for (let i = 0; i < data.poll.options.length; i++) {
      await db.insert(communityPollOptions).values({ pollId: poll.id, text: data.poll.options[i], sortOrder: i });
    }
  }

  // Update forum post count
  if (data.forumId) {
    await db.execute(sql`UPDATE community_forums SET post_count = post_count + 1, last_post_at = NOW() WHERE id = ${data.forumId}`);
  }

  return getPostById(post.id, userId);
}

export async function getPostById(postId: string, currentUserId?: string) {
  const [post] = await db.select({
    id: communityPosts.id, content: communityPosts.content, mediaUrls: communityPosts.mediaUrls,
    isPinned: communityPosts.isPinned, postType: communityPosts.postType,
    background: communityPosts.background, tags: communityPosts.tags,
    createdAt: communityPosts.createdAt, forumId: communityPosts.forumId, authorId: communityPosts.authorId,
    authorFirstName: users.firstName, authorLastName: users.lastName,
    authorAvatarUrl: users.avatarUrl, authorPosition: users.position, authorDepartment: users.department,
  }).from(communityPosts).innerJoin(users, eq(communityPosts.authorId, users.id))
    .where(eq(communityPosts.id, postId)).limit(1);

  if (!post) throw new NotFoundError('Beitrag nicht gefunden');

  // Get reaction counts by type
  const reactions = await db.select({
    reactionType: communityReactions.reactionType,
    count: sql<number>`count(*)::int`,
  }).from(communityReactions).where(eq(communityReactions.postId, postId))
    .groupBy(communityReactions.reactionType);

  const reactionCounts: Record<string, number> = {};
  let totalReactions = 0;
  for (const r of reactions) { reactionCounts[r.reactionType] = r.count; totalReactions += r.count; }

  const [commentCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(communityComments).where(eq(communityComments.postId, postId));

  // Get poll if exists
  const [poll] = await db.select().from(communityPolls).where(eq(communityPolls.postId, postId)).limit(1);
  let pollData = null;
  if (poll) {
    const options = await db.select().from(communityPollOptions).where(eq(communityPollOptions.pollId, poll.id)).orderBy(communityPollOptions.sortOrder);
    const optionsWithVotes = await Promise.all(options.map(async (opt) => {
      const [voteCount] = await db.select({ count: sql<number>`count(*)::int` }).from(communityPollVotes).where(eq(communityPollVotes.optionId, opt.id));
      let userVoted = false;
      if (currentUserId) {
        const [v] = await db.select({ id: communityPollVotes.id }).from(communityPollVotes)
          .where(and(eq(communityPollVotes.optionId, opt.id), eq(communityPollVotes.userId, currentUserId))).limit(1);
        userVoted = !!v;
      }
      return { ...opt, voteCount: voteCount?.count || 0, userVoted };
    }));
    const totalVotes = optionsWithVotes.reduce((s, o) => s + o.voteCount, 0);
    pollData = { ...poll, options: optionsWithVotes, totalVotes };
  }

  let myReaction: string | null = null;
  let isBookmarked = false;
  if (currentUserId) {
    const [r] = await db.select({ reactionType: communityReactions.reactionType }).from(communityReactions)
      .where(and(eq(communityReactions.postId, postId), eq(communityReactions.userId, currentUserId))).limit(1);
    myReaction = r?.reactionType || null;
    const [bm] = await db.select({ id: communityBookmarks.id }).from(communityBookmarks)
      .where(and(eq(communityBookmarks.postId, postId), eq(communityBookmarks.userId, currentUserId))).limit(1);
    isBookmarked = !!bm;
  }

  return { ...post, reactionCounts, totalReactions, commentCount: commentCount?.count || 0, myReaction, isBookmarked, poll: pollData };
}

export async function deletePost(postId: string, userId: string) {
  const [deleted] = await db.delete(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.authorId, userId)))
    .returning({ id: communityPosts.id });
  if (!deleted) throw new NotFoundError('Beitrag nicht gefunden');
}

export async function togglePin(postId: string) {
  const [post] = await db.select({ isPinned: communityPosts.isPinned }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post) throw new NotFoundError('Beitrag nicht gefunden');
  const [updated] = await db.update(communityPosts).set({ isPinned: !post.isPinned }).where(eq(communityPosts.id, postId)).returning();
  return updated;
}

export async function toggleHighlight(postId: string) {
  const [post] = await db.select({ isHighlight: communityPosts.isHighlight }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post) throw new NotFoundError('Beitrag nicht gefunden');
  const [updated] = await db.update(communityPosts).set({ isHighlight: !post.isHighlight }).where(eq(communityPosts.id, postId)).returning();
  return updated;
}

// ============== COMMENTS ==============

export async function getComments(postId: string) {
  return db.select({
    id: communityComments.id, content: communityComments.content, parentId: communityComments.parentId,
    createdAt: communityComments.createdAt, authorId: communityComments.authorId,
    authorFirstName: users.firstName, authorLastName: users.lastName, authorAvatarUrl: users.avatarUrl,
  }).from(communityComments).innerJoin(users, eq(communityComments.authorId, users.id))
    .where(eq(communityComments.postId, postId)).orderBy(communityComments.createdAt);
}

export async function createComment(userId: string, postId: string, data: { content: string; parentId?: string }) {
  const [comment] = await db.insert(communityComments).values({
    postId, authorId: userId, content: data.content, parentId: data.parentId || null,
  }).returning();
  return comment;
}

export async function deleteComment(commentId: string, userId: string) {
  await db.delete(communityComments).where(and(eq(communityComments.id, commentId), eq(communityComments.authorId, userId)));
}

// ============== LIKES & BOOKMARKS ==============

export async function toggleReaction(userId: string, postId: string, reactionType: string) {
  // Valid types: like, fire, rocket, heart, shocked, laugh, dislike
  const validTypes = ['like', 'fire', 'rocket', 'heart', 'shocked', 'laugh', 'dislike'];
  if (!validTypes.includes(reactionType)) reactionType = 'like';

  const [existing] = await db.select({ id: communityReactions.id, reactionType: communityReactions.reactionType })
    .from(communityReactions)
    .where(and(eq(communityReactions.userId, userId), eq(communityReactions.postId, postId))).limit(1);

  if (existing) {
    if (existing.reactionType === reactionType) {
      // Same reaction -> remove
      await db.delete(communityReactions).where(eq(communityReactions.id, existing.id));
      return { reaction: null };
    } else {
      // Different reaction -> update
      await db.update(communityReactions).set({ reactionType }).where(eq(communityReactions.id, existing.id));
      return { reaction: reactionType };
    }
  } else {
    await db.insert(communityReactions).values({ userId, postId, reactionType });
    return { reaction: reactionType };
  }
}

// Keep backward compat
export async function toggleLike(userId: string, postId: string) {
  return toggleReaction(userId, postId, 'like');
}

// ============== POLLS ==============

export async function votePoll(userId: string, optionId: string) {
  // Check if already voted on this option
  const [existing] = await db.select({ id: communityPollVotes.id }).from(communityPollVotes)
    .where(and(eq(communityPollVotes.optionId, optionId), eq(communityPollVotes.userId, userId))).limit(1);

  if (existing) {
    // Remove vote
    await db.delete(communityPollVotes).where(eq(communityPollVotes.id, existing.id));
    return { voted: false };
  } else {
    // Get poll to check if multiple choice
    const [option] = await db.select({ pollId: communityPollOptions.pollId }).from(communityPollOptions)
      .where(eq(communityPollOptions.id, optionId)).limit(1);
    if (!option) throw new NotFoundError('Option nicht gefunden');

    const [poll] = await db.select({ multipleChoice: communityPolls.multipleChoice }).from(communityPolls)
      .where(eq(communityPolls.id, option.pollId)).limit(1);

    // If single choice, remove previous votes for this poll
    if (!poll?.multipleChoice) {
      const allOptions = await db.select({ id: communityPollOptions.id }).from(communityPollOptions)
        .where(eq(communityPollOptions.pollId, option.pollId));
      for (const opt of allOptions) {
        await db.delete(communityPollVotes).where(
          and(eq(communityPollVotes.optionId, opt.id), eq(communityPollVotes.userId, userId))
        );
      }
    }

    await db.insert(communityPollVotes).values({ optionId, userId });
    return { voted: true };
  }
}

export async function toggleBookmark(userId: string, postId: string) {
  const [existing] = await db.select({ id: communityBookmarks.id }).from(communityBookmarks)
    .where(and(eq(communityBookmarks.userId, userId), eq(communityBookmarks.postId, postId))).limit(1);
  if (existing) {
    await db.delete(communityBookmarks).where(eq(communityBookmarks.id, existing.id));
    return { bookmarked: false };
  } else {
    await db.insert(communityBookmarks).values({ userId, postId });
    return { bookmarked: true };
  }
}

export async function getSavedPosts(userId: string) {
  const bookmarks = await db.select({ postId: communityBookmarks.postId })
    .from(communityBookmarks).where(eq(communityBookmarks.userId, userId))
    .orderBy(desc(communityBookmarks.createdAt));
  const posts = await Promise.all(bookmarks.map(b => getPostById(b.postId, userId)));
  return posts;
}

// ============== FOLLOWS ==============

export async function toggleFollow(followerId: string, followingId: string) {
  const [existing] = await db.select({ id: communityFollows.id }).from(communityFollows)
    .where(and(eq(communityFollows.followerId, followerId), eq(communityFollows.followingId, followingId))).limit(1);
  if (existing) {
    await db.delete(communityFollows).where(eq(communityFollows.id, existing.id));
    return { following: false };
  } else {
    await db.insert(communityFollows).values({ followerId, followingId });
    return { following: true };
  }
}

// ============== PROFILE ==============

export async function getUserProfile(userId: string, currentUserId?: string) {
  const [user] = await db.select({
    id: users.id, firstName: users.firstName, lastName: users.lastName,
    avatarUrl: users.avatarUrl, department: users.department, position: users.position,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('Benutzer nicht gefunden');

  const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, userId)).limit(1);
  const [postCount] = await db.select({ count: sql<number>`count(*)::int` }).from(communityPosts).where(eq(communityPosts.authorId, userId));
  const [followerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(communityFollows).where(eq(communityFollows.followingId, userId));
  const [followingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(communityFollows).where(eq(communityFollows.followerId, userId));

  let isFollowing = false;
  if (currentUserId && currentUserId !== userId) {
    const [f] = await db.select({ id: communityFollows.id }).from(communityFollows)
      .where(and(eq(communityFollows.followerId, currentUserId), eq(communityFollows.followingId, userId))).limit(1);
    isFollowing = !!f;
  }

  return {
    ...user,
    bio: profile?.bio || null,
    headline: profile?.headline || null,
    socialLinks: profile?.socialLinks || {},
    postCount: postCount?.count || 0,
    followerCount: followerCount?.count || 0,
    followingCount: followingCount?.count || 0,
    isFollowing,
  };
}

export async function updateProfile(userId: string, data: { bio?: string; headline?: string; socialLinks?: Record<string, string> }) {
  const existing = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(communityProfiles).set({ ...data, updatedAt: new Date() }).where(eq(communityProfiles.userId, userId));
  } else {
    await db.insert(communityProfiles).values({ userId, ...data });
  }
  return getUserProfile(userId);
}
