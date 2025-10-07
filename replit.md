# Overview

This is a location-based travel guide application called "내손가이드" (My Hand Guide) that allows users to create, manage, and share travel guides with photos and location information. The app features AI-powered content generation using Google's Gemini AI to automatically create guide descriptions, tips, and cultural information based on uploaded images and GPS coordinates. Users can capture photos with location data, organize guides, create shareable links, and manage their travel content through a mobile-optimized interface.

## 📝 Recent Changes

### 🎤 Gemini 프롬프트 개선 (2025-10-07) ✅
**Issue:** 손님 피드백 - 인사말 너무 길고 서사적, 재미없음
**Solution:** 정확한 정보 + 흥미로운 스토리텔링 조합

**✅ 변경 내용:**
- **길이:** 2-3분 → **1분 내외 (200-300자)**
- **톤:** 격식적 도슨트 → **친구처럼 자연스럽게**
- **구성:** 정확한 정보(이름/연도/역사) + 재미있는 일화
- **예시 포함:** 베르사유 궁전, 에스카르고 등 구체적 예시

**핵심 개선점:**
1. 카테고리별 차별화 (미술/건축/음식/풍경)
2. "알고보니..." "사실은..." 반전 스토리
3. 검증된 정보 필수 (Gemini 검색 활용)
4. 현지인 꿀팁 포함

### 📦 프롬프트 백업 (2025-10-07)
**원본 프롬프트 보관** - Gemini 응답 개선 전 백업

#### 이미지 분석 프롬프트 (원본):
```
당신은 세계 최고의 여행 가이드 도슨트입니다. 제공된 이미지를 분석하여, 한국어로 생생하게 설명해주세요.

[분석 유형별 가이드라인]
• 미술작품: 작품명, 작가, 시대적 배경, 예술적 특징, 감상 포인트
• 건축/풍경: 명칭, 역사적 의의, 건축 양식, 특징, 방문 팁
• 음식: 음식명, 특징, 유래, 맛의 특징, 추천 사항

[출력 규칙]
- 자연스러운 나레이션 형식으로 작성
- 1분 내외의 음성 해설에 적합한 길이
- 전문 용어는 쉽게 풀어서 설명
- 흥미로운 일화나 배경 지식 포함
- 분석 과정, 기호, 번호 등은 제외하고 순수한 설명문만 출력
- 절대로 마크다운 강조 기호(\`**\`, \`*\` 등)를 사용하지 마세요.
```

#### 텍스트 프롬프트 (원본):
```
당신은 세계 최고의 여행 가이드 도슨트입니다. 사용자가 음성으로 말한 여행지명, 건축물명, 미술작품명, 음식명이 음성인식으로 부정확하게 변환되었을 수 있습니다. 유사한 세계적 유명 관광지를 우선 고려해주세요.

예: "사그라다 파일리아"→"사그라다 파밀리아 성당", "버사이 궁전"→"베르사유 궁전", "콜로시움"→"콜로세움"

[출력 규칙]
- 자연스러운 나레이션 형식으로 작성
- 1분 내외의 음성 해설에 적합한 길이
- 전문 용어는 쉽게 풀어서 설명
- 흥미로운 일화나 배경 지식 포함
- 분석 과정, 기호, 번호 등은 제외하고 순수한 설명문만 출력
- 절대로 마크다운 강조 기호(\`**\`, \`*\` 등)를 사용하지 마세요.
```

## 📝 Recent Changes

### ⭐ Featured Gallery 관리자 UI 개선 (2025-10-07) ✅
**Issue:** 관리자가 Featured 갤러리에 추가할 공유페이지를 찾기 어려움 (ID 직접 입력 불편)
**Solution:** 이름 검색 기능 구현 + 실시간 검색 UI

**✅ 완료:**

