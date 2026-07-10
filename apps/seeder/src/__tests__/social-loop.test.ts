/**
 * Tests for social-loop.service.ts — state machine orchestrator.
 */

// ── Module mocks (must be before imports) ────────────────────────────────────

jest.mock('@abroad-matrimony/db', () => ({
  getPrismaClient: jest.fn(),
}));

jest.mock('../lib/gateway-client.js', () => ({
  getGatewayClient: jest.fn(),
  asUser: jest.fn().mockReturnValue({ headers: { Authorization: 'Bearer seeder-token' } }),
}));

jest.mock('../lib/bot-state.js', () => ({
  getBotState: jest.fn(),
  saveBotState: jest.fn().mockResolvedValue(undefined),
  generatePersona: jest.fn(),
}));

jest.mock('../services/reactive-actions.js', () => ({
  runReactiveActions: jest.fn(),
}));

jest.mock('../services/proactive-actions.js', () => ({
  sendConnectionRequest: jest.fn(),
  postInGroup: jest.fn(),
  logHabit: jest.fn(),
  rsvpToEvent: jest.fn(),
  respondToPrompt: jest.fn(),
  logProfileView: jest.fn(),
  earlyAccessDrop: jest.fn(),
}));

import { runBotCycle, runSocialLoop } from '../services/social-loop.service.js';
import { getPrismaClient } from '@abroad-matrimony/db';
import { getGatewayClient } from '../lib/gateway-client.js';
import { getBotState, saveBotState } from '../lib/bot-state.js';
import { runReactiveActions } from '../services/reactive-actions.js';
import {
  sendConnectionRequest,
  postInGroup,
  logHabit,
  rsvpToEvent,
  respondToPrompt,
  logProfileView,
  earlyAccessDrop,
} from '../services/proactive-actions.js';

const mockReactiveResult = {
  connectionsHandled: 1,
  introsHandled: 0,
  postsLiked: 1,
  commentsAdded: 0,
  responsesResonated: 1,
};

const mockPersona = {
  aggressiveness: 0.8,
  chattiness: 0.7,
  habitConsistency: 0.6,
  connectionAcceptRate: 0.8,
  introAcceptRate: 0.75,
};

const mockBotState = {
  persona: mockPersona,
  lastActionAt: null,
  sentConnectionIds: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (getBotState as jest.Mock).mockResolvedValue(mockBotState);
  (runReactiveActions as jest.Mock).mockResolvedValue(mockReactiveResult);
  // Default: all proactive actions succeed
  (sendConnectionRequest as jest.Mock).mockResolvedValue(true);
  (postInGroup as jest.Mock).mockResolvedValue(true);
  (logHabit as jest.Mock).mockResolvedValue(true);
  (rsvpToEvent as jest.Mock).mockResolvedValue(true);
  (respondToPrompt as jest.Mock).mockResolvedValue(true);
  (logProfileView as jest.Mock).mockResolvedValue(true);
  (earlyAccessDrop as jest.Mock).mockResolvedValue(false);
  (getGatewayClient as jest.Mock).mockReturnValue({});
  (getPrismaClient as jest.Mock).mockReturnValue({
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
  });
});

// ── runBotCycle ───────────────────────────────────────────────────────────────

describe('runBotCycle', () => {
  it('runs reactive actions BEFORE proactive actions', async () => {
    const callOrder: string[] = [];
    (runReactiveActions as jest.Mock).mockImplementation(async () => {
      callOrder.push('reactive');
      return mockReactiveResult;
    });
    (logHabit as jest.Mock).mockImplementation(async () => {
      callOrder.push('proactive');
      return true;
    });

    await runBotCycle('user-a');

    const reactiveIndex = callOrder.indexOf('reactive');
    const proactiveIndex = callOrder.indexOf('proactive');
    expect(reactiveIndex).toBeLessThan(proactiveIndex);
  });

  it('loads bot state at start and saves it at end', async () => {
    await runBotCycle('user-a');
    expect(getBotState).toHaveBeenCalledWith('user-a');
    expect(saveBotState).toHaveBeenCalledWith('user-a', expect.objectContaining({
      persona: mockPersona,
      lastActionAt: expect.any(String),
    }));
  });

  it('returns reactive result and proactive count', async () => {
    const result = await runBotCycle('user-a');
    expect(result.userId).toBe('user-a');
    expect(result.reactive).toEqual(mockReactiveResult);
    expect(result.proactiveCount).toBeGreaterThan(0);
  });

  it('proactive count does not exceed maxProactive (based on aggressiveness)', async () => {
    // aggressiveness 0.8 → maxProactive = round(1 + 0.8 * 2) = 3
    const result = await runBotCycle('user-a');
    expect(result.proactiveCount).toBeLessThanOrEqual(3);
  });
});

// ── runSocialLoop ─────────────────────────────────────────────────────────────

describe('runSocialLoop', () => {
  it('returns aggregated counts from all bot cycles', async () => {
    (getPrismaClient as jest.Mock).mockReturnValue({
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'u1' }, { id: 'u2' }, { id: 'u3' },
        ]),
      },
    });

    const result = await runSocialLoop();
    expect(result.usersActive).toBeGreaterThan(0);
    expect(result.totalReactive.connectionsHandled).toBeGreaterThanOrEqual(0);
    expect(result.totalProactive).toBeGreaterThanOrEqual(0);
  });

  it('handles individual cycle failures gracefully without aborting the loop', async () => {
    (getPrismaClient as jest.Mock).mockReturnValue({
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'u1' }, { id: 'u2' },
        ]),
      },
    });

    // First user throws, second succeeds
    (runReactiveActions as jest.Mock)
      .mockRejectedValueOnce(new Error('Gateway down'))
      .mockResolvedValueOnce(mockReactiveResult);

    const result = await runSocialLoop();
    // Should complete without throwing
    expect(result).toBeDefined();
    expect(result.usersActive).toBeGreaterThan(0);
  });

  it('returns zero totals when no seeded users exist', async () => {
    (getPrismaClient as jest.Mock).mockReturnValue({
      user: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await runSocialLoop();
    expect(result.usersActive).toBe(0);
    expect(result.totalProactive).toBe(0);
  });
});
