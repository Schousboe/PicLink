import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import { storage } from "./storage.js";
import { CloudinaryProvider } from "./providers/cloudinary-provider.js";
import { LocalProvider } from "./providers/local-provider.js";
import { validateFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./utils/validation.js";
import { insertImageSchema, type UploadResponse } from "@shared/schema";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Initialize storage provider based on environment
const getStorageProvider = () => {
  const provider = process.env.STORAGE_PROVIDER || "local";
  
  if (provider === "cloudinary") {
    return new CloudinaryProvider();
  }
  
  return new LocalProvider();
};

export async function registerRoutes(app: Express): Promise<Server> {
  const storageProvider = getStorageProvider();

  // Rate limiting (basic in-memory implementation)
  const uploadCounts = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = 10; // uploads per hour
  const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

  const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const userLimit = uploadCounts.get(ip);
    
    if (!userLimit || now > userLimit.resetTime) {
      uploadCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
      return true;
    }
    
    if (userLimit.count >= RATE_LIMIT) {
      return false;
    }
    
    userLimit.count++;
    return true;
  };

  // Upload endpoint
  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";
      
      // Rate limiting check
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
          message: "Rate limit exceeded. Please try again later.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      // Validate file on server side
      validateFile({
        size: req.file.size,
        type: req.file.mimetype,
      });

      // Upload to storage provider
      const uploadResult = await storageProvider.uploadImage({
        file: req.file.buffer,
        filename: req.file.originalname,
        mime: req.file.mimetype,
      });

      // Store metadata in database
      const image = await storage.createImage({
        provider: process.env.STORAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local",
        providerKey: uploadResult.providerKey,
        rawUrl: uploadResult.rawUrl,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        mime: req.file.mimetype,
        size: req.file.size,
      });

      // Get the host for URLs
      const host = req.get("host") || "localhost:5000";
      const protocol = req.secure ? "https" : "http";
      const shortUrl = `${protocol}://${host}/i/${image.id}`;
      const rawUrl = `${protocol}://${host}/raw/${image.id}`;

      const response: UploadResponse = {
        id: image.id,
        rawUrl: rawUrl,
        shortUrl,
        width: image.width || undefined,
        height: image.height || undefined,
        size: image.size,
        mime: image.mime,
      };

      res.json(response);
    } catch (error) {
      console.error("Upload error:", error);
      
      if (error instanceof Error) {
        return res.status(400).json({
          message: error.message,
        });
      }
      
      res.status(500).json({
        message: "Internal server error during upload",
      });
    }
  });

  // Image view page endpoint
  app.get("/i/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const image = await storage.getImageById(id);
      
      if (!image) {
        return res.status(404).send(generateNotFoundPage());
      }

      const host = req.get("host") || "localhost:5000";
      const protocol = req.secure ? "https" : "http";
      const rawUrl = `${protocol}://${host}/raw/${id}`;
      const shortUrl = `${protocol}://${host}/i/${id}`;

      // Set cache headers for HTML page
      res.set({
        "Cache-Control": "public, max-age=600, s-maxage=600",
        "Content-Type": "text/html",
      });

      const html = generateImageViewPage({
        id: image.id,
        rawUrl,
        shortUrl,
        width: image.width,
        height: image.height,
        size: image.size,
        mime: image.mime,
        createdAt: image.createdAt,
      });

      res.send(html);
    } catch (error) {
      console.error("Image view error:", error);
      res.status(500).send(generateErrorPage("Internal server error"));
    }
  });

  // Raw image endpoint
  app.get("/raw/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const image = await storage.getImageById(id);
      
      if (!image) {
        return res.status(404).json({
          message: "Image not found",
        });
      }

      // Set cache headers for immutable raw image
      res.set({
        "Cache-Control": "public, immutable, max-age=31536000",
        "Content-Type": image.mime,
      });

      // For local storage, serve from uploads directory
      if (image.provider === "local") {
        const filePath = path.join(process.cwd(), "uploads", image.providerKey);
        res.sendFile(filePath);
      } else {
        // For cloudinary, redirect to their URL
        res.redirect(image.rawUrl);
      }
    } catch (error) {
      console.error("Raw image error:", error);
      res.status(500).json({
        message: "Internal server error",
      });
    }
  });

  // Serve uploaded files for local storage
  if (process.env.STORAGE_PROVIDER !== "cloudinary") {
    app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
      maxAge: "1y",
      immutable: true,
    }));
  }

  const httpServer = createServer(app);
  return httpServer;
}

