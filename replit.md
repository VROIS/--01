# Overview

This project is a location-based travel guide application named "내손가이드" (My Hand Guide). Its primary purpose is to enable users to create, manage, and share personalized travel guides featuring photos and location information. A key capability is the integration of Google's Gemini AI, which automatically generates guide descriptions, tips, and cultural insights based on uploaded images and GPS data. The application aims to provide a seamless experience for capturing travel memories, organizing them into shareable guides, and accessing them through a mobile-optimized interface. The business vision is to offer an intuitive tool for travelers to document and share their experiences, leveraging AI to enrich content and improve user engagement, ultimately targeting a broad market of travel enthusiasts.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with **React 18** and **TypeScript**, using **Vite** for building and serving. **Wouter** handles client-side routing, and **TanStack Query** manages server state. Forms are handled with **React Hook Form** and Zod validation. UI components are from **Shadcn/ui** (built on Radix UI primitives), styled using **Tailwind CSS**. Internationalization is provided by **React i18next**, supporting Korean, English, Japanese, and Chinese. The design emphasizes mobile responsiveness and touch-friendly interactions, with PWA features for enhanced mobile experience.

## Backend Architecture
The backend is an **Express.js** server written in **TypeScript**. **Drizzle ORM** is used for interacting with a **PostgreSQL** database. User authentication is managed via **Replit Authentication** (OpenID Connect) with session-based storage in PostgreSQL. **Multer** handles image file uploads. **ESBuild** is used for server-side bundling.

## Database Design
**PostgreSQL** serves as the primary database. **Drizzle ORM** defines the schema, which includes tables for users (with preferences), travel guides (content, images, location), share links, and authentication sessions.

## AI Integration
**Google Gemini AI** is central to content generation, analyzing images and location data to create descriptions, tips, and cultural information. It supports multi-language content generation based on user preferences and enhances travel recommendations with location-based context. Recent optimizations include:
- **Final Model Selection (2025-10-18):** Gemini 2.5 Flash for optimal balance of image recognition, prompt adherence, and cost efficiency (6.4x cheaper than Claude Haiku 4.5)
- **Image Compression:** 0.9 quality maintained (0.6 or below causes AI hallucinations and false information)
- **Prompt Engineering:** Refined 38-character prompt balancing response speed and content quality, targeting 2-2.5 second response times

## Authentication & Authorization
**Replit Auth** with OpenID Connect is integrated via **Passport.js**. A session middleware with PostgreSQL backing store manages user sessions. A soft-delete subscription system preserves user data upon subscription cancellation and reactivation.

## File Upload & Storage
**Multer** handles image uploads, storing them locally. File type validation restricts uploads to image formats, and size limits are enforced. Image compression to 0.6 quality is applied to optimize upload speed and AI processing.

## API Design
The system features a **RESTful API** built with Express, using shared TypeScript schemas for type-safe requests and responses. It includes robust error handling and authentication middleware to protect endpoints. A short URL system has been implemented for share links, reducing their length by 67%.

## System Design Choices
- **UI/UX:** Mobile-first approach with responsive design, touch-friendly interfaces, and camera/GPS integration.
- **Performance:** Focus on optimizing AI response times (current target 2-2.5 seconds) through prompt engineering, AI model selection, and image compression.
- **Share Feature:** Comprehensive re-implementation of sharing functionality, including:
  - Short URLs (8-character IDs, 67% length reduction)
  - **Item Selection Order Preservation (2025-10-18):** User's click order in archive is preserved in shared pages (like shopping cart functionality)
  - Offline support via Service Worker (Cache-First strategy, iOS Safari fixes)
  - Responsive shared page UI with z-index hierarchy and HTML escaping fixes
- **Admin UI:** Improved administrator interface for managing featured galleries with:
  - Search functionality for shared pages by name
  - **Automatic Featured Ordering (2025-10-18):** Click order automatically assigned (1, 2, 3...) via `featuredOrder` column for consistent display

# External Dependencies

## Core Services
- **Replit Authentication**: OpenID Connect for user authentication.
- **Google Gemini AI**: Vision and text generation API for AI content creation.
- **PostgreSQL Database**: Primary data storage, typically a managed service like Neon.

## Frontend Libraries
- **React 18 ecosystem**: Core UI framework.
- **Wouter**: Lightweight client-side router.
- **TanStack React Query**: Server state management.
- **React Hook Form**: Form management with Zod validation.
- **Shadcn/ui & Radix UI**: UI component libraries.
- **Tailwind CSS**: Utility-first CSS framework.
- **React i18next**: Internationalization.

## Backend Dependencies
- **Express.js**: Web application framework.
- **Drizzle ORM**: Database toolkit for PostgreSQL.
- **Passport.js**: Authentication middleware.
- **Multer**: Middleware for handling `multipart/form-data`.
- **OpenID Client**: OpenID Connect client implementation.
- **connect-pg-simple**: PostgreSQL session store for Connect/Express.

## Development Tools
- **Vite**: Frontend build tool.
- **ESBuild**: Server-side bundling.
- **TypeScript**: Language for type safety.
- **PostCSS**: CSS transformation tool.
- **TSX**: TypeScript execution for development.