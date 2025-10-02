# Overview

This is a location-based travel guide application called "내손가이드" (My Hand Guide) that allows users to create, manage, and share travel guides with photos and location information. The app features AI-powered content generation using Google's Gemini AI to automatically create guide descriptions, tips, and cultural information based on uploaded images and GPS coordinates. Users can capture photos with location data, organize guides, create shareable links, and manage their travel content through a mobile-optimized interface.

## 📝 Recent Changes

### 🔗 Share Feature Implementation (2025-10-02) - COMPLETE ✅
**Issue:** Previous share system was broken by predecessor developer
**Solution:** Complete reimplementation of share functionality from scratch
**Changes:**
1. **Database Schema** (`shared/schema.ts`)
   - Created `sharedHtmlPages` table with 8-character short IDs
   - Fields: id (short), userId, name, htmlContent, guideIds[], thumbnail, sender, location
   - Supports isActive flag for link expiration control

2. **Backend Storage** (`server/storage.ts`)
   - Implemented `createSharedHtmlPage()` with ID collision retry logic (5 attempts)
   - Added `getSharedHtmlPage()`, `incrementDownloadCount()`, `getFeaturedHtmlPages()`
   - Short ID generation using crypto.randomBytes(6).toString('base64url')

3. **API Routes** (`server/routes.ts`)
   - POST `/api/share/create` - Creates share page and returns short URL
   - GET `/s/:id` - Serves HTML content directly (primary share route)
   - GET `/api/share/:id` - JSON endpoint for programmatic access
   - Comprehensive error pages (404, 410, 500) with styled HTML

4. **Frontend Implementation** (`public/index.js`, `public/index.html`)
   - Simplified share modal (removed social icons: Kakao, Instagram, Facebook, WhatsApp)
   - Single "링크 복사하기" (Copy Link) button for universal sharing
   - Modal reset logic to fix "다시하니 안됨" (can't use twice) bug
   - Automatic HTML generation from selected guides
   - Clipboard integration for easy sharing

**Technical Details:**
- URL format: `yourdomain.com/s/abc12345` (8 characters)
- HTML pages are self-contained (images embedded as data URLs)
- Download count tracking on every access
- Link expiration via isActive flag
- Temp user ID system (to be replaced with real auth)

**Impact:** 
- ✅ Share links work in browser, KakaoTalk, and all messaging apps
- ✅ Short URLs easy to type manually (8 characters vs previous 36)
- ✅ Modal can be reused multiple times without refresh
- ✅ Complete system with detailed code comments for future maintenance

### Critical Fix (2025-10-01) - Subscription Data Restoration
**Issue:** Users lost all data (guides, share links) when canceling and resubscribing
**Solution:** Implemented soft-delete subscription system with data preservation
**Changes:**
- Added `subscriptionStatus`, `subscriptionCanceledAt`, `accountStatus` fields to user schema
- Created subscription management endpoints: `/api/subscription/cancel` and `/api/subscription/reactivate`
- Account suspension instead of deletion - all user data preserved during subscription gaps
**Impact:** Users can now cancel and resubscribe without losing any data

### URL Optimization (2025-09-24)
**Issue:** Users reported browser URL input errors due to excessively long share URLs (36 characters)
**Solution:** Implemented short URL system reducing URL length by 67% (36 → 12 characters)
**Impact:** Users can now easily type share URLs directly into browser address bar

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React 18** with TypeScript for the user interface
- **Vite** as the build tool and development server
- **Wouter** for client-side routing (lightweight React Router alternative)
- **TanStack Query** for server state management and API caching
- **React Hook Form** with Zod validation for form handling
- **Shadcn/ui** component library with Radix UI primitives
- **Tailwind CSS** for styling with CSS variables for theming
- **React i18next** for internationalization (Korean, English, Japanese, Chinese)

## Backend Architecture
- **Express.js** server with TypeScript
- **Drizzle ORM** for database interactions with PostgreSQL
- **Replit Authentication** using OpenID Connect for user management
- **Session-based authentication** with PostgreSQL session storage
- **Multer** for handling image file uploads
- **ESBuild** for server-side bundling in production

## Database Design
- **PostgreSQL** as the primary database
- **Drizzle ORM** schema definition with type safety
- **User table** with preferences for language and feature toggles
- **Guides table** storing travel guide content, images, and location data
- **Share Links table** for creating shareable collections of guides
- **Sessions table** for authentication session management

## AI Integration
- **Google Gemini AI** for generating guide content from images and location data
- **Vision analysis** to extract contextual information from uploaded photos
- **Multi-language content generation** based on user preferences
- **Location-based context** enhancement for travel recommendations

## Authentication & Authorization
- **Replit Auth** integration using OpenID Connect
- **Passport.js** strategy for authentication handling
- **Session middleware** with PostgreSQL backing store
- **User preference management** for personalization

## File Upload & Storage
- **Multer** middleware for handling image uploads
- **Local file storage** in uploads directory
- **File type validation** restricting to image formats only
- **File size limits** to prevent abuse

## API Design
- **RESTful API** structure with Express routes
- **Type-safe request/response** handling with shared TypeScript schemas
- **Error handling middleware** with consistent error responses
- **Authentication middleware** protecting user-specific endpoints

## Mobile-First Design
- **Responsive design** optimized for mobile devices
- **Touch-friendly interface** with appropriate sizing
- **Camera integration** for photo capture
- **GPS location** access for automatic location tagging
- **Progressive Web App** features for better mobile experience

# External Dependencies

## Core Services
- **Replit Authentication** - OpenID Connect provider for user authentication
- **Google Gemini AI** - Vision and text generation API for content creation
- **PostgreSQL Database** - Primary data storage (likely Neon or similar managed service)

## Frontend Libraries
- **React ecosystem** - React 18, React DOM, React Hook Form
- **Routing** - Wouter for lightweight client-side routing
- **State Management** - TanStack React Query for server state
- **UI Components** - Radix UI primitives with Shadcn/ui wrapper
- **Styling** - Tailwind CSS with class variance authority
- **Internationalization** - React i18next with date-fns locales

## Backend Dependencies
- **Express.js** - Web framework with middleware ecosystem
- **Database** - Drizzle ORM, Neon Database serverless driver
- **Authentication** - Passport.js, OpenID Client, connect-pg-simple
- **File Handling** - Multer for uploads
- **Utilities** - Memoizee for caching, various type definitions

## Development Tools
- **Build Tools** - Vite, ESBuild, TypeScript compiler
- **Code Quality** - TypeScript for type safety
- **CSS Processing** - PostCSS with Tailwind and Autoprefixer
- **Development** - TSX for TypeScript execution, various Replit plugins