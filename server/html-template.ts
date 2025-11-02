interface ShareItem {
  id: string;
  title: string;
  description: string;
  imageBase64: string;
  location?: string;
  locationName?: string; // 🗺️ GPS 위치 이름 (2025-10-26)
}

interface SharePageData {
  title: string;
  items: ShareItem[];
  createdAt: string;
  location?: string;
  includeAudio: boolean;
}

export function generateShareHtml(data: SharePageData): string {
  const { title, items, createdAt, location, includeAudio } = data;
  
  // 최대 20개 아이템으로 제한
  const limitedItems = items.slice(0, 20);
  
  // 갤러리 아이템 생성 (2열 그리드)
  const galleryItemsHtml = limitedItems.map((item, index) => `
    <div class="gallery-item" data-id="${index}">
      <img src="data:image/jpeg;base64,${item.imageBase64}" alt="가이드 ${index + 1}" loading="lazy">
      <p>가이드 ${index + 1}</p>
    </div>
  `).join('');

  // 데이터 JSON (앱과 동일한 구조)
  const dataJSON = JSON.stringify(limitedItems.map((item, index) => ({
    id: index,
    imageDataUrl: `data:image/jpeg;base64,${item.imageBase64}`,
    description: item.description,
    locationName: item.locationName || null // 🗺️ GPS 위치 이름 (2025-10-26)
  })));

  // 앱 origin - ⚠️ 2025.11.02: 보관함으로 (랜딩 페이지 금지)
  const appOrigin = '/archive';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${title} - 손안에 가이드</title>
    <meta property="og:title" content="${title} - 내손가이드">
    <meta property="og:description" content="${limitedItems[0]?.description?.substring(0, 100) || '친구가 공유한 여행 가이드'}">
    <meta property="og:type" content="website">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'gemini-blue': '#4285F4'
                    }
                }
            }
        }
    </script>
    <script>
        // ═══════════════════════════════════════════════════════════════
        // ⭐ 카카오톡 인앱 브라우저 Chrome 강제 리다이렉트 (2025-10-26)
        // ⚠️ CRITICAL: P1-1 최우선 긴급 수정 - DO NOT MODIFY WITHOUT USER APPROVAL
        // ═══════════════════════════════════════════════════════════════
        // 작업 시간: 2시간
        // 문제: 갤럭시 사용자가 카카오톡에서 공유링크 클릭 시 페이지 안 열림
        //       (아이폰은 정상 작동, 삼성폰만 문제 발생)
        // 원인: 카카오톡 인앱 브라우저가 Web Audio API 차단
        // 
        // 해결 전략:
        // 1. UserAgent로 카카오톡 인앱 브라우저 즉시 감지
        // 2. 전체 화면 노란색 경고 배너 즉시 표시 (갤러리 숨김)
        // 3. 0.5초 후 Intent URL로 Chrome 앱 자동 실행
        // 4. 실패 시 사용자가 "Chrome에서 열기" 버튼 수동 클릭
        // 
        // Intent URL 스킴:
        // - intent://도메인/경로#Intent;scheme=https;package=com.android.chrome;end
        // - Android Chrome 앱 강제 실행 (삼성 인터넷 제외)
        // 
        // UX 플로우:
        // 카톡 링크 클릭 → 노란 경고 화면 (0초) → 자동 Chrome 실행 (0.5초)
        // → Chrome에서 정상 재생 ✅
        // ═══════════════════════════════════════════════════════════════
        var isKakaoInApp = false;
        
        (function() {
            var userAgent = navigator.userAgent.toLowerCase();
            var targetUrl = window.location.href;
            
            // 카카오톡 인앱 브라우저 감지
            if (userAgent.match(/kakaotalk/i)) {
                isKakaoInApp = true;
                
                // 1. 즉시 경고 배너 표시 (갤러리 숨김)
                var banner = document.getElementById('kakao-browser-warning');
                var galleryView = document.getElementById('gallery-view');
                var header = document.querySelector('.header');
                
                if (banner) {
                    banner.style.display = 'block';
                    document.body.classList.add('kakao-browser');
                }
                if (galleryView) {
                    galleryView.style.display = 'none';
                }
                if (header) {
                    header.style.display = 'none';
                }
                
                // 2. 자동 리다이렉트 시도 (실패해도 배너는 이미 표시됨)
                setTimeout(function() {
                    // Intent URL로 Chrome 강제 열기
                    var intentUrl = 'intent://' + targetUrl.replace(/https?:\\/\\//, '') + 
                                  '#Intent;scheme=https;package=com.android.chrome;end';
                    window.location.href = intentUrl;
                }, 500); // 0.5초 후 Chrome으로 자동 리다이렉트
            }
        })();
        
        // 🌐 수동 버튼: Chrome에서 열기 (Intent URL)
        function openInChrome() {
            const currentUrl = window.location.href;
            // Android Intent URL 스킴
            const intentUrl = 'intent://' + currentUrl.replace(/https?:\\/\\//, '') + 
                              '#Intent;scheme=https;package=com.android.chrome;end';
            window.location.href = intentUrl;
        }
    </script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            background-color: #f0f2f5;
            overflow-x: hidden;
        }
        .hidden { display: none !important; }
        
        /* 앱과 동일한 전체 화면 배경 */
        .full-screen-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            object-fit: cover;
            z-index: 1;
        }
        
        /* UI 오버레이 레이어 */
        .ui-layer {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            display: flex;
            flex-direction: column;
        }
        
        /* 3구역 레이아웃 */
        .header-safe-area {
            width: 100%;
            height: 80px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 1rem;
            position: relative;
        }
        .content-safe-area {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            background: transparent;
        }
        .footer-safe-area {
            width: 100%;
            height: 100px;
            flex-shrink: 0;
            display: flex;
            justify-content: space-around;
            align-items: center;
            padding: 0 1rem;
        }
        
        /* 텍스트 오버레이 */
        .text-content {
            padding: 2rem 1.5rem;
            line-height: 1.8;
            word-break: keep-all;
            overflow-wrap: break-word;
        }
        .readable-on-image {
            color: white;
            text-shadow: 0px 2px 8px rgba(0, 0, 0, 0.95);
        }
        
        /* 버튼 공통 스타일 (앱과 동일) */
        .interactive-btn {
            transition: transform 0.1s ease;
            cursor: pointer;
            border: none;
        }
        .interactive-btn:active {
            transform: scale(0.95);
        }
        
        /* 헤더 (메타데이터) */
        .header {
            padding: 20px;
            background-color: #343a40;
            color: #fff;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 15px 0;
            font-size: 28px;
        }
        .metadata {
            font-size: 14px;
            opacity: 0.9;
        }
        .metadata p {
            margin: 5px 0;
        }
        
        /* 갤러리 뷰 */
        #gallery-view {
            padding: 15px;
        }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        .gallery-item {
            cursor: pointer;
            text-align: center;
        }
        .gallery-item img {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            background-color: #e9e9e9;
        }
        .gallery-item:hover img {
            transform: scale(1.05);
            box-shadow: 0 6px 15px rgba(0,0,0,0.2);
        }
        .gallery-item p {
            margin: 8px 0 0;
            font-weight: 700;
            color: #333;
            font-size: 14px;
        }
        
        /* 갤러리 하단 버튼 */
        .gallery-footer {
            text-align: center;
            padding: 30px 15px;
        }
        .app-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #4285F4;
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
            transition: all 0.3s;
        }
        .app-button:hover {
            background: #3367D6;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(66, 133, 244, 0.4);
        }
        
        /* 🔔 카카오톡 브라우저 전체 화면 경고 */
        #kakao-browser-warning {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #FEE500 0%, #FFD700 100%);
            color: #3C1E1E;
            z-index: 9999;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            text-align: center;
            animation: fadeIn 0.3s ease-out;
        }
        
        #kakao-browser-warning[style*="display: block"] {
            display: flex !important;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        #kakao-browser-warning .warning-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        
        #kakao-browser-warning .warning-title {
            font-weight: 900;
            font-size: 28px;
            margin-bottom: 16px;
            line-height: 1.3;
        }
        
        #kakao-browser-warning .warning-message {
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 30px;
            opacity: 0.9;
            max-width: 400px;
        }
        
        #kakao-browser-warning .chrome-btn {
            display: inline-block;
            padding: 18px 40px;
            background: #3C1E1E;
            color: #FEE500;
            border: none;
            border-radius: 16px;
            font-weight: 900;
            font-size: 20px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.3s;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
            50% { transform: scale(1.05); box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
        }
        
        #kakao-browser-warning .chrome-btn:active {
            transform: scale(0.95);
        }
        
        #kakao-browser-warning .helper-text {
            margin-top: 20px;
            font-size: 14px;
            opacity: 0.8;
            max-width: 350px;
        }
    </style>
