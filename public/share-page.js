// === 보관함 코드를 그대로 복사한 공유 페이지 ===

// TTS State - 보관함과 100% 동일
const synth = window.speechSynthesis;
let utteranceQueue = [];
let isSpeaking = false;
let isPaused = false;
let currentlySpeakingElement = null;
let lastAudioClickTime = 0;
let textHidden = false;

// 공유 페이지 로딩
document.addEventListener('DOMContentLoaded', async () => {
    const contentContainer = document.getElementById('guidebook-content');
    const loader = document.getElementById('loader');
    const descriptionEl = document.getElementById('guidebook-description');

    const showError = (message) => {
        loader.style.display = 'none';
        contentContainer.innerHTML = `<div class="text-center py-10 text-red-600">${message}</div>`;
    };

    try {
        // 공유 ID 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('id');

        if (!shareId) {
            throw new Error('공유 ID가 없습니다.');
        }

        // API에서 데이터 가져오기
        const response = await fetch(`/api/share?id=${shareId}`);
        if (!response.ok) {
            throw new Error('공유된 가이드북을 찾을 수 없습니다.');
        }

        const shareData = response.json ? await response.json() : response;
        
        console.log('Received shareData:', shareData);
        
        if (!shareData || !shareData.contents || shareData.contents.length === 0) {
            throw new Error('유효하지 않은 공유 데이터입니다.');
        }

        // 타이틀과 설명 설정
        descriptionEl.textContent = shareData.name || '공유된 가이드북';

        // 로더 숨기고 그리드 생성 - 보관함과 동일한 방식
        loader.style.display = 'none';

        shareData.contents.forEach((content, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'archive-item cursor-pointer'; // 보관함과 동일한 클래스
            itemDiv.dataset.id = `content-item-${index}`;

            const img = document.createElement('img');
            img.src = content.imageDataUrl;
            img.alt = content.description.substring(0, 30);
            img.loading = 'lazy';
            img.className = 'w-full h-full object-cover aspect-square'; // 보관함과 동일한 스타일

            itemDiv.appendChild(img);
            contentContainer.appendChild(itemDiv);

            // 보관함과 동일한 클릭 이벤트
            itemDiv.addEventListener('click', () => {
                console.log('Item clicked:', content);
                populateShareDetailPage(content);
            });
        });

        console.log('Setting up detail page event listeners...');
        // 상세페이지 이벤트 리스너 - 보관함과 100% 동일
        setupDetailPageEventListeners();

    } catch (error) {
        console.error('가이드북 로딩 오류:', error);
        showError(`가이드북을 불러오는 중 오류가 발생했습니다: ${error.message}`);
    }
});

