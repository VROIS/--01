# 내손가이드 앱 아키텍처 완전 가이드
> **작성일:** 2025-11-09  
> **목적:** AI 에이전트와 개발자가 앱 구조를 정확히 이해하고 시행착오 없이 작업하기 위함

---

## 📐 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 인터페이스                         │
│                    (Vanilla JS, Tailwind CSS)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🏠 Features Page (추천 갤러리)                                 │
│  📸 Main Page (카메라)                                          │
│  📝 Detail Page (상세 뷰 + 음성)                                │
│  📚 Archive Page (보관함)                                       │
│  ⚙️  Settings Page (설정)                                       │
│  🔗 Share Page (독립 HTML - 오프라인 지원)                      │
│                                                                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ REST API (Express)
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                        Backend Server                            │
│                    (Express + TypeScript)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔐 Authentication (Replit Auth, Google OAuth, Kakao OAuth)     │
│  🤖 AI Integration (Google Gemini 2.5 Flash)                    │
│  📤 File Upload (Multer + Image Compression)                    │
│  🔗 Share System (HTML Generator + Service Worker)              │
│  👑 Admin Dashboard (통계 + Featured 관리)                      │
│                                                                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Drizzle ORM
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                     PostgreSQL Database                          │
│                         (Neon)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 users              사용자 정보                              │
│  📝 guides             여행 가이드                              │
│  🔗 shareLinks         공유 링크 (구버전)                       │
│  📄 sharedHtmlPages    공유 HTML 페이지 (신버전)                │
│  💳 creditTransactions 크레딧 거래                              │
│  🔑 sessions           세션 저장소                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ 페이지 구조 및 네비게이션

### 1. **Features Page** (추천 갤러리)
**파일:** `public/index.js` (featuresPage)  
**목적:** 추천 공유 페이지 갤러리 표시

**주요 버튼:**
```javascript
#startCameraFromFeaturesBtn  // "카메라 시작" → Main Page 이동
#archiveBtn                   // "보관함" → Archive Page 이동
Featured Gallery 아이템 클릭  // 공유 페이지 새 창 오픈 (비로그인: 인증 모달)
```

**동작:**
1. 로그인 안 한 사용자: Featured Gallery만 표시
2. Featured 아이템 클릭 시:
   - ✅ 로그인: 공유 페이지 새 창 오픈
   - ❌ 비로그인: 인증 모달 표시 → 로그인 후 페이지 오픈

---

### 2. **Main Page** (카메라)
**파일:** `public/index.js` (mainPage)  
**목적:** 사진 촬영 및 업로드

**주요 버튼:**
```javascript
#shootBtn   // 카메라 촬영 → Detail Page (AI 분석)
#uploadBtn  // 파일 업로드 → Detail Page (AI 분석)
#micBtn     // 음성 녹음 (현재 미사용)
#archiveBtn // 보관함 → Archive Page 이동
```

**동작 플로우:**
```
1. 촬영/업로드 클릭
   ↓
2. 이미지 압축 (0.9 quality)
   ↓
3. Gemini AI 분석 (/api/gemini)
   ↓
4. Detail Page 표시 (이미지 + 설명 + 음성)
```

---

### 3. **Detail Page** (상세 뷰)
**파일:** `public/index.js` (detailPage)  
**목적:** AI 생성 콘텐츠 + 음성 재생

**주요 버튼:**
```javascript
#backBtn          // 뒤로가기 → Main Page 복귀 (음성 정지)
#audioBtn         // 음성 재생/정지 토글
#textToggleBtn    // 텍스트 오버레이 표시/숨김
#saveBtn          // IndexedDB 저장 → Archive Page 이동
```

**음성 재생 로직:**
- Web Speech API (window.speechSynthesis)
- Microsoft Heami 음성 강제 지정
- 페이지 이탈 시 자동 정지 (beforeunload 이벤트)

---

### 4. **Archive Page** (보관함)
**파일:** `public/index.js` (archivePage)  
**목적:** 저장된 가이드 관리 + 공유

