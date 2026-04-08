import { eq, and, desc, sql, isNull, inArray } from 'drizzle-orm';
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

export async function getFeed(orgId: string, opts: { page?: number; pageSize?: number; forumId?: string; userId?: string; currentUserId?: string } = {}) {
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 20;
  const offset = (page - 1) * pageSize;
  const currentUserId = opts.currentUserId;

  const conditions = [eq(communityPosts.orgId, orgId)];
  if (opts.forumId) conditions.push(eq(communityPosts.forumId, opts.forumId));
  if (opts.userId) conditions.push(eq(communityPosts.authorId, opts.userId));

  const posts = await db
    .select({
      id: communityPosts.id,
      content: communityPosts.content,
      mediaUrls: communityPosts.mediaUrls,
      isPinned: communityPosts.isPinned,
      postType: communityPosts.postType,
      background: communityPosts.background,
      tags: communityPosts.tags,
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

  const postIds = posts.map((p) => p.id);
  const forumIds = Array.from(new Set(posts.map((p) => p.forumId).filter((id): id is string => !!id)));

  // Empty feed shortcut
  if (postIds.length === 0) {
    const [totalResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(communityPosts).where(and(...conditions));
    return { data: [], total: totalResult?.count || 0, page, pageSize };
  }

  // ---- BULK QUERIES (8 statt ~220) ----

  // 1) Forum names
  const forumRows = forumIds.length > 0
    ? await db.select({ id: communityForums.id, name: communityForums.name })
        .from(communityForums).where(inArray(communityForums.id, forumIds))
    : [];
  const forumNameMap = new Map(forumRows.map((f) => [f.id, f.name]));

  // 2) Reaction counts grouped by post + type
  const reactionRows = await db.select({
    postId: communityReactions.postId,
    reactionType: communityReactions.reactionType,
    count: sql<number>`count(*)::int`,
  }).from(communityReactions)
    .where(inArray(communityReactions.postId, postIds))
    .groupBy(communityReactions.postId, communityReactions.reactionType);

  const reactionCountsByPost = new Map<string, { counts: Record<string, number>; total: number }>();
  for (const r of reactionRows) {
    if (!r.postId) continue;
    const entry = reactionCountsByPost.get(r.postId) || { counts: {}, total: 0 };
    entry.counts[r.reactionType] = r.count;
    entry.total += r.count;
    reactionCountsByPost.set(r.postId, entry);
  }

  // 3) Comment counts
  const commentCountRows = await db.select({
    postId: communityComments.postId,
    count: sql<number>`count(*)::int`,
  }).from(communityComments)
    .where(inArray(communityComments.postId, postIds))
    .groupBy(communityComments.postId);
  const commentCountMap = new Map(commentCountRows.map((c) => [c.postId, c.count]));

  // 4) My reactions (only one per post per user)
  const myReactionMap = new Map<string, string>();
  if (currentUserId) {
    const myReactionRows = await db.select({
      postId: communityReactions.postId,
      reactionType: communityReactions.reactionType,
    }).from(communityReactions)
      .where(and(
        inArray(communityReactions.postId, postIds),
        eq(communityReactions.userId, currentUserId),
      ));
    for (const r of myReactionRows) {
      if (r.postId) myReactionMap.set(r.postId, r.reactionType);
    }
  }

  // 5) Bookmarks (which of these posts has the user bookmarked)
  const bookmarkedSet = new Set<string>();
  if (currentUserId) {
    const bookmarkRows = await db.select({ postId: communityBookmarks.postId })
      .from(communityBookmarks)
      .where(and(
        inArray(communityBookmarks.postId, postIds),
        eq(communityBookmarks.userId, currentUserId),
      ));
    for (const b of bookmarkRows) bookmarkedSet.add(b.postId);
  }

  // 6) Latest comment per post — single query using DISTINCT ON (PostgreSQL)
  const idsParam = sql.join(postIds.map((id) => sql`${id}`), sql`, `);
  const latestCommentRows = await db.execute<{
    post_id: string;
    id: string;
    content: string;
    created_at: Date;
    author_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }>(sql`
    SELECT DISTINCT ON (c.post_id)
      c.post_id, c.id, c.content, c.created_at,
      c.author_id, u.first_name, u.last_name, u.avatar_url
    FROM community_comments c
    INNER JOIN users u ON u.id = c.author_id
    WHERE c.post_id IN (${idsParam})
    ORDER BY c.post_id, c.created_at DESC
  `);
  const latestCommentMap = new Map<string, any>();
  for (const c of latestCommentRows.rows) {
    latestCommentMap.set(c.post_id, {
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      authorId: c.author_id,
      authorFirstName: c.first_name,
      authorLastName: c.last_name,
      authorAvatarUrl: c.avatar_url,
    });
  }

  // 7) Polls
  const pollRows = await db.select().from(communityPolls)
    .where(inArray(communityPolls.postId, postIds));
  const pollIds = pollRows.map((p) => p.id);
  const pollByPostId = new Map(pollRows.map((p) => [p.postId, p]));

  // 8) Poll options + vote counts + user votes (only if there are polls)
  let pollDataByPostId = new Map<string, any>();
  if (pollIds.length > 0) {
    const optionRows = await db.select().from(communityPollOptions)
      .where(inArray(communityPollOptions.pollId, pollIds))
      .orderBy(communityPollOptions.sortOrder);

    const optionIds = optionRows.map((o) => o.id);

    // Vote counts grouped by option
    const voteCountRows = optionIds.length > 0
      ? await db.select({
          optionId: communityPollVotes.optionId,
          count: sql<number>`count(*)::int`,
        }).from(communityPollVotes)
          .where(inArray(communityPollVotes.optionId, optionIds))
          .groupBy(communityPollVotes.optionId)
      : [];
    const voteCountMap = new Map(voteCountRows.map((v) => [v.optionId, v.count]));

    // User's votes
    const userVotedSet = new Set<string>();
    if (currentUserId && optionIds.length > 0) {
      const userVoteRows = await db.select({ optionId: communityPollVotes.optionId })
        .from(communityPollVotes)
        .where(and(
          inArray(communityPollVotes.optionId, optionIds),
          eq(communityPollVotes.userId, currentUserId),
        ));
      for (const v of userVoteRows) userVotedSet.add(v.optionId);
    }

    // Group options by pollId
    const optionsByPollId = new Map<string, any[]>();
    for (const opt of optionRows) {
      const enriched = {
        ...opt,
        voteCount: voteCountMap.get(opt.id) || 0,
        userVoted: userVotedSet.has(opt.id),
      };
      const arr = optionsByPollId.get(opt.pollId) || [];
      arr.push(enriched);
      optionsByPollId.set(opt.pollId, arr);
    }

    for (const poll of pollRows) {
      const options = optionsByPollId.get(poll.id) || [];
      const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
      pollDataByPostId.set(poll.postId, { ...poll, options, totalVotes });
    }
  }

  // ---- ASSEMBLE ----
  const postsWithMeta = posts.map((post) => {
    const reactionData = reactionCountsByPost.get(post.id) || { counts: {}, total: 0 };
    return {
      ...post,
      forumName: post.forumId ? forumNameMap.get(post.forumId) || null : null,
      reactionCounts: reactionData.counts,
      totalReactions: reactionData.total,
      commentCount: commentCountMap.get(post.id) || 0,
      poll: pollDataByPostId.get(post.id) || null,
      myReaction: myReactionMap.get(post.id) || null,
      isBookmarked: bookmarkedSet.has(post.id),
      latestComment: latestCommentMap.get(post.id) || null,
    };
  });

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

export async function updatePost(postId: string, userId: string, data: { content?: string; background?: string | null }) {
  const updateFields: Record<string, any> = {};
  if (data.content !== undefined) updateFields.content = data.content;
  if (data.background !== undefined) updateFields.background = data.background;

  if (Object.keys(updateFields).length === 0) throw new NotFoundError('Keine Änderungen');

  const [updated] = await db.update(communityPosts)
    .set(updateFields)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.authorId, userId)))
    .returning({ id: communityPosts.id });
  if (!updated) throw new NotFoundError('Beitrag nicht gefunden');
  return updated;
}

export async function togglePin(postId: string) {
  const [post] = await db.select({ isPinned: communityPosts.isPinned }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post) throw new NotFoundError('Beitrag nicht gefunden');
  const [updated] = await db.update(communityPosts).set({ isPinned: !post.isPinned }).where(eq(communityPosts.id, postId)).returning();
  return updated;
}

export async function toggleHighlight(postId: string) {
  const [post] = await db.select({ tags: communityPosts.tags }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post) throw new NotFoundError('Beitrag nicht gefunden');
  const currentTags = (post.tags as string[]) || [];
  const newTags = currentTags.includes('highlight')
    ? currentTags.filter(t => t !== 'highlight')
    : [...currentTags, 'highlight'];
  const [updated] = await db.update(communityPosts).set({ tags: newTags }).where(eq(communityPosts.id, postId)).returning();
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
    email: users.email, avatarUrl: users.avatarUrl, department: users.department, position: users.position,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('Benutzer nicht gefunden');

  // These may fail if tables don't exist yet — graceful fallback
  let profile: any = null;
  let postCountVal = 0, followerCountVal = 0, followingCountVal = 0;
  let isFollowing = false;

  try {
    const [p] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, userId)).limit(1);
    profile = p;
  } catch {}

  try {
    const [pc] = await db.select({ count: sql<number>`count(*)::int` }).from(communityPosts).where(eq(communityPosts.authorId, userId));
    postCountVal = pc?.count || 0;
  } catch {}

  try {
    const [fc] = await db.select({ count: sql<number>`count(*)::int` }).from(communityFollows).where(eq(communityFollows.followingId, userId));
    followerCountVal = fc?.count || 0;
    const [fgc] = await db.select({ count: sql<number>`count(*)::int` }).from(communityFollows).where(eq(communityFollows.followerId, userId));
    followingCountVal = fgc?.count || 0;
  } catch {}

  try {
    if (currentUserId && currentUserId !== userId) {
      const [f] = await db.select({ id: communityFollows.id }).from(communityFollows)
        .where(and(eq(communityFollows.followerId, currentUserId), eq(communityFollows.followingId, userId))).limit(1);
      isFollowing = !!f;
    }
  } catch {}

  return {
    ...user,
    bio: profile?.bio || null,
    headline: profile?.headline || null,
    socialLinks: profile?.socialLinks || {},
    postCount: postCountVal,
    followerCount: followerCountVal,
    followingCount: followingCountVal,
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
