// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `가이드.한국어
야사→연도/한국→상세
400-500자
금지:인사,마무리`;

export const DEFAULT_TEXT_PROMPT = `가이드.한국어
비화→역사/한국→팁
400-500자
금지:인사,마무리`;

/**
 * Netlify 서버 함수로 요청을 보내고 스트리밍 응답을 처리하는 비동기 제너레이터 함수입니다.
 * @param {object} body - Netlify 함수로 보낼 요청 본문 (JSON)
 * @returns {AsyncGenerator&lt;object, void, unknown&gt;} - { text: "..." } 형태의 객체를 생성하는 비동기 제너레이터
 */
async function* streamResponseFromServer(body) {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) {
            const errorData = await response.json().catch(() => ({ error: `서버 오류: ${response.status}` }));
            throw new Error(errorData.error || `서버에서 응답을 받을 수 없습니다.`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            // 원래 SDK의 스트림 청크와 유사한 객체를 생성합니다.
            yield { text: decoder.decode(value, { stream: true }) };
        }
    } catch (error) {
        console.error("Netlify 함수 fetch 오류:", error);
        // UI에 표시될 수 있도록 오류 메시지 청크를 생성합니다.
        yield { text: `\n[오류: 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.]` };
    }
}



/**
 * 이미지를 분석하고 설명을 생성하기 위해 Netlify 함수를 호출합니다.
 * @param {string} base64Image - Base64로 인코딩된 이미지 데이터
 * @returns {AsyncGenerator&lt;object, void, unknown&gt;} - { text: "..." } 형태의 객체를 생성하는 비동기 제너레이터
 */
export function generateDescriptionStream(base64Image) {
    const systemInstruction = localStorage.getItem('customImagePrompt') || DEFAULT_IMAGE_PROMPT;
    console.log('🔍 [프롬프트확인] 사용중인 이미지 프롬프트:', systemInstruction.substring(0, 50) + '...');
    
    const requestBody = {
        base64Image,
        prompt: "이 이미지를 분석하고 한국어로 생생하게 설명해주세요.",
        systemInstruction
    };
    
    return streamResponseFromServer(requestBody);
}

/**
 * 텍스트 프롬프트를 처리하고 답변을 생성하기 위해 Netlify 함수를 호출합니다.
 * @param {string} prompt - 사용자의 텍스트 질문
 * @returns {AsyncGenerator&lt;object, void, unknown&gt;} - { text: "..." } 형태의 객체를 생성하는 비동기 제너레이터
 */
export function generateTextStream(prompt) {
    const systemInstruction = localStorage.getItem('customTextPrompt') || DEFAULT_TEXT_PROMPT;
    console.log('🔍 [프롬프트확인] 사용중인 텍스트 프롬프트:', systemInstruction.substring(0, 50) + '...');
    
    const requestBody = {
        prompt,
        systemInstruction
    };
    
    return streamResponseFromServer(requestBody);
}