**주요 버튼:**
```javascript
#archiveBackBtn       // 뒤로가기 → Features Page 복귀
#archiveSelectBtn     // 선택 모드 활성화
#archiveShareBtn      // 선택한 아이템 공유 → 공유 모달
#archiveDeleteBtn     // 선택한 아이템 삭제
#archiveSettingsBtn   // 설정 페이지 이동
#cancelSelectionBtn   // 선택 모드 취소
#deleteSelectedBtn    // 선택된 아이템 삭제
아이템 클릭           // Detail Page (읽기 전용)
```

**공유 플로우:**
```
1. 아이템 1개 이상 선택
   ↓
2. "공유" 버튼 클릭
   ↓
3. 제목 입력 모달
   ↓
4. /api/share/create (HTML 생성 + DB 저장)
   ↓
5. 공유 링크 생성: /s/abc12345
   ↓
6. 클립보드 복사 + 토스트 메시지
```

---

### 5. **Settings Page** (설정)
**파일:** `public/index.js` (settingsPage)  
**목적:** 사용자 설정 관리

**주요 버튼:**
```javascript
#settingsBackBtn      // 뒤로가기 → Archive Page 복귀
#languageToggle       // 언어 선택 (한국어/English)
#locationToggle       // 위치 정보 사용 여부
#aiContentToggle      // AI 콘텐츠 생성 여부
#logoutBtn            // 로그아웃
#deleteAccountBtn     // 계정 삭제
```

---

### 6. **Share Page** (공유 페이지)
**파일:** `public/shared/*.html` (독립 HTML)  
**목적:** 오프라인 지원 영구 여행 일기

**페이지 구조:**
```html
<!-- 헤더 -->
<div class="header">
  <h1>제목</h1>
  <p>👤 발신자 이름</p>
  <p>📍 위치</p>
  <p>📅 날짜</p>
</div>

<!-- 갤러리 뷰 (기본) -->
<div id="gallery-view">
  <!-- Featured 전용 리턴 버튼 (왼쪽 상단) -->
  <button>← 보관함으로 돌아가기</button>
  
  <!-- 갤러리 그리드 -->
  <div class="gallery-grid">
    <img> <!-- 클릭 → 상세 뷰 -->
  </div>
  
  <!-- 하단 홈 버튼 -->
  <a id="home-button">손안에 가이드 시작하기</a> ✅ 음성 정지 후 이동
</div>

<!-- 상세 뷰 (hidden) -->
<div id="detail-view">
  <!-- 헤더: 뒤로가기 버튼 -->
  <button id="detail-back">←</button> ✅ 음성 정지 + 갤러리 복귀
  
  <!-- 배경 이미지 -->
  <img id="detail-bg">
  
  <!-- 텍스트 오버레이 -->
  <div id="detail-text">
    <p id="detail-description"></p>
  </div>
  
  <!-- 하단 Footer -->
  <footer id="detail-footer">
    <button id="detail-audio">🔊/⏸</button>  <!-- 음성 재생/정지 -->
    <button id="text-toggle">📄</button>      <!-- 텍스트 표시/숨김 -->
    <a id="detail-home">🏠</a>                <!-- ✅ 음성 정지 후 앱 이동 -->
  </footer>
</div>
```

**⚠️ 음성 정지 중요 버튼:**
```javascript
#detail-back   // 갤러리 복귀 (음성 정지 O)
#detail-home   // 앱으로 이동 (음성 정지 O) ← 최근 수정!
#home-button   // 갤러리 하단 홈 (음성 정지 O)
```

**Service Worker:**
- Cache-First 전략
- 오프라인 영구 보관
- `/sw-share.js` 등록

---

## 🗄️ 데이터베이스 스키마

### **users** (사용자)
```typescript
id: varchar (UUID)           // 사용자 ID
email: varchar (unique)      // 이메일
firstName: varchar           // 이름
lastName: varchar            // 성
profileImageUrl: varchar     // 프로필 이미지
provider: varchar            // replit | google | kakao
preferredLanguage: varchar   // ko | en
locationEnabled: boolean     // 위치 정보 사용 여부
aiContentEnabled: boolean    // AI 콘텐츠 생성 여부
credits: integer             // 크레딧 (미래 기능)
isAdmin: boolean             // 관리자 여부
subscriptionStatus: varchar  // active | canceled
createdAt: timestamp
updatedAt: timestamp
```