// HTML template functions
function generateImageViewPage(image: {
  id: string;
  rawUrl: string;
  shortUrl: string;
  width: number | null;
  height: number | null;
  size: number;
  mime: string;
  createdAt: Date | null;
}) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const markdownFormat = `![Image](${image.rawUrl})`;
  const htmlFormat = `<img src="${image.rawUrl}" alt="Image" />`;
  const bbcodeFormat = `[img]${image.rawUrl}[/img]`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image</title>
    <meta name="description" content="Uploaded image">
    
    <!-- OpenGraph Meta Tags -->
    <meta property="og:title" content="Image">
    <meta property="og:description" content="Uploaded image">
    <meta property="og:image" content="${image.rawUrl}">
    <meta property="og:url" content="${image.shortUrl}">
    <meta property="og:type" content="website">
    
    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Image">
    <meta name="twitter:description" content="Uploaded image">
    <meta name="twitter:image" content="${image.rawUrl}">
    
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen">
    <main class="max-w-4xl mx-auto p-4">
        <!-- Toolbar -->
        <div class="bg-white rounded-lg border p-4 mb-4 flex gap-2">
            <a href="${image.rawUrl}" target="_blank" rel="noopener" 
               class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
               aria-label="Open image file">
                Open image file
            </a>
        </div>
        
        <!-- Image Viewer -->
        <div class="bg-white rounded-lg border p-4 mb-4 text-center">
            <img src="${image.rawUrl}" alt="Image" class="max-w-full max-h-[90vh] mx-auto" />
        </div>
        
        <!-- Copy Snippets -->
        <div class="bg-white rounded-lg border p-4 mb-4">
            <h3 class="text-lg font-medium mb-4">Copy snippets</h3>
            
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Direct URL</label>
                    <div class="flex gap-2">
                        <input type="text" value="${image.rawUrl}" readonly 
                               class="flex-1 p-2 border rounded bg-gray-50 font-mono text-sm"
                               aria-label="Direct URL">
                        <button onclick="copyToClipboard('${image.rawUrl}', 'Direct URL')" 
                                class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                                aria-label="Copy direct URL">
                            Copy
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Markdown</label>
                    <div class="flex gap-2">
                        <input type="text" value="${markdownFormat}" readonly 
                               class="flex-1 p-2 border rounded bg-gray-50 font-mono text-sm"
                               aria-label="Markdown format">
                        <button onclick="copyToClipboard('${markdownFormat}', 'Markdown')" 
                                class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                                aria-label="Copy markdown">
                            Copy
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">BBCode</label>
                    <div class="flex gap-2">
                        <input type="text" value="${bbcodeFormat}" readonly 
                               class="flex-1 p-2 border rounded bg-gray-50 font-mono text-sm"
                               aria-label="BBCode format">
                        <button onclick="copyToClipboard('${bbcodeFormat}', 'BBCode')" 
                                class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                                aria-label="Copy BBCode">
                            Copy
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">HTML</label>
                    <div class="flex gap-2">
                        <input type="text" value="${htmlFormat}" readonly 
                               class="flex-1 p-2 border rounded bg-gray-50 font-mono text-sm"
                               aria-label="HTML format">
                        <button onclick="copyToClipboard('${htmlFormat}', 'HTML')" 
                                class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                                aria-label="Copy HTML">
                            Copy
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Upload Your Own -->
        <div class="text-center">
            <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
               aria-label="Upload your own image">
                Upload your own
            </a>
        </div>
    </main>
    
    <div id="toast" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded transform translate-x-full transition-transform z-50" 
         role="alert" aria-live="polite"></div>
    
    <script>
        function copyToClipboard(text, label) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied ' + label + '!');
            }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Copied ' + label + '!');
            });
        }
        
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.remove('translate-x-full');
            
            setTimeout(() => {
                toast.classList.add('translate-x-full');
            }, 3000);
        }
    </script>
</body>
</html>
  `;
}

function generateNotFoundPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Not Found</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="text-center bg-white p-8 rounded-lg border max-w-md">
        <h1 class="text-xl font-medium mb-2">Image Not Found</h1>
        <p class="text-gray-600 mb-4">The image you're looking for doesn't exist or has been removed.</p>
        <a href="/" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Upload New Image</a>
    </div>
</body>
</html>
  `;
}

function generateErrorPage(message: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="text-center bg-white p-8 rounded-lg border max-w-md">
        <h1 class="text-xl font-medium mb-2">Something went wrong</h1>
        <p class="text-gray-600 mb-4">${message}</p>
        <a href="/" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go Home</a>
    </div>
</body>
</html>
  `;
}
