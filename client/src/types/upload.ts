export interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

export interface UploadProgress {
  progress: number;
  speed: string;
  status: string;
}

export interface UploadResult {
  id: string;
  rawUrl: string;
  shortUrl: string;
  width?: number;
  height?: number;
  size: number;
  mime: string;
}

export interface CopyFormats {
  direct: string;
  short: string;
  markdown: string;
  html: string;
  bbcode: string;
}

export type UploadState = "idle" | "preview" | "uploading" | "success" | "error";