### **guides** (여행 가이드)
```typescript
id: varchar (UUID)           // 가이드 ID
userId: varchar → users.id   // 작성자
title: text                  // 제목
description: text            // 설명
imageUrl: text               // 이미지 경로
latitude: decimal            // GPS 위도
longitude: decimal           // GPS 경도
locationName: text           // 위치 이름
aiGeneratedContent: text     // AI 생성 콘텐츠
viewCount: integer           // 조회수
language: varchar            // ko | en
createdAt: timestamp
updatedAt: timestamp
```

### **sharedHtmlPages** (공유 페이지) ⭐ 핵심!
```typescript
id: varchar (8자)            // 짧은 ID (abc12345)
userId: varchar → users.id   // 생성자
name: text                   // 공유 페이지 제목
htmlContent: text            // (구) 완전한 HTML (nullable)
htmlFilePath: text           // (신) HTML 파일 경로 /shared/abc12345.html
guideIds: text[]             // 포함된 가이드 ID 배열
thumbnail: text              // 썸네일 이미지
sender: text                 // 발신자 이름 (nullable)
location: text               // 위치 정보 (nullable)
date: text                   // 공유 날짜 (YYYY-MM-DD)
featured: boolean            // 추천 갤러리 표시
featuredOrder: integer       // Featured 순서 (클릭 순서대로 1, 2, 3...)
downloadCount: integer       // 조회수
isActive: boolean            // 활성화 상태
createdAt: timestamp
updatedAt: timestamp
```

**⚠️ 중요:** `htmlFilePath`로 HTML 파일을 저장하여 DB 용량 78% 절감 (184MB → 39MB)

---

## 🔌 API 엔드포인트

### **인증 (Authentication)**
```
GET  /api/auth/user          사용자 정보 조회
GET  /api/auth/logout        로그아웃
GET  /auth/google            Google OAuth 리다이렉트
GET  /auth/google/callback   Google OAuth 콜백
GET  /auth/kakao             Kakao OAuth 리다이렉트 (준비 중)
GET  /auth/kakao/callback    Kakao OAuth 콜백 (준비 중)
```

### **가이드 (Guides)**
```
GET    /api/guides           사용자 가이드 목록
POST   /api/guides           가이드 생성 (이미지 업로드 포함)
GET    /api/guides/:id       가이드 상세
DELETE /api/guides/:id       가이드 삭제
```

### **공유 (Share)**
```
POST /api/share/create       공유 페이지 생성 (HTML 파일 저장)
GET  /s/:id                  공유 페이지 접속 (HTML 파일 제공)
GET  /api/share/:id          공유 페이지 데이터 조회
GET  /api/share/featured/list Featured 갤러리 목록 (5분 캐시)
```

### **AI (Gemini)**
```
POST /api/gemini             이미지 분석 + 설명 생성
```

### **관리자 (Admin)**
```
POST   /api/admin/auth                관리자 인증 (비밀번호: 1234)
GET    /api/admin/shares              공유 페이지 검색
GET    /api/admin/all-shares          전체 공유 페이지 목록
GET    /api/admin/featured            Featured 목록
POST   /api/admin/featured/:id        Featured 추가 (자동 순서 지정)
DELETE /api/admin/featured/:id        Featured 제거
POST   /api/admin/featured/:id/regenerate  HTML 재생성
GET    /api/admin/stats               통계 (사용자, 가이드, 공유, 조회수)
GET    /api/admin/analytics           7일 트렌드 분석
```

### **설정 (User Preferences)**
```
PATCH /api/user/preferences  사용자 설정 업데이트
```

### **Service Worker**
```
GET /sw-share.js             Service Worker 파일
```

---

## 🎨 주요 기능 플로우

