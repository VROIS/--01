# 손안에 가이드 - 통합 작업 히스토리

**최종 업데이트:** 2025-11-11  
**프로젝트:** 내손가이드 (My Hand Guide)  
**환경:** Replit (Express + Vite + PostgreSQL)  
**핵심 타겟:** 📱 모바일 99%, 카카오톡 90%, 삼성 안드로이드 90%

---

## 🔴 긴급 수정 필요 (2025-11-11 모바일 실제 테스트 피드백)

> **중요:** 99% 모바일, 90% 카카오톡, 90% 삼성폰 사용자 → 모든 수정은 이 환경 최적화!

### 📱 테스트 환경
- ✅ PC Chrome: Playwright 자동 테스트
- ❌ 실제 모바일: 수동 테스트 필요 (가장 중요!)
- ❌ 아이폰 Safari
- ❌ 삼성폰 카카오톡

### 🔧 발견된 3가지 문제

#### **1. ❌ 추천갤러리 X 버튼이 창을 안 닫음 (PC/모바일 공통)**

**문제:**
- X 버튼 클릭 시 보관함으로 이동만 하고 창이 안 닫힘
- 독립 페이지인데 페이지 이동 불필요
- 백그라운드 보관함 (카메라 라이브뷰, 인증 상태) 유지 안 됨

**위치:** `server/html-template.ts` Line 137-142

**현재 코드:**
```typescript
function handleSmartClose() {
    window.location.replace('/#archive');  // ❌ 페이지 이동만
}
```

**수정 방안:**
```typescript
function handleSmartClose() {
    window.close();  // ✅ 진짜 창 닫기
}
```

**기대 효과:**
- ✅ 설정/대시보드처럼 `window.close()` 로직 통일
- ✅ 백그라운드 앱 상태 그대로 유지
- ✅ 카메라 라이브뷰 보존

---

#### **2. ❌ 아이폰에서 홈 버튼 → 노란 경고 페이지 ("Chrome에서 열기")**

**문제:**
- 카카오톡 감지 코드가 iOS도 잡아버림 (안드로이드만 해야 함)
- Intent URL은 Android 전용인데 iOS에서도 실행
- "Chrome에서 열기" 버튼 클릭 시 아무 동작 없음

**위치:** `server/html-template.ts` Line 89-124

**현재 코드:**
```javascript
// Line 96
if (userAgent.match(/kakaotalk/i)) {  // ❌ 아이폰도 잡힘!
    isKakaoInApp = true;
    // Intent URL 실행...
}
```

**수정 방안 A (Android만 감지):**
```javascript
// Android 체크 추가
if (userAgent.match(/kakaotalk/i) && userAgent.match(/android/i)) {
    isKakaoInApp = true;
    // Intent URL 실행...
}
```

**수정 방안 B (범용 브라우저 지원 - 권장!):**
```javascript
// Intent URL 아예 제거하고 일반 링크 사용
// 카카오톡 WebView가 알아서 기본 브라우저로 열어줌
window.location.href = appUrl;  // 크롬/엣지/삼성인터넷 다 됨!
```

**연구 결과:**
- 삼성폰 카카오톡 = **Chrome 기반 WebView** (MS 기반 아님!)
- CustomTabs 지원: Chrome, Samsung Internet, Firefox, Whale, Edge
- **Intent URL 불필요** → 일반 링크만으로 모든 브라우저 지원

**기대 효과:**
- ✅ 아이폰: 노란 경고 없이 바로 Safari/Chrome에서 열림
- ✅ 삼성폰: 크롬/엣지/삼성인터넷 어디서든 열림
- ✅ UX 최적화: 경고 페이지 제거

---

#### **3. ❌ 아이폰 로그인 후 팝업 창 2개 (백그라운드에 1개 남음)**

**문제:**
- OAuth 팝업이 iOS Safari에서 자동으로 안 닫힘
- `window.close()` 실패 (iOS 보안 정책)
- 백그라운드에 팝업 창 남아있음
- 이전 배포본에서는 사라졌다고 함 (?)

**위치:** `public/index.js` Line 3195-3268

**현재 코드:**
```javascript
// Line 3196: isMobile() 함수
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Line 3200-3202: Google 로그인
if (isMobile()) {
    window.location.href = '/api/auth/google';  // ✅ 이미 맞음
}
```

**문제 원인 (추정):**
1. iOS UserAgent 감지 실패?
2. Safari Private Mode에서 팝업 강제 오픈?
3. `isMobile()` 함수가 작동 안 함?

