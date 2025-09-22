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
    const archiveHeader = document.getElementById('archiveHeader');
    const selectionHeader = document.getElementById('selectionHeader');
    const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
    const selectionCount = document.getElementById('selectionCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const archiveSelectBtn = document.getElementById('archiveSelectBtn');
    const archiveShareBtn = document.getElementById('archiveShareBtn');
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
    const DB_VERSION = 1;
    const STORE_NAME = 'archive';
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
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
        stopSpeech(); // 중앙화된 음성 중지
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

    async function showArchivePage() {
        pauseCamera();
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
        // 🔧 [버그 수정 1] 더 강력한 음성 상태 초기화
        utteranceQueue = [];
        isSpeaking = false;
        isPaused = false;
        if (currentlySpeakingElement) {
            currentlySpeakingElement.classList.remove('speaking');
        }
        currentlySpeakingElement = null;
        
        // 모든 speaking 클래스 제거 (중복 방지)
        const allSpeakingElements = document.querySelectorAll('.speaking');
        allSpeakingElements.forEach(el => el.classList.remove('speaking'));
    }

    // 🔧 [버그 수정 1] 중앙화된 음성 중지 유틸리티 (경쟁 조건 방지)
    function stopSpeech() {
        // 즉시 음성 중지 (타이머 없음)
        if (synth.speaking || synth.pending) {
            synth.cancel();
        }
        
        // 상태 완전 초기화
        resetSpeechState();
    }

    // 🔧 [공유 버그 수정] 클립보드 API fallback (모바일 호환성)
    async function copyToClipboard(text) {
        try {
            // 최신 Clipboard API 사용 (HTTPS 필요)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return;
            }
        } catch (err) {
            console.warn("Clipboard API 실패, fallback 시도:", err);
        }
        
        // Fallback: textarea 요소를 이용한 복사 (모바일 호환)
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            
            // iOS Safari를 위한 특별 처리
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                textarea.style.fontSize = '16px'; // 줌 방지
                textarea.setAttribute('readonly', '');
                const range = document.createRange();
                range.selectNodeContents(textarea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textarea.setSelectionRange(0, 999999);
            } else {
                textarea.select();
            }
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (!successful) {
                throw new Error('execCommand 복사 실패');
            }
        } catch (fallbackErr) {
            console.error("Fallback 복사도 실패:", fallbackErr);
            throw new Error('클립보드 복사가 지원되지 않는 브라우저입니다');
        }
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
            stopSpeech(); // 중앙화된 음성 중지
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
                // 🔧 [버그 수정 2] 업로드는 카메라와 독립적, 촬영/마이크만 카메라 의존
                [shootBtn, micBtn].forEach(btn => {
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
        // 🔧 [버그 수정 2] 이미지 업로드는 카메라와 독립적으로 허용
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => processImage(e.target?.result, uploadBtn);
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    }

    async function processImage(dataUrl, sourceButton) {
        // 🔍 성능 모니터링 시작
        const startTime = performance.now();
        const fileSizeKB = Math.round((dataUrl.length * 3/4) / 1024);
        console.log(`📊 [성능모니터] 이미지 크기: ${fileSizeKB}KB, 처리 시작`);
        
        sourceButton.disabled = true;
        cameFromArchive = false;
        stopSpeech(); // 중앙화된 음성 중지

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
        stopSpeech(); // 중앙화된 음성 중지
        
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
        isSelectionMode = (typeof forceState === 'boolean') ? forceState : !isSelectionMode;
        archiveHeader.classList.toggle('hidden', isSelectionMode);
        selectionHeader.classList.toggle('hidden', !isSelectionMode);

        if (isSelectionMode) {
            selectedItemIds.clear();
            updateSelectionHeader();
        }
        renderArchive();
    }
    
    function updateSelectionHeader() {
        const count = selectedItemIds.size;
        selectionCount.textContent = `${count}개 선택`;
        deleteSelectedBtn.disabled = count === 0;
        archiveShareBtn.disabled = count === 0;
    }

    async function handleDeleteSelected() {
        const count = selectedItemIds.size;
        if (count === 0) return;
        
        if (confirm(`${count}개의 항목을 삭제하시겠습니까?`)) {
            deleteSelectedBtn.disabled = true;
            try {
                await deleteItems(Array.from(selectedItemIds));
                showToast(`${count}개 항목이 삭제되었습니다.`);
                toggleSelectionMode(false);
            } catch (e) {
                 showToast('삭제 중 오류가 발생했습니다.');
                 console.error("Deletion error:", e);
                 deleteSelectedBtn.disabled = false;
            }
        }
    }
    
    /**
     * Creates a new guidebook from selected items and copies the link to the clipboard.
     */
    async function handleCreateGuidebookClick() {
        const idsToShare = Array.from(selectedItemIds);
        if (idsToShare.length === 0) {
            showToast("공유할 항목을 먼저 선택해주세요.");
            return;
        }
    
        const originalBtnContent = archiveShareBtn.innerHTML;
        const spinnerIcon = `<div class="w-8 h-8 rounded-full animate-spin loader-blue"></div>`;
        archiveShareBtn.innerHTML = spinnerIcon;
        archiveShareBtn.disabled = true;
    
        try {
            // 1. DB에서 모든 아이템을 가져옵니다.
            const allItems = await getAllItems(); 
            
            // 2. 선택된 ID를 기반으로 전체 콘텐츠 객체를 필터링합니다.
            const contentsToShare = allItems
                .filter(item => idsToShare.includes(item.id))
                .map(item => ({ // 3. 공유에 필요한 데이터만 추출합니다.
                    imageDataUrl: item.imageDataUrl,
                    description: item.description
                }));

            if (contentsToShare.length !== idsToShare.length) {
                throw new Error("일부 항목을 찾을 수 없습니다. 다시 시도해주세요.");
            }

            // 4. 전체 콘텐츠 배열을 백엔드로 전송합니다.
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: contentsToShare }),
            });
    
            const result = await response.json();
    
            if (!response.ok) {
                throw new Error(result.error || `서버 오류: ${response.status}`);
            }
    
            const { guidebookId } = result;
            const shareUrl = `${window.location.origin}/share.html?id=${guidebookId}`;
    
            // 1. 클립보드 복사 (모바일 호환성 향상)
            try {
                await copyToClipboard(shareUrl);
                showToast("가이드북 링크가 클립보드에 복사되었어요!");
            } catch (e) {
                console.warn("클립보드 복사 실패:", e);
                showToast("링크가 준비되었습니다. 아래 모달에서 복사해주세요.");
            }
            toggleSelectionMode(false); // Exit selection mode on success

            // 2. 공유 모달에 링크 표시 (유튜버 공유 스타일)
            // 공유 모달 내용 동적 생성
            let linkName = ''; // 빈칸으로 시작 (사용자가 직접 입력해야 함)
            shareModalContent.innerHTML =
                '<div class="p-4 border-b border-gray-200 flex justify-between items-center">' +
                    '<h2 class="text-lg font-bold text-gray-800">공유하기</h2>' +
                    '<button id="closeShareModalBtn" class="p-2 text-gray-500 hover:text-gray-800">&times;</button>' +
                '</div>' +
                '<div class="p-6">' +
                    '<p class="text-center text-gray-600 mb-4">아래 링크와 이름을 복사해서 유튜브, 인스타, 카톡 등 원하는 곳에 공유하세요!</p>' +
                    '<div class="flex flex-col items-center gap-2">' +
                        '<input id="shareNameInput" type="text" class="w-full px-2 py-1 border rounded text-sm" value="' + linkName + '" placeholder="링크 이름" />' +
                        '<input id="shareLinkInput" type="text" class="w-full px-2 py-1 border rounded text-sm" value="' + shareUrl + '" readonly />' +
                        '<button id="copyShareLinkBtn" class="px-4 py-2 bg-blue-500 text-white rounded">이름(사용자가 직접 입력함)+링크 복사</button>' +
                    '</div>' +
                '</div>';
                
            // CSS 클래스 수정: 모달을 화면에 표시
            shareModalContent.classList.remove('translate-y-full');
            shareModalContent.classList.add('translate-y-0');
            
            // 3. 모달 표시
            shareModal.classList.remove('hidden');
            
            // 4. 모달 이벤트 리스너 추가
            const newCloseBtn = document.getElementById('closeShareModalBtn');
            const copyBtn = document.getElementById('copyShareLinkBtn');
            
            newCloseBtn.addEventListener('click', () => {
                shareModal.classList.add('hidden');
            });
            
            copyBtn.addEventListener('click', async () => {
                const nameInput = document.getElementById('shareNameInput');
                const linkInput = document.getElementById('shareLinkInput');
                
                // 링크 이름 입력 검증
                if (!nameInput.value.trim()) {
                    showToast('링크 이름을 입력해주세요!');
                    nameInput.focus();
                    return;
                }
                
                const textToCopy = `${nameInput.value}\n${linkInput.value}`;
                try {
                    await copyToClipboard(textToCopy);
                    showToast('이름과 링크가 복사되었어요!');
                    copyBtn.textContent = "복사됨!";
                    setTimeout(() => copyBtn.textContent = "이름(사용자가 직접 입력함)+링크 복사", 2000);
                } catch (e) {
                    showToast("복사에 실패했습니다. 텍스트를 선택해서 수동 복사해주세요.");
                    linkInput.select();
                }
            });
            
            // 5. 성공 시 버튼 상태 복구
            archiveShareBtn.innerHTML = originalBtnContent;
            archiveShareBtn.disabled = false;
            
        } catch (error) {
            console.error("가이드북 생성 오류:", error);
            showToast('오류: ' + error.message);
            archiveShareBtn.innerHTML = originalBtnContent;
            // 버튼 상태를 다시 활성화하고 선택 카운트를 업데이트합니다.
            archiveShareBtn.disabled = false; 
            updateSelectionHeader();
            // 에러 발생 시 모달 닫기
            shareModal.classList.add('hidden');
        }
    }


    async function renderArchive() {
        try {
            const archive = await getAllItems();
            archiveGrid.innerHTML = '';
        
            const hasItems = archive.length > 0;
            emptyArchiveMessage.classList.toggle('hidden', hasItems);
            archiveSelectBtn.classList.toggle('hidden', !hasItems);
        
            if (hasItems) {
                archive.forEach(item => {
                    const itemId = item.id;
                    
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'archive-item';
                    itemDiv.dataset.id = itemId;
        
                    if (isSelectionMode) {
                        itemDiv.classList.add('selectable');
                        if (selectedItemIds.has(itemId)) {
                            itemDiv.classList.add('selected');
                        }
                    }
        
                    itemDiv.setAttribute('role', 'button');
                    itemDiv.setAttribute('tabindex', '0');
                    itemDiv.setAttribute('aria-label', '보관된 항목: ' + item.description.substring(0, 30) + '...');
                    
                    if (isSelectionMode) {
                        const checkbox = document.createElement('div');
                        checkbox.className = 'selection-checkbox';
                        checkbox.innerHTML = '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>';
                        itemDiv.appendChild(checkbox);
                    }
        
                    const img = document.createElement('img');
                    img.src = item.imageDataUrl;
                    img.alt = item.description.substring(0, 30);
                    img.loading = 'lazy';
                    
                    itemDiv.appendChild(img);
                    archiveGrid.appendChild(itemDiv);
                });
            }
        } catch (e) {
            console.error("Could not render archive:", e);
            showToast("보관함 목록을 불러오는 데 실패했습니다.");
            emptyArchiveMessage.classList.remove('hidden');
            archiveSelectBtn.classList.add('hidden');
        }
    }
    

    function populateDetailPageFromArchive(item) {
        // 🔧 [버그 수정 1] 중앙화된 음성 중지 로직
        stopSpeech();
        
        cameFromArchive = true;
        
        resultImage.src = item.imageDataUrl || '';
        resultImage.classList.toggle('hidden', !item.imageDataUrl);

        detailPage.classList.remove('bg-friendly');

        descriptionText.innerHTML = '';
        
        loader.classList.add('hidden');
        textOverlay.classList.remove('hidden');
        textOverlay.classList.remove('animate-in');
        loadingHeader.classList.add('hidden');
        detailFooter.classList.remove('hidden');
        
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
        showDetailPage(true);
    }

    function playNextInQueue() {
        if (isPaused || utteranceQueue.length === 0) {
            if (utteranceQueue.length === 0) {
                isSpeaking = false;
                isPaused = false;
                if(currentlySpeakingElement) currentlySpeakingElement.classList.remove('speaking');
                currentlySpeakingElement = null;
                updateAudioButton('play');
            }
            return;
        }
        
        isSpeaking = true;
        const { utterance, element } = utteranceQueue.shift();
        
        if (currentlySpeakingElement) {
            currentlySpeakingElement.classList.remove('speaking');
        }
        element.classList.add('speaking');
        currentlySpeakingElement = element;
        
        utterance.onend = () => {
            playNextInQueue();
        };

        synth.speak(utterance);
    }

    function queueForSpeech(text, element) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utteranceQueue.push({ utterance, element });

        if (!isSpeaking && !synth.speaking && !isPaused) {
            updateAudioButton('pause');
            playNextInQueue();
        }
    }
    
    function restartAudio() {
        stopSpeech(); // 중앙화된 음성 중지

        const sentences = Array.from(descriptionText.querySelectorAll('span'));
        if (sentences.length === 0) {
             const description = descriptionText.textContent || '';
             const sentenceChunks = description.match(/[^.?!]+[.?!]+/g) || [description];
             sentenceChunks.forEach(sentence => {
                if (sentence.trim()) queueForSpeech(sentence.trim(), document.createElement('span'));
             });
        } else {
             sentences.forEach(span => {
                const text = span.textContent.trim();
                if (text) queueForSpeech(text, span);
            });
        }
        playNextInQueue();
    }

    function handleAudioButtonClick() {
        if (!isSpeaking && utteranceQueue.length > 0) {
            isPaused = false;
            if (synth.paused) synth.resume();
            else playNextInQueue();
            updateAudioButton('pause');
        } else if (isSpeaking && !isPaused) {
            isPaused = true;
            synth.pause();
            updateAudioButton('resume');
        } else if (isSpeaking && isPaused) {
            isPaused = false;
            synth.resume();
            updateAudioButton('pause');
        }
    }
    
    function onAudioBtnClick() {
        const now = Date.now();
        if (now - lastAudioClickTime < 350) {
            restartAudio();
        } else {
            handleAudioButtonClick();
        }
        lastAudioClickTime = now;
    }
    
    function updateAudioButton(state) {
    const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.648c1.295.748 1.295 2.538 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>';
    const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6.75 5.25a.75 .75 0 01.75-.75H9a.75 .75 0 01.75.75v13.5a.75 .75 0 01-.75.75H7.5a.75 .75 0 01-.75-.75V5.25zm7.5 0a.75 .75 0 01.75-.75h1.5a.75 .75 0 01.75.75v13.5a.75 .75 0 01-.75.75h-1.5a.75 .75 0 01-.75-.75V5.25z" clip-rule="evenodd" /></svg>';
    const loadingIcon = '<div class="w-8 h-8 rounded-full animate-spin loader-blue"></div>';

        audioBtn.disabled = state === 'loading' || state === 'disabled';
        
        switch (state) {
            case 'play':
            case 'resume':
                audioBtn.innerHTML = playIcon;
                audioBtn.setAttribute('aria-label', '오디오 재생');
                break;
            case 'pause':
                audioBtn.innerHTML = pauseIcon;
                audioBtn.setAttribute('aria-label', '오디오 일시정지');
                break;
            case 'loading':
                audioBtn.innerHTML = loadingIcon;
                 audioBtn.setAttribute('aria-label', '오디오 로딩 중');
                break;
            case 'disabled':
                 audioBtn.innerHTML = playIcon;
                 audioBtn.setAttribute('aria-label', '오디오 재생 불가');
                break;
        }
    }

    async function handleArchiveGridClick(event) {
        const itemDiv = event.target.closest('.archive-item');
        if (!itemDiv) return;
    
        const itemId = itemDiv.dataset.id;
        
        if (isSelectionMode) {
            event.preventDefault();
            
            if (selectedItemIds.has(itemId)) {
                selectedItemIds.delete(itemId);
                itemDiv.classList.remove('selected');
            } else {
                selectedItemIds.add(itemId);
                itemDiv.classList.add('selected');
            }
            updateSelectionHeader();
        } else {
            const archive = await getAllItems();
            const item = archive.find(i => i.id === itemId);
            if (item) populateDetailPageFromArchive(item);
        }
    }

    async function handleArchiveGridKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            const itemDiv = document.activeElement;
            if (!isSelectionMode && itemDiv.classList.contains('archive-item') && archiveGrid.contains(itemDiv)) {
                event.preventDefault(); 
                const itemId = itemDiv.dataset.id;
                const archive = await getAllItems();
                const item = archive.find(i => i.id === itemId);
                if (item) populateDetailPageFromArchive(item);
            }
        }
    }
    
    // --- Settings Page Logic ---
    function handleAuth(event) {
        event.preventDefault();
        if (authPassword.value === '1234') {
            authSection.classList.add('hidden');
            promptSettingsSection.classList.remove('hidden');
            showToast('인증되었습니다.', 2000);
        } else {
            showToast('인증번호가 올바르지 않습니다.', 2000);
            authPassword.value = '';
        }
    }

    function populatePromptTextareas() {
        imagePromptTextarea.value = localStorage.getItem('customImagePrompt') || gemini.DEFAULT_IMAGE_PROMPT;
        textPromptTextarea.value = localStorage.getItem('customTextPrompt') || gemini.DEFAULT_TEXT_PROMPT;
    }

    function savePrompts() {
        savePromptsBtn.classList.add('bg-blue-800');
        setTimeout(() => savePromptsBtn.classList.remove('bg-blue-800'), 200);

        try {
            localStorage.setItem('customImagePrompt', imagePromptTextarea.value);
            localStorage.setItem('customTextPrompt', textPromptTextarea.value);
            showToast('프롬프트가 저장되었습니다.');
        } catch (e) {
            showToast('설정을 저장할 수 없습니다. 브라우저 설정을 확인해주세요.');
        }
    }
    
    function resetPrompts() {
        if (confirm('모든 프롬프트를 기본값으로 되돌리시겠습니까?')) {
            localStorage.removeItem('customImagePrompt');
            localStorage.removeItem('customTextPrompt');
            populatePromptTextareas();
            showToast('프롬프트가 기본값으로 복원되었습니다.');
        }
    }
    
    function handleGenerateImageDemo() {
        if (!imageSynthesisPromptTextarea.value.trim()) return showToast('이미지 합성을 위한 프롬프트를 입력해주세요.');
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

    archiveSelectBtn?.addEventListener('click', () => toggleSelectionMode(true));
    archiveShareBtn?.addEventListener('click', handleCreateGuidebookClick);
    archiveSettingsBtn?.addEventListener('click', showSettingsPage);

    cancelSelectionBtn?.addEventListener('click', () => toggleSelectionMode(false));
    deleteSelectedBtn?.addEventListener('click', handleDeleteSelected);
    
    archiveGrid?.addEventListener('click', handleArchiveGridClick);
    archiveGrid?.addEventListener('keydown', handleArchiveGridKeydown);
    
    authForm?.addEventListener('submit', handleAuth);
    savePromptsBtn?.addEventListener('click', savePrompts);
    resetPromptsBtn?.addEventListener('click', resetPrompts);
    generateImageBtn?.addEventListener('click', handleGenerateImageDemo);
    generateVideoBtn?.addEventListener('click', handleGenerateVideoDemo);

    initializeApp();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
              .then(reg => console.log('SW registered: ', reg))
              .catch(err => console.log('SW registration failed: ', err));
        });
    }
});