### **1. 사진 촬영 → AI 분석 → 저장**
```
Main Page
  ↓ 촬영/업로드
Image Compression (0.9 quality)
  ↓
POST /api/gemini (Gemini 2.5 Flash)
  ↓ AI 분석 (2-2.5초)
Detail Page (이미지 + 설명 + 음성)
  ↓ 저장 버튼
IndexedDB 저장
  ↓
Archive Page (보관함)
```

### **2. 공유 페이지 생성**
```
Archive Page
  ↓ 아이템 선택
선택 모드 활성화
  ↓ 공유 버튼
제목 입력 모달
  ↓
POST /api/share/create
  ├─ generateShareHTML() 실행 (public/index.js)
  ├─ HTML 파일 생성 (/public/shared/abc12345.html)
  ├─ DB 저장 (sharedHtmlPages 테이블)
  └─ 짧은 URL 반환 (/s/abc12345)
  ↓
클립보드 복사 + 토스트
```

### **3. 공유 페이지 접속 (오프라인 지원)**
```
/s/abc12345 접속
  ↓
Service Worker 확인
  ├─ 캐시 있음 → 즉시 표시 (0ms)
  └─ 캐시 없음 → 서버 요청
       ↓
  GET /s/:id → HTML 파일 제공
       ↓
  Service Worker 캐시 저장
       ↓
  오프라인 영구 보관 완료
```

### **4. Featured 갤러리 관리 (관리자)**
```
Admin Dashboard (/admin-dashboard.html)
  ↓ 비밀번호 입력 (1234)
POST /api/admin/auth
  ↓
공유 페이지 검색
  ↓ Featured 추가
POST /api/admin/featured/:id
  ├─ featuredOrder 자동 지정 (클릭 순서대로 1, 2, 3...)
  └─ DB 업데이트
  ↓
Featured Gallery 표시 (localStorage 5분 캐시)
```

---

## 🔧 핵심 기술 스택

### **Frontend**
- **JavaScript:** Vanilla JS (No Framework)
- **CSS:** Tailwind CSS (CDN)
- **Storage:** IndexedDB (dexie.js)
- **PWA:** Service Worker (오프라인 지원)
- **음성:** Web Speech API (speechSynthesis)

### **Backend**
- **Framework:** Express.js + TypeScript
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL (Neon)
- **인증:** Passport.js (Replit Auth, Google OAuth, Kakao OAuth)
- **파일 업로드:** Multer + Sharp (이미지 압축)
- **AI:** Google Gemini 2.5 Flash

### **Build Tools**
- **Frontend:** Vite
- **Backend:** ESBuild + tsx

---

## 🚨 보호된 코드 (수정 금지)

### **1. generateShareHTML() 함수 (public/index.js)**
- **위치:** 373번 줄
- **목적:** 공유 페이지 HTML 생성
- **보호 이유:** 사용자가 4시간 투자한 원본 로직
- **수정 시 영향:**
  - 공유 페이지 디자인 깨짐
  - 오프라인 기능 손상
  - 음성 재생 버그

### **2. 음성 정지 로직**
- **위치:** public/index.js
  - `stopAudio()` 함수 (841-853번 줄)
  - `#detail-back` 이벤트 (960번 줄)
  - `#detail-home` 이벤트 (1000번 줄)
  - `#home-button` 이벤트 (988번 줄)
- **핵심:** 페이지 이탈 시 `synth.pause()` + `synth.cancel()` + 200ms setTimeout

### **3. sharedHtmlPages 테이블 스키마**
- **위치:** shared/schema.ts (139-156번 줄)
- **보호 이유:** 8시간 작업 결과물
- **수정 시 영향:**
  - 짧은 URL 시스템 파괴
  - 공유 링크 생성 실패
  - DB 구조 손상

### **4. KakaoTalk In-App Browser Fix**
- **위치:** Service Worker + UserAgent 감지
- **보호 이유:** Galaxy 사용자 핵심 UX
- **기능:** 카톡 브라우저 감지 → Chrome 강제 리다이렉트

### **5. Admin Dashboard**
- **위치:** public/admin-dashboard.html
- **보호 이유:** 비즈니스 핵심 기능
- **비밀번호:** 1234 (변경 금지)
- **기능:**
  - 실시간 통계 (KPI)
  - Featured 관리
  - 공유 페이지 검색
  - HTML 재생성