#### 백엔드
1. **Storage 추가** (`server/storage.ts`)
   - `getAllSharedHtmlPages(searchQuery?)` 함수 추가
   - 검색어로 페이지 이름 필터링 (LIKE %query%)
   - 다운로드 수 + 최신순 정렬
   - htmlContent 제외로 성능 최적화

2. **API 엔드포인트 추가** (`server/routes.ts`)
   - GET `/api/admin/all-shares?search=query` - 모든 공유페이지 검색
   - 기존 `/api/admin/shares`는 사용자별 페이지 전용으로 유지

#### 프론트엔드
3. **검색 UI 개선** (`public/index.html`)
   - Select 박스 제거 → 검색 결과 카드로 변경
   - 실시간 검색창 (300ms 디바운스)
   - 검색 결과: 이름, 다운로드 수, 날짜 표시
   - Featured 상태 표시 + 추가 버튼

4. **JavaScript 로직** (`public/index.js`)
   - `searchShares()` - 실시간 검색 함수
   - `addFeaturedById()` - ID로 Featured 추가
   - 검색 후 Featured 추가 시 자동 UI 업데이트

**사용법:**
1. 설정 → 관리자 인증 (1234)
2. Featured 갤러리 관리 섹션에서 검색
3. 예: "철수아빠 파리3일여행" 입력
4. 검색 결과에서 "⭐ 추가" 버튼 클릭
5. Featured 목록에 자동 반영

### 🔗 Share Feature Implementation (2025-10-03) - 1/5 완료 ✅
**Issue:** Previous share system was broken by predecessor developer
**Solution:** Complete reimplementation of share functionality from scratch

**✅ 완료된 부분:**

#### 백엔드 (2025-10-02)
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

#### 공유 페이지 UX (2025-10-03) ⭐ **3시간 디버깅 끝에 완성!**
5. **상세 뷰 UX 수정** (`public/index.js` - generateShareHTML)
   - ✅ 앱과 100% 동일한 구조 구현 (`.full-screen-bg` + `.ui-layer` + 3구역)
   - ✅ z-index 계층 확립: background(1) → ui-layer(10) → header(20) → content(25) → footer(30)
   - ✅ `.header-safe-area`에 `position: relative` 추가 (뒤로가기 버튼 클릭 문제 해결)
   - ✅ `.content-safe-area`에 `z-index: 25` 추가 (텍스트 표시 문제 해결)
   - ✅ 텍스트 자동 하이라이트 기능 추가 (onboundary 이벤트)
   - ✅ 텍스트 초기 표시 로직: 음성과 동시에 표시
   - ✅ DB 24개 기존 공유 링크 자동 업데이트
   - ⚠️ **수정금지** 주석 추가 (핵심 로직 보호)

6. **JavaScript 정규식 HTML Escape 버그 해결** (`public/index.js` - playAudio) ✅
   - ✅ **치명적 버그:** `/<br\s*\/?>/gi` → HTML 파서가 `&lt;` 변환 → JavaScript 파싱 에러
   - ✅ **해결책:** `new RegExp('<br\\s*/?>', 'gi')` 방식으로 HTML 파서와 100% 분리
   - ✅ **영향:** 27개 기존 공유 페이지 DB 일괄 업데이트 완료
   - ✅ **안전성:** 모든 브라우저 호환, 앞으로 절대 깨지지 않음
   - ⚠️ **수정금지** 주석 추가 (핵심 로직 보호)

7. **반응형 디자인 추가** (`public/index.js` - generateShareHTML) ✅
   - ✅ 모바일: 2열 그리드
   - ✅ 노트북/PC: 3열 그리드 (`@media (min-width: 768px)`)
   - ✅ 갤러리 패딩 최적화 (모바일 20px, 데스크톱 30px)

