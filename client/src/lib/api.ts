import { type UploadResult } from "../types/upload";

export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("image", file);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = (e.loaded / e.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (error) {
          reject(new Error("Invalid response format"));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function validateFile(file: File): string | null {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

  if (!allowedTypes.includes(file.type)) {
    return "File type not supported. Please use PNG, JPG, JPEG, WebP, or GIF.";
  }

  if (file.size > maxSize) {
    return "File size must be less than 10MB.";
  }

  return null;
}

export function generateCopyFormats(result: UploadResult) {
  return {
    direct: result.rawUrl,
    short: result.shortUrl,
    markdown: `![Image](${result.shortUrl})`,
    html: `<img src="${result.shortUrl}" alt="Image" />`,
    bbcode: `[img]${result.shortUrl}[/img]`,
  };
}
