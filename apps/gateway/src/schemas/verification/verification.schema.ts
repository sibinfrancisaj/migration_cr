import { z } from 'zod';

export const submitVerificationSchema = z.object({
  idDocType: z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT']),
  idDocS3Key: z.string().min(1, 'idDocS3Key is required'),
  selfieS3Key: z.string().min(1, 'selfieS3Key is required'),
});

export const verificationUploadUrlSchema = z.object({
  fileType: z.enum(['id_document', 'selfie']),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export type SubmitVerificationBody = z.infer<typeof submitVerificationSchema>;
export type VerificationUploadUrlQuery = z.infer<typeof verificationUploadUrlSchema>;
