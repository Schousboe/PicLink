import { useEffect } from "react";
import { useUpload } from "../hooks/use-upload";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { UploadZone } from "../components/upload-zone";
import { FilePreview } from "../components/file-preview";
import { UploadProgress } from "../components/upload-progress";
import { SuccessResult } from "../components/success-result";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Zap, Shield, Link } from "lucide-react";

export default function Home() {
  const {
    state,
    selectedFile,
    uploadProgress,
    result,
    error,
    selectFile,
    upload,
    reset,
    copyToClipboard,
  } = useUpload();

  // Handle keyboard paste events globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (state !== "idle") return;
      
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          selectFile(file);
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [state, selectFile]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-card-foreground mb-4">
              Upload & Share Images{" "}
              <span className="text-primary">Instantly</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Drop your images, get direct links. Simple, fast, and reliable image hosting for everyone.
            </p>
          </div>

          {/* Upload Section */}
          <div className="space-y-8">
            {/* Upload Zone - Show when idle */}
            {state === "idle" && (
              <UploadZone onFileSelect={selectFile} />
            )}

            {/* File Preview - Show when file selected */}
            {state === "preview" && selectedFile && (
              <FilePreview
                file={selectedFile}
                onUpload={upload}
                onCancel={reset}
              />
            )}

            {/* Upload Progress - Show during upload */}
            {state === "uploading" && (
              <UploadProgress
                progress={uploadProgress}
                onCancel={reset}
              />
            )}

            {/* Success Result - Show after successful upload */}
            {state === "success" && result && (
              <SuccessResult
                result={result}
                onCopy={copyToClipboard}
                onUploadAnother={reset}
              />
            )}

            {/* Error Message - Show on error */}
            {state === "error" && error && (
              <Card className="bg-card border border-destructive rounded-xl p-6 shadow-sm fade-in">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <AlertTriangle className="text-xl text-destructive w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-card-foreground mb-2">Upload Failed</h4>
                    <p className="text-muted-foreground mb-4" data-testid="text-error-message">
                      {error}
                    </p>
                    <div className="flex space-x-3">
                      <Button
                        onClick={reset}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        data-testid="button-try-again"
                      >
                        <RotateCcw className="mr-2 w-4 h-4" />
                        Try Again
                      </Button>
                      <Button
                        onClick={reset}
                        variant="outline"
                        className="border border-border hover:bg-accent text-card-foreground"
                        data-testid="button-dismiss-error"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Features Section */}
          <div className="mt-16">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-card-foreground mb-4">Why Choose PicLink?</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Fast, reliable, and user-friendly image hosting with all the features you need.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-chart-1/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="text-2xl text-chart-1 w-8 h-8" />
                </div>
                <h4 className="text-xl font-semibold text-card-foreground mb-2">Lightning Fast</h4>
                <p className="text-muted-foreground">
                  Upload and share your images in seconds with our optimized infrastructure.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-chart-2/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-2xl text-chart-2 w-8 h-8" />
                </div>
                <h4 className="text-xl font-semibold text-card-foreground mb-2">Secure & Private</h4>
                <p className="text-muted-foreground">
                  Your images are stored securely with EXIF data removed for privacy protection.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-chart-3/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Link className="text-2xl text-chart-3 w-8 h-8" />
                </div>
                <h4 className="text-xl font-semibold text-card-foreground mb-2">Direct Links</h4>
                <p className="text-muted-foreground">
                  Get direct image URLs that work everywhere - no redirects or ads.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