---

## 📝 작업 체크리스트

### **버튼 수정 시**
1. ✅ 어느 페이지의 버튼인지 확인 (Features/Main/Detail/Archive/Settings/Share)
2. ✅ 버튼 ID 확인 (`getElementById('xxx')`)
3. ✅ 기존 이벤트 리스너 확인 (`addEventListener`)
4. ✅ 음성 재생 중인가? → `stopAudio()` 호출 필요
5. ✅ 페이지 이동하는가? → `setTimeout` 200ms 적용
6. ✅ Share Page 수정인가? → `generateShareHTML()` 함수 수정
7. ✅ 새 공유 페이지로 테스트 (캐시 주의!)

### **API 수정 시**
1. ✅ 인증 필요? → `isAuthenticated` 미들웨어
2. ✅ 관리자 전용? → `requireAdmin` 미들웨어
3. ✅ 파일 업로드? → `upload.single('image')` 미들웨어
4. ✅ DB 접근? → Drizzle ORM 사용
5. ✅ 에러 처리? → try-catch + 500 응답

### **DB 스키마 수정 시**
1. ✅ 기존 데이터 호환성 확인
2. ✅ Primary Key 타입 절대 변경 금지
3. ✅ `npm run db:push --force` 실행
4. ✅ 수동 마이그레이션 금지

---

## 🎯 자주 발생하는 실수

### **1. 공유 페이지 수정 후 캐시 문제**
- **문제:** 기존 공유 페이지는 HTML이 이미 저장됨
- **해결:** 새 공유 페이지 생성 후 테스트

### **2. 음성 정지 안 됨**
- **문제:** `synth.cancel()` 호출 후 즉시 페이지 이동
- **해결:** `setTimeout(() => { window.location.href = ... }, 200);`

### **3. 버튼 클릭 안 됨**
- **문제:** `querySelector` vs `getElementById` 혼동
- **해결:** ID는 `getElementById`, Class는 `querySelector`

### **4. Featured Gallery 캐시 미적용**
- **문제:** localStorage 캐시 로직 누락
- **해결:** 5분 캐시 (localStorage + version hash)

### **5. 관리자 기능 접근 불가**
- **문제:** 비밀번호 틀림 또는 세션 만료
- **해결:** 비밀번호 1234 재입력

---

## 📚 참고 파일 위치

```
프로젝트 루트/
├── public/
│   ├── index.js              # 메인 앱 로직 (3,400+ 라인)
│   ├── index.html            # 앱 HTML
│   ├── admin-dashboard.html  # 관리자 대시보드
│   ├── service-worker.js     # Service Worker (앱용)
│   ├── sw-share.js           # Service Worker (공유 페이지용)
│   └── shared/               # 공유 HTML 파일 저장 폴더
│       └── *.html
├── server/
│   ├── routes.ts             # API 라우트 (2,000+ 라인)
│   ├── storage.ts            # 스토리지 인터페이스
│   ├── auth.ts               # 인증 설정
│   └── vite.ts               # Vite 서버 설정
├── shared/
│   └── schema.ts             # DB 스키마
└── replit.md                 # 프로젝트 개요
```

---

## 🏁 결론

이 문서는 **AI 에이전트와 개발자가 앱 구조를 완벽히 이해**하고, **시행착오 없이 작업**하기 위해 작성되었습니다.

**핵심 원칙:**
1. 수정 전 반드시 파일 구조 확인
2. 보호된 코드는 승인 없이 절대 수정 금지
3. 테스트는 새 데이터로 진행 (캐시 주의)
4. 음성 관련 작업은 `stopAudio()` 필수

**문제 발생 시:**
1. 이 문서의 체크리스트 확인
2. 관련 파일의 주석 확인
3. replit.md 참고
4. 사용자에게 명확히 질문 (추측 금지)

---

**마지막 업데이트:** 2025-11-09  
**작성자:** Replit AI Agent (Claude Sonnet 4.5)  
**검토자:** 프로젝트 오너님 💙
