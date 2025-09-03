import { type Image, type InsertImage } from "@shared/schema";
import { generateImageId, generateDeleteToken } from "./utils/id-generator.js";

export interface IStorage {
  createImage(image: Omit<InsertImage, "id" | "deleteToken">): Promise<Image>;
  getImageById(id: string): Promise<Image | undefined>;
  deleteImage(id: string, deleteToken: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private images: Map<string, Image>;

  constructor() {
    this.images = new Map();
  }

  async createImage(imageData: Omit<InsertImage, "id" | "deleteToken">): Promise<Image> {
    const id = generateImageId();
    const deleteToken = generateDeleteToken();
    
    const image: Image = {
      ...imageData,
      id,
      deleteToken,
      createdAt: new Date(),
    };
    
    this.images.set(id, image);
    return image;
  }

  async getImageById(id: string): Promise<Image | undefined> {
    return this.images.get(id);
  }

  async deleteImage(id: string, deleteToken: string): Promise<boolean> {
    const image = this.images.get(id);
    if (!image || image.deleteToken !== deleteToken) {
      return false;
    }
    
    return this.images.delete(id);
  }
}

export const storage = new MemStorage();
