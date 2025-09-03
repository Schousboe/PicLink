export interface StorageProvider {
  uploadImage(input: {
    file: Buffer | ReadableStream<Uint8Array>;
    filename: string;
    mime: string;
  }): Promise<{
    providerKey: string; // e.g., Cloudinary public_id or local path
    rawUrl: string;      // direct, raw image URL
    width?: number;
    height?: number;
  }>;
}
