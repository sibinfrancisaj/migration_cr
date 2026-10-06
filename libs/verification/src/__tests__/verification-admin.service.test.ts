import {
  approveVerification,
  rejectVerification,
  VerificationAlreadyReviewedError,
  VerificationRequestNotFoundError,
} from '../verification-admin.service.js';
import { CLOUD_EVENT_TYPES, VerificationStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    verificationRequest: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update:     (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const mockAuditLog = jest.fn();
jest.mock('@abroad-matrimony/auth', () => ({
  auditLog: (...a: unknown[]) => mockAuditLog(...a),
}));

const mockPublish = jest.fn();
jest.mock('@abroad-matrimony/event-bus', () => ({
  publish: (...a: unknown[]) => mockPublish(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const REQUEST_ID = 'ver-uuid-1';
const USER_ID = 'user-uuid-1';
const ADMIN_ID = 'admin-uuid-1';

const DETAIL_ROW = {
  id: REQUEST_ID,
  userId: USER_ID,
  status: VerificationStatus.APPROVED,
  idDocType: 'PASSPORT',
  idDocS3Key: 'id.jpg',
  selfieS3Key: 'selfie.jpg',
  submittedAt: new Date('2026-10-01T10:00:00Z'),
  reviewedAt: new Date('2026-10-02T10:00:00Z'),
  reviewNote: null,
  user: { phone: '+447700900000', email: null, profile: { name: 'Priya' } },
};

function setupPending(): void {
  mockFindUnique
    .mockResolvedValueOnce({ id: REQUEST_ID, userId: USER_ID, status: VerificationStatus.PENDING })
    .mockResolvedValueOnce(DETAIL_ROW);
  mockUpdate.mockResolvedValue({});
  mockAuditLog.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockReset();
});

// ── approveVerification ────────────────────────────────────────────────────────

describe('approveVerification', () => {
  it('publishes VERIFICATION_REVIEWED with APPROVED status (EVT-002)', async () => {
    setupPending();

    await approveVerification(REQUEST_ID, ADMIN_ID, '127.0.0.1');

    expect(mockPublish).toHaveBeenCalledWith(
      CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED,
      { verificationId: REQUEST_ID, userId: USER_ID, status: VerificationStatus.APPROVED },
      `user:${USER_ID}`,
    );
  });

  it('does not publish when the request is already reviewed', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: REQUEST_ID, userId: USER_ID, status: VerificationStatus.REJECTED });

    await expect(approveVerification(REQUEST_ID, ADMIN_ID, '127.0.0.1')).rejects.toBeInstanceOf(
      VerificationAlreadyReviewedError,
    );
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('does not publish when the request does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(approveVerification(REQUEST_ID, ADMIN_ID, '127.0.0.1')).rejects.toBeInstanceOf(
      VerificationRequestNotFoundError,
    );
    expect(mockPublish).not.toHaveBeenCalled();
  });
});

// ── rejectVerification ─────────────────────────────────────────────────────────

describe('rejectVerification', () => {
  it('publishes VERIFICATION_REVIEWED with REJECTED status and the reason', async () => {
    setupPending();

    await rejectVerification(REQUEST_ID, 'blurry selfie', ADMIN_ID, '127.0.0.1');

    expect(mockPublish).toHaveBeenCalledWith(
      CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED,
      { verificationId: REQUEST_ID, userId: USER_ID, status: VerificationStatus.REJECTED, reason: 'blurry selfie' },
      `user:${USER_ID}`,
    );
  });

  it('does not publish when the request is already reviewed', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: REQUEST_ID, userId: USER_ID, status: VerificationStatus.APPROVED });

    await expect(rejectVerification(REQUEST_ID, 'x', ADMIN_ID, '127.0.0.1')).rejects.toBeInstanceOf(
      VerificationAlreadyReviewedError,
    );
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