**수정 방안 A (모바일 감지 강화):**
```javascript
function isMobile() {
    // 터치 지원 + 화면 크기로 더 정확하게 감지
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return (hasTouch && isSmallScreen) || mobileUA;
}
```

**수정 방안 B (iOS 강제):**
```javascript
function isMobile() {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    return isIOS || isAndroid;
}
```

**기대 효과:**
- ✅ 모바일에서 팝업 안 뜸
- ✅ 현재 탭에서 로그인
- ✅ 로그인 후 자동 복귀
- ✅ 백그라운드 창 없음

---

## ✅ 완료된 작업 (날짜별 역순)

### 📅 2025-11-09: 대시보드/사용설명서 window.open() 변경 ✅

**작업 내용:**
- 설정 페이지 링크 → 버튼으로 변경
- `<a href>` → `<button onclick="window.open()">`
- 새 창으로 열어서 원래 앱 탭 유지

**수정 파일:**
- `public/index.html`

**Before:**
```html
<a href="./admin-dashboard.html">📊 관리자 대시보드 열기</a>
<a href="./user-guide.html">📖 사용설명서 열기</a>
```

**After:**
```html
<button onclick="window.open('./admin-dashboard.html')">📊 관리자 대시보드 열기</button>
<button onclick="window.open('./user-guide.html')">📖 사용설명서 열기</button>
```

**결과:**
- ✅ 새 창 오픈 (PC 테스트 완료)
- ✅ 원래 앱 탭 유지 → 카메라 라이브뷰 보존
- ✅ `window.close()`로 간편하게 닫기

---

### 📅 2025-11-02: Featured Gallery UX 개선 + 다운로드 기능 ✅

**작업 시간:** 3-4시간  
**배경:** 5,100+ 조회수, 566 방문자 바이럴 성장

**완료된 작업:**
1. **추천 갤러리 레이아웃 재구성** ✅
   - 추천 갤러리 상단 고정 (스크롤 안 됨)
   - 내 보관함만 스크롤
   
2. **다운로드 버튼 추가** ✅
   - 추천 갤러리와 내 보관함 사이 배치
   - 선택 모드에서만 표시
   - ZIP 다운로드 기능

3. **Featured Gallery 새 탭 열기** ✅
   - `window.location.href` → `window.open()`
   - 보관함 세션 유지
   
4. **Featured 타이틀 글자 크기 조정** ✅
   - 모바일 가독성 개선
   - `clamp(1.125rem, 6vw, 1.75rem)` → `clamp(1rem, 4.5vw, 1.5rem)`

5. **인증 후 리다이렉트 수정** ✅
   - `res.redirect('/')` → `res.redirect('/archive')`
   - 이탈 방지

**수정 파일:**
- `public/index.html` (레이아웃, 다운로드 버튼)
- `public/index.js` (다운로드 로직, Featured 클릭)
- `server/googleAuth.ts`, `server/kakaoAuth.ts` (리다이렉트)

---

### 📅 2025-10-31: Featured 리턴 버튼 + 콘텐츠 순서 편집 ✅

**작업 시간:** 3시간

**완료된 작업:**
1. **Featured 리턴 버튼 수정** ✅ 🔥 **CRITICAL FIX**
   - 문제: `window.location.href='/#archive'` → 카메라 권한 손실
   - 해결: `window.close()` → 페이지만 닫고 앱 유지
   - 위치: `server/storage.ts` (Line 852)
   - 효과: 삼성폰 카메라 권한 문제 완전 해결

2. **Featured 콘텐츠 순서 편집 기능** ✅
   - Backend: guideIds 파라미터 추가
   - Admin UI: Drag & Drop 구현
   - 20장 이미지 순서 변경 가능

**수정 파일:**
- `server/storage.ts` (리턴 버튼, regenerateFeaturedHtml)
- `server/routes.ts` (POST /api/admin/featured/:id/regenerate)
- `public/admin-dashboard.html` (편집 모달 UI)

---

### 📅 2025-10-26: 관리자 대시보드 & DB 최적화 ✅

**작업 시간:** 4시간

**완료된 작업:**
1. **HTML 파일 저장 시스템 구축** ✅
   - DB에서 htmlContent 제거 → 파일 시스템으로 이동
   - `public/shared/` 폴더에 HTML 파일 저장
   - **결과:** DB 크기 184MB → 39MB (78% 감소!)

2. **기존 데이터 마이그레이션** ✅
   - 40개 기존 공유 페이지를 파일로 이동
   - 총 84.13MB 데이터 마이그레이션

