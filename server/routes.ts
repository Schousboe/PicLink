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

  const formatDate = (date: Date | null): string => {
    if (!date) return "Unknown";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
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
    <title>PicLink — Image</title>
    <meta name="description" content="Uploaded image hosted on PicLink">
    
    <!-- OpenGraph Meta Tags -->
    <meta property="og:title" content="PicLink Image">
    <meta property="og:description" content="Uploaded image">
    <meta property="og:image" content="${image.rawUrl}">
    <meta property="og:url" content="${image.shortUrl}">
    <meta property="og:type" content="website">
    
    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="PicLink Image">
    <meta name="twitter:description" content="Uploaded image">
    <meta name="twitter:image" content="${image.rawUrl}">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        
        .header {
            background: white;
            border-bottom: 1px solid #e2e8f0;
            padding: 1rem 0;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .logo {
            width: 40px;
            height: 40px;
            background: #3b82f6;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 1rem;
        }
        
        .toolbar {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 2rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
        }
        
        .btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            transition: background-color 0.2s;
        }
        
        .btn:hover {
            background: #2563eb;
        }
        
        .btn-secondary {
            background: #64748b;
        }
        
        .btn-secondary:hover {
            background: #475569;
        }
        
        .btn-outline {
            background: transparent;
            color: #64748b;
            border: 1px solid #cbd5e1;
        }
        
        .btn-outline:hover {
            background: #f1f5f9;
        }
        
        .image-container {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .image-container img {
            max-width: 90vw;
            max-height: 90vh;
            width: auto;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .metadata {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .metadata h3 {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #1e293b;
        }
        
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .metadata-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #f1f5f9;
        }
        
        .metadata-label {
            font-weight: 500;
            color: #64748b;
        }
        
        .metadata-value {
            color: #1e293b;
            font-family: monospace;
        }
        
        .copy-section {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .copy-section h3 {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #1e293b;
        }
        
        .copy-item {
            margin-bottom: 1rem;
        }
        
        .copy-label {
            display: block;
            font-weight: 500;
            color: #64748b;
            margin-bottom: 0.25rem;
        }
        
        .copy-input-group {
            display: flex;
            gap: 0.5rem;
        }
        
        .copy-input {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.875rem;
            background: #f8fafc;
        }
        
        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            justify-content: center;
        }
        
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #059669;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            z-index: 1000;
        }
        
        .toast.show {
            transform: translateX(0);
        }
        
        @media (max-width: 768px) {
            .toolbar {
                flex-direction: column;
                align-items: stretch;
            }
            
            .btn {
                justify-content: center;
            }
            
            .metadata-grid {
                grid-template-columns: 1fr;
            }
            
            .actions {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <div class="logo">📷</div>
            <h1>PicLink</h1>
        </div>
    </header>
    
    <main class="container">
        <div class="toolbar">
            <a href="${image.rawUrl}" target="_blank" rel="noopener" class="btn" aria-label="Open original image">
                🔍 Open Original
            </a>
            <button onclick="copyToClipboard('${image.rawUrl}', 'Direct URL')" class="btn btn-secondary" aria-label="Copy direct URL">
                📋 Copy Direct URL
            </button>
            <button onclick="copyToClipboard('${image.shortUrl}', 'Share URL')" class="btn btn-secondary" aria-label="Copy share URL">
                🔗 Copy Share URL
            </button>
            <a href="/" class="btn btn-outline" aria-label="Upload another image">
                ➕ Upload Another
            </a>
        </div>
        
        <div class="image-container">
            <img src="${image.rawUrl}" alt="Uploaded image" loading="lazy" />
        </div>
        
        <div class="metadata">
            <h3>Image Information</h3>
            <div class="metadata-grid">
                <div class="metadata-item">
                    <span class="metadata-label">File Size:</span>
                    <span class="metadata-value">${formatBytes(image.size)}</span>
                </div>
                <div class="metadata-item">
                    <span class="metadata-label">MIME Type:</span>
                    <span class="metadata-value">${image.mime}</span>
                </div>
                ${image.width && image.height ? `
                <div class="metadata-item">
                    <span class="metadata-label">Dimensions:</span>
                    <span class="metadata-value">${image.width} × ${image.height}</span>
                </div>
                ` : ''}
                <div class="metadata-item">
                    <span class="metadata-label">Uploaded:</span>
                    <span class="metadata-value">${formatDate(image.createdAt)}</span>
                </div>
            </div>
        </div>
        
        <div class="copy-section">
            <h3>Share & Embed</h3>
            
            <div class="copy-item">
                <label class="copy-label">Direct URL:</label>
                <div class="copy-input-group">
                    <input type="text" class="copy-input" value="${image.rawUrl}" readonly aria-label="Direct URL">
                    <button onclick="copyToClipboard('${image.rawUrl}', 'Direct URL')" class="btn btn-outline">Copy</button>
                </div>
            </div>
            
            <div class="copy-item">
                <label class="copy-label">Markdown:</label>
                <div class="copy-input-group">
                    <input type="text" class="copy-input" value="${markdownFormat}" readonly aria-label="Markdown format">
                    <button onclick="copyToClipboard('${markdownFormat}', 'Markdown')" class="btn btn-outline">Copy</button>
                </div>
            </div>
            
            <div class="copy-item">
                <label class="copy-label">HTML:</label>
                <div class="copy-input-group">
                    <input type="text" class="copy-input" value="${htmlFormat}" readonly aria-label="HTML format">
                    <button onclick="copyToClipboard('${htmlFormat}', 'HTML')" class="btn btn-outline">Copy</button>
                </div>
            </div>
            
            <div class="copy-item">
                <label class="copy-label">BBCode:</label>
                <div class="copy-input-group">
                    <input type="text" class="copy-input" value="${bbcodeFormat}" readonly aria-label="BBCode format">
                    <button onclick="copyToClipboard('${bbcodeFormat}', 'BBCode')" class="btn btn-outline">Copy</button>
                </div>
            </div>
        </div>
        
        <div class="actions">
            <a href="${image.rawUrl}" download class="btn" target="_blank" rel="noopener" aria-label="Download image">
                💾 Download Image
            </a>
            <a href="/" class="btn btn-secondary" aria-label="Upload another image">
                ➕ Upload Another
            </a>
        </div>
    </main>
    
    <div id="toast" class="toast" role="alert" aria-live="polite"></div>
    
    <script>
        function copyToClipboard(text, label) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied ' + label + ' to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Copied ' + label + ' to clipboard!');
            });
        }
        
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        
        // Keyboard navigation support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any open modals or return to home
                window.location.href = '/';
            }
        });
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
    <title>Image Not Found - PicLink</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #334155;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        
        .error-container {
            text-align: center;
            background: white;
            padding: 3rem;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            max-width: 400px;
        }
        
        .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        
        .error-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #1e293b;
        }
        
        .error-message {
            color: #64748b;
            margin-bottom: 2rem;
        }
        
        .btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .btn:hover {
            background: #2563eb;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">🖼️</div>
        <h1 class="error-title">Image Not Found</h1>
        <p class="error-message">The image you're looking for doesn't exist or has been removed.</p>
        <a href="/" class="btn">Upload New Image</a>
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
    <title>Error - PicLink</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #334155;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        
        .error-container {
            text-align: center;
            background: white;
            padding: 3rem;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            max-width: 400px;
        }
        
        .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        
        .error-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #1e293b;
        }
        
        .error-message {
            color: #64748b;
            margin-bottom: 2rem;
        }
        
        .btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .btn:hover {
            background: #2563eb;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h1 class="error-title">Something went wrong</h1>
        <p class="error-message">${message}</p>
        <a href="/" class="btn">Go Home</a>
    </div>
</body>
</html>
  `;
}
