import request from 'supertest';
import { createApp } from '../../../app.js';
import { Gender, VerificationStatus } from '@abroad-matrimony/shared';

// ── Service mock ──────────────────────────────────────────────────────────────

const mockCreateProfileService = jest.fn();

// ── Mock @abroad-matrimony/profile ────────────────────────────────────────────
// ProfileAlreadyExistsError is defined inside the factory so instanceof works.

jest.mock('@abroad-matrimony/profile', () => {
  class ProfileAlreadyExistsError extends Error {
    constructor() { super('PROFILE_ALREADY_EXISTS'); this.name = 'ProfileAlreadyExistsError'; }
  }
  return {
    createProfileService: (...args: unknown[]) => mockCreateProfileService(...args),
    ProfileAlreadyExistsError,
  };
});

const getProfileErrors = () =>
  jest.requireMock('@abroad-matrimony/profile') as {
    ProfileAlreadyExistsError: new () => Error;
  };

// ── Mock @abroad-matrimony/auth ───────────────────────────────────────────────
// requireAuth behaviour is controlled via a closure variable so it can be
// flipped per-test without recreating the app.

let requireAuthBehavior: 'pass' | 'fail401' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  // Stubs for other exports the app module imports
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService:    jest.fn().mockResolvedValue({}),
  tokenRefreshService: jest.fn().mockResolvedValue({}),
  revokeForDevice:     jest.fn().mockResolvedValue(undefined),
  revokeAllForUser:    jest.fn().mockResolvedValue(undefined),
  OtpInvalidError:   class OtpInvalidError   extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:  class DeviceLimitError   extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  TokenInvalidError: class TokenInvalidError  extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:   class TokenReuseError    extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
  checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  adminLoginService:        jest.fn().mockResolvedValue({}),
  AdminCredentialsError:  class AdminCredentialsError  extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
  AdminTotpRequiredError: class AdminTotpRequiredError extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
  AdminTotpInvalidError:  class AdminTotpInvalidError  extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS:    60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX:      3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  name: 'Priya Sharma',
  dateOfBirth: '1990-05-15',
  gender: 'FEMALE',
  currentCity: 'London',
  currentCountry: 'United Kingdom',
  settlementIntent: 'UK or Canada',
  bio: 'Software engineer who loves hiking.',
};

const PROFILE_RESULT = {
  id: 'profile-uuid-1',
  userId: 'user-uuid-1',
  name: 'Priya Sharma',
  dateOfBirth: new Date('1990-05-15').toISOString(),
  gender: Gender.FEMALE,
  currentCity: 'London',
  currentCountry: 'United Kingdom',
  settlementIntent: 'UK or Canada',
  bio: 'Software engineer who loves hiking.',
  completionScore: 0,
  verificationStatus: VerificationStatus.PENDING,
  isVerified: false,
  photos: [],
  realLifeAnswers: [],
  storyPrompts: [],
  createdAt: new Date('2026-05-27T10:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-05-27T10:00:00.000Z').toISOString(),
};

const app = createApp();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockCreateProfileService.mockResolvedValue(PROFILE_RESULT);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 201 with profile data on valid body', async () => {
    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('profile-uuid-1');
    expect(res.body.data.name).toBe('Priya Sharma');
    expect(res.body.data.gender).toBe('FEMALE');
    expect(res.body.data.photos).toEqual([]);
    expect(res.body.data.realLifeAnswers).toEqual([]);
  });

  it('returns 201 when bio is omitted (bio is optional)', async () => {
    const { bio: _bio, ...bodyWithoutBio } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(bodyWithoutBio);

    expect(res.status).toBe(201);
  });

  it('passes userId from req.user to the service', async () => {
    await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(mockCreateProfileService).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-uuid-1' }),
    );
  });

  it('coerces dateOfBirth string to a Date before calling the service', async () => {
    await request(app).post('/api/v1/profile').send(VALID_BODY);

    const serviceArg = mockCreateProfileService.mock.calls[0][0];
    expect(serviceArg.dateOfBirth).toBeInstanceOf(Date);
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .set('X-Request-ID', 'profile-test-1234')
      .send(VALID_BODY);

    expect(res.headers['x-request-id']).toBe('profile-test-1234');
    expect(res.body.requestId).toBe('profile-test-1234');
  });

  // ── Validation errors — name ──────────────────────────────────────────────

  it('returns 400 when name is missing', async () => {
    const { name: _name, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when name is less than 2 characters', async () => {
    const res = await request(app).post('/api/v1/profile').send({ ...VALID_BODY, name: 'A' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Validation errors — dateOfBirth ──────────────────────────────────────

  it('returns 400 when dateOfBirth is missing', async () => {
    const { dateOfBirth: _dob, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when dateOfBirth is not a valid date string', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .send({ ...VALID_BODY, dateOfBirth: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when user is under 18 years old', async () => {
    // 2015-01-01 is only 11 years old as of 2026
    const res = await request(app)
      .post('/api/v1/profile')
      .send({ ...VALID_BODY, dateOfBirth: '2015-01-01' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Validation errors — gender ────────────────────────────────────────────

  it('returns 400 when gender is missing', async () => {
    const { gender: _gender, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when gender is not a valid enum value', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .send({ ...VALID_BODY, gender: 'INVALID_GENDER' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Validation errors — location / settlementIntent ───────────────────────

  it('returns 400 when currentCity is missing', async () => {
    const { currentCity: _city, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when currentCountry is missing', async () => {
    const { currentCountry: _country, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when settlementIntent is missing', async () => {
    const { settlementIntent: _si, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Domain errors ─────────────────────────────────────────────────────────

  it('returns 409 CONFLICT when profile already exists', async () => {
    const { ProfileAlreadyExistsError } = getProfileErrors();
    mockCreateProfileService.mockRejectedValueOnce(new ProfileAlreadyExistsError());

    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when createProfileService throws an unexpected error', async () => {
    mockCreateProfileService.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(500);
  });
});