// === 보관함에서 그대로 복사한 TTS 시스템 ===
function resetSpeechState() {
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

function stopSpeech() {
    // 즉시 음성 중지 (타이머 없음)
    if (synth.speaking || synth.pending) {
        synth.cancel();
    }
    
    // 상태 완전 초기화
    resetSpeechState();
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

function restartAudio() {
    stopSpeech();
    
    const descriptionText = document.getElementById('shareDescriptionText');
    if (!descriptionText) return;

    const spans = Array.from(descriptionText.querySelectorAll('span'));
    spans.forEach(span => {
        const text = span.textContent.trim();
        if (text) {
            queueForSpeech(text, span);
        }
    });
    updateAudioButton('pause');
}

function handleAudioButtonClick() {
    if (!isSpeaking && !isPaused && utteranceQueue.length === 0) {
        restartAudio();
    } else if (isSpeaking && !isPaused) {
        isPaused = true;
        synth.pause();
        updateAudioButton('play');
    } else if (isSpeaking && isPaused) {
        isPaused = false;
        synth.resume();
        updateAudioButton('pause');
    }
}

function onShareAudioBtnClick() {
    const now = Date.now();
    if (now - lastAudioClickTime < 350) {
        restartAudio();
    } else {
        handleAudioButtonClick();
    }
    lastAudioClickTime = now;
}

function updateAudioButton(state) {
    const audioBtn = document.getElementById('shareAudioBtn');
    if (!audioBtn) return;
    
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

// === 보관함의 populateDetailPageFromArchive를 그대로 복사 ===
function populateShareDetailPage(item) {
    console.log('populateShareDetailPage called:', item);
    
    // 보관함과 100% 동일한 음성 중지 로직
    stopSpeech();
    
    const shareDetailPage = document.getElementById('shareDetailPage');
    const shareResultImage = document.getElementById('shareResultImage');
    const shareDescriptionText = document.getElementById('shareDescriptionText');
    const shareTextOverlay = document.getElementById('shareTextOverlay');
    
    if (!shareDetailPage || !shareResultImage || !shareDescriptionText) {
        console.error('Required share page elements not found');
        return;
    }
    
    // 이미지 설정
    shareResultImage.src = item.imageDataUrl || '';
    shareResultImage.classList.toggle('hidden', !item.imageDataUrl);

    // 친화적 배경 제거 (보관함과 동일)
    shareDetailPage.classList.remove('bg-friendly');

    // 텍스트 초기화
    shareDescriptionText.innerHTML = '';
    
    // 오버레이 표시 (보관함과 동일)
    shareTextOverlay.classList.remove('hidden');
    shareTextOverlay.classList.remove('animate-in');
    
    const description = item.description || '';
    
    // 보관함과 100% 동일한 문장 분할 및 TTS 큐 설정
    const sentences = description.match(/[^.?!]+[.?!]+/g) || [description];
    sentences.forEach(sentence => {
        if (!sentence) return;
        const span = document.createElement('span');
        span.textContent = sentence.trim() + ' ';
        shareDescriptionText.appendChild(span);
        queueForSpeech(sentence.trim(), span);
    });

    updateAudioButton('play');
    
    // 상세페이지 표시
    shareDetailPage.classList.remove('hidden');
}

function hideShareDetailPage() {
    console.log('hideShareDetailPage called');
    stopSpeech(); // 보관함과 동일한 음성 중지
    
    const shareDetailPage = document.getElementById('shareDetailPage');
    if (shareDetailPage) {
        shareDetailPage.classList.add('hidden');
    }
}

// 이벤트 리스너 설정 함수
function setupDetailPageEventListeners() {
    const shareBackBtn = document.getElementById('shareBackBtn');
    const shareAudioBtn = document.getElementById('shareAudioBtn');
    const shareTextToggleBtn = document.getElementById('shareTextToggleBtn');
    
    console.log('Found shareBackBtn:', !!shareBackBtn);
    console.log('Found shareAudioBtn:', !!shareAudioBtn);
    console.log('Found shareTextToggleBtn:', !!shareTextToggleBtn);
    
    if (shareBackBtn) {
        shareBackBtn.addEventListener('click', () => {
            console.log('Back button clicked');
            hideShareDetailPage();
        });
    }
    
    if (shareAudioBtn) {
        shareAudioBtn.addEventListener('click', () => {
            console.log('Audio button clicked');
            onShareAudioBtnClick();
        });
    }
    
    if (shareTextToggleBtn) {
        shareTextToggleBtn.addEventListener('click', () => {
            console.log('Text toggle button clicked');
            const textOverlay = document.getElementById('shareTextOverlay');
            if (textOverlay) {
                textOverlay.classList.toggle('hidden');
                console.log('Text overlay toggled, hidden:', textOverlay.classList.contains('hidden'));
            } else {
                console.log('shareTextOverlay not found');
            }
        });
    }
}

// Global 함수 노출 (테스트용)
window.populateShareDetailPage = populateShareDetailPage;
window.hideShareDetailPage = hideShareDetailPage;
window.setupDetailPageEventListeners = setupDetailPageEventListeners;
window.onShareAudioBtnClick = onShareAudioBtnClick;

// 추천 배너 함수들 (기존 유지)
window.showReferralBanner = function(refCode) {
    const banner = document.getElementById('referralBanner');
    const referrerName = document.getElementById('referrerName');
    
    if (banner && referrerName) {
        referrerName.textContent = `${refCode}`;
        banner.classList.remove('hidden');
    }
};

window.signUpWithBonus = function() {
    const referrer = localStorage.getItem('referrer');
    const params = referrer ? `?ref=${referrer}` : '';
    window.open(`/${params}`, '_blank');
};