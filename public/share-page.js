// share-page.js - Modified for Express.js backend with voice playback

// 🎵 음성 재생 시스템 변수 (보관함과 동일)
let utteranceQueue = [];
let isSpeaking = false;
let isPaused = false;
let currentlySpeakingElement = null;
let lastAudioClickTime = 0;
let textHidden = false; // 🎯 텍스트 숨김 상태
const synth = window.speechSynthesis;

document.addEventListener('DOMContentLoaded', async () => {
    const contentContainer = document.getElementById('guidebook-content');
    const loader = document.getElementById('loader');
    const descriptionEl = document.getElementById('guidebook-description');

    const showError = (message) => {
        console.error("Share page error:", message);
        if (loader) loader.classList.add('hidden');
        contentContainer.innerHTML = `
            <div class="text-center py-10">
                <div class="text-red-500 text-lg mb-4">⚠️ 오류가 발생했습니다</div>
                <p class="text-gray-700 mb-4">${message}</p>
                <button onclick="window.location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    다시 시도
                </button>
            </div>
        `;
    };

    try {
        // 🔧 [공유링크 수정] URL 쿼리 파라미터에서 ID 가져오기
        const params = new URLSearchParams(window.location.search);
        const guidebookId = params.get('id');
        const refCode = params.get('ref'); // 🔗 추천 코드 감지

        // 💰 추천 링크 처리
        if (refCode) {
            localStorage.setItem('referrer', refCode);
            console.log(`🔗 추천코드 감지: ${refCode}`);
            
            // 추천 배너 표시
            showReferralBanner(refCode);
        }

        if (!guidebookId) {
            showError('가이드북 ID를 찾을 수 없습니다. 링크가 올바른지 확인해주세요.');
            return;
        }

        // Express 서버에 GET 요청을 보냅니다.
        const response = await fetch(`/api/share?id=${guidebookId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error || `오류: ${response.status} - ${response.statusText}`;
            throw new Error(errorMessage);
        }

        const guidebook = await response.json();
        // 이제 contentIds 대신 contents 배열을 받습니다.
        const { contents, createdAt, name } = guidebook;
        
        // Open Graph URL 동적 설정 (카톡 공유 최적화)
        const currentUrl = window.location.href;
        const ogUrlMeta = document.querySelector('meta[property="og:url"]');
        if (ogUrlMeta) {
            ogUrlMeta.content = currentUrl;
        }
        
        // 가이드북 이름이 있으면 제목 업데이트
        if (name) {
            document.title = `${name} - 내손가이드`;
            const ogTitleMeta = document.querySelector('meta[property="og:title"]');
            if (ogTitleMeta) {
                ogTitleMeta.content = `${name} - 내손가이드`;
            }
        }

        if (!contents || !Array.isArray(contents) || contents.length === 0) {
            showError('이 가이드북에는 공유된 항목이 없습니다.');
            return;
        }

        if (loader) loader.classList.add('hidden');
        
        if (descriptionEl) {
            const createdDate = new Date(createdAt).toLocaleDateString('ko-KR');
            const guideName = name ? `"${name}" 가이드북은` : '이 가이드북은';
            const totalItems = contents.length;
            const displayItems = Math.min(totalItems, 30);
            const itemText = totalItems > 30 ? `${displayItems}개 콘텐츠 (총 ${totalItems}개 중)` : `${displayItems}개의 콘텐츠`;
            descriptionEl.textContent = `${guideName} ${itemText}를 포함하고 있으며, ${createdDate}에 만들어졌습니다.`;
        }

        // 🎯 3×10 모자이크 그리드로 렌더링 (최대 30개 제한)
        const maxItems = 30; // 진정한 3×10 그리드
        const limitedContents = contents.slice(0, maxItems);
        
        
        limitedContents.forEach((content, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'guidebook-item relative cursor-pointer bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden aspect-square';
            itemDiv.setAttribute('data-testid', `content-item-${index}`);


            // 🔒 XSS 방지를 위해 DOM 구조 안전하게 생성
            if (content.imageDataUrl) {
                const img = document.createElement('img');
                img.src = content.imageDataUrl;
                img.alt = `가이드 ${index + 1}`;
                img.className = 'w-full h-full object-cover';
                itemDiv.appendChild(img);
            }
            
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent';
            itemDiv.appendChild(overlay);
            
            const bottomDiv = document.createElement('div');
            bottomDiv.className = 'absolute bottom-0 left-0 right-0 p-3';
            
            const title = document.createElement('h3');
            title.className = 'text-white text-sm font-medium mb-1';
            title.textContent = `가이드 ${index + 1}`;
            
            const description = document.createElement('p');
            description.className = 'text-white text-xs leading-tight line-clamp-2';
            // 🔒 XSS 방지: textContent 사용
            const descText = content.description || '내용 없음';
            description.textContent = descText.length > 80 ? descText.substring(0, 80) + '...' : descText;
            
            bottomDiv.appendChild(title);
            bottomDiv.appendChild(description);
            itemDiv.appendChild(bottomDiv);
            
            // 🎯 이미지 클릭시 상세페이지 표시 
            itemDiv.addEventListener('click', (e) => {
                console.log('Item clicked:', index + 1, content);
                populateShareDetailPage(content, index + 1);
            });
            
            contentContainer.appendChild(itemDiv);
        });


        // 🎯 상세페이지 뒤로가기 버튼 이벤트 리스너
        console.log('Setting up detail page event listeners...');
        const shareBackBtn = document.getElementById('shareBackBtn');
        if (shareBackBtn) {
            console.log('Found shareBackBtn, adding click listener');
            shareBackBtn.addEventListener('click', () => {
                console.log('Back button clicked');
                hideShareDetailPage();
            });
        } else {
            console.log('shareBackBtn not found');
        }

        // 🎯 상세페이지 음성 버튼 이벤트 리스너
        const shareAudioBtn = document.getElementById('shareAudioBtn');
        if (shareAudioBtn) {
            console.log('Found shareAudioBtn, adding click listener');
            shareAudioBtn.addEventListener('click', () => {
                console.log('Audio button clicked');
                onShareAudioBtnClick();
            });
        } else {
            console.log('shareAudioBtn not found');
        }

        // 🎯 상세페이지 텍스트 토글 버튼 
        const shareTextToggleBtn = document.getElementById('shareTextToggleBtn');
        if (shareTextToggleBtn) {
            console.log('Found shareTextToggleBtn, adding click listener');
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
        } else {
            console.log('shareTextToggleBtn not found');
        }

    } catch (error) {
        console.error('가이드북 로딩 오류:', error);
        showError(`가이드북을 불러오는 중 오류가 발생했습니다: ${error.message}`);
    }
});

// 🔗 추천 배너 함수들
window.showReferralBanner = function(refCode) {
    const banner = document.getElementById('referralBanner');
    const referrerName = document.getElementById('referrerName');
    
    if (banner && referrerName) {
        referrerName.textContent = `${refCode}`;
        banner.classList.remove('hidden');
    }
};

window.signUpWithBonus = function() {
    // 추천인 정보를 저장하고 메인 앱으로 이동
    const referrer = localStorage.getItem('referrer');
    const params = referrer ? `?ref=${referrer}` : '';
    window.open(`/${params}`, '_blank');
};

// 🎵 음성 재생 시스템 함수들 (보관함과 100% 동일)
function queueForSpeech(text, element) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utteranceQueue.push({ utterance, element });

    if (!isSpeaking && !synth.speaking && !isPaused) {
        isSpeaking = true;
        playNextInQueue();
    }
}

function playNextInQueue() {
    if (isPaused || utteranceQueue.length === 0) {
        if (utteranceQueue.length === 0) {
            // 🔧 완전히 종료시 상태 초기화
            resetSpeechState();
        }
        return;
    }

    const { utterance, element } = utteranceQueue.shift();
    
    if(currentlySpeakingElement) {
        currentlySpeakingElement.classList.remove('speaking');
    }
    if(element) {
        element.classList.add('speaking');
        currentlySpeakingElement = element;
    }
    
    utterance.onend = () => {
        // 🔧 각 발화 종료 후에도 speaking 클래스 체크
        if(element) {
            element.classList.remove('speaking');
        }
        playNextInQueue();
    };
    
    utterance.onerror = () => {
        console.warn('Speech synthesis error');
        if(element) {
            element.classList.remove('speaking');
        }
        playNextInQueue();
    };

    synth.speak(utterance);
}

// 🔧 음성 상태 완전 초기화 함수
function resetSpeechState() {
    isSpeaking = false;
    isPaused = false;
    if(currentlySpeakingElement) {
        currentlySpeakingElement.classList.remove('speaking');
    }
    currentlySpeakingElement = null;
    // 모든 오디오 버튼을 재생 상태로 복원
    document.querySelectorAll('.audio-btn').forEach(btn => {
        updateAudioButton(btn, 'play');
    });
}

function playContentAudio(description, descriptionElement, audioBtn) {
    // 🎵 기존 음성이 재생 중이면 일시정지/재개 토글
    if (isSpeaking && !isPaused) {
        isPaused = true;
        synth.pause();
        updateAudioButton(audioBtn, 'resume');
        return;
    } else if (isSpeaking && isPaused) {
        isPaused = false;
        synth.resume();
        updateAudioButton(audioBtn, 'pause');
        return;
    }
    
    // 음성 중지 및 초기화
    stopSpeech();
    
    // 문장 단위로 나누기
    const sentences = description.match(/[^.!?]*[.!?]+/g) || [description];
    
    sentences.forEach(sentence => {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence) {
            queueForSpeech(trimmedSentence, descriptionElement);
        }
    });
    
    // 버튼 상태 업데이트
    updateAudioButton(audioBtn, 'pause');
}

function stopSpeech() {
    // 🔧 강화된 음성 중지 로직
    synth.cancel();
    utteranceQueue = [];
    
    // 안전장치: 잠시 후 다시 한 번 cancel 호출
    setTimeout(() => {
        if (synth.speaking) {
            synth.cancel();
        }
    }, 50);
    
    resetSpeechState();
}

function updateAudioButton(btn, state) {
    if (!btn) return;
    
    const iconSvg = btn.querySelector('svg');
    if (!iconSvg) return;
    
    switch(state) {
        case 'play':
            iconSvg.innerHTML = '<path d="M8 5v14l11-7z"/>'; // 재생 아이콘
            btn.title = '음성 재생';
            break;
        case 'pause':
            iconSvg.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>'; // 일시정지 아이콘
            btn.title = '음성 일시정지';
            break;
        case 'resume':
            iconSvg.innerHTML = '<path d="M8 5v14l11-7z"/>'; // 재생 아이콘
            btn.title = '음성 재개';
            break;
    }
}

// 🎯 상세페이지 표시 함수 (이미 받아온 데이터 사용)
// 🎯 [메인앱 복사] 상세페이지 표시 함수 (메인 앱의 populateDetailPageFromArchive와 동일)
function populateShareDetailPage(item, guideNumber) {
    console.log('populateShareDetailPage called:', item, guideNumber);
    // 🔧 [버그 수정 1] 중앙화된 음성 중지 로직
    stopSpeech();
    
    const shareDetailPage = document.getElementById('shareDetailPage');
    const shareResultImage = document.getElementById('shareResultImage');
    const shareDescriptionText = document.getElementById('shareDescriptionText');
    const shareTextOverlay = document.getElementById('shareTextOverlay');
    const shareDetailFooter = document.getElementById('shareDetailFooter');
    
    shareResultImage.src = item.imageDataUrl || '';
    shareResultImage.classList.toggle('hidden', !item.imageDataUrl);

    shareDescriptionText.innerHTML = '';
    
    shareTextOverlay.classList.remove('hidden');
    shareDetailFooter.classList.remove('hidden');
    
    const description = item.description || '';
    
    // 🎯 [메인앱 동일] 문장별로 나누어 span 생성 및 음성 큐 추가
    const sentences = description.match(/[^.?!]+[.?!]+/g) || [description];
    sentences.forEach(sentence => {
        if (!sentence) return;
        const span = document.createElement('span');
        span.textContent = sentence.trim() + ' ';
        shareDescriptionText.appendChild(span);
        queueForSpeech(sentence.trim(), span);
    });

    updateShareAudioButton('play');
    shareDetailPage.classList.remove('hidden');
}


// 🎯 [메인앱 복사] 중앙화된 음성 중지 (메인 앱과 동일)
function stopSpeech() {
    // 즉시 음성 중지 (타이머 없음)
    if (synth.speaking || synth.pending) {
        synth.cancel();
    }
    
    // 상태 완전 초기화
    resetSpeechState();
}

// 🎯 [메인앱 복사] 다음 문장 재생 (메인 앱과 동일)
function playNextInQueue() {
    if (isPaused || utteranceQueue.length === 0) {
        if (utteranceQueue.length === 0) {
            isSpeaking = false;
            isPaused = false;
            if(currentlySpeakingElement) currentlySpeakingElement.classList.remove('speaking');
            currentlySpeakingElement = null;
            updateShareAudioButton('play');
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

// 🎯 [메인앱 복사] 음성 재생 큐에 추가 (메인 앱과 동일)
function queueForSpeech(text, element) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utteranceQueue.push({ utterance, element });

    if (!isSpeaking && !synth.speaking && !isPaused) {
        updateShareAudioButton('pause');
        playNextInQueue();
    }
}

// 🎯 [메인앱 복사] 음성 재시작 (메인 앱과 동일)
function restartShareAudio() {
    stopSpeech(); // 중앙화된 음성 중지

    const shareDescriptionText = document.getElementById('shareDescriptionText');
    const sentences = Array.from(shareDescriptionText.querySelectorAll('span'));
    if (sentences.length === 0) {
         const description = shareDescriptionText.textContent || '';
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

// 🎯 [메인앱 복사] 오디오 버튼 클릭 처리 (메인 앱과 동일)
function handleShareAudioButtonClick() {
    if (!isSpeaking && utteranceQueue.length > 0) {
        isPaused = false;
        if (synth.paused) synth.resume();
        else playNextInQueue();
        updateShareAudioButton('pause');
    } else if (isSpeaking && !isPaused) {
        isPaused = true;
        synth.pause();
        updateShareAudioButton('resume');
    } else if (isSpeaking && isPaused) {
        isPaused = false;
        synth.resume();
        updateShareAudioButton('pause');
    }
}

// 🎯 [메인앱 복사] 오디오 버튼 더블클릭 감지 (메인 앱과 동일)
function onShareAudioBtnClick() {
    const now = Date.now();
    if (now - lastAudioClickTime < 350) {
        restartShareAudio();
    } else {
        handleShareAudioButtonClick();
    }
    lastAudioClickTime = now;
}

// 🎯 [메인앱 복사] 오디오 버튼 상태 업데이트 (메인 앱과 동일)
function updateShareAudioButton(state) {
const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.648c1.295.748 1.295 2.538 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>';
const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6.75 5.25a.75 .75 0 01.75-.75H9a.75 .75 0 01.75.75v13.5a.75 .75 0 01-.75.75H7.5a.75 .75 0 01-.75-.75V5.25zm7.5 0a.75 .75 0 01.75-.75h1.5a.75 .75 0 01.75.75v13.5a.75 .75 0 01-.75.75h-1.5a.75 .75 0 01-.75-.75V5.25z" clip-rule="evenodd" /></svg>';
const loadingIcon = '<div class="w-8 h-8 rounded-full animate-spin loader-blue"></div>';

    const shareAudioBtn = document.getElementById('shareAudioBtn');
    if (!shareAudioBtn) return;

    shareAudioBtn.disabled = state === 'loading' || state === 'disabled';
    
    switch (state) {
        case 'play':
        case 'resume':
            shareAudioBtn.innerHTML = playIcon;
            shareAudioBtn.setAttribute('aria-label', '오디오 재생');
            break;
        case 'pause':
            shareAudioBtn.innerHTML = pauseIcon;
            shareAudioBtn.setAttribute('aria-label', '오디오 일시정지');
            break;
        case 'loading':
            shareAudioBtn.innerHTML = loadingIcon;
             shareAudioBtn.setAttribute('aria-label', '오디오 로딩 중');
            break;
        case 'disabled':
             shareAudioBtn.innerHTML = playIcon;
             shareAudioBtn.setAttribute('aria-label', '오디오 재생 불가');
            break;
    }
}

// 🎯 상세페이지 숨김 함수
function hideShareDetailPage() {
    // 음성 중지
    stopSpeech();
    
    const detailPage = document.getElementById('shareDetailPage');
    detailPage.classList.add('hidden');
}


