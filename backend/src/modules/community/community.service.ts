import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { communityPosts, communityComments, communityLikes } from '../../db/schema/community.js';
import { users } from '../../db/schema/users.js';
import { NotFoundError } from '../../lib/errors.js';

// --- Posts ---

export async function getFeed(orgId: string, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;

  const posts = await db
    .select({
      id: communityPosts.id,
      content: communityPosts.content,
      mediaUrls: communityPosts.mediaUrls,
      isPinned: communityPosts.isPinned,
      createdAt: communityPosts.createdAt,
      authorId: communityPosts.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarUrl: users.avatarUrl,
      authorPosition: users.position,
      authorDepartment: users.department,
    })
    .from(communityPosts)
    .innerJoin(users, eq(communityPosts.authorId, users.id))
    .where(eq(communityPosts.orgId, orgId))
    .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Get counts for each post
  const postsWithCounts = await Promise.all(
    posts.map(async (post) => {
      const [likeCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communityLikes)
        .where(eq(communityLikes.postId, post.id));

      const [commentCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communityComments)
        .where(eq(communityComments.postId, post.id));

      return {
        ...post,
        likeCount: likeCount?.count || 0,
        commentCount: commentCount?.count || 0,
      };
    })
  );

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(eq(communityPosts.orgId, orgId));

  return {
    data: postsWithCounts,
    total: totalResult?.count || 0,
    page,
    pageSize,
  };
}

export async function createPost(
  userId: string,
  orgId: string,
  data: { content: string; mediaUrls?: string[] }
) {
  const [post] = await db
    .insert(communityPosts)
    .values({
      orgId,
      authorId: userId,
      content: data.content,
      mediaUrls: data.mediaUrls || [],
    })
    .returning();

  return getPostById(post.id, userId);
}

export async function getPostById(postId: string, currentUserId?: string) {
  const [post] = await db
    .select({
      id: communityPosts.id,
      content: communityPosts.content,
      mediaUrls: communityPosts.mediaUrls,
      isPinned: communityPosts.isPinned,
      createdAt: communityPosts.createdAt,
      authorId: communityPosts.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarUrl: users.avatarUrl,
      authorPosition: users.position,
      authorDepartment: users.department,
    })
    .from(communityPosts)
    .innerJoin(users, eq(communityPosts.authorId, users.id))
    .where(eq(communityPosts.id, postId))
    .limit(1);

  if (!post) throw new NotFoundError('Beitrag nicht gefunden');

  const [likeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityLikes)
    .where(eq(communityLikes.postId, postId));

  const [commentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityComments)
    .where(eq(communityComments.postId, postId));

  // Check if current user liked this post
  let isLiked = false;
  if (currentUserId) {
    const [like] = await db
      .select({ id: communityLikes.id })
      .from(communityLikes)
      .where(and(eq(communityLikes.postId, postId), eq(communityLikes.userId, currentUserId)))
      .limit(1);
    isLiked = !!like;
  }

  return {
    ...post,
    likeCount: likeCount?.count || 0,
    commentCount: commentCount?.count || 0,
    isLiked,
  };
}

export async function deletePost(postId: string, userId: string) {
  const [deleted] = await db
    .delete(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.authorId, userId)))
    .returning({ id: communityPosts.id });

  if (!deleted) throw new NotFoundError('Beitrag nicht gefunden oder keine Berechtigung');
}

export async function togglePin(postId: string) {
  const [post] = await db
    .select({ isPinned: communityPosts.isPinned })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);

  if (!post) throw new NotFoundError('Beitrag nicht gefunden');

  const [updated] = await db
    .update(communityPosts)
    .set({ isPinned: !post.isPinned })
    .where(eq(communityPosts.id, postId))
    .returning();

  return updated;
}

// --- Comments ---

export async function getComments(postId: string) {
  return db
    .select({
      id: communityComments.id,
      content: communityComments.content,
      parentId: communityComments.parentId,
      createdAt: communityComments.createdAt,
      authorId: communityComments.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(communityComments)
    .innerJoin(users, eq(communityComments.authorId, users.id))
    .where(eq(communityComments.postId, postId))
    .orderBy(communityComments.createdAt);
}

export async function createComment(
  userId: string,
  postId: string,
  data: { content: string; parentId?: string }
) {
  const [comment] = await db
    .insert(communityComments)
    .values({
      postId,
      authorId: userId,
      content: data.content,
      parentId: data.parentId || null,
    })
    .returning();

  return comment;
}

export async function deleteComment(commentId: string, userId: string) {
  const [deleted] = await db
    .delete(communityComments)
    .where(and(eq(communityComments.id, commentId), eq(communityComments.authorId, userId)))
    .returning({ id: communityComments.id });

  if (!deleted) throw new NotFoundError('Kommentar nicht gefunden oder keine Berechtigung');
}

// --- Likes ---

export async function toggleLike(userId: string, postId: string) {
  const [existing] = await db
    .select({ id: communityLikes.id })
    .from(communityLikes)
    .where(and(eq(communityLikes.userId, userId), eq(communityLikes.postId, postId)))
    .limit(1);

  if (existing) {
    await db.delete(communityLikes).where(eq(communityLikes.id, existing.id));
    return { liked: false };
  } else {
    await db.insert(communityLikes).values({ userId, postId });
    return { liked: true };
  }
}

// --- User Profile ---

export async function getUserProfile(userId: string, orgId: string) {
  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      department: users.department,
      position: users.position,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new NotFoundError('Benutzer nicht gefunden');

  const [postCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(eq(communityPosts.authorId, userId));

  return { ...user, postCount: postCount?.count || 0 };
}
