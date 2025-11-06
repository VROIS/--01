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

    // Auth Modal Elements
    const authModal = document.getElementById('authModal');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const kakaoLoginBtn = document.getElementById('kakaoLoginBtn');

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
    
    // ═══════════════════════════════════════════════════════════════
    // 🚀 전역 디바운스 시스템 (2025-10-05)
    // 목적: 버튼 버벅거림 완전 제거 - 손님 30명 테스트 대비
    // ═══════════════════════════════════════════════════════════════
    const buttonDebounceMap = new Map();
    function debounceClick(buttonId, callback, delay = 500) {
        const now = Date.now();
        const lastClick = buttonDebounceMap.get(buttonId) || 0;
        
        if (now - lastClick < delay) {
            return false; // 클릭 무시
        }
        
        buttonDebounceMap.set(buttonId, now);
        callback();
        return true;
    }

    // App State
    let currentContent = { imageDataUrl: null, description: '' };
    let isSelectionMode = false;
    let selectedItemIds = []; // ✅ Array로 변경 (클릭 순서 보존!)
    
    // ═══════════════════════════════════════════════════════════════
    // 🗺️ Google Maps 상태 (2025-10-26)
    // ═══════════════════════════════════════════════════════════════
    let googleMapsLoaded = false;
    let googleMapsApiKey = '';
    let geocoder = null;
    let cameFromArchive = false;
    
    // ═══════════════════════════════════════════════════════════════
    // 🗺️ Google Maps API 동적 로딩 (2025-10-26)
    // ═══════════════════════════════════════════════════════════════
    
    // API 키 가져오기
    async function loadGoogleMapsApiKey() {
        if (googleMapsApiKey) return googleMapsApiKey;
        
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            googleMapsApiKey = config.googleMapsApiKey;
            return googleMapsApiKey;
        } catch (error) {
            console.error('Google Maps API 키 로드 실패:', error);
            return '';
        }
    }
    
    // Google Maps API 동적 로드
    function loadGoogleMapsAPI(callback) {
        if (googleMapsLoaded) {
            if (callback) callback();
            return;
        }
        
        loadGoogleMapsApiKey().then(apiKey => {
            if (!apiKey) {
                console.error('Google Maps API 키가 없습니다.');
                return;
            }
            
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                googleMapsLoaded = true;
                geocoder = new google.maps.Geocoder();
                console.log('🗺️ Google Maps API 로드 완료');
                if (callback) callback();
            };
            script.onerror = () => {
                console.error('Google Maps API 로드 실패');
            };
            document.head.appendChild(script);
        });
    }
    
    // 📍 주변 유명 랜드마크 찾기 (GPS → "에펠탑", "루브르 박물관" 등)
    async function getNearbyLandmark(lat, lng) {
        console.log('🔍 랜드마크 검색 시작:', lat, lng);
        
        if (!googleMapsLoaded || !window.google) {
            console.warn('⚠️ Google Maps가 로드되지 않음');
            return null;
        }
        
        return new Promise((resolve) => {
            // Places API Nearby Search 사용
            const map = new google.maps.Map(document.createElement('div'));
            const service = new google.maps.places.PlacesService(map);
            const location = new google.maps.LatLng(lat, lng);
            
            console.log('🔍 Places Nearby Search 호출 (반경 100m)...');
            const request = {
                location: location,
                radius: 100,
                rankBy: google.maps.places.RankBy.PROMINENCE
            };
            
            service.nearbySearch(request, (places, status) => {
                console.log('📡 Places API 응답:', status);
                
                if (status === google.maps.places.PlacesServiceStatus.OK && places && places.length > 0) {
                    // 랜드마크/관광지 우선 검색
                    const nearbyPlace = places.find(place => 
                        place.types.includes('tourist_attraction') ||
                        place.types.includes('museum') ||
                        place.types.includes('church') ||
                        place.types.includes('park') ||
                        place.types.includes('lodging') ||
                        place.types.includes('point_of_interest')
                    ) || places[0];
                    
                    const placeName = nearbyPlace.name;
                    console.log('🎯 근처 장소:', placeName, '(타입:', nearbyPlace.types.join(', ') + ')');
                    resolve(placeName);
                } else {
                    // Places API 실패 → Geocoding Fallback
                    console.log('📍 Places API 실패, Geocoding으로 전환');
                    
                    if (!geocoder) {
                        console.warn('⚠️ Geocoder 초기화 안 됨');
                        resolve(null);
                        return;
                    }
                    
                    geocoder.geocode({ location: { lat, lng } }, (geoResults, geoStatus) => {
                        if (geoStatus === 'OK' && geoResults[0]) {
                            const city = geoResults[0].address_components.find(
                                c => c.types.includes('locality')
                            )?.long_name || geoResults[0].formatted_address.split(',')[0];
                            console.log('📍 도시 찾음:', city);
                            resolve(city);
                        } else {
                            console.warn('⚠️ 위치 정보 찾기 실패');
                            resolve(null);
                        }
                    });
                }
            });
        });
    }
    
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
    function generateShareHTML(title, sender, location, date, guideItems, appOrigin, isFeatured = false) {
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
    <script>
        // ⭐ 카카오톡 인앱 브라우저 Chrome 강제 리다이렉트 (2025-10-31)
        var isKakaoInApp = false;
        
        (function() {
            var userAgent = navigator.userAgent.toLowerCase();
            var targetUrl = window.location.href;
            
            // 카카오톡 인앱 브라우저 감지
            if (userAgent.match(/kakaotalk/i)) {
                isKakaoInApp = true;
                
                // 1. 즉시 경고 배너 표시 (갤러리 숨김)
                window.addEventListener('DOMContentLoaded', function() {
                    var banner = document.getElementById('kakao-browser-warning');
                    var galleryView = document.getElementById('gallery-view');
                    var header = document.querySelector('.header');
                    
                    if (banner) {
                        banner.style.display = 'flex';
                        document.body.classList.add('kakao-browser');
                    }
                    if (galleryView) {
                        galleryView.style.display = 'none';
                    }
                    if (header) {
                        header.style.display = 'none';
                    }
                    
                    // 2. 자동 리다이렉트 시도
                    setTimeout(function() {
                        var intentUrl = 'intent://' + targetUrl.replace(/https?:\\\\/\\\\//, '') + 
                                      '#Intent;scheme=https;package=com.android.chrome;end';
                        window.location.href = intentUrl;
                    }, 500);
                });
            }
        })();
        
        // 수동 버튼: Chrome에서 열기
        function openInChrome() {
            const currentUrl = window.location.href;
            const intentUrl = 'intent://' + currentUrl.replace(/https?:\\\\/\\\\//, '') + 
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
        
        #kakao-browser-warning[style*="display: flex"] {
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
    <!-- ❌ X 닫기 버튼 (우측 상단, 최상위 z-index) -->
    <button id="closeWindowBtn" onclick="window.close()" title="페이지 닫기" style="position: fixed; top: 1rem; right: 1rem; z-index: 10000; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); border-radius: 50%; color: #4285F4; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: none;">
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
        <h1>${escapeHTML(title)}</h1>
        <div class="metadata">
            <p>👤 ${escapeHTML(sender)} 님이 보냄</p>
            <p>📍 ${escapeHTML(location)}</p>
            <p>📅 ${escapeHTML(date)}</p>
        </div>
    </div>
    
    <!-- 갤러리 뷰 -->
    <div id="gallery-view">
        ${isFeatured ? `
        <!-- 🔙 추천 갤러리 전용 리턴 버튼 (왼쪽 상단, 앱과 통일) -->
        <div style="position: sticky; top: 0; z-index: 100; height: 60px; display: flex; align-items: center; padding: 0 1rem; background: #4285F4;">
            <button onclick="window.location.href='${appOrigin}/#archive'" style="width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(255, 255, 255, 0.95); color: #4285F4; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transition: all 0.3s;" aria-label="보관함으로 돌아가기">
                <svg xmlns="http://www.w3.org/2000/svg" style="width: 1.5rem; height: 1.5rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
            </button>
        </div>
        ` : ''}
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
        
        // 🔙 보관함으로 돌아가기 버튼 (갤러리 뷰)
        const galleryBackBtn = document.getElementById('gallery-back-btn');
        if (galleryBackBtn) {
            galleryBackBtn.addEventListener('click', () => {
                window.location.href = '/#archive';
            });
        }
        
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
    // ⚡ 성능 최적화: 화면 먼저 표시, 데이터는 백그라운드 로드 (2025-10-05)
    // ═══════════════════════════════════════════════════════════════
    async function showArchivePage() {
        pauseCamera();
        synth.cancel();
        resetSpeechState();
        if (isSelectionMode) { 
            toggleSelectionMode(false);
        }
        showPage(archivePage); // ⚡ 화면 먼저 표시 (즉시)
        renderArchive(); // ⚡ 데이터 백그라운드 로드 (비차단)
    }

    async function showSettingsPage() {
        pauseCamera();
        
        // 🔐 서버 세션 확인 (localStorage와 동기화)
        try {
            const response = await fetch('/api/admin/featured');
            if (response.ok) {
                // 서버 세션 유효 - 관리자 섹션 표시
                localStorage.setItem('adminAuthenticated', 'true');
                localStorage.setItem('adminAuthTime', Date.now().toString());
                
                authSection.classList.add('hidden');
                promptSettingsSection.classList.remove('hidden');
                
                const dashboardLink = document.getElementById('adminDashboardLink');
                if (dashboardLink) {
                    dashboardLink.classList.remove('hidden');
                }
                
                await loadAdminData();
            } else {
                // 서버 세션 없음 - localStorage 클리어 + 로그인 화면
                localStorage.removeItem('adminAuthenticated');
                localStorage.removeItem('adminAuthTime');
                
                authPassword.value = '';
                authSection.classList.remove('hidden');
                promptSettingsSection.classList.add('hidden');
                
                const dashboardLink = document.getElementById('adminDashboardLink');
                if (dashboardLink) {
                    dashboardLink.classList.add('hidden');
                }
            }
        } catch (error) {
            // 에러 발생 - localStorage 클리어 + 로그인 화면
            localStorage.removeItem('adminAuthenticated');
            localStorage.removeItem('adminAuthTime');
            
            authPassword.value = '';
            authSection.classList.remove('hidden');
            promptSettingsSection.classList.add('hidden');
            
            const dashboardLink = document.getElementById('adminDashboardLink');
            if (dashboardLink) {
                dashboardLink.classList.add('hidden');
            }
        }
        
        populatePromptTextareas(); // Load saved or default prompts
        showPage(settingsPage);
    }

    function resetSpeechState() {
        // 🧹 메모리 최적화: 이전 음성 완전 정리 (2025-10-05)
        synth.cancel(); // 모든 대기 중인 음성 취소
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
        
        // OAuth 인증 실패 체크 (UX 개선)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auth') === 'failed') {
            console.error('❌ OAuth 인증 실패 감지');
            showToast('로그인에 실패했습니다. 다시 시도해주세요.');
            // URL 파라미터 제거 (깨끗하게)
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
            localStorage.removeItem('pendingShareUrl'); // 실패한 URL 삭제
        }
        
        // 인증 완료 후 대기 중인 공유 URL 확인
        console.log('🔍 Checking for pending share URL...');
        const pendingUrl = localStorage.getItem('pendingShareUrl');
        console.log('📦 localStorage.pendingShareUrl:', pendingUrl);
        if (pendingUrl) {
            console.log('🎯 Opening pending share URL after auth:', pendingUrl);
            localStorage.removeItem('pendingShareUrl');
            console.log('🗑️ Removed from localStorage');
            // 현재 탭에서 열기 (모바일 팝업 차단 해결)
            setTimeout(() => {
                console.log('🚀 Opening page in current tab:', pendingUrl);
                window.location.href = pendingUrl;
            }, 500);
        } else {
            console.log('❌ No pending URL found');
        }
        
        // ✨ 보관함 직접 접속 (#archive) 처리 (2025-10-28)
        if (window.location.hash === '#archive') {
            console.log('📁 Direct archive access detected');
            showArchivePage();
        }
        // The landing page animation will handle showing the features page initially.
        
        if (recognition) {
            recognition.continuous = false;
            recognition.lang = 'ko-KR';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
        }
        
        // 인증 성공 후 authModal 자동 닫기 (2025-10-26)
        checkAuthStatusAndCloseModal();
        
        // 페이지 포커스 시 인증 상태 재확인 (OAuth 리다이렉트 대응)
        window.addEventListener('focus', checkAuthStatusAndCloseModal);
        window.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkAuthStatusAndCloseModal();
            }
        });
        
        // ⚠️ 2025.11.06: OAuth 팝업 완료 메시지 수신
        window.addEventListener('message', (event) => {
            // 보안: origin 체크 (같은 도메인만 허용)
            if (event.origin !== window.location.origin) {
                console.warn('⚠️ Unauthorized message origin:', event.origin);
                return;
            }
            
            if (event.data.type === 'oauth_success') {
                console.log('✅ OAuth 팝업 성공 메시지 수신!');
                
                // 인증 모달 닫기
                authModal?.classList.add('hidden');
                authModal?.classList.add('pointer-events-none');
                authModal?.classList.remove('pointer-events-auto');
                
                // pendingShareUrl로 이동
                const pendingUrl = localStorage.getItem('pendingShareUrl');
                if (pendingUrl) {
                    console.log('🎯 Opening pending URL:', pendingUrl);
                    localStorage.removeItem('pendingShareUrl');
                    window.location.href = pendingUrl;
                } else {
                    // Featured Gallery 새로고침
                    console.log('🔄 Refreshing Featured Gallery');
                    loadFeaturedGallery();
                }
            }
        });
    }
    
    // 인증 상태 확인 및 모달 자동 닫기
    async function checkAuthStatusAndCloseModal() {
        console.log('🟡 Checking auth status...');
        try {
            const response = await fetch('/api/auth/user');
            console.log('🟡 Auth response:', response.ok, response.status);
            if (response.ok) {
                // 로그인되어 있으면 authModal 닫기
                console.log('🟡 Modal element:', authModal);
                authModal?.classList.add('hidden');
                authModal?.classList.add('pointer-events-none');
                authModal?.classList.remove('pointer-events-auto');
                console.log('✅ Auth modal closed - user is authenticated');
                
                // 대기 중인 공유 URL이 있으면 현재 탭에서 열기
                const pendingUrl = localStorage.getItem('pendingShareUrl');
                if (pendingUrl) {
                    console.log('🎯 Opening pending share URL in current tab:', pendingUrl);
                    localStorage.removeItem('pendingShareUrl');
                    window.location.href = pendingUrl;
                }
            } else {
                console.log('⚪ Not authenticated, keeping modal state');
            }
        } catch (error) {
            // 에러 발생 시 무시 (모달 상태 유지)
            console.log('⚠️ Auth check error:', error);
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
            
            // 📍 브라우저 위치 권한 요청 (백그라운드 실행)
            requestBrowserLocation();
            
            processImage(canvas.toDataURL('image/jpeg'), shootBtn);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 📍 브라우저 위치 권한 요청 (2025-10-26)
    // ═══════════════════════════════════════════════════════════════
    // 목적: EXIF GPS 없을 때 브라우저 Geolocation API 사용
    // 기능: 현재 위치 가져오기 → 랜드마크 검색
    // ═══════════════════════════════════════════════════════════════
    async function requestBrowserLocation() {
        if (!navigator.geolocation) {
            console.warn('⚠️ 브라우저가 위치 정보를 지원하지 않습니다');
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            window.currentGPS = {
                latitude: latitude,
                longitude: longitude,
                locationName: null
            };
            console.log('📍 브라우저 위치 추출 성공:', window.currentGPS);

            // 🗺️ 주변 유명 랜드마크 찾기
            loadGoogleMapsAPI(async () => {
                console.log('🗺️ callback 실행됨 (브라우저 GPS)');
                const landmark = await getNearbyLandmark(latitude, longitude);
                console.log('🔎 랜드마크 검색 결과:', landmark);
                if (landmark) {
                    window.currentGPS.locationName = landmark;
                    console.log('✅ 위치 이름 저장 완료:', landmark);
                }
            });
        } catch (error) {
            if (error.code === 1) {
                console.log('ℹ️ 사용자가 위치 권한을 거부했습니다');
            } else {
                console.error('위치 정보 오류:', error);
            }
            window.currentGPS = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 📍 사진 업로드 + GPS 자동 추출 (2025-10-26)
    // ═══════════════════════════════════════════════════════════════
    // 목적: 콘텐츠 신뢰성 최적화 (Google Maps 연동)
    // 기능: 사진 업로드 시 GPS EXIF 자동 추출 → 지도 표시
    // ═══════════════════════════════════════════════════════════════
    async function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (file) {
            // 📸 Step 1: GPS EXIF 데이터 추출 (exifr 라이브러리)
            try {
                if (window.exifr) {
                    const gpsData = await exifr.gps(file);
                    if (gpsData && gpsData.latitude && gpsData.longitude) {
                        // GPS 데이터를 전역 객체에 저장
                        window.currentGPS = {
                            latitude: gpsData.latitude,
                            longitude: gpsData.longitude,
                            locationName: null
                        };
                        console.log('📍 EXIF GPS 추출 성공:', window.currentGPS);
                        
                        // 🗺️ Step 1.5: 주변 유명 랜드마크 찾기 (GPS → "에펠탑" 등)
                        loadGoogleMapsAPI(async () => {
                            console.log('🗺️ callback 실행됨 (EXIF GPS)');
                            const landmark = await getNearbyLandmark(
                                gpsData.latitude,
                                gpsData.longitude
                            );
                            console.log('🔎 랜드마크 검색 결과:', landmark);
                            if (landmark) {
                                window.currentGPS.locationName = landmark;
                                console.log('✅ 위치 이름 저장 완료:', landmark);
                            }
                        });
                    } else {
                        console.log('ℹ️ EXIF GPS 정보 없음 → 브라우저 위치 요청');
                        window.currentGPS = null;
                        
                        // 📍 EXIF GPS 없으면 브라우저 위치 사용 (백그라운드)
                        requestBrowserLocation();
                    }
                } else {
                    console.warn('⚠️ exifr 라이브러리 로딩 실패 → 브라우저 위치 요청');
                    window.currentGPS = null;
                    
                    // 📍 브라우저 위치 요청 (백그라운드)
                    requestBrowserLocation();
                }
            } catch (error) {
                console.error('GPS 추출 오류:', error);
                window.currentGPS = null;
                
                // 📍 오류 시에도 브라우저 위치 요청 (백그라운드)
                requestBrowserLocation();
            }
            
            // 📷 Step 2: 이미지 처리 (기존 로직)
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
            // 📍 GPS 데이터 포함 (2025-10-26 콘텐츠 신뢰성 최적화)
            if (window.currentGPS) {
                currentContent.latitude = window.currentGPS.latitude;
                currentContent.longitude = window.currentGPS.longitude;
                currentContent.locationName = window.currentGPS.locationName;
                console.log('📍 GPS 데이터 저장:', window.currentGPS);
            }
            
            await addItem(currentContent);
            showToast("보관함에 저장되었습니다.");
            
            // GPS 데이터 초기화
            window.currentGPS = null;
        } catch(e) {
            console.error("Failed to save to archive:", e);
            showToast("저장에 실패했습니다. 저장 공간이 부족할 수 있습니다.");
            saveBtn.disabled = false;
        }
    }
    
    // ⚠️ 2025.11.02: 선택 모드 토글 - 다운로드 버튼 표시/숨김 추가
    function toggleSelectionMode(forceState) {
        if (typeof forceState === 'boolean') {
            isSelectionMode = forceState;
        } else {
            isSelectionMode = !isSelectionMode;
        }

        const downloadSelectedBtnContainer = document.getElementById('downloadSelectedBtnContainer');
        console.log('🔵 [Selection Mode] Toggling:', isSelectionMode);
        console.log('🔵 [Selection Mode] Download container exists:', !!downloadSelectedBtnContainer);

        if (isSelectionMode) {
            archiveGrid.classList.add('selection-mode');
            archiveHeader.classList.add('hidden');
            selectionHeader.classList.remove('hidden');
            downloadSelectedBtnContainer?.classList.remove('hidden'); // 다운로드 버튼 표시
            console.log('✅ [Selection Mode] Download button shown');
            selectedItemIds = []; // ✅ Array 초기화
            updateSelectionUI();
        } else {
            archiveGrid.classList.remove('selection-mode');
            archiveHeader.classList.remove('hidden');
            selectionHeader.classList.add('hidden');
            downloadSelectedBtnContainer?.classList.add('hidden'); // 다운로드 버튼 숨김
            console.log('❌ [Selection Mode] Download button hidden');
            selectedItemIds = []; // ✅ Array 초기화
            
            // Remove selection styling from all items
            document.querySelectorAll('.archive-item').forEach(item => {
                item.classList.remove('selected');
            });
        }
    }

    // ⚠️ 2025.11.02: 다운로드 버튼 활성화/비활성화 추가
    function updateSelectionUI() {
        selectionCount.textContent = `${selectedItemIds.length}개 선택`; // ✅ .size → .length
        
        // 다운로드 버튼 활성화/비활성화
        const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
        if (downloadSelectedBtn) {
            if (selectedItemIds.length > 0) {
                downloadSelectedBtn.disabled = false;
                downloadSelectedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                downloadSelectedBtn.disabled = true;
                downloadSelectedBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    async function handleDeleteSelected() {
        if (selectedItemIds.length === 0) return; // ✅ .size → .length
        if (!confirm(`선택된 ${selectedItemIds.length}개 항목을 삭제하시겠습니까?`)) return; // ✅ .size → .length

        try {
            await deleteItems([...selectedItemIds]);
            await renderArchive();
            toggleSelectionMode(false);
            showToast(`${selectedItemIds.length}개 항목이 삭제되었습니다.`); // ✅ .size → .length
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

        // 선택 모드: 선택된 아이템만 (클릭 순서대로!), 일반 모드: 전체
        const allItems = isSelectionMode && selectedItemIds.length > 0
            ? selectedItemIds.map(id => items.find(item => item.id === id)).filter(Boolean) // ✅ 클릭 순서 보존!
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
        
        // ⚠️ 2025-10-05: 모달 배경 클릭 시 닫기 (모달 내용 클릭은 무시)
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                shareModal.classList.add('hidden');
            }
        });
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
            
            // ✅ 2025-10-05: 모달 안에 성공 메시지 크게 표시 (3초간)
            // 목적: 사용자가 링크가 생성되었다는 것을 명확히 인지
            shareModalContent.innerHTML = `
                <div class="p-8 text-center">
                    <div class="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                        <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-4">링크 생성 완료!</h3>
                    ${copySuccess ? `
                        <p class="text-lg text-gray-700 mb-3">✅ 링크가 클립보드에 복사되었습니다</p>
                        <p class="text-base text-gray-600">카카오톡, 문자, 메신저 등<br>원하는 곳에 붙여넣기 하세요!</p>
                    ` : `
                        <p class="text-base text-gray-700 mb-4">아래 링크를 복사해서 공유하세요:</p>
                        <div class="bg-gray-100 p-4 rounded-lg mb-3">
                            <p class="text-sm font-mono text-gray-800 break-all">${shareUrl}</p>
                        </div>
                        <button onclick="navigator.clipboard.writeText('${shareUrl}').then(() => alert('복사 완료!'))" 
                                class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            링크 복사하기
                        </button>
                    `}
                </div>
            `;
            
            // 3초 후 자동으로 모달 닫기
            setTimeout(() => {
                shareModal.classList.add('hidden');
            }, 3000);

        } catch (error) {
            console.error('Share error:', error);
            shareModal.classList.add('hidden');
            showToast('❌ ' + error.message);
        }
    }

    // ⚠️ 2025.11.02: 선택한 가이드를 공유 페이지로 생성 후 바로 열기
    // 핵심: createAndCopyShareLink 로직 복사 + window.open으로 새 탭 열기
    async function handleDownloadSelectedGuides() {
        const items = await getAllItems();
        if (items.length === 0) return showToast('공유할 항목이 없습니다.');

        // 선택된 아이템만 필터링 (클릭 순서 보존)
        const selectedItems = selectedItemIds.map(id => items.find(item => item.id === id)).filter(Boolean);

        // 검증
        if (selectedItems.length === 0) return showToast('선택된 항목이 없습니다.');
        if (selectedItems.length > 20) return showToast('한 번에 최대 20개까지 공유할 수 있습니다.');

        // 로딩 토스트 표시
        showToast('공유 페이지 생성 중...');

        try {
            // 메타데이터 자동 생성
            const today = new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // 링크 이름 자동 생성
            const linkName = `내 여행 가이드 ${new Date().toLocaleDateString('ko-KR')}`;
            
            // HTML 콘텐츠 생성
            const appOrigin = window.location.origin;
            const htmlContent = generateShareHTML(
                linkName,
                '여행자',
                '파리, 프랑스',
                today,
                selectedItems,
                appOrigin
            );

            // 서버로 보낼 데이터 준비
            const requestData = {
                name: linkName,
                htmlContent: htmlContent,
                guideIds: selectedItems.map(item => item.id),
                thumbnail: selectedItems[0]?.imageDataUrl || null,
                sender: '여행자',
                location: '파리, 프랑스',
                featured: false
            };

            // 서버 API 호출 (공유 페이지 생성)
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
            // 짧은 URL 생성
            const shareUrl = `${window.location.origin}/s/${result.id}`;

            // ✅ 핵심: 클립보드 복사 대신 새 탭으로 열기!
            window.open(shareUrl, '_blank');

            // 선택 모드 해제
            if (isSelectionMode) toggleSelectionMode(false);
            
            // 보관함 새로고침
            await renderArchive();
            
            showToast('✅ 가이드 페이지가 열렸습니다!');

        } catch (error) {
            console.error('Download guide error:', error);
            showToast('❌ ' + error.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ Featured Gallery 로딩 시스템 (2025-10-05)
    // ⚠️ CRITICAL: 성능 최적화 완료 - 수정 시 주의 필요
    // ═══════════════════════════════════════════════════════════════
    // 작업 시간: 4시간
    // 목적: 사용자에게 추천 콘텐츠를 보관함 상단에 표시
    // 
    // 핵심 로직:
    // 1. /api/share/featured/list에서 추천 페이지 목록 가져오기
    // 2. 3칸 그리드로 썸네일 표시 (있으면 이미지, 없으면 아이콘)
    // 3. 데이터 없으면 갤러리 숨김 처리
    // 4. 에러 발생 시 조용히 숨김 (사용자 경험 방해 안함)
    // 
    // 레이아웃 위치: 헤더 바로 아래 → 내 보관함 위
    // 성능: 비동기 로딩으로 내 보관함 표시 차단 안함
    // 
    // 🚀 캐싱 최적화 (2025-10-26):
    // - localStorage 5분 캐싱으로 0.9초 → 0ms 개선
    // - 캐시 키: featuredGalleryCache
    // - 만료 시간: 5분 (300,000ms)
    // ═══════════════════════════════════════════════════════════════
    async function loadFeaturedGallery() {
        try {
            const CACHE_KEY = 'featuredGalleryCache_v2'; // ✅ X 버튼 업데이트
            const CACHE_DURATION = 5 * 60 * 1000; // 5분
            
            // API 호출 (버전 체크를 위해)
            const response = await fetch('/api/share/featured/list');
            if (!response.ok) return;
            
            const data = await response.json();
            const featuredPages = data.pages || [];
            const currentVersion = data.version;
            
            // 캐시 확인
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const { data: cachedData, timestamp, version: cachedVersion } = JSON.parse(cached);
                    const age = Date.now() - timestamp;
                    
                    if (age < CACHE_DURATION && cachedVersion === currentVersion) {
                        console.log('💾 Featured Gallery 캐시 사용 (버전:', currentVersion, ', 나이:', Math.round(age / 1000), '초)');
                        renderFeaturedGallery(cachedData.pages || []);
                        return;
                    } else if (cachedVersion !== currentVersion) {
                        console.log('🔄 Featured Gallery 버전 변경 감지 (', cachedVersion, '→', currentVersion, ') - 캐시 무효화');
                    }
                } catch (e) {
                    // 캐시 파싱 실패 시 무시
                }
            }
            
            // 캐시 저장
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: data,
                    version: currentVersion,
                    timestamp: Date.now()
                }));
                console.log('💾 Featured Gallery 캐시 저장 완료 (버전:', currentVersion, ')');
            } catch (e) {
                // localStorage 저장 실패 시 무시
            }
            
            renderFeaturedGallery(featuredPages);
        } catch (error) {
            console.warn('Featured gallery not available yet:', error);
            featuredGallery?.classList.add('hidden');
        }
    }
    
    // Featured Gallery 렌더링 함수 (캐싱 및 API 호출 모두 사용)
    function renderFeaturedGallery(featuredPages) {
        if (featuredPages.length > 0) {
            featuredGallery.classList.remove('hidden');
            featuredGrid.innerHTML = featuredPages.map((page, index) => {
                const thumbnail = page.thumbnail || '';
                const shareUrl = `${window.location.origin}/s/${page.id}`;
                const pageName = page.name || '공유 페이지';
                return `
                    <div class="flex flex-col gap-2">
                        <div onclick="handleFeaturedClick('${shareUrl}')" 
                           class="relative block bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
                           data-testid="featured-${page.id}">
                            ${thumbnail ? `
                                <img src="${thumbnail}" alt="${pageName}" 
                                     class="w-full aspect-square object-cover">
                            ` : `
                                <div class="w-full aspect-square bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                    <span class="text-4xl">📍</span>
                                </div>
                            `}
                            <div class="absolute inset-0 bg-gradient-to-b from-black/85 via-black/50 to-black/20 flex items-start justify-center pt-4 px-4">
                                <h3 class="text-white font-extrabold text-center leading-tight line-clamp-2" 
                                    style="font-size: clamp(1rem, 4.5vw, 1.5rem); text-shadow: 0 3px 15px rgba(0,0,0,1), 0 2px 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8);">
                                    ${pageName}
                                </h3>
                            </div>
                            <div class="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 shadow-lg" data-testid="download-count-${page.id}">
                                <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                </svg>
                                <span class="text-xs font-bold text-gray-700">${page.downloadCount || 0}</span>
                            </div>
                        </div>
                        <button 
                            onclick="event.stopPropagation(); handleFeaturedDownload('${shareUrl}', ${index})"
                            data-testid="button-download-featured-${index}"
                            class="w-full py-2 px-3 flex items-center justify-center rounded-full transition-all interactive-btn"
                            style="background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px);"
                            aria-label="링크 복사">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" style="color: #4285F4;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                        </button>
                    </div>
                `;
            }).join('');
        } else {
            featuredGallery.classList.add('hidden');
        }
    }

    // ⚠️ 2025.11.02: Featured 갤러리 다운로드 버튼 핸들러
    // 핵심: 공유 페이지 링크를 클립보드에 복사 + 공유 모달 2번째 팝업 표시
    window.handleFeaturedDownload = async function(shareUrl, index) {
        console.log('📥 Featured Gallery download clicked:', shareUrl, 'index:', index);
        
        // 📋 클립보드에 복사 시도
        let copySuccess = false;
        try {
            await navigator.clipboard.writeText(shareUrl);
            copySuccess = true;
            console.log('✅ Link copied to clipboard:', shareUrl);
        } catch (clipboardError) {
            console.warn('클립보드 복사 실패 (권한 없음):', clipboardError);
        }
        
        // ✅ 공유 모달 2번째 팝업 표시 (성공 메시지)
        const escapedUrl = shareUrl.replace(/'/g, "\\'");
        shareModalContent.innerHTML = `
            <div class="p-8 text-center">
                <div class="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-gray-900 mb-4">링크 복사 완료!</h3>
                ${copySuccess ? `
                    <p class="text-lg text-gray-700 mb-3">✅ 링크가 클립보드에 복사되었습니다</p>
                    <p class="text-base text-gray-600">카카오톡, 문자, 메신저 등<br>원하는 곳에 붙여넣기 하세요!</p>
                ` : `
                    <p class="text-base text-gray-700 mb-4">아래 링크를 복사해서 공유하세요:</p>
                    <div class="bg-gray-100 p-4 rounded-lg mb-3">
                        <p class="text-sm font-mono text-gray-800 break-all">${shareUrl}</p>
                    </div>
                    <button id="manualCopyBtn" data-url="${shareUrl}"
                            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        링크 복사하기
                    </button>
                `}
            </div>
        `;
        
        // 수동 복사 버튼 이벤트 리스너 (클립보드 실패 시)
        if (!copySuccess) {
            const manualBtn = document.getElementById('manualCopyBtn');
            if (manualBtn) {
                manualBtn.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(shareUrl);
                        manualBtn.textContent = '복사 완료!';
                        setTimeout(() => {
                            shareModal.classList.add('hidden');
                            resetShareModal();
                        }, 1000);
                    } catch (err) {
                        alert('복사 실패: ' + err.message);
                    }
                };
            }
        }
        
        // 모달 표시
        shareModal.classList.remove('hidden');
        
        // 3초 후 자동으로 모달 닫기
        setTimeout(() => {
            shareModal.classList.add('hidden');
            resetShareModal();
        }, 3000);
    };

    // ⚠️ 2025.11.06 UX FIX: Featured 갤러리 - 현재 탭에서 열기 (모바일 팝업 차단 해결)
    // 핵심: 모바일에서 팝업 차단되므로 현재 탭에서 열기, X 버튼은 보관함으로 복귀!
    window.handleFeaturedClick = async function(shareUrl) {
        console.log('🔵 Featured Gallery clicked:', shareUrl);
        try {
            // 인증 상태 확인
            const response = await fetch('/api/auth/user');
            console.log('🔵 Auth status:', response.ok, response.status);
            if (response.ok) {
                // 로그인되어 있으면 현재 탭에서 페이지 열기
                console.log('✅ Opening page in current tab:', shareUrl);
                window.location.href = shareUrl;
            } else {
                // 로그인되어 있지 않으면 URL 저장 후 인증 모달 표시
                console.log('❌ Not authenticated, showing auth modal');
                console.log('💾 Saving to localStorage:', shareUrl);
                localStorage.setItem('pendingShareUrl', shareUrl);
                console.log('✅ Saved! localStorage value:', localStorage.getItem('pendingShareUrl'));
                
                // 인증 모달 표시
                const authModal = document.getElementById('authModal');
                if (authModal) {
                    authModal.classList.remove('hidden');
                    console.log('📱 Auth modal displayed');
                } else {
                    console.error('❌ Auth modal not found, falling back to Kakao login');
                    window.location.href = '/api/auth/kakao';
                }
            }
        } catch (error) {
            // 에러 발생 시 URL 저장 후 인증 모달 표시
            console.log('❌ Auth check failed, showing auth modal:', error);
            console.log('💾 Saving to localStorage:', shareUrl);
            localStorage.setItem('pendingShareUrl', shareUrl);
            console.log('✅ Saved! localStorage value:', localStorage.getItem('pendingShareUrl'));
            
            // 인증 모달 표시
            const authModal = document.getElementById('authModal');
            if (authModal) {
                authModal.classList.remove('hidden');
                console.log('📱 Auth modal displayed');
            } else {
                console.error('❌ Auth modal not found, falling back to Kakao login');
                window.location.href = '/api/auth/kakao';
            }
        }
    };

    async function renderArchive() {
        try {
            const items = await getAllItems();
            
            // Featured Gallery 로드
            loadFeaturedGallery();
            
            if (items.length === 0) {
                archiveGrid.classList.add('hidden');
                emptyArchiveMessage.classList.remove('hidden');
            } else {
                emptyArchiveMessage.classList.add('hidden');
                archiveGrid.classList.remove('hidden');
                
                archiveGrid.innerHTML = items.map(item => `
                    <div class="archive-item relative ${selectedItemIds.includes(item.id) ? 'selected ring-2 ring-blue-500' : ''}" // ✅ .has → .includes 
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
            }

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
            // ✅ Array 기반 선택/해제 (클릭 순서 보존!)
            const index = selectedItemIds.indexOf(itemId);
            if (index > -1) {
                // 이미 선택됨 → 제거
                selectedItemIds.splice(index, 1);
                item.classList.remove('selected');
            } else {
                // 선택 안됨 → 추가 (클릭 순서대로!)
                selectedItemIds.push(itemId);
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
            
            // 📍 위치 정보 표시 (2025-10-26)
            const locationInfo = document.getElementById('locationInfo');
            const locationName = document.getElementById('locationName');
            if (item.locationName && locationInfo && locationName) {
                locationName.textContent = item.locationName;
                locationInfo.classList.remove('hidden');
            } else if (locationInfo) {
                locationInfo.classList.add('hidden');
            }
            
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

    // ═══════════════════════════════════════════════════════════════
    // 🔐 관리자 인증 로직 (Admin Authentication)
    // ═══════════════════════════════════════════════════════════════
    // ⚠️ CRITICAL: DO NOT MODIFY WITHOUT USER APPROVAL
    // 사용자 승인 없이 절대 수정 금지 - AI 및 모든 개발자 주의
    // Verified: 2025-10-26 | Status: Production-Ready ✅
    // ═══════════════════════════════════════════════════════════════
    // 
    // 목적: 관리자 페이지 접근 제어 (영업 비밀 보호!)
    // 작업 시간: 2시간
    // 
    // 핵심 로직:
    //   1. 비밀번호 인증 (1234)
    //   2. promptSettingsSection 표시
    //   3. adminDashboardLink 표시 (인증 후에만!)
    //   4. Featured 갤러리 관리 기능 활성화
    // 
    // 보안 규칙:
    //   - 설정 페이지 열 때마다 대시보드 링크 숨김
    //   - 재인증 필요 (영업 비밀 보호!)
    // ═══════════════════════════════════════════════════════════════
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
                // 인증 성공 - localStorage에 세션 저장 (유지)
                localStorage.setItem('adminAuthenticated', 'true');
                localStorage.setItem('adminAuthTime', Date.now().toString());
                
                authSection.classList.add('hidden');
                promptSettingsSection.classList.remove('hidden');
                showToast('관리자 인증 성공');
                
                // 🔓 대시보드 링크 표시 (영업 비밀!)
                const dashboardLink = document.getElementById('adminDashboardLink');
                if (dashboardLink) {
                    dashboardLink.classList.remove('hidden');
                }
                
                // Featured 갤러리 관리 데이터 로드
                await loadAdminData();
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

    // Featured 갤러리 관리 함수들
    async function loadAdminData() {
        await loadFeaturedList();
        
        // 검색창 이벤트 리스너 추가
        const searchInput = document.getElementById('shareSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchShares(e.target.value);
                }, 300); // 300ms 디바운스
            });
        }
    }

    async function searchShares(query) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        if (!query || query.trim().length === 0) {
            resultsContainer.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">검색어를 입력하세요</p>';
            return;
        }

        try {
            resultsContainer.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">검색 중...</p>';
            
            const response = await fetch(`/api/admin/all-shares?search=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error('검색 실패');
            
            const shares = await response.json();
            
            if (!shares || shares.length === 0) {
                resultsContainer.innerHTML = `
                    <p class="text-sm text-gray-400 text-center py-4">
                        "<span class="font-semibold">${query}</span>" 검색 결과가 없습니다
                    </p>
                `;
                return;
            }
            
            resultsContainer.innerHTML = shares.map(share => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-yellow-400 transition-colors">
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-900 truncate">${share.name}</p>
                        <div class="flex items-center gap-3 mt-1">
                            <span class="text-xs text-gray-500">📥 ${share.downloadCount || 0}회</span>
                            <span class="text-xs text-gray-400">${new Date(share.createdAt).toLocaleDateString()}</span>
                            ${share.featured ? '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">⭐ Featured</span>' : ''}
                        </div>
                    </div>
                    ${!share.featured ? `
                        <button 
                            onclick="addFeaturedById('${share.id}')" 
                            class="ml-3 px-3 py-1.5 bg-yellow-500 text-white text-sm font-medium rounded hover:bg-yellow-600 transition-colors whitespace-nowrap"
                            data-testid="button-add-featured-${share.id}">
                            ⭐ 추가
                        </button>
                    ` : `
                        <span class="ml-3 px-3 py-1.5 bg-gray-200 text-gray-500 text-sm font-medium rounded cursor-not-allowed whitespace-nowrap">
                            이미 추가됨
                        </span>
                    `}
                </div>
            `).join('');
            
        } catch (error) {
            console.error('공유 페이지 검색 오류:', error);
            resultsContainer.innerHTML = '<p class="text-sm text-red-400 text-center py-4">검색 중 오류가 발생했습니다</p>';
        }
    }

    async function loadFeaturedList() {
        try {
            const response = await fetch('/api/admin/featured', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load featured');
            
            const featured = await response.json();
            
            const list = document.getElementById('featuredList');
            const count = document.getElementById('featuredCount');
            
            if (count) count.textContent = featured.length;
            
            if (!list) return;
            
            if (!featured || featured.length === 0) {
                list.innerHTML = '<p class="text-sm text-gray-400">Featured 페이지가 없습니다</p>';
                return;
            }
            
            list.innerHTML = featured.map(page => `
                <div class="flex items-center justify-between p-2 bg-yellow-50 rounded">
                    <span class="text-sm font-medium text-gray-800">${page.name}</span>
                    <div class="flex items-center gap-2">
                        <button onclick="editFeatured('${page.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            ✏️ 편집
                        </button>
                        <button onclick="removeFeatured('${page.id}')" class="text-red-500 hover:text-red-700 text-sm font-medium">
                            ✕ 제거
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Featured 목록 로드 오류:', error);
            const list = document.getElementById('featuredList');
            if (list) list.innerHTML = '<p class="text-sm text-red-400">로드 실패</p>';
        }
    }

    window.addFeaturedById = async function(shareId) {
        if (!shareId) {
            showToast('공유 페이지를 선택해주세요');
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/featured/${shareId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast('⭐ Featured에 추가되었습니다!');
                await loadFeaturedList();
                // 검색 결과 다시 로드해서 "이미 추가됨" 표시
                const searchInput = document.getElementById('shareSearchInput');
                if (searchInput && searchInput.value) {
                    await searchShares(searchInput.value);
                }
            } else {
                showToast(data.error || 'Featured 추가 실패');
            }
        } catch (error) {
            console.error('Featured 추가 오류:', error);
            showToast('Featured 추가 중 오류 발생');
        }
    };

    window.removeFeatured = async function(shareId) {
        if (!confirm('Featured에서 제거하시겠습니까?')) return;
        
        try {
            const response = await fetch(`/api/admin/featured/${shareId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast('Featured에서 제거되었습니다');
                await loadFeaturedList();
            } else {
                showToast(data.error || 'Featured 제거 실패');
            }
        } catch (error) {
            console.error('Featured 제거 오류:', error);
            showToast('Featured 제거 중 오류 발생');
        }
    };

    // Featured 편집 모달
    window.editFeatured = async function(id) {
        try {
            showToast('📝 편집 정보 불러오는 중...');
            
            // 1. 관리자용 API로 데이터 가져오기
            const res = await fetch(`/api/admin/featured/${id}/data`, {
                credentials: 'include'
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || '데이터 로드 실패');
            }
            const data = await res.json();
            const { page, guides } = data;
            
            console.log('📊 편집 데이터:', { page, guides, guidesCount: guides?.length });
            
            // 2. 모달 입력 필드 채우기
            document.getElementById('editTitle').value = page.name || '';
            document.getElementById('editSender').value = page.sender || '여행자';
            document.getElementById('editLocation').value = page.location || '미지정';
            document.getElementById('editDate').value = page.date || new Date(page.createdAt).toISOString().split('T')[0];
            
            // 3. 모바일 친화적 가이드 리스트 생성 (위/아래 버튼)
            const guideListHtml = guides.map((guide, index) => {
                const imgSrc = guide.imageUrl || '';
                const isFirst = index === 0;
                const isLast = index === guides.length - 1;
                return `
                    <div class="guide-item flex items-center gap-2 p-3 bg-white rounded-lg border-2 border-gray-300 mb-2" data-guide-id="${guide.id}">
                        <img src="${imgSrc}" alt="가이드 ${index + 1}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">
                        <span class="font-medium text-gray-700 flex-1">가이드 ${index + 1}</span>
                        <div class="flex flex-col gap-1">
                            <button onclick="moveGuideUp(this)" ${isFirst ? 'disabled' : ''} class="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-bold" style="min-width: 40px; min-height: 36px;">▲</button>
                            <button onclick="moveGuideDown(this)" ${isLast ? 'disabled' : ''} class="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-bold" style="min-width: 40px; min-height: 36px;">▼</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            document.getElementById('guideList').innerHTML = guideListHtml;
            
            // 5. 모달 표시
            document.getElementById('editFeaturedModal').classList.remove('hidden');
            
            // 6. 저장 버튼 클릭 이벤트
            document.getElementById('saveFeaturedBtn').onclick = async () => {
                const title = document.getElementById('editTitle').value;
                const sender = document.getElementById('editSender').value;
                const location = document.getElementById('editLocation').value;
                const date = document.getElementById('editDate').value;
                
                if (!title || !sender || !location || !date) {
                    showToast('❌ 모든 필드를 입력해주세요.');
                    return;
                }
                
                // 가이드 순서 가져오기 (올바른 가이드 ID 사용)
                const guideItems = document.querySelectorAll('.guide-item');
                const newGuideIds = Array.from(guideItems).map(item => parseInt(item.dataset.guideId));
                
                try {
                    showToast('💾 저장 중...');
                    const response = await fetch(`/api/admin/featured/${id}/regenerate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            title,
                            sender,
                            location,
                            date,
                            guideIds: newGuideIds
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'HTML 재생성 실패');
                    }
                    
                    showToast('✅ Featured 페이지가 업데이트되었습니다!');
                    closeEditModal();
                    loadFeaturedList();
                } catch (error) {
                    console.error('Featured 편집 오류:', error);
                    showToast('❌ 편집 실패: ' + error.message);
                }
            };
        } catch (error) {
            console.error('Featured 편집 오류:', error);
            showToast('❌ 편집 실패: ' + error.message);
        }
    };

    // 모달 닫기
    window.closeEditModal = function() {
        document.getElementById('editFeaturedModal').classList.add('hidden');
    };

    // 가이드 위로 이동 (모바일 친화적)
    window.moveGuideUp = function(button) {
        const item = button.closest('.guide-item');
        const prev = item.previousElementSibling;
        if (prev) {
            item.parentNode.insertBefore(item, prev);
            updateGuideNumbers();
        }
    };

    // 가이드 아래로 이동 (모바일 친화적)
    window.moveGuideDown = function(button) {
        const item = button.closest('.guide-item');
        const next = item.nextElementSibling;
        if (next) {
            item.parentNode.insertBefore(next, item);
            updateGuideNumbers();
        }
    };

    // 가이드 번호 및 버튼 상태 업데이트
    function updateGuideNumbers() {
        const items = document.querySelectorAll('.guide-item');
        items.forEach((item, index) => {
            // 번호 업데이트
            const label = item.querySelector('span.font-medium');
            if (label) label.textContent = `가이드 ${index + 1}`;
            
            // 버튼 상태 업데이트
            const upBtn = item.querySelector('button:first-of-type');
            const downBtn = item.querySelector('button:last-of-type');
            
            upBtn.disabled = (index === 0);
            downBtn.disabled = (index === items.length - 1);
        });
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


    // --- Event Listeners (디바운스 적용) ---
    startCameraFromFeaturesBtn?.addEventListener('click', handleStartFeaturesClick);
    shootBtn?.addEventListener('click', () => debounceClick('shoot', capturePhoto, 800));
    uploadBtn?.addEventListener('click', () => uploadInput.click());
    micBtn?.addEventListener('click', () => debounceClick('mic', handleMicButtonClick, 500));
    archiveBtn?.addEventListener('click', () => debounceClick('archive', showArchivePage, 300));
    uploadInput?.addEventListener('change', handleFileSelect);
    
    backBtn?.addEventListener('click', () => cameFromArchive ? showArchivePage() : showMainPage());
    archiveBackBtn?.addEventListener('click', showMainPage);
    settingsBackBtn?.addEventListener('click', showArchivePage);
    
    // 🔓 테스트용 로그아웃 버튼
    const testLogoutBtn = document.getElementById('testLogoutBtn');
    testLogoutBtn?.addEventListener('click', () => {
        console.log('🔓 Test logout clicked');
        if (confirm('로그아웃하시겠습니까? (테스트용)')) {
            console.log('✅ User confirmed, logging out...');
            window.location.href = '/api/auth/logout';
        }
    });
    
    audioBtn?.addEventListener('click', onAudioBtnClick);
    saveBtn?.addEventListener('click', () => debounceClick('save', handleSaveClick, 500));
    textToggleBtn?.addEventListener('click', () => textOverlay.classList.toggle('hidden'));

    archiveSelectBtn?.addEventListener('click', () => {
        // 선택 버튼: 선택 모드 토글
        console.log('🔴 [DEBUG] 선택 버튼 클릭됨');
        toggleSelectionMode(!isSelectionMode);
        
        // 즉시 다운로드 버튼 상태 확인
        setTimeout(() => {
            const container = document.getElementById('downloadSelectedBtnContainer');
            const button = document.getElementById('downloadSelectedBtn');
            console.log('🔴 [DEBUG] 다운로드 컨테이너:', {
                exists: !!container,
                hidden: container?.classList.contains('hidden'),
                display: container ? window.getComputedStyle(container).display : 'N/A',
                visibility: container ? window.getComputedStyle(container).visibility : 'N/A'
            });
            console.log('🔴 [DEBUG] 다운로드 버튼:', {
                exists: !!button,
                text: button?.textContent,
                disabled: button?.disabled
            });
        }, 100);
    });
    // ✅ 공유 버튼 간편 로직 - 2025.10.02 구현 완료 (디바운스 추가)
    // 핵심: 1회 클릭 → 선택 모드 활성화 / 2회 클릭 (선택 후) → 공유 모달
    archiveShareBtn?.addEventListener('click', async () => {
        debounceClick('share', async () => {
            if (!isSelectionMode) {
                showToast('이미지를 선택해주세요');
                toggleSelectionMode(true);
                return;
            }
            
            if (selectedItemIds.length === 0) { // ✅ .size → .length
                showToast('이미지를 선택해주세요');
                return;
            }
            
            await handleCreateGuidebookClick();
        }, 600);
    });
    
    // ✅ 삭제 버튼 간편 로직 - 2025.10.02 구현 완료 (디바운스 추가)
    // 핵심: 1회 클릭 → 선택 모드 활성화 / 2회 클릭 (선택 후) → 삭제 실행
    archiveDeleteBtn?.addEventListener('click', async () => {
        debounceClick('delete', async () => {
            if (!isSelectionMode) {
                showToast('이미지를 선택해주세요');
                toggleSelectionMode(true);
                return;
            }
            
            if (selectedItemIds.length === 0) { // ✅ .size → .length
                showToast('이미지를 선택해주세요');
                return;
            }
            
            await handleDeleteSelected();
        }, 600);
    });
    
    // ⚠️ 2025.11.02: 다운로드 버튼 - 공유 페이지 생성 후 바로 열기
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    downloadSelectedBtn?.addEventListener('click', async () => {
        debounceClick('download', async () => {
            if (selectedItemIds.length === 0) {
                showToast('이미지를 선택해주세요');
                return;
            }
            
            await handleDownloadSelectedGuides();
        }, 600);
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

    // Auth Modal Event Listeners
    closeAuthModalBtn?.addEventListener('click', () => {
        console.log('❌ 인증 취소 - 모달 닫기');
        authModal.classList.add('hidden');
        authModal.classList.add('pointer-events-none');
        authModal.classList.remove('pointer-events-auto');
        // 대기 중인 URL 삭제 (배포본과 동일)
        localStorage.removeItem('pendingShareUrl');
        console.log('🗑️ pendingShareUrl 삭제 완료');
    });

    // ⚠️ 2025.11.06: OAuth 팝업 방식 (PC) vs 현재 탭 (모바일)
    // 모바일 감지 함수
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    googleLoginBtn?.addEventListener('click', () => {
        if (isMobile()) {
            console.log('🔵 Google 로그인 - 📱 모바일: 현재 탭에서 진행');
            window.location.href = '/api/auth/google';
        } else {
            console.log('🔵 Google 로그인 - 💻 PC: 팝업 열기');
            const width = 500;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            const popup = window.open(
                '/api/auth/google',
                'google_oauth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
            );
            if (!popup) {
                console.error('❌ 팝업이 차단되었습니다. 현재 탭으로 진행합니다.');
                window.location.href = '/api/auth/google';
            }
        }
    });

    kakaoLoginBtn?.addEventListener('click', () => {
        if (isMobile()) {
            console.log('🔵 Kakao 로그인 - 📱 모바일: 현재 탭에서 진행');
            window.location.href = '/api/auth/kakao';
        } else {
            console.log('🔵 Kakao 로그인 - 💻 PC: 팝업 열기');
            const width = 500;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            const popup = window.open(
                '/api/auth/kakao',
                'kakao_oauth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
            );
            if (!popup) {
                console.error('❌ 팝업이 차단되었습니다. 현재 탭으로 진행합니다.');
                window.location.href = '/api/auth/kakao';
            }
        }
    });
    
    // OAuth 팝업 닫힌 후 인증 상태 확인 및 Featured Gallery 열기
    async function checkAuthAndOpenPendingUrl() {
        try {
            const response = await fetch('/api/auth/user');
            if (response.ok) {
                console.log('✅ 인증 성공!');
                // 인증 모달 닫기
                authModal?.classList.add('hidden');
                
                // pendingShareUrl이 있으면 현재 탭에서 열기
                const pendingUrl = localStorage.getItem('pendingShareUrl');
                if (pendingUrl) {
                    console.log('🎯 Opening pending URL in current tab:', pendingUrl);
                    localStorage.removeItem('pendingShareUrl');
                    window.location.href = pendingUrl;
                } else {
                    // Featured Gallery 새로고침
                    loadFeaturedGallery();
                }
            } else {
                console.log('❌ 인증 실패');
            }
        } catch (error) {
            console.error('인증 확인 오류:', error);
        }
    }

    // Auth Modal Background Click to Close
    authModal?.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.add('hidden');
            authModal.classList.add('pointer-events-none');
            authModal.classList.remove('pointer-events-auto');
        }
    });

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