import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { NotInGroupError } from './index.js';

const log = createChildLogger({ module: 'groups:feed' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class PostNotFoundError extends Error {
  constructor() {
    super('POST_NOT_FOUND');
    this.name = 'PostNotFoundError';
  }
}

export class PostForbiddenError extends Error {
  constructor() {
    super('POST_FORBIDDEN');
    this.name = 'PostForbiddenError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface GroupPostDto {
  id: string;
  groupId: string;
  authorId: string;
  text: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  isPinned: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  author: { name: string };
}

export interface GroupPostCommentDto {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author: { name: string };
}

export interface PaginatedPostsResult {
  posts: GroupPostDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedCommentsResult {
  comments: GroupPostCommentDto[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePostData {
  text?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkPreview?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertGroupMember(userId: string, groupId: string): Promise<void> {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { status: true },
  });
  if (!membership || membership.status !== 'ACTIVE') throw new NotInGroupError();
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Create a post in a group. Caller must be an active member.
 *
 * @throws {NotInGroupError}
 */
export async function createPost(
  userId: string,
  groupId: string,
  data: CreatePostData,
): Promise<GroupPostDto> {
  await assertGroupMember(userId, groupId);

  const post = await prisma.groupPost.create({
    data: {
      groupId,
      authorId: userId,
      text: data.text ?? null,
      imageUrl: data.imageUrl ?? null,
      linkUrl: data.linkUrl ?? null,
      linkTitle: data.linkTitle ?? null,
      linkPreview: data.linkPreview ?? null,
    },
    include: { author: { include: { profile: { select: { name: true } } } } },
  });

  log.info('createPost', { groupId, postId: post.id, userId });

  return {
    id: post.id,
    groupId: post.groupId,
    authorId: post.authorId,
    text: post.text,
    imageUrl: post.imageUrl,
    linkUrl: post.linkUrl,
    linkTitle: post.linkTitle,
    isPinned: post.isPinned,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    createdAt: post.createdAt.toISOString(),
    author: { name: post.author.profile?.name ?? '' },
  };
}

/**
 * List posts in a group — ordered by isPinned DESC, createdAt DESC.
 */
export async function listPosts(
  groupId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedPostsResult> {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.groupPost.findMany({
      where: { groupId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: { author: { include: { profile: { select: { name: true } } } } },
    }),
    prisma.groupPost.count({ where: { groupId } }),
  ]);

  return {
    posts: posts.map((p) => ({
      id: p.id,
      groupId: p.groupId,
      authorId: p.authorId,
      text: p.text,
      imageUrl: p.imageUrl,
      linkUrl: p.linkUrl,
      linkTitle: p.linkTitle,
      isPinned: p.isPinned,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      createdAt: p.createdAt.toISOString(),
      author: { name: p.author.profile?.name ?? '' },
    })),
    total,
    page,
    limit,
  };
}

/**
 * Delete a post. Only the author or an admin (isAdmin=true) may delete.
 *
 * @throws {PostNotFoundError}
 * @throws {PostForbiddenError}
 */
export async function deletePost(
  userId: string,
  postId: string,
  isAdmin = false,
): Promise<void> {
  const post = await prisma.groupPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });

  if (!post) throw new PostNotFoundError();
  if (!isAdmin && post.authorId !== userId) throw new PostForbiddenError();

  await prisma.groupPost.delete({ where: { id: postId } });
  log.info('deletePost', { postId, userId, isAdmin });
}

/**
 * Like a post. Idempotent — no error if already liked.
 *
 * @throws {PostNotFoundError}
 */
export async function likePost(userId: string, postId: string): Promise<void> {
  const post = await prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError();

  const existing = await prisma.groupPostLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) return; // idempotent

  await prisma.$transaction([
    prisma.groupPostLike.create({ data: { postId, userId } }),
    prisma.groupPost.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }),
  ]);
}

/**
 * Unlike a post. Idempotent — no error if not liked.
 *
 * @throws {PostNotFoundError}
 */
export async function unlikePost(userId: string, postId: string): Promise<void> {
  const post = await prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError();

  const existing = await prisma.groupPostLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (!existing) return; // idempotent

  await prisma.$transaction([
    prisma.groupPostLike.delete({ where: { postId_userId: { postId, userId } } }),
    prisma.groupPost.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } }),
  ]);
}

/**
 * Add a comment to a post. Caller must be an active group member.
 *
 * @throws {PostNotFoundError}
 * @throws {NotInGroupError}
 */
export async function addComment(
  userId: string,
  postId: string,
  text: string,
): Promise<GroupPostCommentDto> {
  const post = await prisma.groupPost.findUnique({
    where: { id: postId },
    select: { id: true, groupId: true },
  });

  if (!post) throw new PostNotFoundError();

  await assertGroupMember(userId, post.groupId);

  const [comment] = await prisma.$transaction([
    prisma.groupPostComment.create({
      data: { postId, authorId: userId, text },
      include: { author: { include: { profile: { select: { name: true } } } } },
    }),
    prisma.groupPost.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    }),
  ]);

  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    author: { name: (comment as { author: { profile?: { name: string } | null } }).author.profile?.name ?? '' },
  };
}

/**
 * List comments on a post — paginated, ordered by createdAt ASC (flat, no nesting).
 *
 * @throws {PostNotFoundError}
 */
export async function listComments(
  postId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedCommentsResult> {
  const post = await prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError();

  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    prisma.groupPostComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: { author: { include: { profile: { select: { name: true } } } } },
    }),
    prisma.groupPostComment.count({ where: { postId } }),
  ]);

  return {
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      author: { name: c.author.profile?.name ?? '' },
    })),
    total,
    page,
    limit,
  };
}

/**
 * Pin a post (admin only).
 *
 * @throws {PostNotFoundError}
 */
export async function pinPost(_adminId: string, postId: string): Promise<void> {
  const post = await prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError();

  await prisma.groupPost.update({ where: { id: postId }, data: { isPinned: true } });
  log.info('pinPost', { postId });
}

/**
 * Unpin a post (admin only).
 *
 * @throws {PostNotFoundError}
 */
export async function unpinPost(_adminId: string, postId: string): Promise<void> {
  const post = await prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new PostNotFoundError();

  await prisma.groupPost.update({ where: { id: postId }, data: { isPinned: false } });
  log.info('unpinPost', { postId });
}
