# Overview

PicLink is a minimal image hosting web application built as a full-stack TypeScript application. The system allows users to upload images through a drag-and-drop interface and receive direct links for sharing. The application is designed with a clean, modular architecture that separates concerns between frontend presentation, backend API handling, and storage management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: React hooks with TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **File Upload**: Multer middleware for handling multipart form data
- **Database**: In-memory storage (MemStorage class) for development, designed to be replaceable
- **API Design**: RESTful endpoints with proper error handling and rate limiting

## Storage Provider Pattern
- **Interface**: Abstract StorageProvider interface for pluggable storage solutions
- **Local Provider**: File system storage for development (saves to `/uploads` directory)
- **Cloudinary Provider**: Cloud-based image hosting for production
- **Selection**: Environment variable `STORAGE_PROVIDER` determines which provider to use

## Data Flow
- **Upload Process**: File validation → Storage provider upload → Database record creation → Direct link generation
- **Image Access**: Short URL (`/i/:id`) redirects to raw image URL with proper caching headers
- **File Validation**: Client and server-side validation for file type, size (10MB limit), and MIME types

## Development Environment
- **Hot Reload**: Vite dev server with HMR for frontend development
- **Build Process**: Vite builds frontend assets, esbuild bundles server code
- **Database Migration**: Drizzle ORM configured for PostgreSQL with schema in `/shared`
- **Type Safety**: Shared TypeScript interfaces between client and server

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection (though currently using in-memory storage)
- **drizzle-orm**: SQL ORM with type safety
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight client-side routing
- **multer**: File upload middleware for Express

## UI and Styling
- **@radix-ui/***: Unstyled, accessible UI components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe CSS variants
- **clsx**: Conditional className utility

## File Upload and Storage
- **cloudinary**: Cloud-based image storage and optimization service
- **nanoid**: URL-safe unique ID generation

## Development Tools
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for server code
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay