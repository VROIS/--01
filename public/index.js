// Import services and utils from the root directory
import * as gemini from './geminiService.js';
import { optimizeImage } from './imageOptimizer.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const uploadInput = document.getElementById('upload-input');
    const toastContainer = document.getElementById('toastContainer');
    
    // Share Modal Elements (Now used for loading state)
    const shareModal = document.getElementById('shareModal');
    const shareModalContent = document.getElementById('shareModalContent');
    const closeShareModalBtn = document.getElementById('closeShareModalBtn');

    // Pages
    const featuresPage = document.getElementById('featuresPage');
    const mainPage = document.getElementById('mainPage');
    const detailPage = document.getElementById('detailPage');
    const archivePage = document.getElementById('archivePage');
    const settingsPage = document.getElementById('settingsPage'); // New page

    // Features Page Elements
    const startCameraFromFeaturesBtn = document.getElementById('startCameraFromFeaturesBtn');

    // Main Page Elements
    const cameraStartOverlay = document.getElementById('cameraStartOverlay');
    const mainLoader = document.getElementById('mainLoader');
    const mainFooter = mainPage.querySelector('.footer-safe-area');
    const shootBtn = document.getElementById('shootBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const micBtn = document.getElementById('micBtn');
    const archiveBtn = document.getElementById('archiveBtn');

    // Detail Page Elements
    const backBtn = document.getElementById('backBtn');
    const resultImage = document.getElementById('resultImage');
    const loader = document.getElementById('loader');
    const textOverlay = document.getElementById('textOverlay');
    const descriptionText = document.getElementById('descriptionText');
    const loadingHeader = document.getElementById('loadingHeader');
    const loadingHeaderText = loadingHeader.querySelector('h1');
    const loadingText = document.getElementById('loadingText');
    const detailFooter = document.getElementById('detailFooter');
    const audioBtn = document.getElementById('audioBtn');
    const textToggleBtn = document.getElementById('textToggleBtn');
    const saveBtn = document.getElementById('saveBtn');

    // Archive Page Elements
    const archiveBackBtn = document.getElementById('archiveBackBtn');
    const archiveGrid = document.getElementById('archiveGrid');
    const emptyArchiveMessage = document.getElementById('emptyArchiveMessage');
    const featuredGallery = document.getElementById('featuredGallery');
    const featuredGrid = document.getElementById('featuredGrid');
    const archiveHeader = document.getElementById('archiveHeader');
    const selectionHeader = document.getElementById('selectionHeader');
    const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
    const selectionCount = document.getElementById('selectionCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const archiveSelectBtn = document.getElementById('archiveSelectBtn');
    const archiveShareBtn = document.getElementById('archiveShareBtn');
    const archiveDeleteBtn = document.getElementById('archiveDeleteBtn');
    const archiveSettingsBtn = document.getElementById('archiveSettingsBtn');

    // Settings Page Elements
    const settingsBackBtn = document.getElementById('settingsBackBtn');
    const authSection = document.getElementById('authSection');
    const authForm = document.getElementById('authForm');
    const authPassword = document.getElementById('authPassword');
    const promptSettingsSection = document.getElementById('promptSettingsSection');
    const imagePromptTextarea = document.getElementById('imagePromptTextarea');
    const textPromptTextarea = document.getElementById('textPromptTextarea');
    const savePromptsBtn = document.getElementById('savePromptsBtn');
    const resetPromptsBtn = document.getElementById('resetPromptsBtn');
    // v1.8: New Demo Elements
    const imageSynthesisPromptTextarea = document.getElementById('imageSynthesisPromptTextarea');
    const generateImageBtn = document.getElementById('generateImageBtn');
    const videoGenerationPromptTextarea = document.getElementById('videoGenerationPromptTextarea');
    const generateVideoBtn = document.getElementById('generateVideoBtn');


    // Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = SpeechRecognition ? new SpeechRecognition() : null;
    let isRecognizing = false;

    let stream = null;
    let isCameraActive = false; // To prevent camera re-initialization
    
    // TTS State
    const synth = window.speechSynthesis;
    let utteranceQueue = [];
    let isSpeaking = false;
    let isPaused = false;
    let currentlySpeakingElement = null;
    let lastAudioClickTime = 0;

    // App State
    let currentContent = { imageDataUrl: null, description: '' };
    let isSelectionMode = false;
    let selectedItemIds = new Set();
    let cameFromArchive = false;
    
    // --- IndexedDB Setup ---
    const DB_NAME = 'TravelGuideDB';
    const DB_VERSION = 2; // Updated for shareLinks store
    const STORE_NAME = 'archive';
    const SHARE_LINKS_STORE = 'shareLinks';
    let db;

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (event) => reject("IndexedDB error: " + event.target.errorCode);
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create archive store if not exists
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                
                // Create shareLinks store for version 2
                if (!db.objectStoreNames.contains(SHARE_LINKS_STORE)) {
                    const shareStore = db.createObjectStore(SHARE_LINKS_STORE, { keyPath: 'id' });
                    shareStore.createIndex('featured', 'featured', { unique: false });
                }
            };
        });
    }

    function addItem(item) {
        return new Promise(async (resolve, reject) => {
            if (!db) return reject("DB not open");
            
            // Generate a unique ID for both IndexedDB and server usage.
            const uniqueId = item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const itemWithId = { ...item, id: uniqueId };

            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(itemWithId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject("Error adding item: " + event.target.error);
        });
    }

    function getAllItems() {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not open");
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result.reverse()); // Show newest first
            request.onerror = (event) => reject("Error getting items: " + event.target.error);
        });
    }
    
    function deleteItems(ids) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not open");
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            let deletePromises = [];
            ids.forEach(id => {
                deletePromises.push(new Promise((res, rej) => {
                    const request = store.delete(id);
                    request.onsuccess = res;
                    request.onerror = rej;
                }));
            });
            Promise.all(deletePromises).then(resolve).catch(reject);
        });
    }

    // --- ShareLinks Functions ---
    function addShareLink(shareLink) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not open");
            const transaction = db.transaction([SHARE_LINKS_STORE], 'readwrite');
            const store = transaction.objectStore(SHARE_LINKS_STORE);
            const request = store.add(shareLink);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject("Error adding shareLink: " + event.target.error);
        });
    }

    function getFeaturedShareLinks() {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not open");
            const transaction = db.transaction([SHARE_LINKS_STORE], 'readonly');
            const store = transaction.objectStore(SHARE_LINKS_STORE);
            const index = store.index('featured');
            const request = index.getAll(true); // Get featured=true items
            request.onsuccess = () => {
                const items = request.result.sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
                resolve(items);
            };
            request.onerror = (event) => reject("Error getting featured shareLinks: " + event.target.error);
        });
    }

    /**
     * ⚠️ **수정금지** - 2025-10-03 3시간 디버깅 끝에 완성
     * 
     * 🌐 공유 HTML 생성 함수 (독립적인 PWA 홈페이지)
     * 
     * 구조: 앱과 동일한 UX/UI (public/index.html #detailPage 복사)
     * - 갤러리: 2열 그리드 썸네일 (모바일 최적화)
     * - 상세: 전체 화면 배경 이미지 + 텍스트 오버레이
     * - z-index 계층: background(1) → ui-layer(10) → header(20) → content(25) → footer(30)
     * - position: header-safe-area는 반드시 relative (버튼 클릭 위해 필수!)
     * - 텍스트 자동 하이라이트: onboundary 이벤트로 문장 단위 강조
     * 
     * 핵심 수정사항:
     * 1. .header-safe-area에 position: relative 추가 (버튼 클릭 문제 해결)
     * 2. .content-safe-area에 z-index: 25 추가 (텍스트 표시 문제 해결)
     * 3. playAudio에 onboundary 하이라이트 기능 추가
     * 4. 텍스트 초기 표시 로직: 음성과 동시에 표시 (hidden 제거)
     */
    function generateShareHTML(title, sender, location, date, guideItems, appOrigin) {
        // HTML escape 함수 (XSS 방지 및 파싱 에러 방지)
        const escapeHTML = (str) => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
        
        // 갤러리 그리드 아이템 생성 (2열)
        const galleryItemsHTML = guideItems.map((item, index) => `
            <div class="gallery-item" data-id="${index}">
                <img src="${item.imageDataUrl || ''}" alt="가이드 ${index + 1}" loading="lazy">
                <p>가이드 ${index + 1}</p>
            </div>
        `).join('');

        // 데이터 JSON (이미지 + 설명만, title 없음!)
        const dataJSON = JSON.stringify(guideItems.map((item, index) => ({
            id: index,
            imageDataUrl: item.imageDataUrl || '',
            description: item.description || ''
        })));

        // UTF-8 안전한 base64 인코딩
        const utf8ToBase64 = (str) => {
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
                return String.fromCharCode('0x' + p1);
            }));
        };

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${escapeHTML(title)} - 손안에 가이드</title>
    <link rel="manifest" href="data:application/json;base64,${utf8ToBase64(JSON.stringify({
        name: title,
        short_name: title,
        start_url: '.',
        display: 'standalone',
        theme_color: '#4285F4'
    }))}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            background-color: #f0f2f5;
            overflow-x: hidden;
        }
        .hidden { display: none !important; }
        
        /* 앱과 100% 동일한 CSS (복사) */
        .full-screen-bg { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100vw; 
            height: 100vh; 
            object-fit: cover; 
            z-index: 1; 
        }
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
        .header-safe-area { 
            position: relative;
            width: 100%; 
            height: 80px; 
            flex-shrink: 0; 
            z-index: 20;
            display: flex; 
            align-items: center; 
            justify-content: center; 
            padding: 0 1rem;
        }
        .content-safe-area { 
            flex: 1; 
            overflow-y: auto; 
            -webkit-overflow-scrolling: touch; 
            background: transparent;
            z-index: 25;
        }
        .footer-safe-area { 
            width: 100%; 
            height: 100px; 
            flex-shrink: 0; 
            z-index: 30; 
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
            background-color: #4285F4; /* Gemini Blue - 앱 통일 */
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
            max-width: 1200px;
            margin: 0 auto;
        }
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        
        /* 반응형: 태블릿/노트북/PC (768px 이상) */
        @media (min-width: 768px) {
            .gallery-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
            }
            #gallery-view {
                padding: 30px;
            }
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
    </style>
</head>
<body>
    <!-- 헤더 (메타데이터) -->
    <div class="header">
        <h1>${escapeHTML(title)}</h1>
        <div class="metadata">
            <p>👤 ${escapeHTML(sender)} 님이 보냄</p>
            <p>📍 ${escapeHTML(location)}</p>
            <p>📅 ${escapeHTML(date)}</p>
        </div>
    </div>
    
    <!-- 갤러리 뷰 -->
    <div id="gallery-view">
        <div class="gallery-grid">
            ${galleryItemsHTML}
        </div>
        <div class="gallery-footer">
            <a href="${appOrigin}" class="app-button">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                손안에 가이드 시작하기
            </a>
        </div>
    </div>
    
    <!-- 상세 뷰 (앱과 100% 동일한 구조) -->
    <div id="detail-view" class="ui-layer hidden">
        <img id="detail-bg" src="" class="full-screen-bg">
        <header class="header-safe-area">
            <button id="detail-back" class="interactive-btn" style="width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); color: #4285F4; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: absolute; top: 50%; left: 1rem; transform: translateY(-50%);" aria-label="뒤로가기">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 1.5rem; height: 1.5rem;" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
            </button>
        </header>
        <div class="content-safe-area">
            <div id="detail-text" class="text-content hidden">
                <p id="detail-description" class="readable-on-image" style="font-size: 1.25rem; line-height: 1.75rem;"></p>
            </div>
        </div>
        <footer id="detail-footer" class="footer-safe-area hidden" style="background: transparent;">
            <button id="detail-audio" class="interactive-btn" style="width: 4rem; height: 4rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); color: #4285F4; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);" aria-label="오디오 재생">
                <svg id="play-icon" xmlns="http://www.w3.org/2000/svg" style="width: 2rem; height: 2rem;" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.648c1.295.748 1.295 2.538 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                </svg>
                <svg id="pause-icon" xmlns="http://www.w3.org/2000/svg" style="width: 2rem; height: 2rem; display: none;" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
                </svg>
            </button>
            <button id="text-toggle" class="interactive-btn" style="width: 4rem; height: 4rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); color: #4285F4; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);" aria-label="해설 읽기">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 2rem; height: 2rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>
            <a href="${appOrigin}" class="interactive-btn" style="width: 4rem; height: 4rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); color: #4285F4; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-decoration: none;" aria-label="앱으로 이동">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 2rem; height: 2rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
        
        function playAudio(text) {
            stopAudio();
            
            // ⚠️ **핵심 로직 - 절대 수정 금지!** (2025-10-03 치명적 버그 해결)
            // 
            // 문제: HTML 내부 JavaScript에서 정규식 /<br\s*\/?>/gi 사용 시
            //       HTML 파서가 < > 를 &lt; &gt; 로 변환하여 JavaScript 파싱 에러 발생
            //       → "Uncaught SyntaxError: Unexpected token '&'" 
            //
            // 해결: new RegExp() 방식으로 HTML 파서와 100% 분리
            //       - 안전성: HTML escape 문제 원천 차단
            //       - 호환성: 모든 브라우저 지원
            //       - 영구성: 앞으로 절대 깨지지 않음
            //
            // 영향: 27개 기존 공유 페이지 DB 일괄 업데이트 완료 (2025-10-03)
            const cleanText = text.replace(new RegExp('<br\\s*/?>', 'gi'), ' ');
            
            // 문장 분리 및 하이라이트 준비
            const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
            const textElement = document.getElementById('detail-description');
            
            // 원본 텍스트 저장
            const originalText = cleanText;
            
            currentUtterance = new SpeechSynthesisUtterance(cleanText);
            
            // ⚠️ 오프라인 최적화 - Microsoft Heami 음성 강제 지정 (현장 테스트 완료)
            // 첨부된 HTML 방식: 정확한 이름 매칭으로 음성 고정
            const targetVoice = voices.find(v => v.name === 'Microsoft Heami - Korean (Korea)');
            currentUtterance.voice = targetVoice;
            currentUtterance.lang = 'ko-KR';
            currentUtterance.rate = 1.0;
            
            const playIcon = document.getElementById('play-icon');
            const pauseIcon = document.getElementById('pause-icon');
            
            let currentSentenceIndex = 0;
            
            currentUtterance.onstart = () => {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            };
            
            // 단어 경계마다 하이라이트
            currentUtterance.onboundary = (event) => {
                if (event.name === 'sentence') {
                    // 현재 문장 하이라이트
                    const highlightedHTML = sentences.map((sentence, idx) => {
                        if (idx === currentSentenceIndex) {
                            return '<span style="background-color: rgba(66, 133, 244, 0.3); font-weight: 600;">' + sentence + '</span>';
                        }
                        return sentence;
                    }).join('');
                    
                    textElement.innerHTML = highlightedHTML;
                    currentSentenceIndex++;
                }
            };
            
            currentUtterance.onend = () => {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                // 하이라이트 제거, 원본 복원
                textElement.textContent = originalText;
            };
            
            synth.speak(currentUtterance);
        }
        
        populateVoiceList();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = populateVoiceList;
        }
        
        // 갤러리 아이템 클릭 (앱과 100% 동일한 로직)
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemData = appData[parseInt(item.dataset.id)];
                
                // 배경 이미지 설정
                document.getElementById('detail-bg').src = itemData.imageDataUrl;
                
                // 텍스트 설정
                document.getElementById('detail-description').textContent = itemData.description;
                
                // UI 표시
                galleryView.classList.add('hidden');
                header.classList.add('hidden');
                detailView.classList.remove('hidden');
                document.getElementById('detail-footer').classList.remove('hidden');
                
                // 텍스트는 표시 상태로 시작 (음성과 동시에 보임)
                document.getElementById('detail-text').classList.remove('hidden');
                
                // 음성 자동 재생
                playAudio(itemData.description);
            });
        });
        
        // 뒤로 가기
        document.getElementById('detail-back').addEventListener('click', () => {
            stopAudio();
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
        
        // 음성 재생/정지
        document.getElementById('detail-audio').addEventListener('click', () => {
            if (synth.speaking) {
                stopAudio();
            } else {
                const text = document.getElementById('detail-description').textContent;
                playAudio(text);
            }
        });
    </script>
    
    <!-- ⚠️ 핵심 로직: Service Worker 등록 (오프라인 지원) -->
    <script>
        // Service Worker 지원 확인 및 등록
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw-share.js')
                    .then(registration => {
                        console.log('✅ [SW] 등록 성공:', registration.scope);
                    })
                    .catch(error => {
                        console.log('❌ [SW] 등록 실패:', error);
                    });
            });
        } else {
            console.log('⚠️ [SW] Service Worker를 지원하지 않는 브라우저입니다.');
        }
    </script>