3. **관리자 대시보드 구축** ✅
   - API: GET /api/admin/stats, /api/admin/analytics
   - 실시간 KPI 카드
   - Provider별 사용자 분포
   - 조회수 Top 10 공유 페이지
   - 일별 활동 추이 (최근 7일)

4. **관리자 인증 시스템** ✅
   - 비밀번호 기반 인증 (1234)
   - 설정 페이지 열 때마다 재인증
   - 영업 비밀 보호

5. **디자인 시스템 문서화** ✅
   - Gemini Blue (#4285F4)
   - MaruBuri 폰트
   - Heroicons (이모지 금지)

**수정 파일:**
- `server/routes.ts` (관리자 대시보드 API)
- `server/storage.ts` (HTML 파일 저장)
- `public/index.js` (관리자 인증)
- `public/admin-dashboard.html` (신규 파일)
- `public/index.html` (adminDashboardLink)
- `replit.md` (디자인 시스템)

---

### 📅 2025-10-26 B: Phase 1 긴급 수정 ✅

**작업 시간:** 3시간

**완료된 작업:**
1. **Featured Gallery localStorage 캐싱** ✅
   - 5분 캐싱 시스템
   - API 로딩: 0.9초 → 0ms
   - 보관함 즉시 표시

2. **삼성폰 이미지 업로드 버그 수정** ✅
   - `accept` 속성 단순화
   - 삼성 인터넷 브라우저 호환성

3. **카카오톡 Chrome 강제 리다이렉트** ✅ 🔥 **P1-1 CRITICAL**
   - 문제: 갤럭시 사용자가 카톡에서 링크 클릭 시 페이지 안 열림
   - 해결:
     - UserAgent로 카카오톡 인앱 브라우저 즉시 감지
     - 전체 화면 노란색 경고 배너 즉시 표시
     - 0.5초 후 Intent URL로 Chrome 앱 자동 실행
     - 실패 시 수동 "Chrome에서 열기" 버튼
   - Intent URL: `intent://...#Intent;scheme=https;package=com.android.chrome;end`

**수정 파일:**
- `public/index.js` (Featured 캐싱)
- `public/index.html` (이미지 업로드)
- `server/html-template.ts` (카카오톡 리다이렉트)

---

### 📅 2025-10-05: Featured Gallery 성능 최적화 ✅

**작업 시간:** 4시간

**완료된 작업:**
1. **성능 모니터링 시스템 제거** ✅
   - `performanceMonitor.js` 로딩 제거
   - 불필요한 로깅 정리

2. **Featured Gallery 로딩 최적화** ✅
   - API 호출 간소화 (4-5초 → 즉시)
   - 백그라운드 비동기 로딩
   - 에러 처리 개선

3. **레이아웃 복원** ✅
   - Featured Gallery를 헤더 바로 아래로 이동
   - 원래 UI 순서 복원

---

### 📅 2025-10-02: 공유/삭제 간편 로직 + 4존 스크롤 레이아웃 ✅

**완료된 작업:**
1. **공유 기능 개선** ✅
   - 선택 모드 구현
   - 클릭 순서 보존 (Array 기반)
   - 공유 모달 UI

2. **4존 스크롤 레이아웃** ✅
   - 헤더 고정
   - 스크롤 영역 분리
   - 하단 네비게이션 고정

---

## 🔒 절대 수정 금지 (핵심 로직)

> **⚠️ CRITICAL: DO NOT MODIFY WITHOUT USER APPROVAL**
>
> 3개월간의 시행착오로 완성된 검증된 로직들입니다.  
> 수정 시 **반드시 사용자 승인** 필요!

### 1. 🔥 카카오톡 Chrome 강제 리다이렉트 (2025-10-26)
**위치:** `server/html-template.ts` Line 66-143  
**중요도:** P1-1 CRITICAL  
**작업 시간:** 2시간

**로직:**
```javascript
// UserAgent 감지
if (userAgent.match(/kakaotalk/i)) {
    // 1. 노란 경고 배너 즉시 표시
    banner.style.display = 'block';
    galleryView.style.display = 'none';
    
    // 2. 0.5초 후 Chrome Intent URL 실행
    setTimeout(() => {
        const intentUrl = 'intent://' + urlWithoutProtocol + 
                          '#Intent;scheme=https;package=com.android.chrome;end';
        window.location.href = intentUrl;
    }, 500);
}
```

**영향:** 90% 삼성폰 사용자 핵심 UX

---

### 2. ⚠️ Featured Gallery localStorage 캐싱 (2025-10-26)
**위치:** `public/index.js`  
**중요도:** HIGH

**로직:**
```javascript
const CACHE_KEY = 'featuredGalleryCache';
const CACHE_DURATION = 5 * 60 * 1000; // 5분

const cached = localStorage.getItem(CACHE_KEY);
if (cached && Date.now() - data.timestamp < CACHE_DURATION) {
    // 캐시 사용 (0ms 로딩)
} else {
    // API 호출 + 캐시 저장
}
```

**영향:** 보관함 즉시 표시 (0.9초 → 0ms)

---

### 3. ⚠️ HTML 파일 저장 시스템 (2025-10-26)
**위치:** `server/storage.ts`  
**중요도:** HIGH

**로직:**
```typescript
const htmlFilePath = `/shared/${shortId}.html`;
const fullPath = path.join(process.cwd(), 'public', htmlFilePath);
fs.writeFileSync(fullPath, page.htmlContent, 'utf8');

// DB에는 경로만 저장
await db.insert(sharedHtmlPages).values({ 
    id: shortId,
    htmlFilePath: htmlFilePath,
    // htmlContent 제외!
});
```

**영향:** DB 크기 78% 감소 (184MB → 39MB)

---

### 4. ⚠️ Featured 리턴 버튼 (2025-10-31)
**위치:** `server/storage.ts` Line 852  
**중요도:** CRITICAL

**로직:**
```javascript
onclick="window.close()"  // ← 카메라 권한 보존!
// ❌ window.location.href='/#archive' (카메라 권한 손실)
```

**영향:** 삼성폰 카메라 권한 유지

---

### 5. ⚠️ Featured 순서 편집 (2025-10-31)
**위치:** `public/admin-dashboard.html`  
**중요도:** MEDIUM

**로직:**
```javascript
// Drag & Drop
const guideItems = document.querySelectorAll('.guide-item');
const newGuideIds = Array.from(guideItems).map(item => item.dataset.index);

await fetch(`/api/admin/featured/${id}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ guideIds: newGuideIds })
});
```

---

### 6. ⚠️ 관리자 대시보드 API (2025-10-26)
**위치:** `server/routes.ts` Line 1645-1810  
**중요도:** HIGH (영업 비밀)

**API 목록:**
- GET /api/admin/stats (전체 통계)
- GET /api/admin/analytics (일별 분석)
- POST /api/admin/featured/:id/regenerate

---

### 7. ⚠️ 관리자 인증 로직 (2025-10-26)
**위치:** `public/index.js`  
**중요도:** HIGH (보안)

**로직:**
```javascript
const password = '1234';
if (inputPassword === password) {
    // 대시보드 링크 표시
    adminDashboardLink.classList.remove('hidden');
}
```

---

### 8. ✅ 공유/삭제 간편 로직 (2025-10-02)
**위치:** `public/index.js`  
**중요도:** MEDIUM

**로직:**
```javascript
// 클릭 순서 보존 (Array)
let selectedItemIds = [];  // ← Set이 아니라 Array!