8. **Service Worker 추가 (오프라인 지원)** ✅ **← 2025-10-04 완료!**
   - ✅ **서버 라우트:** `/sw-share.js` (line 1201, `server/routes.ts`)
   - ✅ **HTML 등록:** Service Worker 자동 등록 (line 665-680, `public/index.js`)
   - ✅ **캐싱 전략:** Cache-First (캐시 우선, 실패 시 네트워크)
   - ✅ **테스트 완료:** 오프라인 모드에서 6개 이미지 포함 전체 페이지 작동
   - ✅ **자동 작동:** 사용자가 링크 클릭만 하면 백그라운드에서 자동 캐싱
   - ✅ **iOS Safari 오프라인 수정 (2025-10-04):** 캐시된 응답에 Content-Disposition: inline 헤더 추가 → txt 다운로드 방지
   - ⚠️ **브라우저 호환:** 크롬/파이어폭스 완벽 지원, 사파리 iOS 15+ 필요

**✅ 공유 기능 100% 완료! (2025-10-04)**

모든 핵심 기능 구현 완료:
- ✅ 상세 뷰 UX (z-index 계층, 텍스트 표시)
- ✅ JavaScript 정규식 HTML Escape 버그
- ✅ 반응형 디자인 (모바일 2열, 데스크톱 3열)
- ✅ Service Worker 오프라인 지원 (iOS Safari 포함)

**선택 작업 (필요시):**
1. ⭕ **공유 모달 터치 문제** (낮은 우선순위)
   - 증상: 모바일에서 모달 배경 클릭 시 보관함 이미지가 재생됨
   - 영향: 사용성 불편하나 치명적이지 않음
2. ⭕ **SVG 아이콘 교체** (선택사항 - 현재 이모지도 충분함)

**핵심 로직 (절대 수정 금지!):**

**1. CSS z-index 계층 (상세 뷰 UX)**
```css
/* ⚠️ 수정금지 - 2025-10-03 3시간 디버깅 끝에 완성 */
.full-screen-bg { z-index: 1; }
.ui-layer { z-index: 10; }
.header-safe-area { 
    position: relative;  /* 필수! 버튼 클릭 위해 */
    z-index: 20; 
}
.content-safe-area { z-index: 25; }
.footer-safe-area { z-index: 30; }
```

**2. JavaScript 정규식 (HTML 파싱 에러 방지)**
```javascript
// ⚠️ 수정금지 - 2025-10-03 치명적 버그 해결
// HTML 내부 JavaScript에서는 정규식 리터럴 대신 new RegExp() 사용!
const cleanText = text.replace(new RegExp('<br\\s*/?>', 'gi'), ' ');

// ❌ 절대 사용 금지: /<br\s*\/?>/gi 
//    → HTML 파서가 < > 를 &lt; &gt; 로 변환하여 파싱 에러 발생
```

**3. Service Worker (오프라인 지원)**
```javascript
// ⚠️ 수정금지 - 2025-10-04 오프라인 지원 + iOS Safari 수정 완료
// 자동 작동: 사용자가 링크 클릭만 하면 백그라운드에서 자동 캐싱

// HTML 등록 코드 (public/index.js - line 665-680)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw-share.js')
            .then(registration => console.log('✅ [SW] 등록 성공'))
            .catch(error => console.log('❌ [SW] 등록 실패'));
    });
}

// 서버 라우트 (server/routes.ts - line 1228-1268)
// Cache-First 전략: /s/:id 경로만 캐싱
// 첫 방문: 자동 캐싱 → 다음부터 오프라인 접근 가능

// ⚠️ iOS Safari 오프라인 수정 (2025-10-04):
// 문제: 오프라인(비행기모드)에서 캐시된 HTML을 txt 파일로 다운로드하려 함
// 해결: 캐시된 응답에 Content-Disposition: inline 헤더 명시적 추가
const headers = new Headers(cachedResponse.headers);
headers.set('Content-Disposition', 'inline');
headers.set('Content-Type', 'text/html; charset=utf-8');
```

**참고 파일:**
- 앱 구조: `public/index.html` - `#detailPage`
- 공유 HTML 생성: `public/index.js` - `generateShareHTML()` (line 230)
- 작업 로그: `todos.md` - Section I

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