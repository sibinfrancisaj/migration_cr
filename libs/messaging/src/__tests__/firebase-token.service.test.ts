import { createFirebaseToken, FirebaseNotConfiguredError } from '../firebase-token.service.js';

// ─── Mock firebase lib ────────────────────────────────────────────────────────

const mockCreateCustomToken = jest.fn();

jest.mock('@abroad-matrimony/firebase', () => ({
  isFirebaseConfigured: jest.fn(),
  getFirebaseAuth: jest.fn(() => ({
    createCustomToken: mockCreateCustomToken,
  })),
}));

import { isFirebaseConfigured } from '@abroad-matrimony/firebase';

const mockIsFirebaseConfigured = isFirebaseConfigured as jest.MockedFunction<typeof isFirebaseConfigured>;

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createFirebaseToken()', () => {
  const USER_ID = 'user-uuid-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('returns a Firebase custom token when Firebase is configured', async () => {
      mockIsFirebaseConfigured.mockReturnValue(true);
      mockCreateCustomToken.mockResolvedValue('firebase.custom.token.abc');

      const token = await createFirebaseToken(USER_ID);

      expect(token).toBe('firebase.custom.token.abc');
      expect(mockCreateCustomToken).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('Firebase not configured', () => {
    it('throws FirebaseNotConfiguredError when credentials are absent', async () => {
      mockIsFirebaseConfigured.mockReturnValue(false);

      await expect(createFirebaseToken(USER_ID)).rejects.toBeInstanceOf(
        FirebaseNotConfiguredError,
      );
      expect(mockCreateCustomToken).not.toHaveBeenCalled();
    });
  });

  describe('FirebaseNotConfiguredError', () => {
    it('has the correct name property', () => {
      const err = new FirebaseNotConfiguredError();
      expect(err.name).toBe('FirebaseNotConfiguredError');
      expect(err instanceof Error).toBe(true);
    });
  });
});
