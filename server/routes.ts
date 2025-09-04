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
  const bbcodeFormat = `[img]${image.rawUrl}[/img]`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image</title>
    <meta name="description" content="Uploaded image">
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: ['class'],
            theme: {
                extend: {
                    colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: 'hsl(var(--card))',
                        'card-foreground': 'hsl(var(--card-foreground))',
                        primary: 'hsl(var(--primary))',
                        'primary-foreground': 'hsl(var(--primary-foreground))',
                        secondary: 'hsl(var(--secondary))',
                        'secondary-foreground': 'hsl(var(--secondary-foreground))',
                        muted: 'hsl(var(--muted))',
                        'muted-foreground': 'hsl(var(--muted-foreground))',
                        accent: 'hsl(var(--accent))',
                        'accent-foreground': 'hsl(var(--accent-foreground))',
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))'
                    }
                }
            }
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');

        :root {
          --background: 195.6 27.17% 36.08%;
          --foreground: 0 6.67% 2.94%;
          --card: 180 6.6667% 97.0588%;
          --card-foreground: 240 2.7% 14.51%;
          --popover: 0 0% 100%;
          --popover-foreground: 210 25% 7.8431%;
          --primary: 203.8863 88.2845% 53.1373%;
          --primary-foreground: 0 0% 100%;
          --secondary: 210 25% 7.8431%;
          --secondary-foreground: 0 0% 100%;
          --muted: 0 0% 98.82%;
          --muted-foreground: 210 10% 35.29%;
          --accent: 211.5789 51.3514% 92.7451%;
          --accent-foreground: 203.8863 88.2845% 53.1373%;
          --destructive: 356.3033 90.5579% 54.3137%;
          --destructive-foreground: 0 0% 100%;
          --border: 180 6.45% 24.31%;
          --input: 180 4.88% 16.08%;
          --ring: 180 6.45% 24.31%;
          --radius: 1.5rem;
        }

        .dark {
          --background: 0 0% 0%;
          --foreground: 200 6.6667% 91.1765%;
          --card: 228 9.8039% 10%;
          --card-foreground: 0 0% 85.0980%;
          --popover: 0 0% 0%;
          --popover-foreground: 200 6.6667% 91.1765%;
          --primary: 203.7736 87.6033% 52.5490%;
          --primary-foreground: 0 0% 100%;
          --secondary: 195.0000 15.3846% 94.9020%;
          --secondary-foreground: 210 25% 7.8431%;
          --muted: 0 0% 9.4118%;
          --muted-foreground: 210 3.3898% 46.2745%;
          --accent: 205.7143 70% 7.8431%;
          --accent-foreground: 203.7736 87.6033% 52.5490%;
          --destructive: 356.3033 90.5579% 54.3137%;
          --destructive-foreground: 0 0% 100%;
          --border: 210 5.2632% 14.9020%;
          --input: 207.6923 27.6596% 18.4314%;
          --ring: 202.8169 89.1213% 53.1373%;
          --radius: 1.3rem;
        }

        body {
          font-family: 'Poppins', sans-serif;
        }

        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
    </style>
</head>
<body class="min-h-screen bg-background text-foreground font-sans">
    <header class="border-b border-border bg-card">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-foreground text-xl w-6 h-6">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-2xl font-bold text-card-foreground">PicLink</h1>
                        <p class="text-xs text-muted-foreground">Simple Image Hosting</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="toggleTheme()" class="w-10 h-10 rounded-lg bg-accent hover:bg-accent/80 flex items-center justify-center" aria-label="Toggle theme">
                        <svg id="theme-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-accent-foreground">
                            <circle cx="12" cy="12" r="5"/>
                            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="max-w-4xl mx-auto">
        <!-- Toolbar -->
        <div style="background-color: hsl(var(--card)); border: 1px solid hsl(var(--border));" class="rounded-xl p-4 mb-4 flex gap-2">
            <a href="${image.rawUrl}" target="_blank" rel="noopener" 
               style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground));" class="px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
               aria-label="Open image file">
                Open image file
            </a>
        </div>
        
        <!-- Image Viewer -->
        <div class="bg-card border border-border rounded-xl p-8 mb-8 text-center shadow-sm">
            <img src="${image.rawUrl}" alt="Image" class="max-w-full max-h-96 w-auto h-auto mx-auto rounded-lg shadow-lg object-contain" />
        </div>
        
        <!-- Copy Snippets -->
        <div class="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
            <h3 class="text-lg font-medium mb-4 text-card-foreground">Copy snippets</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1 text-muted-foreground">Direct URL</label>
                    <div class="flex gap-2">
                        <input type="text" value="${image.rawUrl}" readonly 
                               class="flex-1 p-2 rounded-lg font-mono text-sm bg-input border border-border text-foreground"
                               aria-label="Direct URL">
                        <button onclick="copyToClipboard('${image.rawUrl}', 'Direct URL')" 
                                class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors"
                                aria-label="Copy direct URL">
                            Copy
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-1 text-muted-foreground">Markdown</label>
                    <div class="flex gap-2">
                        <input type="text" value="${markdownFormat}" readonly 
                               class="flex-1 p-2 rounded-lg font-mono text-sm bg-input border border-border text-foreground"
                               aria-label="Markdown format">
                        <button onclick="copyToClipboard('${markdownFormat}', 'Markdown')" 
                                class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors"
                                aria-label="Copy markdown">
                            Copy
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-1 text-muted-foreground">BBCode</label>
                    <div class="flex gap-2">
                        <input type="text" value="${bbcodeFormat}" readonly 
                               class="flex-1 p-2 rounded-lg font-mono text-sm bg-input border border-border text-foreground"
                               aria-label="BBCode format">
                        <button onclick="copyToClipboard('${bbcodeFormat}', 'BBCode')" 
                                class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors"
                                aria-label="Copy BBCode">
                            Copy
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
            <!-- Upload Your Own Button -->
            <div class="text-center">
                <a href="/" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                   aria-label="Upload your own image">
                    Upload your own
                </a>
            </div>
        </div>
    </main>
    
    <!-- Footer - Exact same as original site -->
    <footer class="border-t border-border bg-card mt-16">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex flex-col md:flex-row justify-between items-center">
                <div class="flex items-center space-x-3 mb-4 md:mb-0">
                    <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-foreground w-4 h-4">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                    </div>
                    <span class="font-semibold text-card-foreground">PicLink</span>
                </div>
                <div class="flex space-x-6 text-sm text-muted-foreground">
                    <a href="#" class="hover:text-primary transition-colors">Privacy Policy</a>
                    <a href="#" class="hover:text-primary transition-colors">Terms of Service</a>
                    <a href="#" class="hover:text-primary transition-colors">Contact</a>
                    <a href="#" class="hover:text-primary transition-colors">API Docs</a>
                </div>
            </div>
            <div class="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
                <p>&copy; 2025 PicLink. All rights reserved. Built with React, TypeScript, and Tailwind CSS.</p>
            </div>
        </div>
    </footer>
    
    <div id="toast" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded transform translate-x-full transition-transform z-50" 
         role="alert" aria-live="polite"></div>
    
    <script>
        // Theme toggle functionality
        let currentTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.classList.toggle('dark', currentTheme === 'dark');
        
        function toggleTheme() {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', currentTheme === 'dark');
            localStorage.setItem('theme', currentTheme);
            
            // Update icon
            const icon = document.getElementById('theme-icon');
            if (currentTheme === 'dark') {
                icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
            } else {
                icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
            }
        }
        
        // Initialize theme icon
        const icon = document.getElementById('theme-icon');
        if (currentTheme === 'light') {
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        }
        
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
