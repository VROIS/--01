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
            
            // 🎯 이미지 클릭시 상세페이지 표시 (보관함과 완전히 동일)
            itemDiv.addEventListener('click', (e) => {
                showShareDetailPage(content, index);
            });
            
            contentContainer.appendChild(itemDiv);
        });


        // 🎯 상세페이지 뒤로가기 버튼 이벤트 리스너
        const shareBackBtn = document.getElementById('shareBackBtn');
        if (shareBackBtn) {
            shareBackBtn.addEventListener('click', hideShareDetailPage);
        }

        // 🎯 상세페이지 음성 버튼 이벤트 리스너
        const shareAudioBtn = document.getElementById('shareAudioBtn');
        if (shareAudioBtn) {
            shareAudioBtn.addEventListener('click', () => {
                const currentContent = shareAudioBtn.dataset.currentContent;
                if (currentContent) {
                    const content = JSON.parse(currentContent);
                    const descElement = document.getElementById('shareDescriptionText');
                    playContentAudio(content.description, descElement, shareAudioBtn);
                }
            });
        }

        // 🎯 상세페이지 텍스트 토글 버튼 
        const shareTextToggleBtn = document.getElementById('shareTextToggleBtn');
        if (shareTextToggleBtn) {
            shareTextToggleBtn.addEventListener('click', () => {
                const textOverlay = document.getElementById('shareTextOverlay');
                textOverlay.classList.toggle('hidden');
            });
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
function showShareDetailPage(content, index) {
    // 음성 중지
    stopSpeech();
    
    // DOM 요소들 가져오기
    const detailPage = document.getElementById('shareDetailPage');
    const resultImage = document.getElementById('shareResultImage');
    const descriptionText = document.getElementById('shareDescriptionText');
    const audioBtn = document.getElementById('shareAudioBtn');
    const textOverlay = document.getElementById('shareTextOverlay');
    
    // 이미지 설정
    if (content.imageDataUrl) {
        resultImage.src = content.imageDataUrl;
    }
    
    // 설명 텍스트 설정
    if (content.description) {
        descriptionText.textContent = content.description;
        // 음성 버튼에 현재 컨텐츠 저장
        audioBtn.dataset.currentContent = JSON.stringify(content);
    }
    
    // 상세페이지 표시
    detailPage.classList.remove('hidden');
    textOverlay.classList.remove('hidden');
    
    // 🎵 자동 음성 재생 (보관함과 동일)
    if (content.description) {
        setTimeout(() => {
            playContentAudio(content.description, descriptionText, audioBtn);
        }, 300);
    }
}

// 🎯 상세페이지 숨김 함수
function hideShareDetailPage() {
    // 음성 중지
    stopSpeech();
    
    const detailPage = document.getElementById('shareDetailPage');
    detailPage.classList.add('hidden');
}

