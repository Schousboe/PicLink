import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, Eye } from "lucide-react";
import { type FileWithPreview } from "../types/upload";
import { formatFileSize } from "../lib/api";

interface FilePreviewProps {
  file: FileWithPreview;
  onUpload: () => void;
  onCancel: () => void;
}

export function FilePreview({ file, onUpload, onCancel }: FilePreviewProps) {
  return (
    <Card className="bg-card border border-border rounded-xl p-6 shadow-sm fade-in">
      <h4 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
        <Eye className="mr-2 w-5 h-5" />
        File Preview
      </h4>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={file.preview}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
              data-testid="img-preview"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Filename:</span>
              <span className="font-medium text-card-foreground" data-testid="text-filename">
                {file.file.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-medium text-card-foreground" data-testid="text-filesize">
                {formatFileSize(file.file.size)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium text-card-foreground" data-testid="text-filetype">
                {file.file.type}
              </span>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={onUpload}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-upload"
            >
              <Upload className="mr-2 w-4 h-4" />
              Upload Image
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="border border-border hover:bg-accent text-card-foreground"
              data-testid="button-cancel-preview"
            >
              <X className="mr-2 w-4 h-4" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
