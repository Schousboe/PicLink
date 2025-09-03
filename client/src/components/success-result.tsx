import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Copy, ExternalLink, Plus, Clipboard } from "lucide-react";
import { type UploadResult, type CopyFormats } from "../types/upload";
import { generateCopyFormats } from "../lib/api";

interface SuccessResultProps {
  result: UploadResult;
  onCopy: (text: string, label: string) => void;
  onUploadAnother: () => void;
}

export function SuccessResult({ result, onCopy, onUploadAnother }: SuccessResultProps) {
  const formats = generateCopyFormats(result);

  const handleOpenImage = () => {
    window.open(result.shortUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyAll = () => {
    const allFormats = Object.entries(formats)
      .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
      .join("\n");
    onCopy(allFormats, "All formats");
  };

  return (
    <Card className="bg-card border border-border rounded-xl p-6 shadow-sm fade-in">
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 bg-chart-2/10 rounded-full flex items-center justify-center mr-4">
          <CheckCircle className="text-2xl text-chart-2 w-6 h-6" />
        </div>
        <div>
          <h4 className="text-xl font-semibold text-card-foreground">Upload Successful!</h4>
          <p className="text-muted-foreground">Your image is ready to share</p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {/* Direct Link */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-card-foreground">Direct Link</Label>
          <div className="flex">
            <Input
              value={formats.direct}
              readOnly
              className="flex-1 bg-input border border-border rounded-l-lg font-mono text-sm"
              data-testid="input-direct-link"
            />
            <Button
              onClick={() => onCopy(formats.direct, "Direct link")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-l-none"
              aria-label="Copy direct link"
              data-testid="button-copy-direct"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Short Link */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-card-foreground">Short Link</Label>
          <div className="flex">
            <Input
              value={formats.short}
              readOnly
              className="flex-1 bg-input border border-border rounded-l-lg font-mono text-sm"
              data-testid="input-short-link"
            />
            <Button
              onClick={() => onCopy(formats.short, "Short link")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-l-none"
              aria-label="Copy short link"
              data-testid="button-copy-short"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Embed Codes */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Markdown */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-card-foreground">Markdown</Label>
            <div className="flex">
              <Input
                value={formats.markdown}
                readOnly
                className="flex-1 bg-input border border-border rounded-l-lg font-mono text-xs"
                data-testid="input-markdown"
              />
              <Button
                onClick={() => onCopy(formats.markdown, "Markdown")}
                variant="outline"
                className="rounded-l-none"
                aria-label="Copy markdown"
                data-testid="button-copy-markdown"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* HTML */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-card-foreground">HTML</Label>
            <div className="flex">
              <Input
                value={formats.html}
                readOnly
                className="flex-1 bg-input border border-border rounded-l-lg font-mono text-xs"
                data-testid="input-html"
              />
              <Button
                onClick={() => onCopy(formats.html, "HTML")}
                variant="outline"
                className="rounded-l-none"
                aria-label="Copy HTML"
                data-testid="button-copy-html"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* BBCode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-card-foreground">BBCode</Label>
          <div className="flex">
            <Input
              value={formats.bbcode}
              readOnly
              className="flex-1 bg-input border border-border rounded-l-lg font-mono text-sm"
              data-testid="input-bbcode"
            />
            <Button
              onClick={() => onCopy(formats.bbcode, "BBCode")}
              variant="outline"
              className="rounded-l-none"
              aria-label="Copy BBCode"
              data-testid="button-copy-bbcode"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleOpenImage}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          data-testid="button-open-image"
        >
          <ExternalLink className="mr-2 w-4 h-4" />
          Open Image
        </Button>
        <Button
          onClick={onUploadAnother}
          className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          data-testid="button-upload-another"
        >
          <Plus className="mr-2 w-4 h-4" />
          Upload Another
        </Button>
        <Button
          onClick={handleCopyAll}
          variant="outline"
          className="bg-accent hover:bg-accent/80 text-accent-foreground"
          data-testid="button-copy-all"
        >
          <Clipboard className="mr-2 w-4 h-4" />
          Copy All
        </Button>
      </div>
    </Card>
  );
}
