/**
 * GRP-R-002 tests — Group Social Feed Service.
 */

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockGroupMemberFindUnique = jest.fn();
const mockPostFindUnique  = jest.fn();
const mockPostFindMany    = jest.fn();
const mockPostCount       = jest.fn();
const mockPostCreate      = jest.fn();
const mockPostUpdate      = jest.fn();
const mockPostDelete      = jest.fn();
const mockLikeFindUnique  = jest.fn();
const mockLikeCreate      = jest.fn();
const mockLikeDelete      = jest.fn();
const mockCommentFindMany = jest.fn();
const mockCommentCount    = jest.fn();
const mockCommentCreate   = jest.fn();
const mockTransaction     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    groupMember: {
      findUnique: (...a: unknown[]) => mockGroupMemberFindUnique(...a),
    },
    groupPost: {
      findUnique: (...a: unknown[]) => mockPostFindUnique(...a),
      findMany:   (...a: unknown[]) => mockPostFindMany(...a),
      count:      (...a: unknown[]) => mockPostCount(...a),
      create:     (...a: unknown[]) => mockPostCreate(...a),
      update:     (...a: unknown[]) => mockPostUpdate(...a),
      delete:     (...a: unknown[]) => mockPostDelete(...a),
    },
    groupPostLike: {
      findUnique: (...a: unknown[]) => mockLikeFindUnique(...a),
      create:     (...a: unknown[]) => mockLikeCreate(...a),
      delete:     (...a: unknown[]) => mockLikeDelete(...a),
    },
    groupPostComment: {
      findMany: (...a: unknown[]) => mockCommentFindMany(...a),
      count:    (...a: unknown[]) => mockCommentCount(...a),
      create:   (...a: unknown[]) => mockCommentCreate(...a),
    },
  },
}));

import {
  createPost,
  listPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  listComments,
  pinPost,
  unpinPost,
  PostNotFoundError,
  PostForbiddenError,
} from '../feed.service.js';
import { NotInGroupError } from '../index.js';

const USER_ID  = 'user-aaa';
const GROUP_ID = 'group-bbb';
const POST_ID  = 'post-ccc';

const POST_ROW = {
  id: POST_ID,
  groupId: GROUP_ID,
  authorId: USER_ID,
  text: 'Hello group!',
  imageUrl: null,
  linkUrl: null,
  linkTitle: null,
  isPinned: false,
  likesCount: 0,
  commentsCount: 0,
  createdAt: new Date('2026-06-01T10:00:00Z'),
  author: { profile: { name: 'Priya' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (ops: unknown[]) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return ops;
  });
});

// ── createPost ────────────────────────────────────────────────────────────────

describe('createPost()', () => {
  it('creates a post when caller is a group member', async () => {
    mockGroupMemberFindUnique.mockResolvedValue({ status: 'ACTIVE' });
    mockPostCreate.mockResolvedValue(POST_ROW);

    const result = await createPost(USER_ID, GROUP_ID, { text: 'Hello group!' });

    expect(result.text).toBe('Hello group!');
    expect(result.author.name).toBe('Priya');
  });

  it('throws NotInGroupError when caller is not a member', async () => {
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(createPost(USER_ID, GROUP_ID, { text: 'Hi' })).rejects.toBeInstanceOf(NotInGroupError);
  });
});

// ── listPosts ─────────────────────────────────────────────────────────────────

describe('listPosts()', () => {
  it('returns paginated posts ordered pinned-first', async () => {
    mockPostFindMany.mockResolvedValue([POST_ROW]);
    mockPostCount.mockResolvedValue(1);

    const result = await listPosts(GROUP_ID, 1, 20);

    expect(result.posts).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('returns empty result when no posts', async () => {
    mockPostFindMany.mockResolvedValue([]);
    mockPostCount.mockResolvedValue(0);

    const result = await listPosts(GROUP_ID);
    expect(result.posts).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ── deletePost ────────────────────────────────────────────────────────────────

describe('deletePost()', () => {
  it('deletes the post when caller is the author', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID, authorId: USER_ID });
    mockPostDelete.mockResolvedValue({});

    await deletePost(USER_ID, POST_ID);

    expect(mockPostDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes the post when isAdmin=true regardless of authorId', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID, authorId: 'someone-else' });
    mockPostDelete.mockResolvedValue({});

    await deletePost(USER_ID, POST_ID, true);

    expect(mockPostDelete).toHaveBeenCalledTimes(1);
  });

  it('throws PostNotFoundError when post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null);
    await expect(deletePost(USER_ID, POST_ID)).rejects.toBeInstanceOf(PostNotFoundError);
  });

  it('throws PostForbiddenError when caller is not the author', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID, authorId: 'other-user' });
    await expect(deletePost(USER_ID, POST_ID)).rejects.toBeInstanceOf(PostForbiddenError);
  });
});

