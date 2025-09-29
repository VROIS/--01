document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 가져오기 ---
    const cameraView = document.getElementById('camera-view');
    const resultView = document.getElementById('result-view');
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const resultImage = document.getElementById('result-image');
    const resultText = document.getElementById('result-text');
    const loader = document.getElementById('loader');

    // 버튼
    const shootBtn = document.getElementById('shoot-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadInput = document.getElementById('upload-input');
    const micBtn = document.getElementById('mic-btn');
    const backBtn = document.getElementById('back-btn');

    // --- 상태 변수 ---
    let stream = null;

    // --- 핵심 로직: Gemini API 호출 (Netlify Function 경유) ---
    // 이 함수는 import/export 없이 이 파일 내에서 직접 사용됩니다.
    async function getAIGeneratedText(base64Image, prompt) {
        loader.classList.remove('hidden');
        try {
            // 우리 서버의 '백엔드 대리인'에게 요청을 보냅니다.
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64Image: base64Image,
                    prompt: prompt,
                    // 기본 시스템 프롬프트를 여기에 포함시킬 수 있습니다.
                    systemInstruction: '당신은 세계 최고의 여행 가이드입니다. 제공된 이미지를 한국어로 생생하게 설명해주세요.'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '서버에서 오류가 발생했습니다.');
            }

            const data = await response.json();
            return data.text;

        } catch (error) {
            console.error("API 호출 오류:", error);
            return "해설을 생성하는 데 실패했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.";
        } finally {
            loader.classList.add('hidden');
        }
    }


    // --- 카메라 및 UI 제어 ---
    async function startCamera() {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
        } catch (err) {
            console.error("카메라 시작 오류:", err);
            alert("카메라를 시작할 수 없습니다. 권한을 확인해주세요.");
        }
    }

    function showView(viewToShow) {
        if (viewToShow === 'result') {
            cameraView.classList.add('hidden');
            resultView.classList.add('visible');
        } else {
            cameraView.classList.remove('hidden');
            resultView.classList.remove('visible');
            startCamera(); // 메인 화면으로 돌아올 때 카메라 다시 시작
        }
    }

    async function processImage(dataUrl) {
        showView('result');
        resultImage.src = dataUrl;
        resultText.textContent = ''; // 이전 텍스트 초기화

        const base64Image = dataUrl.split(',')[1];
        const aiText = await getAIGeneratedText(base64Image, "이 이미지를 설명해줘");
        resultText.textContent = aiText;
    }


    // --- 이벤트 리스너 설정 ---
    shootBtn.addEventListener('click', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        processImage(dataUrl);
    });

    uploadBtn.addEventListener('click', () => {
        uploadInput.click();
    });

    uploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                processImage(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    });

    backBtn.addEventListener('click', () => {
        showView('camera');
    });


    // --- 앱 시작 ---
    showView('camera'); // 앱 시작 시 카메라 화면부터 보여주기
});