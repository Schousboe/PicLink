import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, ExternalLink, Download, Share2, Calendar, FileText, Maximize } from "lucide-react";
import { formatFileSize } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { type UploadResult } from "../types/upload";

export default function ImageViewer() {
  const { id } = useParams();
  const [image, setImage] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;

    const fetchImage = async () => {
      try {
        const response = await fetch(`/api/image/${id}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? "Image not found" : "Failed to load image");
        }
        const data = await response.json();
        setImage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load image");
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [id]);

  const copyToClipboard = async (text: string, label: string) => {
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
  };

  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.rawUrl;
    link.download = `image-${image.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFullscreen = () => {
    if (!image) return;
    window.open(image.rawUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-6xl mx-auto">
            <Skeleton className="w-full h-96 rounded-xl mb-6" />
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <Skeleton className="w-full h-48 rounded-lg" />
              </div>
              <div className="space-y-4">
                <Skeleton className="w-full h-12" />
                <Skeleton className="w-full h-12" />
                <Skeleton className="w-full h-12" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <Card className="bg-card border border-border rounded-xl p-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-card-foreground mb-2">Image Not Found</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Go Home
              </Button>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!image) {
    return null;
  }

  const formats = {
    direct: image.rawUrl,
    short: image.shortUrl,
    markdown: `![Image](${image.shortUrl})`,
    html: `<img src="${image.shortUrl}" alt="Image" />`,
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Main Image Display */}
          <Card className="bg-card border border-border rounded-xl p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-card-foreground">Image Viewer</h1>
              <div className="flex space-x-2">
                <Button
                  onClick={handleFullscreen}
                  variant="outline"
                  size="sm"
                  data-testid="button-fullscreen"
                >
                  <Maximize className="w-4 h-4 mr-2" />
                  Full Size
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="sm"
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
            
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-96">
              <img
                src={image.rawUrl}
                alt="Uploaded image"
                className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
                data-testid="img-main"
              />
            </div>
          </Card>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Image Information */}
            <div className="md:col-span-2">
              <Card className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-xl font-semibold text-card-foreground mb-4">Image Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">File Size</Label>
                    <p className="text-card-foreground font-mono" data-testid="text-filesize">
                      {formatFileSize(image.size)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">File Type</Label>
                    <p className="text-card-foreground font-mono" data-testid="text-mimetype">
                      {image.mime}
                    </p>
                  </div>
                  {image.width && image.height && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Dimensions</Label>
                        <p className="text-card-foreground font-mono" data-testid="text-dimensions">
                          {image.width} × {image.height}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Aspect Ratio</Label>
                        <p className="text-card-foreground font-mono">
                          {(image.width / image.height).toFixed(2)}:1
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>

            {/* Sharing Options */}
            <div>
              <Card className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-xl font-semibold text-card-foreground mb-4 flex items-center">
                  <Share2 className="w-5 h-5 mr-2" />
                  Share Image
                </h3>
                
                <div className="space-y-4">
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
                        onClick={() => copyToClipboard(formats.direct, "Direct link")}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-l-none"
                        data-testid="button-copy-direct"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Page Link */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-card-foreground">Page Link</Label>
                    <div className="flex">
                      <Input
                        value={formats.short}
                        readOnly
                        className="flex-1 bg-input border border-border rounded-l-lg font-mono text-sm"
                        data-testid="input-page-link"
                      />
                      <Button
                        onClick={() => copyToClipboard(formats.short, "Page link")}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-l-none"
                        data-testid="button-copy-page"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

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
                        onClick={() => copyToClipboard(formats.markdown, "Markdown")}
                        variant="outline"
                        className="rounded-l-none"
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
                        onClick={() => copyToClipboard(formats.html, "HTML")}
                        variant="outline"
                        className="rounded-l-none"
                        data-testid="button-copy-html"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}