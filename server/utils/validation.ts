import { z } from "zod";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg", 
  "image/jpg",
  "image/webp",
  "image/gif",
];

export const fileValidationSchema = z.object({
  size: z.number().max(MAX_FILE_SIZE, "File size must be less than 10MB"),
  type: z.string().refine(
    (type) => ALLOWED_MIME_TYPES.includes(type),
    "File type not supported. Please use PNG, JPG, JPEG, WebP, or GIF"
  ),
});

export function validateFile(file: { size: number; type: string }) {
  return fileValidationSchema.parse(file);
}

export function getFileExtension(mime: string): string {
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg", 
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return extensions[mime] || "jpg";
}
