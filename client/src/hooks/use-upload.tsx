import { useState, useCallback } from "react";
import { uploadImage, validateFile } from "../lib/api";
import { type FileWithPreview, type UploadResult, type UploadState } from "../types/upload";
import { useToast } from "./use-toast";

export function useUpload() {
  const [state, setState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setState("idle");
    setSelectedFile(null);
    setUploadProgress(0);
    setResult(null);
    setError(null);
    
    // Clean up preview URL
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
  }, [selectedFile]);

  const selectFile = useCallback((file: File) => {
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setState("error");
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: validationError,
      });
      return;
    }

    // Clean up previous preview
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    const fileWithPreview: FileWithPreview = {
      file,
      preview,
      id: Math.random().toString(36).substr(2, 9),
    };

    setSelectedFile(fileWithPreview);
    setState("preview");
    setError(null);
  }, [selectedFile, toast]);

  const upload = useCallback(async () => {
    if (!selectedFile) return;

    setState("uploading");
    setUploadProgress(0);
    setError(null);

    try {
      const result = await uploadImage(selectedFile.file, setUploadProgress);
      setResult(result);
      setState("success");
      toast({
        title: "Upload successful!",
        description: "Your image is ready to share",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setError(errorMessage);
      setState("error");
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: errorMessage,
      });
    }
  }, [selectedFile, toast]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Unable to copy to clipboard",
      });
    }
  }, [toast]);

  return {
    state,
    selectedFile,
    uploadProgress,
    result,
    error,
    selectFile,
    upload,
    reset,
    copyToClipboard,
  };
}
