// DOM 요소가 모두 로드된 후에 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', function () {

    // HTML에서 필요한 요소들을 가져옵니다.
    const promptInput = document.getElementById('prompt-input');
    const generateButton = document.getElementById('generate-button');
    const resultText = document.getElementById('result-text');
    const clipboardButton = document.getElementById('clipboard-button');

    let generatedContent = ''; // AI가 생성한 콘텐츠를 저장할 변수

    // '공유 링크 생성' 버튼에 클릭 이벤트 리스너를 추가합니다.
    generateButton.addEventListener('click', async function () {
        const prompt = promptInput.value;

        // 프롬프트가 비어있는지 확인합니다.
        if (!prompt.trim()) {
            alert('공유할 내용을 입력해주세요.');
            return;
        }

        // 로딩 상태를 UI에 표시합니다.
        generateButton.disabled = true;
        generateButton.textContent = '생성 중...';
        resultText.textContent = 'AI가 답변을 생성하고 있습니다. 잠시만 기다려주세요...';
        clipboardButton.style.display = 'none';

        try {
            // Netlify Function API에 POST 요청을 보냅니다.
            // '/api/gemini'는 Netlify의 리다이렉트 설정을 통해
            // '/.netlify/functions/api/gemini'로 자동 연결됩니다.
            const response = await fetch('/.netlify/functions/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // 요청 본문에 프롬프트를 담아 JSON 문자열로 보냅니다.
                body: JSON.stringify({ prompt: prompt }),
            });

            // 응답이 성공적이지 않을 경우 에러를 처리합니다.
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '알 수 없는 오류가 발생했습니다.');
            }

            const data = await response.json();
            generatedContent = data.text; // 결과를 변수에 저장

            // 결과를 화면에 표시합니다.
            resultText.textContent = generatedContent;
            clipboardButton.style.display = 'block'; // 복사 버튼을 보여줍니다.

        } catch (error) {
            // 에러 발생 시 사용자에게 알립니다.
            resultText.textContent = '오류가 발생했습니다: ' + error.message;
            console.error('API 요청 오류:', error);
        } finally {
            // 로딩 상태를 해제합니다.
            generateButton.disabled = false;
            generateButton.textContent = '공유 링크 생성';
        }
    });

    // '클립보드에 복사' 버튼에 클릭 이벤트 리스너를 추가합니다.
    clipboardButton.addEventListener('click', function() {
        if (!generatedContent) {
            alert('복사할 내용이 없습니다.');
            return;
        }

        // navigator.clipboard API를 사용하여 텍스트를 복사합니다.
        navigator.clipboard.writeText(generatedContent).then(function() {
            alert('AI가 생성한 답변이 클립보드에 복사되었습니다!');
        }, function(err) {
            alert('클립보드 복사에 실패했습니다. 수동으로 복사해주세요.');
            console.error('클립보드 복사 오류:', err);
        });
    });
});