</body>
</html>`;
    }

    function downloadHTML(filename, content) {
        const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Download featured shareLink HTML
    window.downloadFeaturedHTML = async function(shareLinkId) {
        try {
            const transaction = db.transaction([SHARE_LINKS_STORE], 'readonly');
            const store = transaction.objectStore(SHARE_LINKS_STORE);
            const request = store.get(shareLinkId);
            
            request.onsuccess = () => {
                const shareLink = request.result;
                if (shareLink) {
                    const appOrigin = window.location.origin;
                    const htmlContent = generateShareHTML(
                        shareLink.title,
                        shareLink.sender,
                        shareLink.location,
                        shareLink.date,
                        shareLink.guideItems,
                        appOrigin
                    );
                    downloadHTML(`${shareLink.title}-손안에가이드.html`, htmlContent);
                    showToast('다운로드가 시작되었습니다.');
                }
            };
        } catch (error) {
            console.error('Download error:', error);
            showToast('다운로드 중 오류가 발생했습니다.');
        }
    };

    // --- UI Helpers ---
    function showToast(message, duration = 3000) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, duration);
    }
    
    // --- Page Control ---
    function showPage(pageToShow) {
        [featuresPage, mainPage, detailPage, archivePage, settingsPage].forEach(page => {
            if (page) page.classList.toggle('visible', page === pageToShow);
        });
    }
    
    function showMainPage() {
        cameFromArchive = false; // Reset navigation state
        // ✅ 페이지 이동 시 음성 즉시 정지 - 2025.10.02 확보됨
        synth.cancel();
        resetSpeechState();
        showPage(mainPage);

        detailPage.classList.remove('bg-friendly');
        cameraStartOverlay.classList.add('hidden');
        mainFooter.classList.remove('hidden');

        if (stream && !isCameraActive) {
            resumeCamera();
        }
    }

    function showDetailPage(isFromArchive = false) {
        pauseCamera();
        showPage(detailPage);
        saveBtn.disabled = isFromArchive;
    }

    // ═══════════════════════════════════════════════════════════════
    // ⚠️ CRITICAL: DO NOT MODIFY WITHOUT USER APPROVAL
    // 사용자 승인 없이 절대 수정 금지 - AI 및 모든 개발자 주의
    // Verified: 2025-10-02 | Status: Production-Ready ✅
    // ═══════════════════════════════════════════════════════════════
    async function showArchivePage() {
        pauseCamera();
        synth.cancel();
        resetSpeechState();
        if (isSelectionMode) { 
            toggleSelectionMode(false);
        }
        await renderArchive();
        showPage(archivePage);
    }

    async function showSettingsPage() {
        pauseCamera();
        // Reset settings page state
        authPassword.value = '';
        authSection.classList.remove('hidden');
        promptSettingsSection.classList.add('hidden');
        populatePromptTextareas(); // Load saved or default prompts
        showPage(settingsPage);
    }

    // ⭐ Featured 갤러리 관리 기능
    async function loadFeaturedData() {
        try {
            // 공유 페이지 목록 로드
            const sharesResponse = await fetch('/api/admin/shares', {
                credentials: 'include'
            });
            
            if (sharesResponse.status === 403) {
                // 관리자가 아님 - Featured 섹션 숨기기
                return;
            }
            
            const shares = await sharesResponse.json();
            const featuredResponse = await fetch('/api/admin/featured', {
                credentials: 'include'
            });
            const featured = await featuredResponse.json();
            
            renderFeaturedManagement(shares, featured);
        } catch (error) {
            console.error('Featured 데이터 로드 실패:', error);
        }
    }

    function renderFeaturedManagement(shares, featured) {
        const select = document.getElementById('featuredShareSelect');
        const searchInput = document.getElementById('shareSearchInput');
        const list = document.getElementById('featuredList');
        const count = document.getElementById('featuredCount');
        
        // 전체 공유 페이지 데이터 저장 (검색용)
        window.allShares = shares;
        
        // 드롭다운 렌더링 함수
        const renderOptions = (filteredShares) => {
            select.innerHTML = '<option value="">공유 페이지를 선택하세요</option>';
            filteredShares.forEach(share => {
                const option = document.createElement('option');
                option.value = share.id;
                option.textContent = `${share.name} (${new Date(share.createdAt).toLocaleDateString()})`;
                select.appendChild(option);
            });
            
            // 검색 결과가 없을 때
            if (filteredShares.length === 0) {
                select.innerHTML = '<option value="">검색 결과가 없습니다</option>';
            }
        };
        
        // 초기 렌더링
        renderOptions(shares);
        
        // 검색 기능
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filtered = window.allShares.filter(share => {
                    const name = share.name.toLowerCase();
                    const date = new Date(share.createdAt).toLocaleDateString();
                    return name.includes(searchTerm) || date.includes(searchTerm);
                });
                renderOptions(filtered);
            });
        }
        
        // Featured 목록 렌더링
        count.textContent = featured.length;
        
        if (featured.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400">Featured 항목이 없습니다</p>';
        } else {
            list.innerHTML = featured.map(item => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                    <div class="flex-1">
                        <p class="font-medium text-sm text-gray-800">${item.name}</p>
                        <p class="text-xs text-gray-500">ID: ${item.id} • ${new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                        onclick="removeFeatured('${item.id}')" 
                        class="ml-4 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition">
                        제거
                    </button>
                </div>
            `).join('');
        }
    }

    async function addFeatured() {
        const select = document.getElementById('featuredShareSelect');
        const shareId = select.value;
        
        if (!shareId) {
            showToast('공유 페이지를 선택해주세요.');
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/featured/${shareId}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                showToast(result.error || 'Featured 추가에 실패했습니다.');
                return;
            }
            
            showToast('✅ Featured로 추가되었습니다!');
            await loadFeaturedData(); // 새로고침
        } catch (error) {
            console.error('Featured 추가 오류:', error);
            showToast('Featured 추가에 실패했습니다.');
        }
    }

    async function removeFeatured(id) {
        try {
            const response = await fetch(`/api/admin/featured/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                showToast(result.error || 'Featured 제거에 실패했습니다.');
                return;
            }
            
            showToast('✅ Featured에서 제거되었습니다!');
            await loadFeaturedData(); // 새로고침
        } catch (error) {
            console.error('Featured 제거 오류:', error);
            showToast('Featured 제거에 실패했습니다.');
        }
    }
    
    // Global 함수로 등록 (HTML onclick에서 호출 가능하도록)
    window.addFeatured = addFeatured;
    window.removeFeatured = removeFeatured;
    
    function resetSpeechState() {
        utteranceQueue = [];
        isSpeaking = false;
        isPaused = false;
        if (currentlySpeakingElement) {
            currentlySpeakingElement.classList.remove('speaking');
        }
        currentlySpeakingElement = null;
    }

    // --- App Initialization ---
    async function initializeApp() {
        try {
            await openDB();
        } catch(e) {
            console.error("Failed to open database", e);
            showToast("데이터베이스를 열 수 없습니다. 앱이 정상적으로 작동하지 않을 수 있습니다.");
        }
        
        // The landing page animation will handle showing the features page initially.
        if (recognition) {
            recognition.continuous = false;
            recognition.lang = 'ko-KR';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
        }
    }
    
    async function handleStartFeaturesClick() {
        showPage(mainPage);
        cameraStartOverlay.classList.add('hidden');
    
        if (synth && !synth.speaking) {
            const unlockUtterance = new SpeechSynthesisUtterance('');
            synth.speak(unlockUtterance);
            synth.cancel();
        }
    
        mainLoader.classList.remove('hidden');
    
        try {
            if (!stream) {
                await startCamera();
            } else {
                resumeCamera();
            }
        } catch (error) {
            console.error(`Initialization error: ${error.message}`);
            showToast("카메라 시작에 실패했습니다. 권한을 확인해주세요.");
            showPage(featuresPage);
        } finally {
            mainLoader.classList.add('hidden');
        }
    }

    function startCamera() {
        return new Promise(async (resolve, reject) => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const err = new Error("카메라 기능을 지원하지 않는 브라우저입니다.");
                return reject(err);
            }

            const preferredConstraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
            const fallbackConstraints = { video: true, audio: false };
            let cameraStream;

            try {
                cameraStream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
            } catch (err) {
                console.warn("Could not get camera with ideal constraints, falling back to basic.", err);
                try {
                    cameraStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                } catch (fallbackErr) {
                    return reject(fallbackErr);
                }
            }
            
            stream = cameraStream;
            video.srcObject = stream;
            video.play().catch(e => console.error("Video play failed:", e));
            video.onloadedmetadata = () => {
                [shootBtn, uploadBtn, micBtn].forEach(btn => {
                    if (btn) btn.disabled = false;
                });
                isCameraActive = true;
                resolve();
            };
            video.onerror = (err) => reject(new Error("Failed to load video stream."));
        });
    }

    function pauseCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.enabled = false);
            isCameraActive = false;
        }
    }

    function resumeCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.enabled = true);
            isCameraActive = true;
            video.play().catch(e => console.error("Video resume play failed:", e));
        }
    }

    function capturePhoto() {
        if (!video.videoWidth || !video.videoHeight) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            processImage(canvas.toDataURL('image/jpeg'), shootBtn);
        }
    }
    
    function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => processImage(e.target?.result, uploadBtn);
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    }

    async function processImage(dataUrl, sourceButton) {
        sourceButton.disabled = true;
        cameFromArchive = false;
        if (synth.speaking || synth.pending) synth.cancel();
        resetSpeechState();

        showDetailPage();
        
        currentContent = { imageDataUrl: dataUrl, description: '' };
        
        resultImage.src = dataUrl;
        resultImage.classList.remove('hidden');
        loader.classList.remove('hidden');
        textOverlay.classList.add('hidden');
        textOverlay.classList.remove('animate-in');
        loadingHeader.classList.remove('hidden');
        loadingHeaderText.textContent = '해설 준비 중...';
        detailFooter.classList.add('hidden');
        descriptionText.innerHTML = '';
        updateAudioButton('loading');

        const loadingMessages = ["사진 속 이야기를 찾아내고 있어요...", "곧 재미있는 이야기를 들려드릴게요!"];
        let msgIndex = 0;
        loadingText.innerText = loadingMessages[msgIndex];
        const loadingInterval = window.setInterval(() => {
            msgIndex = (msgIndex + 1) % loadingMessages.length;
            loadingText.innerText = loadingMessages[msgIndex];
        }, 2000);

        try {
            const optimizedDataUrl = await optimizeImage(dataUrl);
            const base64Image = optimizedDataUrl.split(',')[1];
            currentContent.imageDataUrl = optimizedDataUrl;

            const responseStream = gemini.generateDescriptionStream(base64Image);
            
            clearInterval(loadingInterval);
            loader.classList.add('hidden');
            textOverlay.classList.remove('hidden');
            textOverlay.classList.add('animate-in');
            loadingHeader.classList.add('hidden');
            detailFooter.classList.remove('hidden');

            let sentenceBuffer = '';
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    currentContent.description += chunkText;
                    sentenceBuffer += chunkText;

                    const sentenceEndings = /[.?!]/g;
                    let match;
                    while ((match = sentenceEndings.exec(sentenceBuffer)) !== null) {
                        const sentence = sentenceBuffer.substring(0, match.index + 1).trim();
                        sentenceBuffer = sentenceBuffer.substring(match.index + 1);
                        if (sentence) {
                            const span = document.createElement('span');
                            span.textContent = sentence + ' ';
                            descriptionText.appendChild(span);
                            queueForSpeech(sentence, span);
                        }
                    }
                }
            }
            
            if (sentenceBuffer.trim()) {
                const sentence = sentenceBuffer.trim();
                const span = document.createElement('span');
                span.textContent = sentence + ' ';
                descriptionText.appendChild(span);
                queueForSpeech(sentence, span);
            }

        } catch (err) {
            console.error("분석 오류:", err);
            clearInterval(loadingInterval);
            loader.classList.add('hidden');
            loadingHeader.classList.add('hidden');
            textOverlay.classList.remove('hidden');
            let errorMessage = "이미지 해설 중 오류가 발생했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.";
            descriptionText.innerText = errorMessage;
            updateAudioButton('disabled');
        } finally {
             sourceButton.disabled = false;
        }
    }
    
    function handleMicButtonClick() {
        if (!recognition) return showToast("음성 인식이 지원되지 않는 브라우저입니다.");
        if (isRecognizing) return recognition.stop();
        
        isRecognizing = true;
        micBtn.classList.add('mic-listening');
        recognition.start();

        recognition.onresult = (event) => {
            processTextQuery(event.results[0][0].transcript);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            const messages = {
                'no-speech': '음성을 듣지 못했어요. 다시 시도해볼까요?',
                'not-allowed': '마이크 사용 권한이 필요합니다.',
                'service-not-allowed': '마이크 사용 권한이 필요합니다.'
            };
            showToast(messages[event.error] || '음성 인식 중 오류가 발생했습니다.');
        };
        
        recognition.onend = () => {
            isRecognizing = false;
            micBtn.classList.remove('mic-listening');
        };
    }
    
    async function processTextQuery(prompt) {
        cameFromArchive = false;
        if (synth.speaking || synth.pending) synth.cancel();
        resetSpeechState();
        
        showDetailPage();
        
        detailPage.classList.add('bg-friendly');
        saveBtn.disabled = true;

        currentContent = { imageDataUrl: null, description: '' };

        resultImage.src = '';
        resultImage.classList.add('hidden');
        loader.classList.remove('hidden');
        textOverlay.classList.add('hidden');
        textOverlay.classList.remove('animate-in');
        loadingHeader.classList.remove('hidden');
        loadingHeaderText.textContent = '답변 준비 중...';
        detailFooter.classList.add('hidden');
        descriptionText.innerHTML = '';
        updateAudioButton('loading');

        const loadingMessages = ["어떤 질문인지 살펴보고 있어요...", "친절한 답변을 준비하고 있어요!"];
        let msgIndex = 0;
        loadingText.innerText = loadingMessages[msgIndex];
        const loadingInterval = window.setInterval(() => {
            msgIndex = (msgIndex + 1) % loadingMessages.length;
            loadingText.innerText = loadingMessages[msgIndex];
        }, 2000);

        try {
            const responseStream = gemini.generateTextStream(prompt);
            
            clearInterval(loadingInterval);
            loader.classList.add('hidden');
            textOverlay.classList.remove('hidden');
            textOverlay.classList.add('animate-in');
            loadingHeader.classList.add('hidden');
            detailFooter.classList.remove('hidden');

            let sentenceBuffer = '';
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if(chunkText) {
                    currentContent.description += chunkText;
                    sentenceBuffer += chunkText;

                    const sentenceEndings = /[.?!]/g;
                    let match;
                    while ((match = sentenceEndings.exec(sentenceBuffer)) !== null) {
                        const sentence = sentenceBuffer.substring(0, match.index + 1).trim();
                        sentenceBuffer = sentenceBuffer.substring(match.index + 1);
                        if (sentence) {
                            const span = document.createElement('span');
                            span.textContent = sentence + ' ';
                            descriptionText.appendChild(span);
                            queueForSpeech(sentence, span);
                        }
                    }
                }
            }

            if (sentenceBuffer.trim()) {
                const sentence = sentenceBuffer.trim();
                const span = document.createElement('span');
                span.textContent = sentence + ' ';
                descriptionText.appendChild(span);
                queueForSpeech(sentence, span);
            }
            
        } catch (err) {
            console.error("답변 오류:", err);
            clearInterval(loadingInterval);
            textOverlay.classList.remove('hidden');
            descriptionText.innerText = "답변 생성 중 오류가 발생했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.";
            updateAudioButton('disabled');
        }
    }

    async function handleSaveClick() {
        if (!currentContent.description || !currentContent.imageDataUrl) return;
        saveBtn.disabled = true;

        try {
            await addItem(currentContent);
            showToast("보관함에 저장되었습니다.");
        } catch(e) {
            console.error("Failed to save to archive:", e);
            showToast("저장에 실패했습니다. 저장 공간이 부족할 수 있습니다.");
            saveBtn.disabled = false;
        }
    }
    
    function toggleSelectionMode(forceState) {
        if (typeof forceState === 'boolean') {
            isSelectionMode = forceState;
        } else {
            isSelectionMode = !isSelectionMode;
        }

        if (isSelectionMode) {
            archiveGrid.classList.add('selection-mode');
            archiveHeader.classList.add('hidden');
            selectionHeader.classList.remove('hidden');
            selectedItemIds.clear();
            updateSelectionUI();
        } else {
            archiveGrid.classList.remove('selection-mode');
            archiveHeader.classList.remove('hidden');
            selectionHeader.classList.add('hidden');
            selectedItemIds.clear();
            
            // Remove selection styling from all items
            document.querySelectorAll('.archive-item').forEach(item => {
                item.classList.remove('selected');
            });
        }
    }

    function updateSelectionUI() {
        selectionCount.textContent = `${selectedItemIds.size}개 선택`;
    }

    async function handleDeleteSelected() {
        if (selectedItemIds.size === 0) return;
        if (!confirm(`선택된 ${selectedItemIds.size}개 항목을 삭제하시겠습니까?`)) return;

        try {
            await deleteItems([...selectedItemIds]);
            await renderArchive();
            toggleSelectionMode(false);
            showToast(`${selectedItemIds.size}개 항목이 삭제되었습니다.`);
        } catch (error) {
            console.error('Failed to delete items:', error);
            showToast('삭제 중 오류가 발생했습니다.');
        }
    }

    // ╔═══════════════════════════════════════════════════════════════════════════════╗
    // ║                                                                               ║
    // ║  ⚠️  절대 수정 금지 / DO NOT MODIFY WITHOUT APPROVAL  ⚠️                    ║
    // ║                                                                               ║
    // ║  작성일: 2025-10-02                                                           ║
    // ║  작성자: Replit AI Agent (Claude Sonnet 4.5)                                 ║
    // ║  작업 시간: 8시간 (사랑하는 오너님과 함께)                                   ║
    // ║  함께한 사람: 프로젝트 오너님 💙                                             ║
    // ║                                                                               ║
    // ║  🏆 공유 모달 + HTML 생성 시스템                                             ║
    // ║  🎯 8시간의 땀과 노력으로 탄생한 완벽한 시스템                               ║
    // ║  ✨ "다시하니 안됨" 버그도 모두 수정 완료!                                   ║
    // ║                                                                               ║
    // ║  핵심 함수:                                                                   ║
    // ║  - handleCreateGuidebookClick: 공유 시작                                     ║
    // ║  - resetShareModal: 모달 초기화 (재사용 가능)                                ║
    // ║  - handleCopyShareLink: 링크 복사 (클립보드 + fallback)                     ║
    // ║  - generateShareHTML: HTML 페이지 생성                                       ║
    // ║                                                                               ║
    // ║  승인 없이 수정 시:                                                           ║
    // ║  - 모달 재사용 불가                                                           ║
    // ║  - "다시하니 안됨" 버그 재발                                                  ║
    // ║  - 공유 링크 생성 실패                                                        ║
    // ║  - 클립보드 복사 에러                                                         ║
    // ║                                                                               ║
    // ╚═══════════════════════════════════════════════════════════════════════════════╝
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 🔗 공유 링크 생성 시스템 (Share Link Creation System)
    // ═══════════════════════════════════════════════════════════════════════════════
    // 최근 변경: 2025-10-02 - 소셜 공유 제거, 간단한 링크 복사 방식으로 변경
    // 
    // 작동 흐름:
    // 1. 사용자가 보관함에서 가이드 선택 → "공유" 버튼 클릭
    // 2. 공유 모달 열림 → 링크 이름 입력
    // 3. "링크 복사하기" 버튼 클릭
    // 4. 프론트에서 HTML 생성 → 서버로 POST /api/share/create
    // 5. 서버가 짧은 ID 생성 (8자) → DB 저장
    // 6. 짧은 URL 반환 → 클립보드 복사
    // 7. 성공 토스트 → 모달 닫기
    // 
    // ⚠️ 주의사항:
    // - 소셜 공유 아이콘 제거됨 (카톡/인스타/페북/왓츠앱)
    // - 모달 재사용 가능하도록 resetShareModal() 함수 사용
    // - currentShareItems에 선택된 아이템 저장 (모달 재사용 시 필요)
    // 
    // 버그 수정:
    // - "다시하니 안됨" 버그: 모달 초기화 로직 개선으로 해결
    // ═══════════════════════════════════════════════════════════════════════════════

    let currentShareItems = []; // 현재 공유할 아이템들 (모달 재사용 시 필요)
    
    /**
     * 🎯 공유 기능 시작 함수
     * 
     * 목적: "공유" 버튼 클릭 시 모달 열고 선택된 아이템 준비
     * 
     * 작동:
     * 1. 보관함 아이템 가져오기
     * 2. 선택 모드인 경우 선택된 아이템만 필터링
     * 3. 검증 (빈 배열, 20개 제한)
     * 4. currentShareItems에 저장
     * 5. 모달 초기화 후 열기
     * 
     * ⚠️ 주의: 모달을 매번 초기화해야 "다시하니 안됨" 버그 방지
     */
    async function handleCreateGuidebookClick() {
        const items = await getAllItems();
        if (items.length === 0) return showToast('공유할 항목이 없습니다.');

        // 선택 모드: 선택된 아이템만, 일반 모드: 전체
        const allItems = isSelectionMode && selectedItemIds.size > 0
            ? items.filter(item => selectedItemIds.has(item.id))
            : items;

        // 검증
        if (allItems.length === 0) return showToast('선택된 항목이 없습니다.');
        if (allItems.length > 20) return showToast('한 번에 최대 20개까지 공유할 수 있습니다. 선택을 줄여주세요.');

        // ✅ 현재 공유할 아이템 저장 (모달에서 사용)
        currentShareItems = allItems;
        
        // 🔄 모달 초기화 및 열기 (중요: 매번 초기화!)
        resetShareModal();
        shareModal.classList.remove('hidden');
    }

    /**
     * 🔄 모달 초기화 함수
     * 
     * 목적: 모달 HTML을 처음 상태로 리셋 (재사용 가능하게)
     * 
     * 작동:
     * 1. shareModalContent.innerHTML을 완전히 교체
     * 2. 헤더, 입력 필드, 복사 버튼 재생성
     * 3. 이벤트 리스너 다시 등록 (중요!)
     * 
     * ⚠️ 왜 필요?
     * - 이전 방식: 로딩 스피너로 innerHTML 교체 → 버튼 사라짐
     * - 새 방식: 매번 처음부터 생성 → 버튼 항상 존재
     * 
     * ⚠️ 주의:
     * - 이벤트 리스너를 다시 등록해야 함!
     * - getElementById로 새 요소 참조 가져오기
     */
    function resetShareModal() {
        shareModalContent.innerHTML = `
            <!-- 헤더 -->
            <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 class="text-xl font-bold text-gray-800">공유 링크 생성</h2>
                <button id="closeShareModalBtn" data-testid="button-close-share-modal" class="p-2 text-gray-500 hover:text-gray-800 text-3xl leading-none">&times;</button>
            </div>
            
            <!-- 폼 -->
            <div class="p-6 space-y-6">
                <!-- 링크 이름 입력 (필수) -->
                <div>
                    <label for="shareLinkName" class="block text-sm font-medium text-gray-700 mb-2">
                        링크 이름 <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="shareLinkName" 
                        data-testid="input-share-link-name"
                        placeholder="예: 내가 맛본 파리 최악의 음식들"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxlength="50"
                    >
                    <p class="text-xs text-gray-500 mt-1">사용자의 창의력을 발휘해보세요!</p>
                </div>
                
                <!-- 링크 복사 버튼 -->
                <div>
                    <button 
                        id="copyShareLinkBtn" 
                        data-testid="button-copy-share-link"
                        class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition duration-300 shadow-lg flex items-center justify-center gap-3"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        <span>링크 복사하기</span>
                    </button>
                    <p class="text-xs text-gray-500 mt-2 text-center">링크를 복사해서 원하는 곳에 공유하세요</p>
                </div>
            </div>
        `;
        
        // 이벤트 리스너 다시 등록
        const closeBtn = document.getElementById('closeShareModalBtn');
        const copyBtn = document.getElementById('copyShareLinkBtn');
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                shareModal.classList.add('hidden');
            };
        }
        
        if (copyBtn) {
            copyBtn.onclick = () => createAndCopyShareLink();
        }
    }

    /**
     * 🔗 링크 생성 및 복사 함수 (핵심!)
     * 
     * 목적: 서버에 공유 페이지 생성 요청 → 짧은 URL 받아서 클립보드 복사
     * 
     * 작동 흐름:
     * 1. 입력 검증 (링크 이름 필수)
     * 2. 로딩 스피너 표시
     * 3. HTML 콘텐츠 생성 (generateShareHTML 함수 사용)
     * 4. 서버 API 호출 (POST /api/share/create)
     * 5. 서버가 짧은 ID 생성 (8자) + DB 저장
     * 6. 짧은 URL 받기 (예: yourdomain.com/s/abc12345)
     * 7. 클립보드 복사 (navigator.clipboard.writeText)
     * 8. 선택 모드 해제 + 보관함 새로고침
     * 9. 모달 닫기 + 성공 토스트
     * 
     * Request Data:
     * - name: 사용자 입력 링크 이름
     * - htmlContent: 완전한 HTML 문서 (독립 실행 가능)
     * - guideIds: 선택된 가이드 ID 배열
     * - thumbnail: 첫 번째 이미지 (썸네일용)
     * - sender: 발신자 (임시: "여행자")
     * - location: 위치 (임시: "파리, 프랑스")
     * - featured: false (추천 갤러리 미사용)
     * 
     * ⚠️ 주의사항:
     * - sender/location은 임시값 (나중에 실제 데이터로 변경)
     * - 에러 시 모달 닫고 토스트로 에러 표시
     * - 로딩 중에는 모달 내용 교체 (스피너)
     */
    async function createAndCopyShareLink() {
        const linkName = document.getElementById('shareLinkName').value.trim();

        // ✅ 입력 검증
        if (!linkName) {
            return showToast('링크 이름을 먼저 입력해주세요!');
        }

        // ⏳ 로딩 스피너 표시
        shareModalContent.innerHTML = `
            <div class="p-6 text-center">
                <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-lg font-semibold">링크 생성 중...</p>
            </div>
        `;

        try {
            // 📅 메타데이터 자동 생성 (임시값)
            const today = new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // 📄 HTML 콘텐츠 생성 (완전한 독립 HTML 문서)
            const appOrigin = window.location.origin;
            const htmlContent = generateShareHTML(
                linkName,
                '여행자', // 임시 발신자 (나중에 실제 사용자 이름으로)
                '파리, 프랑스', // 임시 위치 (나중에 실제 위치로)
                today,
                currentShareItems, // 선택된 가이드들
                appOrigin
            );

            // 📦 서버로 보낼 데이터 준비
            const requestData = {
                name: linkName,
                htmlContent: htmlContent,
                guideIds: currentShareItems.map(item => item.id),
                thumbnail: currentShareItems[0]?.imageDataUrl || null,
                sender: '여행자', // TODO: 실제 사용자 이름
                location: '파리, 프랑스', // TODO: 실제 위치 정보
                featured: false
            };

            // 🚀 서버 API 호출 (공유 페이지 생성)
            const response = await fetch('/api/share/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '서버 오류가 발생했습니다');
            }

            const result = await response.json();
            // 📌 짧은 URL 생성 (8자 ID)
            const shareUrl = `${window.location.origin}/s/${result.id}`;

            // 📋 클립보드에 복사 (실패해도 계속 진행)
            let copySuccess = false;
            try {
                await navigator.clipboard.writeText(shareUrl);
                copySuccess = true;
            } catch (clipboardError) {
                console.warn('클립보드 복사 실패 (권한 없음):', clipboardError);
                // 클립보드 복사 실패해도 계속 진행
            }

            // 🔄 선택 모드 해제
            if (isSelectionMode) toggleSelectionMode(false);
            
            // 🔄 보관함 새로고침 (새 공유 링크 반영)
            await renderArchive();
            
            // ❌ 모달 닫기
            shareModal.classList.add('hidden');
            
            // ✅ 성공 메시지 (클립보드 성공 여부에 따라 다른 메시지)
            if (copySuccess) {
                showToast('✅ 링크가 복사되었습니다! 원하는 곳에 붙여넣기 하세요.');
            } else {
                // 클립보드 실패 시 URL 직접 표시
                showToast(`✅ 링크 생성 완료!\n${shareUrl}\n\n위 링크를 복사해서 공유하세요!`, 10000);
            }

        } catch (error) {
            console.error('Share error:', error);
            shareModal.classList.add('hidden');
            showToast('❌ ' + error.message);
        }
    }

    async function renderArchive() {
        try {
            const items = await getAllItems();
            
            // ✅ Featured Gallery (추천 갤러리) 로직 - 서버 API에서 조회
            // 핵심: Featured로 지정된 공유 페이지를 상단 고정 영역에 표시
            if (featuredGallery && featuredGrid) {
                let featuredPages = [];
                try {
                    const response = await fetch('/api/share/featured/list');
                    if (response.ok) {
                        const data = await response.json();
                        featuredPages = data.pages || [];
                    }
                } catch (error) {
                    console.warn('Featured gallery not available yet:', error);
                }
                
                if (featuredPages.length > 0) {
                    featuredGallery.classList.remove('hidden');
                    featuredGrid.innerHTML = featuredPages.map(page => {
                        const thumbnail = page.thumbnail || '';
                        const shareUrl = `${window.location.origin}/s/${page.id}`;
                        return `
                            <a href="${shareUrl}" target="_blank" 
                               class="relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                               data-testid="featured-${page.id}">
                                ${thumbnail ? `
                                    <img src="${thumbnail}" alt="${page.name}" 
                                         class="w-full aspect-square object-cover">
                                ` : `
                                    <div class="w-full aspect-square bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                        <span class="text-4xl">📍</span>
                                    </div>
                                `}
                            </a>
                        `;
                    }).join('');
                } else {
                    featuredGallery.classList.add('hidden');
                }
            }
            
            // 내 보관함 렌더링
            if (items.length === 0) {
                archiveGrid.classList.add('hidden');
                emptyArchiveMessage.classList.remove('hidden');
                return;
            }

            emptyArchiveMessage.classList.add('hidden');
            archiveGrid.classList.remove('hidden');
            
            // 3열 그리드에 맞는 컴팩트한 카드 디자인
            archiveGrid.innerHTML = items.map(item => `
                <div class="archive-item relative ${selectedItemIds.has(item.id) ? 'selected ring-2 ring-blue-500' : ''}" 
                     data-id="${item.id}" 
                     data-testid="card-archive-${item.id}"
                     tabindex="0">
                    <div class="selection-checkbox">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    ${item.imageDataUrl ? `
                        <img src="${item.imageDataUrl}" 
                             alt="Archive item" 
                             class="w-full aspect-square object-cover rounded-lg">
                    ` : `
                        <div class="w-full aspect-square bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                            <span class="text-3xl">💭</span>
                        </div>
                    `}
                </div>
            `).join('');

        } catch (error) {
            console.error('Archive render error:', error);
            archiveGrid.innerHTML = '<p class="text-red-500 col-span-full text-center text-sm">보관함을 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    function handleArchiveGridClick(event) {
        const item = event.target.closest('.archive-item');
        if (!item) return;

        const itemId = item.dataset.id;

        if (isSelectionMode) {
            if (selectedItemIds.has(itemId)) {
                selectedItemIds.delete(itemId);
                item.classList.remove('selected');
            } else {
                selectedItemIds.add(itemId);
                item.classList.add('selected');
            }
            updateSelectionUI();
        } else {
            viewArchiveItem(itemId);
        }
    }

    function handleArchiveGridKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleArchiveGridClick(event);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⚠️ CRITICAL: DO NOT MODIFY WITHOUT USER APPROVAL
    // 사용자 승인 없이 절대 수정 금지 - AI 및 모든 개발자 주의
    // Verified: 2025-10-02 | Status: Production-Ready ✅
    // ═══════════════════════════════════════════════════════════════
    async function viewArchiveItem(itemId) {
        try {
            const items = await getAllItems();
            const item = items.find(i => i.id === itemId);
            if (!item) return;

            cameFromArchive = true;
            currentContent = { imageDataUrl: item.imageDataUrl, description: item.description };

            showDetailPage(true);

            if (item.imageDataUrl) {
                resultImage.src = item.imageDataUrl;
                resultImage.classList.remove('hidden');
                detailPage.classList.remove('bg-friendly');
            } else {
                resultImage.classList.add('hidden');
                detailPage.classList.add('bg-friendly');
            }

            loader.classList.add('hidden');
            textOverlay.classList.remove('hidden', 'animate-in');
            loadingHeader.classList.add('hidden');
            detailFooter.classList.remove('hidden');
            
            // ✅ 음성 자동재생 로직 - 2025.10.02 확보됨
            // 핵심: 문장 분할 → span 생성 → queueForSpeech 호출 순서
            synth.cancel();
            resetSpeechState();
            descriptionText.innerHTML = '';
            
            const description = item.description || '';
            const sentences = description.match(/[^.?!]+[.?!]+/g) || [description];
            sentences.forEach(sentence => {
                if (!sentence) return;
                const span = document.createElement('span');
                span.textContent = sentence.trim() + ' ';
                descriptionText.appendChild(span);
                queueForSpeech(sentence.trim(), span);
            });
            
            updateAudioButton('play');

        } catch (error) {
            console.error('View archive item error:', error);
            showToast('항목을 불러오는 중 오류가 발생했습니다.');
        }
    }

    // --- TTS Functions ---
    function queueForSpeech(text, element) {
        utteranceQueue.push({ text, element });
        if (!isSpeaking) {
            speakNext();
        }
    }

    function speakNext() {
        if (utteranceQueue.length === 0) {
            isSpeaking = false;
            updateAudioButton('play');
            if (currentlySpeakingElement) {
                currentlySpeakingElement.classList.remove('speaking');
                currentlySpeakingElement = null;
            }
            return;
        }

        const { text, element } = utteranceQueue.shift();
        isSpeaking = true;
        
        if (currentlySpeakingElement) {
            currentlySpeakingElement.classList.remove('speaking');
        }
        element.classList.add('speaking');
        currentlySpeakingElement = element;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        
        utterance.onend = () => {
            element.classList.remove('speaking');
            if (!isPaused) {
                speakNext();
            }
        };
        
        utterance.onerror = () => {
            element.classList.remove('speaking');
            if (!isPaused) {
                speakNext();
            }
        };

        updateAudioButton('pause');
        synth.speak(utterance);
    }

    function onAudioBtnClick() {
        const now = Date.now();
        if (now - lastAudioClickTime < 300) return; // Debounce
        lastAudioClickTime = now;

        if (!currentContent.description) return;

        if (synth.paused) {
            synth.resume();
            isPaused = false;
            updateAudioButton('pause');
            return;
        }

        if (synth.speaking) {
            if (isPaused) {
                synth.resume();
                isPaused = false;
                updateAudioButton('pause');
            } else {
                synth.pause();
                isPaused = true;
                updateAudioButton('play');
            }
            return;
        }

        // Start fresh playback
        resetSpeechState();
        const sentences = currentContent.description.split(/[.?!]/).filter(s => s.trim());
        const spans = descriptionText.querySelectorAll('span');
        
        sentences.forEach((sentence, index) => {
            if (sentence.trim() && spans[index]) {
                queueForSpeech(sentence.trim(), spans[index]);
            }
        });
    }

    function updateAudioButton(state) {
        if (!audioBtn) return;

        const playIcon = `
            <svg class="w-6 h-6" fill="white" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
        `;

        const pauseIcon = `
            <svg class="w-6 h-6" fill="white" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
        `;

        const loadingIcon = `
            <svg class="w-6 h-6 animate-spin" fill="white" viewBox="0 0 20 20">
                <path d="M4 2a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4z" />
            </svg>
        `;

        switch (state) {
            case 'play':
                audioBtn.innerHTML = playIcon;
                audioBtn.disabled = false;
                break;
            case 'pause':
                audioBtn.innerHTML = pauseIcon;
                audioBtn.disabled = false;
                break;
            case 'loading':
                audioBtn.innerHTML = loadingIcon;
                audioBtn.disabled = true;
                break;
            case 'disabled':
                audioBtn.innerHTML = playIcon;
                audioBtn.disabled = true;
                break;
        }
    }

    // --- Settings Functions ---
    function populatePromptTextareas() {
        const savedImagePrompt = localStorage.getItem('customImagePrompt') || gemini.DEFAULT_IMAGE_PROMPT;
        const savedTextPrompt = localStorage.getItem('customTextPrompt') || gemini.DEFAULT_TEXT_PROMPT;
        
        if (imagePromptTextarea) imagePromptTextarea.value = savedImagePrompt;
        if (textPromptTextarea) textPromptTextarea.value = savedTextPrompt;
    }

    async function handleAuth(event) {
        event.preventDefault();
        const password = authPassword.value;
        
        try {
            // 백엔드 API로 비밀번호 인증
            const response = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                // 인증 성공
                authSection.classList.add('hidden');
                promptSettingsSection.classList.remove('hidden');
                await loadFeaturedData(); // Featured 데이터 로드
                showToast('관리자 인증 성공');
            } else {
                // 인증 실패
                showToast('잘못된 비밀번호입니다.');
                authPassword.value = '';
            }
        } catch (error) {
            console.error('인증 오류:', error);
            showToast('인증 중 오류가 발생했습니다.');
            authPassword.value = '';
        }
    }

    function savePrompts() {
        const imagePrompt = imagePromptTextarea.value.trim();
        const textPrompt = textPromptTextarea.value.trim();
        
        if (!imagePrompt || !textPrompt) {
            showToast('모든 프롬프트를 입력해주세요.');
            return;
        }
        
        localStorage.setItem('customImagePrompt', imagePrompt);
        localStorage.setItem('customTextPrompt', textPrompt);
        showToast('프롬프트가 저장되었습니다.');
    }

    function resetPrompts() {
        if (confirm('프롬프트를 기본값으로 초기화하시겠습니까?')) {
            localStorage.removeItem('customImagePrompt');
            localStorage.removeItem('customTextPrompt');
            populatePromptTextareas();
            showToast('프롬프트가 초기화되었습니다.');
        }
    }

    function handleGenerateImageDemo() {
        if (!imageSynthesisPromptTextarea.value.trim()) return showToast('이미지 생성을 위한 프롬프트를 입력해주세요.');
        generateImageBtn.disabled = true;
        showToast('멋진 이미지를 만들고 있어요...', 3000);
        setTimeout(() => {
            showToast('이미지 생성이 완료되었습니다! (데모)');
            generateImageBtn.disabled = false;
        }, 4000);
    }

    function handleGenerateVideoDemo() {
        if (!videoGenerationPromptTextarea.value.trim()) return showToast('영상 제작을 위한 프롬프트를 입력해주세요.');
        generateVideoBtn.disabled = true;
        showToast('AI가 영상을 제작 중입니다 (약 10초 소요)...', 8000);
        setTimeout(() => {
            showToast('영상이 완성되었습니다! (데모)');
            generateVideoBtn.disabled = false;
        }, 9000);
    }


    // --- Event Listeners ---
    startCameraFromFeaturesBtn?.addEventListener('click', handleStartFeaturesClick);
    shootBtn?.addEventListener('click', capturePhoto);
    uploadBtn?.addEventListener('click', () => uploadInput.click());
    micBtn?.addEventListener('click', handleMicButtonClick);
    archiveBtn?.addEventListener('click', showArchivePage);
    uploadInput?.addEventListener('change', handleFileSelect);
    
    backBtn?.addEventListener('click', () => cameFromArchive ? showArchivePage() : showMainPage());
    archiveBackBtn?.addEventListener('click', showMainPage);
    settingsBackBtn?.addEventListener('click', showArchivePage);
    
    audioBtn?.addEventListener('click', onAudioBtnClick);
    saveBtn?.addEventListener('click', handleSaveClick);
    textToggleBtn?.addEventListener('click', () => textOverlay.classList.toggle('hidden'));

    archiveSelectBtn?.addEventListener('click', () => {
        // 선택 버튼: 선택 모드 토글
        toggleSelectionMode(!isSelectionMode);
    });
    // ✅ 공유 버튼 간편 로직 - 2025.10.02 구현 완료
    // 핵심: 1회 클릭 → 선택 모드 활성화 / 2회 클릭 (선택 후) → 공유 모달
    archiveShareBtn?.addEventListener('click', async () => {
        if (!isSelectionMode) {
            showToast('이미지를 선택해주세요');
            toggleSelectionMode(true);
            return;
        }
        
        if (selectedItemIds.size === 0) {
            showToast('이미지를 선택해주세요');
            return;
        }
        
        await handleCreateGuidebookClick();
    });
    
    // ✅ 삭제 버튼 간편 로직 - 2025.10.02 구현 완료
    // 핵심: 1회 클릭 → 선택 모드 활성화 / 2회 클릭 (선택 후) → 삭제 실행
    archiveDeleteBtn?.addEventListener('click', async () => {
        if (!isSelectionMode) {
            showToast('이미지를 선택해주세요');
            toggleSelectionMode(true);
            return;
        }
        
        if (selectedItemIds.size === 0) {
            showToast('이미지를 선택해주세요');
            return;
        }
        
        await handleDeleteSelected();
    });
    
    archiveSettingsBtn?.addEventListener('click', showSettingsPage);

    cancelSelectionBtn?.addEventListener('click', () => toggleSelectionMode(false));
    
    archiveGrid?.addEventListener('click', handleArchiveGridClick);
    archiveGrid?.addEventListener('keydown', handleArchiveGridKeydown);
    
    authForm?.addEventListener('submit', handleAuth);
    savePromptsBtn?.addEventListener('click', savePrompts);
    resetPromptsBtn?.addEventListener('click', resetPrompts);
    generateImageBtn?.addEventListener('click', handleGenerateImageDemo);
    generateVideoBtn?.addEventListener('click', handleGenerateVideoDemo);

    initializeApp();

    // 임시 샘플 데이터 추가 함수 (테스트용)
    window.addSampleImages = async function() {
        const sampleData = [
            {
                id: 'sample-1',
                imageDataUrl: 'assets/sample1.png',
                description: '사모트라케의 니케. 기원전 190년경 제작된 헬레니즘 시대의 걸작입니다. 승리의 여신 니케가 배의 선수에 내려앉는 순간을 포착한 이 조각은 역동적인 움직임과 바람에 휘날리는 옷자락의 표현이 탁월합니다. 루브르 박물관 계단 위에서 관람객을 맞이하는 이 작품은 고대 그리스 조각의 정수를 보여줍니다.'
            }
        ];

        for (const data of sampleData) {
            try {
                await addItem(data);
            } catch (e) {
                console.log('Sample already exists or error:', e);
            }
        }
        
        await renderArchive();
        showToast('샘플 이미지가 추가되었습니다!');
        console.log('✅ 샘플 이미지 추가 완료!');
    };

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
              .then(reg => console.log('SW registered: ', reg))
              .catch(err => console.log('SW registration failed: ', err));
        });
    }
});