import { checkImageSafety, assertImageSafe, ImageModerationRejectedError } from '../image-moderation.service.js';

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: jest.fn().mockReturnValue({}),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeVisionResponse(annotation: Record<string, string>): Response {
  return {
    ok: true,
    json: async () => ({ responses: [{ safeSearchAnnotation: annotation }] }),
  } as unknown as Response;
}

describe('checkImageSafety — Vision not configured', () => {
  beforeAll(() => {
    delete process.env['GOOGLE_VISION_API_KEY'];
  });

  it('returns safe:true without calling fetch', async () => {
    const result = await checkImageSafety('base64data');
    expect(result.safe).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('checkImageSafety — Vision configured', () => {
  beforeAll(() => {
    process.env['GOOGLE_VISION_API_KEY'] = 'test-key';
  });
  afterAll(() => {
    delete process.env['GOOGLE_VISION_API_KEY'];
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns safe:true for POSSIBLE adult likelihood', async () => {
    mockFetch.mockResolvedValue(makeVisionResponse({ adult: 'POSSIBLE', violence: 'VERY_UNLIKELY' }));
    const result = await checkImageSafety('base64data');
    expect(result.safe).toBe(true);
  });

  it('returns safe:false for LIKELY adult content', async () => {
    mockFetch.mockResolvedValue(makeVisionResponse({ adult: 'LIKELY' }));
    const result = await checkImageSafety('base64data');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('adult');
  });

  it('returns safe:false for VERY_LIKELY violence', async () => {
    mockFetch.mockResolvedValue(makeVisionResponse({ violence: 'VERY_LIKELY' }));
    const result = await checkImageSafety('base64data');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('violent');
  });

  it('fails open (safe:true) when Vision API returns non-OK status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const result = await checkImageSafety('base64data');
    expect(result.safe).toBe(true);
  });

  it('fails open (safe:true) when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await checkImageSafety('base64data');
    expect(result.safe).toBe(true);
  });
});

describe('assertImageSafe', () => {
  beforeAll(() => {
    process.env['GOOGLE_VISION_API_KEY'] = 'test-key';
  });
  afterAll(() => {
    delete process.env['GOOGLE_VISION_API_KEY'];
  });
  beforeEach(() => jest.clearAllMocks());

  it('does not throw for safe images', async () => {
    mockFetch.mockResolvedValue(makeVisionResponse({ adult: 'VERY_UNLIKELY' }));
    await expect(assertImageSafe('safe')).resolves.toBeUndefined();
  });

  it('throws ImageModerationRejectedError for unsafe images', async () => {
    mockFetch.mockResolvedValue(makeVisionResponse({ adult: 'VERY_LIKELY' }));
    await expect(assertImageSafe('unsafe')).rejects.toThrow(ImageModerationRejectedError);
  });
});
