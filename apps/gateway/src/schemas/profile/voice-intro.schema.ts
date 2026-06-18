import { z } from 'zod';

export const voiceIntroUploadSchema = z.object({
  mimeType: z.enum(['audio/mpeg', 'audio/webm', 'audio/aac', 'audio/mp4']),
});

export const saveVoiceIntroSchema = z.object({
  s3Key: z.string().min(1, 's3Key is required'),
});

export type VoiceIntroUploadBody = z.infer<typeof voiceIntroUploadSchema>;
export type SaveVoiceIntroBody = z.infer<typeof saveVoiceIntroSchema>;