// ── likePost / unlikePost ─────────────────────────────────────────────────────

describe('likePost()', () => {
  it('creates a like and increments count', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockLikeFindUnique.mockResolvedValue(null);

    await likePost(USER_ID, POST_ID);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — does not create duplicate like', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockLikeFindUnique.mockResolvedValue({ postId: POST_ID, userId: USER_ID });

    await likePost(USER_ID, POST_ID);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('throws PostNotFoundError when post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null);
    await expect(likePost(USER_ID, POST_ID)).rejects.toBeInstanceOf(PostNotFoundError);
  });
});

describe('unlikePost()', () => {
  it('deletes the like and decrements count', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockLikeFindUnique.mockResolvedValue({ postId: POST_ID, userId: USER_ID });

    await unlikePost(USER_ID, POST_ID);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — no error when not liked', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockLikeFindUnique.mockResolvedValue(null);

    await unlikePost(USER_ID, POST_ID);

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ── addComment ────────────────────────────────────────────────────────────────

describe('addComment()', () => {
  it('adds a comment when caller is a group member', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID, groupId: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue({ status: 'ACTIVE' });
    mockTransaction.mockResolvedValue([
      {
        id: 'comment-1',
        postId: POST_ID,
        authorId: USER_ID,
        text: 'Nice post!',
        createdAt: new Date('2026-06-01T11:00:00Z'),
        author: { profile: { name: 'Priya' } },
      },
      {},
    ]);

    const result = await addComment(USER_ID, POST_ID, 'Nice post!');

    expect(result.text).toBe('Nice post!');
    expect(result.author.name).toBe('Priya');
  });

  it('throws PostNotFoundError when post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null);
    await expect(addComment(USER_ID, POST_ID, 'Hi')).rejects.toBeInstanceOf(PostNotFoundError);
  });

  it('throws NotInGroupError when caller is not a member', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID, groupId: GROUP_ID });
    mockGroupMemberFindUnique.mockResolvedValue(null);

    await expect(addComment(USER_ID, POST_ID, 'Hi')).rejects.toBeInstanceOf(NotInGroupError);
  });
});

// ── listComments ──────────────────────────────────────────────────────────────

describe('listComments()', () => {
  it('returns paginated comments ordered by createdAt ASC', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockCommentFindMany.mockResolvedValue([{
      id: 'comment-1',
      postId: POST_ID,
      authorId: USER_ID,
      text: 'Great post!',
      createdAt: new Date('2026-06-01T11:00:00Z'),
      author: { profile: { name: 'Priya' } },
    }]);
    mockCommentCount.mockResolvedValue(1);

    const result = await listComments(POST_ID, 1, 20);

    expect(result.comments).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('throws PostNotFoundError when post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null);
    await expect(listComments(POST_ID)).rejects.toBeInstanceOf(PostNotFoundError);
  });
});

// ── pinPost / unpinPost ───────────────────────────────────────────────────────

describe('pinPost()', () => {
  it('sets isPinned=true', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockPostUpdate.mockResolvedValue({});

    await pinPost('admin-1', POST_ID);

    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPinned: true } }),
    );
  });

  it('throws PostNotFoundError when post does not exist', async () => {
    mockPostFindUnique.mockResolvedValue(null);
    await expect(pinPost('admin-1', POST_ID)).rejects.toBeInstanceOf(PostNotFoundError);
  });
});

describe('unpinPost()', () => {
  it('sets isPinned=false', async () => {
    mockPostFindUnique.mockResolvedValue({ id: POST_ID });
    mockPostUpdate.mockResolvedValue({});

    await unpinPost('admin-1', POST_ID);

    expect(mockPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPinned: false } }),
    );
  });
});
