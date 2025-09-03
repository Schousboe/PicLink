import { v2 as cloudinary } from "cloudinary";
import { StorageProvider } from "./storage-provider.js";

export class CloudinaryProvider implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(input: {
    file: Buffer | ReadableStream<Uint8Array>;
    filename: string;
    mime: string;
  }): Promise<{
    providerKey: string;
    rawUrl: string;
    width?: number;
    height?: number;
  }> {
    const buffer = input.file instanceof Buffer ? input.file : Buffer.from(await this.streamToBuffer(input.file));
    
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          quality: "auto",
          fetch_format: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    }) as any;

    return {
      providerKey: result.public_id,
      rawUrl: result.secure_url,
      width: result.width,
      height: result.height,
    };
  }

  private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }
}
