# Overview

This is a location-based travel guide application called "내손가이드" (My Hand Guide) that allows users to create, manage, and share travel guides with photos and location information. The app features AI-powered content generation using Google's Gemini AI to automatically create guide descriptions, tips, and cultural information based on uploaded images and GPS coordinates. Users can capture photos with location data, organize guides, create shareable links, and manage their travel content through a mobile-optimized interface.

## 📝 Recent Changes

### 🔗 Share Feature Implementation (2025-10-02) - IN PROGRESS 🚧
**Issue:** Previous share system was broken by predecessor developer
**Solution:** Complete reimplementation of share functionality from scratch

**✅ 완료된 부분 (백엔드):**
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

4. **Frontend Modal** (`public/index.js`, `public/index.html`)
   - ✅ Simplified share modal (removed social icons)
   - ✅ Single "링크 복사하기" button
   - ✅ Modal reset logic fixed ("다시하니 안됨" bug)
   - ✅ Clipboard fallback (URL 직접 표시)

**❌ 남은 문제 (공유 HTML 페이지):**

**테스트 결과 (2025-10-02 오후):**
1. ❌ **공유 모달 터치 문제** 
   - 증상: 모바일에서 모달 배경 클릭 시 보관함 이미지가 재생됨
   - 원인: z-index/pointer-events 문제
   - 위치: `public/index.html` - share modal CSS

2. ❌ **오프라인 미작동 (핵심 기능!)**
   - 증상: 공유 페이지 1회 열람 후 오프라인에서 작동 안 됨
   - 필요: Service Worker 구현 (캐싱)
   - 참고: `public/service-worker.js` 예시 확인 필요

3. ❌ **반응형 디자인 깨짐**
   - 증상: 모바일 ✅ / 노트북 ❌ (레이아웃 깨짐)
   - 필요: Media query 추가 (`@media (min-width: 768px)`)

4. ❌ **상세 뷰 UX 불일치 (중요!)**
   - 현재: 일반 웹페이지 스타일 (이미지 박스 + 버튼)
   - 필요: 앱과 동일한 UX
     - 전체 화면 배경 이미지 (`.full-screen-bg`)
     - 텍스트 오버레이 (`.ui-layer`)
     - 버튼 하단 배치 (`.footer-safe-area`)
   - 참고 파일: `public/index.html` - `#detailPage` 구조
   - 첨부 이미지: `attached_assets/image_1759396618399.png`

5. ❌ **아이콘 불일치**
   - 현재: 이모지 사용 (🏠, ▶, ❚❚)
   - 필요: SVG 아이콘으로 교체
   - 참고: `public/index.html` - SVG 아이콘 예시 복사

**작업 우선순위:**
1. **상세 뷰 UX 수정** (앱 구조 복사) - 가장 중요!
2. **반응형 디자인** 추가
3. **SVG 아이콘** 교체
4. **Service Worker** 추가 (오프라인)
5. 공유 모달 터치 문제 수정

**데이터 구조 (중요!):**
```javascript
// IndexedDB (프론트엔드)
currentContent = {
    imageDataUrl: "data:image/jpeg;base64,/9j...",
    description: "해설 텍스트..."
    // ❌ title 필드 없음!
}
```

**다음 작업 시 참고:**
- `generateShareHTML()` 함수 재작성 진행 중 (line 220)
- 실제 앱 구조: `public/index.html` - `#detailPage` 참조
- 첨부 이미지로 UX 확인 가능

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