import fs from "fs/promises";
import path from "path";
import { StorageProvider } from "./storage-provider.js";
import { generateImageId } from "../utils/id-generator.js";
import { getFileExtension } from "../utils/validation.js";

export class LocalProvider implements StorageProvider {
  private uploadDir = path.join(process.cwd(), "uploads");

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
    // Ensure upload directory exists
    await fs.mkdir(this.uploadDir, { recursive: true });

    const id = generateImageId();
    const ext = getFileExtension(input.mime);
    const filename = `${id}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    // Convert stream to buffer if needed
    const buffer = input.file instanceof Buffer ? input.file : Buffer.from(await this.streamToBuffer(input.file));
    
    // Write file to disk
    await fs.writeFile(filePath, buffer);

    // Get image dimensions (basic implementation)
    const dimensions = await this.getImageDimensions(buffer, input.mime);

    return {
      providerKey: filename,
      rawUrl: `/uploads/${filename}`,
      width: dimensions?.width,
      height: dimensions?.height,
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

  private async getImageDimensions(buffer: Buffer, mime: string): Promise<{ width: number; height: number } | null> {
    // Basic dimension detection for common formats
    try {
      if (mime === "image/png") {
        return this.getPngDimensions(buffer);
      } else if (mime === "image/jpeg" || mime === "image/jpg") {
        return this.getJpegDimensions(buffer);
      }
    } catch (error) {
      console.error("Error getting image dimensions:", error);
    }
    return null;
  }

  private getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
    if (buffer.length < 24) return null;
    
    // PNG signature check
    if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
      return null;
    }
    
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    
    return { width, height };
  }

  private getJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
    let offset = 2; // Skip initial 0xFFD8
    
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) break;
      
      const marker = buffer[offset + 1];
      
      // SOF (Start of Frame) markers
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || 
          (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      
      // Skip this segment
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += segmentLength + 2;
    }
    
    return null;
  }
}
