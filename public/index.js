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

    function generateShareHTML(title, sender, location, date, guideItems, appOrigin) {
        const guideItemsHTML = guideItems.map((item, index) => `
            <div class="guide-item">
                ${item.imageDataUrl ? `<img src="${item.imageDataUrl}" alt="Guide ${index + 1}">` : ''}
                <p class="description">${item.description || ''}</p>
            </div>
        `).join('');

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 손안에 가이드</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            background: #FFFEFA;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #4285F4 0%, #34A853 100%);
            color: white;
            padding: 30px;
            border-radius: 16px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2rem; margin-bottom: 10px; }
        .metadata { 
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .metadata p { margin: 8px 0; color: #666; }
        .guide-item {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .guide-item img {
            width: 100%;
            border-radius: 8px;
            margin-bottom: 15px;
        }
        .description {
            font-size: 1rem;
            color: #333;
            white-space: pre-wrap;
        }
        .app-link {
            display: inline-block;
            background: #4285F4;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
        }
        .app-link:hover { background: #3367D6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📍 ${title}</h1>
        </div>
        <div class="metadata">
            <p><strong>👤 발신자:</strong> ${sender} 님이 보냄</p>
            <p><strong>📍 위치:</strong> ${location}</p>
            <p><strong>📅 생성일:</strong> ${date}</p>
        </div>
        ${guideItemsHTML}
        <div style="text-align: center; margin-top: 40px;">
            <a href="${appOrigin}" class="app-link">🎯 앱으로 가기</a>
        </div>
    </div>
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

    function showSettingsPage() {
        pauseCamera();
        // Reset settings page state
        authPassword.value = '';
        authSection.classList.remove('hidden');
        promptSettingsSection.classList.add('hidden');
        populatePromptTextareas(); // Load saved or default prompts
        showPage(settingsPage);
    }
    
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

    // ✅ 공유 링크 생성 로직 - 2025.10.02 간단한 복사 방식
    let currentShareItems = []; // 현재 공유할 아이템들을 저장
    
    async function handleCreateGuidebookClick() {
        const items = await getAllItems();
        if (items.length === 0) return showToast('공유할 항목이 없습니다.');

        const allItems = isSelectionMode && selectedItemIds.size > 0
            ? items.filter(item => selectedItemIds.has(item.id))
            : items;

        if (allItems.length === 0) return showToast('선택된 항목이 없습니다.');
        if (allItems.length > 20) return showToast('한 번에 최대 20개까지 공유할 수 있습니다. 선택을 줄여주세요.');

        // 현재 공유할 아이템 저장
        currentShareItems = allItems;
        
        // 모달 초기화 및 열기
        resetShareModal();
        shareModal.classList.remove('hidden');
    }

    // 모달 초기화 함수
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

    // 링크 생성 및 복사 함수
    async function createAndCopyShareLink() {
        const linkName = document.getElementById('shareLinkName').value.trim();

        // 입력 검증
        if (!linkName) {
            return showToast('링크 이름을 먼저 입력해주세요!');
        }

        // 로딩 표시
        shareModalContent.innerHTML = `
            <div class="p-6 text-center">
                <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-lg font-semibold">링크 생성 중...</p>
            </div>
        `;

        try {
            // 메타데이터 자동 생성 (임시값)
            const today = new Date().toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // HTML 콘텐츠 생성
            const appOrigin = window.location.origin;
            const htmlContent = generateShareHTML(
                linkName,
                '여행자', // 임시 발신자
                '파리, 프랑스', // 임시 위치
                today,
                currentShareItems,
                appOrigin
            );

            // 서버로 보낼 데이터
            const requestData = {
                name: linkName,
                htmlContent: htmlContent,
                guideIds: currentShareItems.map(item => item.id),
                thumbnail: currentShareItems[0]?.imageDataUrl || null,
                sender: '여행자',
                location: '파리, 프랑스',
                featured: false
            };

            // 서버 API 호출
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
            const shareUrl = `${window.location.origin}/s/${result.id}`;

            // 클립보드에 복사
            await navigator.clipboard.writeText(shareUrl);

            // 선택 모드 해제
            if (isSelectionMode) toggleSelectionMode(false);
            
            // 보관함 새로고침
            await renderArchive();
            
            // 모달 닫기
            shareModal.classList.add('hidden');
            
            // 성공 메시지
            showToast('✅ 링크가 복사되었습니다! 원하는 곳에 붙여넣기 하세요.');

        } catch (error) {
            console.error('Share error:', error);
            shareModal.classList.add('hidden');
            showToast('❌ ' + error.message);
        }
    }

    async function renderArchive() {
        try {
            const items = await getAllItems();
            
            // ✅ Featured Gallery (추천 갤러리) 로직 - 2025.10.02 확보됨
            // 핵심: 최신 3개 공유링크를 상단 고정 영역에 표시 (사진만, 타이틀/다운로드 버튼 제거)
            if (featuredGallery && featuredGrid) {
                let featuredLinks = [];
                try {
                    featuredLinks = await getFeaturedShareLinks();
                } catch (error) {
                    console.warn('Featured gallery not available yet:', error);
                    featuredLinks = [];
                }
                
                // 임시 샘플 데이터 (테스트용)
                if (featuredLinks.length === 0) {
                    const sampleImages = items.slice(0, 3);
                    if (sampleImages.length > 0) {
                        featuredLinks = sampleImages.map(item => ({
                            id: item.id,
                            title: '샘플',
                            guideItems: [{ imageDataUrl: item.imageDataUrl }]
                        }));
                    }
                }
                
                if (featuredLinks.length > 0) {
                    featuredGallery.classList.remove('hidden');
                    featuredGrid.innerHTML = featuredLinks.map(link => {
                        const thumbnail = link.guideItems[0]?.imageDataUrl || '';
                        return `
                            <div class="relative bg-white rounded-lg overflow-hidden shadow-sm"
                                 data-testid="featured-${link.id}">
                                ${thumbnail ? `
                                    <img src="${thumbnail}" alt="${link.title}" 
                                         class="w-full aspect-square object-cover">
                                ` : `
                                    <div class="w-full aspect-square bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                        <span class="text-4xl">📍</span>
                                    </div>
                                `}
                            </div>
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

    function handleAuth(event) {
        event.preventDefault();
        const password = authPassword.value;
        
        // Simple password check - in production, this should be more secure
        if (password === 'admin123') {
            authSection.classList.add('hidden');
            promptSettingsSection.classList.remove('hidden');
            showToast('인증되었습니다.');
        } else {
            showToast('잘못된 비밀번호입니다.');
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