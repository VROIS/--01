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
        
        console.log('🔍 Received shareData:', shareData);
        console.log('🔍 shareData.name:', shareData.name);
        console.log('🔍 shareData.linkName:', shareData.linkName);
        console.log('🔍 shareData keys:', Object.keys(shareData));
        
        // 🔄 오프라인 지원: 로컬스토리지에 데이터 저장
        try {
            localStorage.setItem(`share-${shareId}`, JSON.stringify(shareData));
            console.log('💾 공유 데이터를 로컬스토리지에 저장했습니다:', shareId);
        } catch (e) {
            console.warn('로컬스토리지 저장 실패:', e);
        }
        
        if (!shareData || !shareData.contents || shareData.contents.length === 0) {
            throw new Error('유효하지 않은 공유 데이터입니다.');
        }

        // 🔥 새로운 헤더 시스템 적용
        const titleEl = document.getElementById('guidebook-title');
        const locationEl = document.getElementById('guidebook-location');
        const createdDateEl = document.getElementById('guidebook-created-date');
        
        // 링크 이름을 타이틀로 사용
        const linkName = shareData.name || shareData.linkName || '공유된 가이드북';
        titleEl.textContent = linkName;
        
        // 🔥 페이지 타이틀과 메타태그 동적 업데이트
        document.title = `${linkName} - 내손가이드`;
        document.getElementById('page-title').textContent = `${linkName} - 내손가이드`;
        document.getElementById('og-title').setAttribute('content', `${linkName} - 내손가이드`);
        document.getElementById('twitter-title').setAttribute('content', `${linkName} - 내손가이드`);
        
        // GPS 위치 정보 표시 (사진촬영시만, 업로드시 제외)
        if (shareData.location && shareData.location.trim() !== '') {
            locationEl.textContent = `📍 ${shareData.location}`;
            locationEl.style.display = 'block';
        } else {
            locationEl.style.display = 'none';
        }
        
        // 생성일자 표시 (인간적인 형태로)
        if (shareData.createdAt) {
            const date = new Date(shareData.createdAt);
            const formattedDate = date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            createdDateEl.textContent = `${formattedDate}에 생성`;
        }

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
        
        // 🔗 사용자 요청: 하단 버튼 기능 추가
        setupSharePageButtons(shareData, shareId);

    } catch (error) {
        console.error('가이드북 로딩 오류:', error);
        
        // 🔄 오프라인 지원: 로컬스토리지에서 데이터 복구 시도
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const shareId = urlParams.get('id');
            const cachedData = localStorage.getItem(`share-${shareId}`);
            
            if (cachedData) {
                const shareData = JSON.parse(cachedData);
                console.log('📦 오프라인 모드: 로컬스토리지에서 데이터 복구:', shareId);
                
                // 타이틀과 설명 설정
                descriptionEl.textContent = shareData.name || '공유된 가이드북 (오프라인)';
                
                // 로더 숨기고 그리드 생성
                loader.style.display = 'none';
                
                shareData.contents.forEach((content, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'archive-item cursor-pointer';
                    itemDiv.dataset.id = `content-item-${index}`;

                    const img = document.createElement('img');
                    img.src = content.imageDataUrl;
                    img.alt = content.description.substring(0, 30);
                    img.loading = 'lazy';
                    img.className = 'w-full h-full object-cover aspect-square';

                    itemDiv.appendChild(img);
                    contentContainer.appendChild(itemDiv);

                    itemDiv.addEventListener('click', () => {
                        console.log('Item clicked (offline):', content);
                        populateShareDetailPage(content);
                    });
                });

                setupDetailPageEventListeners();
                return; // 성공적으로 복구됨
            }
        } catch (localError) {
            console.warn('로컬스토리지 복구 실패:', localError);
        }
        
        // 로컬스토리지에서도 복구 실패
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
    const shareLoader = document.getElementById('shareLoader');
    const shareLoadingHeader = document.getElementById('shareLoadingHeader');
    const shareDetailFooter = document.getElementById('shareDetailFooter');
    
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
    
    // 보관함과 100% 동일한 요소 표시/숨김 순서
    shareLoader.classList.add('hidden');
    shareTextOverlay.classList.remove('hidden');
    shareTextOverlay.classList.remove('animate-in');
    shareLoadingHeader.classList.add('hidden');
    shareDetailFooter.classList.remove('hidden');
    
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
    
    // 상세페이지 표시 (보관함과 동일)
    shareDetailPage.classList.add('visible');
}

function hideShareDetailPage() {
    console.log('hideShareDetailPage called');
    stopSpeech(); // 보관함과 동일한 음성 중지
    
    const shareDetailPage = document.getElementById('shareDetailPage');
    if (shareDetailPage) {
        shareDetailPage.classList.remove('visible');
    }
}

