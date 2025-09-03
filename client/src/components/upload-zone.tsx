import { useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelect, disabled = false }: UploadZoneProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
    // Reset input value to allow selecting same file again
    e.target.value = "";
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.getElementById("file-input") as HTMLInputElement;
    input?.click();
  }, [disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick, disabled]);

  // Handle paste events
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (disabled) return;
    
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, disabled]);

  return (
    <Card className="bg-card border border-border rounded-xl p-8 shadow-sm">
      <div
        className={cn(
          "border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center transition-all duration-200 cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drop files here or click to select"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-testid="upload-zone"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <CloudUpload className="text-3xl text-primary w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-card-foreground mb-2">
              Drop your images here
            </h3>
            <p className="text-muted-foreground mb-4">
              or click to browse • paste from clipboard with Ctrl+V
            </p>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={disabled}
              data-testid="button-choose-files"
            >
              <FolderOpen className="mr-2 w-4 h-4" />
              Choose Files
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Supports: PNG, JPG, JPEG, WebP, GIF • Max size: 10MB
          </p>
        </div>
      </div>

      <input
        type="file"
        id="file-input"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileInput}
        data-testid="input-file"
      />
    </Card>
  );
}