function handleItemSelect(id) {
    if (selectedItemIds.includes(id)) {
        selectedItemIds = selectedItemIds.filter(x => x !== id);
    } else {
        selectedItemIds.push(id);  // 순서 보존
    }
}
```

---

### 9. ✅ 4존 스크롤 레이아웃 (2025-10-02)
**위치:** `public/index.html`  
**중요도:** MEDIUM

**구조:**
```
┌─────────────────┐
│ 보관함 헤더 (고정) │
├─────────────────┤
│ 추천 갤러리 (고정) │
├─────────────────┤
│ ┌─────────────┐ │
│ │ 내 보관함   │ │ ← 여기만 스크롤
│ │ (스크롤)    │ │
│ └─────────────┘ │
├─────────────────┤
│ 하단 네비 (고정)  │
└─────────────────┘
```

---

## 📋 대기중 작업 (백로그)

### 🟡 Priority 1 (중요)

#### 1. 범용 브라우저 지원 (삼성 인터넷, Edge, Whale)
**상태:** ⏳ 대기  
**예상 시간:** 2시간

**목표:**
- Intent URL 제거
- 일반 링크로 모든 브라우저 지원
- Chrome, Samsung Internet, Edge, Whale, Firefox

---

#### 2. Featured 캐시 무효화 시점 명확화
**상태:** ⏳ 대기  
**예상 시간:** 30분

**문제:**
- localStorage 5분 캐시 + DB Featured 업데이트 시차
- 새로 추가한 Featured가 바로 안 보임

**해결:**
- Admin에서 Featured 추가/삭제 시 localStorage 캐시 즉시 삭제

---

#### 3. Google Maps API 위치 정보 시스템
**상태:** ✅ 완료 (2025-10-26)

**완료된 기능:**
- GPS EXIF 자동 추출 (exifr)
- Google Maps Places API 동적 로딩
- GPS → 유명 랜드마크 자동 변환 (100m 반경)
- 상세 페이지 위치 배지 표시
- 공유 페이지에 위치 정보 포함

---

### 🟢 Priority 2 (개선)

#### 4. 공유 페이지 오프라인 지원 강화
**상태:** ⏳ 대기  
**예상 시간:** 2시간

**현재:**
- Service Worker 등록됨
- Cache-First 전략

**개선:**
- 공유 페이지 HTML 파일 자동 캐싱
- 이미지 Base64 임베딩으로 완전 오프라인
- 네트워크 없을 시 안내 메시지

---

#### 5. PC 데스크톱 레이아웃 최적화
**상태:** ⏳ 대기  
**예상 시간:** 1시간

**현재:** 모바일 UI 그대로 (1열 그리드)  
**개선:** 768px 이상에서 3열 그리드 (CSS만 수정)

---

#### 6. 공유 페이지 OG 태그 개선
**상태:** ⏳ 대기  
**예상 시간:** 1시간

**현재:** 기본 제목만  
**개선:** 썸네일 이미지, 설명, 작성자 정보

---

#### 7. SEO 최적화
**상태:** ⏳ 대기  
**예상 시간:** 2시간

- sitemap.xml 생성
- robots.txt 설정
- meta description 개선

---

### 🔵 Priority 3 (장기)

#### 8. 충전식 결제 시스템 (크레딧)
**상태:** ⏳ 대기  
**예상 시간:** 8-10시간

**비즈니스 모델:**
- 1 크레딧 = 300원
- 사진 촬영 + AI = 10 크레딧
- 가이드 저장 = 3 크레딧
- 공유페이지 생성 = 100 크레딧

---

#### 9. 다국어 지원 (ChatGPT 등록 필수)
**상태:** ⏳ 대기  
**예상 시간:** 8-10시간  
**마감:** 2025년 12월

**지원 언어:** 한/영/프/스/포/중/일 (7개)

**범위:**
- 인증 모달 언어 선택
- UI 텍스트 번역
- Gemini API 언어별 호출
- TTS 음성 언어별 생성
- 공유 페이지 언어별 생성

---

#### 10. 네이티브 앱 전환 연구
**상태:** ⏳ 대기  
**예상 시간:** 조사 2-3일

**조사 필요:**
- PWA → Android APK 변환 (PWABuilder, Bubblewrap)
- React Native 전환 비용/시간
- Flutter 전환 가능성
- Play Store 출시 절차 및 비용

---

## 🎯 작업 우선순위 요약

```
🔴 P0 (긴급): 3개 - 모바일 실제 테스트 피드백
  1. X 버튼 window.close()
  2. 아이폰 경고 페이지 제거
  3. iOS 로그인 팝업 문제