// 이벤트 리스너 설정 함수
function setupDetailPageEventListeners() {
    const shareBackBtn = document.getElementById('shareBackBtn');
    const shareAudioBtn = document.getElementById('shareAudioBtn');
    const shareTextToggleBtn = document.getElementById('shareTextToggleBtn');
    const shareHomeBtn = document.getElementById('shareHomeBtn');
    
    console.log('Found shareBackBtn:', !!shareBackBtn);
    console.log('Found shareAudioBtn:', !!shareAudioBtn);
    console.log('Found shareTextToggleBtn:', !!shareTextToggleBtn);
    console.log('Found shareHomeBtn:', !!shareHomeBtn);
    
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
    
    if (shareHomeBtn) {
        shareHomeBtn.addEventListener('click', () => {
            console.log('Home button clicked');
            window.open('/', '_blank');
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

// 🔗 사용자 요청: 하단 버튼 기능 구현
function setupSharePageButtons(shareData, shareId) {
    console.log('🔗 하단 버튼 기능 설정 중...');
    
    // 1. 링크 복사 버튼
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', async () => {
            const shareUrl = window.location.href;
            try {
                await navigator.clipboard.writeText(shareUrl);
                copyLinkBtn.textContent = '✅ 복사됨!';
                setTimeout(() => {
                    copyLinkBtn.textContent = '🔗 링크 복사';
                }, 2000);
            } catch (err) {
                console.error('클립보드 복사 실패:', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                copyLinkBtn.textContent = '✅ 복사됨!';
                setTimeout(() => {
                    copyLinkBtn.textContent = '🔗 링크 복사';
                }, 2000);
            }
        });
    }
    
    // 2. HTML 다운로드 버튼 (사용자 요청: 오프라인 HTML 파일 생성)
    const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
    if (downloadHtmlBtn) {
        downloadHtmlBtn.addEventListener('click', () => {
            generateAndDownloadHtml(shareData, shareId);
        });
    }
    
    // 3. 카카오톡 공유 버튼
    const shareKakaoBtn = document.getElementById('shareKakaoBtn');
    if (shareKakaoBtn) {
        shareKakaoBtn.addEventListener('click', () => {
            const shareUrl = window.location.href;
            const linkName = shareData.name || shareData.linkName || '공유된 가이드북';
            
            // 카카오톡 앱이 설치된 경우 앱으로 공유
            if (navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone')) {
                const kakaoUrl = `kakaotalk://share?text=${encodeURIComponent(`${linkName} - 내손가이드`)}&url=${encodeURIComponent(shareUrl)}`;
                window.location.href = kakaoUrl;
            } else {
                // 웹에서는 링크 복사로 대체
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('링크가 복사되었습니다. 카카오톡에 붙여넣기 하세요!');
                }).catch(() => {
                    alert(`다음 링크를 복사해서 카카오톡에 공유하세요:\n${shareUrl}`);
                });
            }
        });
    }
}

// 🔗 사용자 요청: HTML 파일 다운로드 기능 (오프라인 지원)
function generateAndDownloadHtml(shareData, shareId) {
    console.log('📥 HTML 파일 생성 중...', shareData);
    
    const linkName = shareData.name || shareData.linkName || '공유된 가이드북';
    const currentDate = new Date().toLocaleDateString('ko-KR');
    
    // HTML 템플릿 생성 (Base64 이미지 포함으로 완전 오프라인)
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${linkName} - 내손가이드 (오프라인)</title>
    <meta name="description" content="${linkName} - 오프라인에서도 볼 수 있는 여행 가이드북">
    <style>
        body { font-family: 'MaruBuri', sans-serif; background: #FFFEFA; margin: 0; padding: 16px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 2rem; }
        .title { font-size: 1.8rem; font-weight: bold; color: #1f2937; margin-bottom: 0.5rem; }
        .meta { color: #6b7280; font-size: 0.9rem; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .item { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .item img { width: 100%; aspect-ratio: 1; object-fit: cover; }
        .item-desc { padding: 1rem; font-size: 0.9rem; line-height: 1.6; }
        .footer { text-align: center; margin-top: 3rem; color: #9ca3af; font-size: 0.8rem; }
        .offline-notice { background: #f3f4f6; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="offline-notice">
            📱 <strong>오프라인 버전</strong> - 인터넷 연결 없이도 볼 수 있습니다
        </div>
        
        <header class="header">
            <h1 class="title">${linkName}</h1>
            <div class="meta">
                ${shareData.location ? `📍 ${shareData.location}` : ''}
                ${shareData.createdAt ? ` | ${new Date(shareData.createdAt).toLocaleDateString('ko-KR')}에 생성` : ''}
            </div>
        </header>
        
        <main class="grid">
            ${shareData.contents.map((content, index) => `
                <div class="item">
                    <img src="${content.imageDataUrl}" alt="가이드 이미지 ${index + 1}" loading="lazy">
                    <div class="item-desc">${content.description}</div>
                </div>
            `).join('')}
        </main>
        
        <footer class="footer">
            <p>손안에 가이드 - ${currentDate} 다운로드</p>
            <p>온라인 버전: <a href="${window.location.href}">${window.location.href}</a></p>
        </footer>
    </div>
</body>
</html>`;

    // 파일 다운로드
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${linkName.replace(/[^a-zA-Z0-9가-힣\s]/g, '')}_${shareId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📥 HTML 파일 다운로드 완료!');
    
    // 버튼 상태 변경
    const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
    if (downloadHtmlBtn) {
        downloadHtmlBtn.textContent = '✅ 다운로드됨!';
        setTimeout(() => {
            downloadHtmlBtn.textContent = '📥 HTML 다운로드';
        }, 3000);
    }
}