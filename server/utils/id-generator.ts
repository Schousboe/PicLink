import { customAlphabet } from "nanoid";

// Use URL-safe characters, exclude similar looking ones
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 10);

export function generateImageId(): string {
  return nanoid();
}

export function generateDeleteToken(): string {
  return nanoid();
}