</head>
<body>
    <!-- ✕ 닫기 버튼 (모든 공유 페이지에 표시) - ⚠️ 2025.11.02: 보관함으로 이동 -->
    <button id="closeWindowBtn" onclick="window.location.href='/archive'" title="보관함으로 돌아가기" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); border-radius: 50%; color: #4285F4; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>
    
    <!-- 🔔 카카오톡 인앱 브라우저 전체 화면 경고 -->
    <div id="kakao-browser-warning">
        <div class="warning-icon">⚠️</div>
        <div class="warning-title">
            카카오톡에서는<br>이 페이지를 볼 수 없어요
        </div>
        <div class="warning-message">
            음성과 이미지가 제대로 작동하지 않습니다.<br>
            아래 버튼을 눌러 Chrome에서 열어주세요!
        </div>
        <button onclick="openInChrome()" class="chrome-btn">
            🌐 Chrome에서 열기
        </button>
        <div class="helper-text">
            버튼을 누르면 자동으로 Chrome 브라우저로 이동합니다
        </div>
    </div>
    <!-- 헤더 (메타데이터) -->
    <div class="header">
        <h1>${title}</h1>
        <div class="metadata">
            <p>👤 공유된 가이드</p>
            ${location ? `<p>📍 ${location}</p>` : ''}
            <p>📅 ${new Date(createdAt).toLocaleDateString('ko-KR')}</p>
        </div>
    </div>
    
    <!-- 갤러리 뷰 -->
    <div id="gallery-view">
        <!-- 🔙 보관함으로 돌아가기 & 🗑️ 삭제 버튼 (2025-11-02) -->
        <div style="position: sticky; top: 0; z-index: 100; background: linear-gradient(to bottom, #343a40 0%, #343a40 80%, transparent 100%); padding: 15px; padding-bottom: 30px; display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="gallery-back-btn" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(66, 133, 244, 0.9); color: white; padding: 12px 24px; border-radius: 12px; border: none; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3); transition: all 0.3s; backdrop-filter: blur(10px);">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                보관함으로 돌아가기
            </button>
            <button id="gallery-delete-btn" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(239, 68, 68, 0.9); color: white; padding: 12px 24px; border-radius: 12px; border: none; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s; backdrop-filter: blur(10px);">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                이 페이지 삭제
            </button>
        </div>
        <div class="gallery-grid">
            ${galleryItemsHtml}
        </div>
    </div>
    
    <!-- 상세 뷰 (앱과 100% 동일한 구조) -->
    <div id="detail-view" class="ui-layer hidden">
        <img id="detail-bg" src="" class="full-screen-bg">
        <header class="header-safe-area">
            <button id="detail-back" class="w-12 h-12 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-gemini-blue interactive-btn shadow-2xl absolute top-1/2 left-4 -translate-y-1/2" aria-label="뒤로가기">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
            </button>
        </header>
        <div class="content-safe-area">
            <div id="detail-text" class="text-content hidden">
                <!-- 📍 위치 정보 표시 (2025-10-26) -->
                <div id="detail-location-info" class="hidden mb-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gemini-blue flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                    </svg>
                    <span id="detail-location-name" class="text-base font-semibold text-gray-800"></span>
                </div>
                <p id="detail-description" class="readable-on-image text-xl leading-relaxed"></p>
            </div>
        </div>
        <footer id="detail-footer" class="footer-safe-area hidden" style="background: transparent;">
            ${includeAudio ? `
            <button id="detail-audio" class="w-16 h-16 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-gemini-blue interactive-btn shadow-2xl" aria-label="오디오 재생">
                <svg id="play-icon" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.648c1.295.748 1.295 2.538 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                </svg>
                <svg id="pause-icon" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 hidden" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
                </svg>
            </button>
            ` : ''}
            <button id="text-toggle" class="w-16 h-16 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-gemini-blue interactive-btn shadow-2xl" aria-label="해설 읽기">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>
            <a href="${appOrigin}" class="w-16 h-16 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-gemini-blue interactive-btn shadow-2xl no-underline" aria-label="앱으로 이동">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            </a>
        </footer>
    </div>
    
    <!-- 데이터 저장 -->
    <script id="app-data" type="application/json">${dataJSON}</script>
    
    <script>
        // 데이터 로드
        const appData = JSON.parse(document.getElementById('app-data').textContent);
        const galleryView = document.getElementById('gallery-view');
        const detailView = document.getElementById('detail-view');
        const header = document.querySelector('.header');
        
        ${includeAudio ? `
        // Web Speech API
        const synth = window.speechSynthesis;
        let voices = [];
        let currentUtterance = null;
        
        function populateVoiceList() {
            voices = synth.getVoices().filter(v => v.lang.startsWith('ko'));
        }
        
        function stopAudio() {
            if (synth.speaking) synth.cancel();
            const playIcon = document.getElementById('play-icon');
            const pauseIcon = document.getElementById('pause-icon');
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
        }
        
        function playAudio(text) {
            stopAudio();
            currentUtterance = new SpeechSynthesisUtterance(text);
            const koVoice = voices.find(v => v.lang.startsWith('ko'));
            if (koVoice) currentUtterance.voice = koVoice;
            currentUtterance.lang = 'ko-KR';
            currentUtterance.rate = 1.0;
            
            const playIcon = document.getElementById('play-icon');
            const pauseIcon = document.getElementById('pause-icon');
            
            currentUtterance.onstart = () => {
                if (playIcon) playIcon.style.display = 'none';
                if (pauseIcon) pauseIcon.style.display = 'block';
            };
            currentUtterance.onend = () => {
                if (playIcon) playIcon.style.display = 'block';
                if (pauseIcon) pauseIcon.style.display = 'none';
            };
            synth.speak(currentUtterance);
        }
        
        populateVoiceList();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = populateVoiceList;
        }
        ` : ''}
        
        // 갤러리 아이템 클릭 (앱과 100% 동일한 로직)
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemData = appData[parseInt(item.dataset.id)];
                
                // 배경 이미지 설정
                document.getElementById('detail-bg').src = itemData.imageDataUrl;
                
                // 📍 위치 정보 표시 (2025-10-26)
                const locationInfo = document.getElementById('detail-location-info');
                const locationName = document.getElementById('detail-location-name');
                if (itemData.locationName && locationInfo && locationName) {
                    locationName.textContent = itemData.locationName;
                    locationInfo.classList.remove('hidden');
                } else if (locationInfo) {
                    locationInfo.classList.add('hidden');
                }
                
                // 텍스트 설정
                document.getElementById('detail-description').textContent = itemData.description;
                
                // UI 표시
                galleryView.classList.add('hidden');
                header.classList.add('hidden');
                detailView.classList.remove('hidden');
                document.getElementById('detail-footer').classList.remove('hidden');
                
                // 텍스트는 숨김 상태로 시작 (앱과 동일)
                document.getElementById('detail-text').classList.add('hidden');
                
                ${includeAudio ? `
                // 음성 자동 재생
                playAudio(itemData.description);
                ` : ''}
            });
        });
        
        // 🔙 보관함으로 돌아가기 (갤러리 뷰)
        const galleryBackBtn = document.getElementById('gallery-back-btn');
        if (galleryBackBtn) {
            galleryBackBtn.addEventListener('click', () => {
                // ⚠️ 2025.11.02: 보관함으로 이동 (랜딩 페이지 금지)
                window.location.href = '/archive';
            });
        }
        
        // 🗑️ 공유 페이지 삭제 (2025-11-02)
        const galleryDeleteBtn = document.getElementById('gallery-delete-btn');
        if (galleryDeleteBtn) {
            galleryDeleteBtn.addEventListener('click', async () => {
                if (!confirm('이 공유 페이지를 삭제하시겠습니까?\\n\\n삭제된 페이지는 복구할 수 없습니다.')) {
                    return;
                }
                
                try {
                    // 현재 URL에서 share ID 추출 (/s/xxxxx 또는 /shared/xxxxx.html)
                    const pathParts = window.location.pathname.split('/');
                    let shareId = '';
                    
                    if (pathParts.includes('s')) {
                        // /s/xxxxx 형식
                        const sIndex = pathParts.indexOf('s');
                        shareId = pathParts[sIndex + 1];
                    } else if (pathParts.includes('shared')) {
                        // /shared/xxxxx.html 형식
                        const filename = pathParts[pathParts.length - 1];
                        shareId = filename.replace('.html', '');
                    }
                    
                    if (!shareId) {
                        alert('공유 페이지 ID를 찾을 수 없습니다.');
                        return;
                    }
                    
                    console.log('🗑️ Deleting share page:', shareId);
                    
                    // API 호출
                    const response = await fetch(\`/api/share/\${shareId}\`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        alert('공유 페이지가 삭제되었습니다.');
                        window.location.href = '/archive';
                    } else {
                        const error = await response.json().catch(() => ({ message: '알 수 없는 오류' }));
                        alert('삭제 실패: ' + (error.message || '알 수 없는 오류'));
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    alert('삭제 중 오류가 발생했습니다: ' + error.message);
                }
            });
        }
        
        // 뒤로 가기 (디테일 뷰 → 갤러리 뷰)
        document.getElementById('detail-back').addEventListener('click', () => {
            ${includeAudio ? 'stopAudio();' : ''}
            detailView.classList.add('hidden');
            document.getElementById('detail-text').classList.add('hidden');
            document.getElementById('detail-footer').classList.add('hidden');
            header.classList.remove('hidden');
            galleryView.classList.remove('hidden');
        });
        
        // 텍스트 토글 버튼 (앱과 동일한 로직)
        document.getElementById('text-toggle')?.addEventListener('click', () => {
            document.getElementById('detail-text').classList.toggle('hidden');
        });
        
        ${includeAudio ? `
        // 음성 재생/정지
        const audioBtn = document.getElementById('detail-audio');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                if (synth.speaking) {
                    stopAudio();
                } else {
                    const text = document.getElementById('detail-description').textContent;
                    playAudio(text);
                }
            });
        }
        ` : ''}
        
        // Service Worker 등록 (오프라인 지원)
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('✅ Service Worker 등록 성공:', registration.scope);
                    })
                    .catch(error => {
                        console.error('❌ Service Worker 등록 실패:', error);
                    });
            });
        }
    </script>
</body>
</html>`;
}
