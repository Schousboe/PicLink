import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface UploadProgressProps {
  progress: number;
  onCancel?: () => void;
}

export function UploadProgress({ progress, onCancel }: UploadProgressProps) {
  return (
    <Card className="bg-card border border-border rounded-xl p-6 shadow-sm fade-in">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-card-foreground flex items-center">
          <Loader2 className="mr-2 w-5 h-5 animate-spin" />
          Uploading Image...
        </h4>
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-destructive hover:text-destructive/80"
            data-testid="button-cancel-upload"
          >
            Cancel
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <Progress 
          value={progress} 
          className="w-full"
          aria-label="Upload progress"
          data-testid="progress-upload"
        />

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground" data-testid="text-upload-status">
            Uploading... {Math.round(progress)}%
          </span>
        </div>
      </div>
    </Card>
  );
}
