# Overview

This project is a location-based travel guide application named "내손가이드" (My Hand Guide). Its primary purpose is to enable users to create, manage, and share personalized travel guides featuring photos and location information. A key capability is the integration of Google's Gemini AI, which automatically generates guide descriptions, tips, and cultural insights based on uploaded images and GPS data. The application aims to provide a seamless experience for capturing travel memories, organizing them into shareable guides, and accessing them through a mobile-optimized interface. The business vision is to offer an intuitive tool for travelers to document and share their experiences, leveraging AI to enrich content and improve user engagement, ultimately targeting a broad market of travel enthusiasts.

# User Preferences

Preferred communication style: Simple, everyday language.

# Design System

## Brand Colors
- **Primary Color (Gemini Blue)**: `#4285F4` (CSS variable: `--gemini-blue`)
- **Background**: `#FFFEFA` (크림색/Cream)
- **Accent (Yellow Dot)**: `#FBBF24`

## Typography
- **Primary Font**: `MaruBuri` (마루부리) - 네이버 한글 폰트
- **Fallback**: `sans-serif`
- **Import**: `https://hangeul.pstatic.net/maruburi/maruburi.css`

## UI Guidelines
- **Mobile-first**: 모든 UI는 터치 친화적으로 설계
- **PWA**: 오프라인 지원, Service Worker 활용
- **Interactive Elements**: Gemini Blue 기본 사용
- **Buttons**: 둥근 모서리, 그림자 효과
- **Admin Pages**: 예외적으로 다른 컬러/폰트 허용 (영업 비밀)

## Important Note
**모든 사용자 대면 UI는 Gemini Blue + MaruBuri 사용 필수!** 관리자 전용 페이지는 예외.

# System Architecture

## Frontend Architecture
The frontend is built with **Vanilla JavaScript** (not React). The app uses a single-page architecture with manual DOM manipulation and IndexedDB for local storage. **Tailwind CSS** is used for styling via CDN. The design emphasizes mobile responsiveness and touch-friendly interactions, with PWA features for enhanced mobile experience. All UI follows the brand design system (Gemini Blue + MaruBuri font).

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

**Google OAuth Integration (2025-10-18):** Added Google OAuth 2.0 authentication via `passport-google-oauth20`. Users can log in with their Google accounts. The database schema includes a `provider` column (varchar) to distinguish between authentication methods ('replit', 'google', 'kakao'). Kakao OAuth is planned but not yet implemented.

**Authentication Modal (2025-10-18):** Implemented a login modal that appears when unauthenticated users click Featured Gallery items. The modal offers:
- Google Login button (active, redirects to `/api/auth/google`)
- Kakao Login button (disabled with "준비 중" badge)
- Smooth returnTo redirect after successful authentication

**Setup Requirements:**
- For Google OAuth to work, set environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console
- OAuth consent screen must be configured with authorized redirect URIs

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
  - **Admin Dashboard (2025-10-26):** Real-time statistics dashboard with KPIs, analytics, and top shares
    - 📊 Core metrics: Total users, guides, shared pages, views
    - 📈 Daily trends: User/guide/share creation over 7 days
    - 🔒 Password-protected access (비밀번호: 1234)
    - 💾 DB optimization tracking: HTML file storage reduced DB from 184MB to 39MB (78% reduction)
    - ⚠️ **Protected Code**: All critical functions marked with "DO NOT MODIFY WITHOUT USER APPROVAL"

# External Dependencies

## Core Services
- **Replit Authentication**: OpenID Connect for user authentication.
- **Google Gemini AI**: Vision and text generation API for AI content creation.
- **PostgreSQL Database**: Primary data storage, typically a managed service like Neon.

## Frontend Libraries
- **Vanilla JavaScript**: No framework, manual DOM manipulation
- **IndexedDB**: Local storage for guides and user data
- **Tailwind CSS**: Utility-first CSS framework (CDN)
- **Web APIs**: Speech Synthesis, Media Recorder, Geolocation, Camera

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