🟡 P1 (중요): 3개 - UX 개선
  4. 범용 브라우저 지원
  5. Featured 캐시 관리
  6. 오프라인 강화

🟢 P2 (개선): 4개 - 추가 기능
  7. PC 레이아웃
  8. OG 태그
  9. SEO
  10. 결제 시스템

🔵 P3 (장기): 2개 - 백로그
  11. 다국어 지원
  12. 네이티브 앱
```

---

## 🚨 중요 원칙

1. **모든 수정은 사용자 승인 후 진행** ⚠️
2. **단계별 충분한 소통** 💬
3. **테스트 후 배포** ✅
4. **롤백 가능성 항상 고려** 🔄
5. **99% 모바일 최적화 우선** 📱

---

## 📊 프로젝트 현황

**통계:**
- 5,100+ 조회수
- 566 방문자
- 바이럴 성장 중

**핵심 사용자:**
- 99% 모바일
- 90% 카카오톡 링크
- 90% 삼성 안드로이드

**기술 스택:**
- Frontend: Vanilla JavaScript (React 아님!)
- Backend: Express + TypeScript
- Database: PostgreSQL (Neon)
- AI: Google Gemini 2.5 Flash
- Auth: Replit Auth + Google OAuth + Kakao OAuth

**디자인 시스템:**
- Primary Color: Gemini Blue (#4285F4)
- Font: MaruBuri (마루부리)
- Icons: Heroicons (이모지 금지!)
- Background: #FFFEFA (크림색)

---

**문서 끝**
