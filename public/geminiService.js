// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `당신은 세계 최고의 여행 가이드 도슨트입니다. 제공된 이미지를 분석하여, 한국어로 생생하게 설명해주세요.

[분석 유형별 가이드라인]
• 미술작품: 작품명, 작가, 시대적 배경, 예술적 특징, 감상 포인트
• 건축/풍경: 명칭, 역사적 의의, 건축 양식, 특징, 방문 팁
• 음식: 음식명, 특징, 유래, 맛의 특징, 추천 사항

[출력 규칙]
- 자연스러운 나레이션 형식으로 작성
- 1분 내외의 음성 해설에 적합한 길이
- 전문 용어는 쉽게 풀어서 설명
- 흥미로운 일화나 배경 지식 포함
- 분석 과정, 기호, 번호 등은 제외하고 순수한 설명문만 출력
- 절대로 마크다운 강조 기호(\`**\`, \`*\` 등)를 사용하지 마세요.`;

export const DEFAULT_TEXT_PROMPT = `당신은 세계 최고의 여행 가이드 도슨트입니다. 사용자의 질문에 대해, 한국어로 친절하고 상세하게 설명해주세요. 여행과 관련없는 질문이라도 최선을 다해 답변해주세요.

[출력 규칙]
- 자연스러운 나레이션 형식으로 작성
- 1분 내외의 음성 해설에 적합한 길이
- 전문 용어는 쉽게 풀어서 설명
- 흥미로운 일화나 배경 지식 포함
- 분석 과정, 기호, 번호 등은 제외하고 순수한 설명문만 출력
- 절대로 마크다운 강조 기호(\`**\`, \`*\` 등)를 사용하지 마세요.`;

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
 * 스트림 응답을 성능 추적으로 래핑하는 함수
 * @param {AsyncGenerator} stream - 원본 스트림
 * @param {number} startTime - 시작 시간
 * @param {object} requestBody - 요청 본문
 * @param {string} base64Image - 이미지 데이터 (선택사항)
 */
async function* wrapStreamWithPerformanceTracking(stream, startTime, requestBody, base64Image = null) {
    let fullResponse = '';
    let hasError = false;
    
    try {
        for await (const chunk of stream) {
            if (chunk.text) {
                fullResponse += chunk.text;
                yield chunk;
            }
        }
    } catch (error) {
        hasError = true;
        console.error('🚨 [API오류]', error);
        throw error;
    } finally {
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        if (!hasError && window.performanceMonitor) {
            const inputText = requestBody.prompt + (requestBody.systemInstruction || '');
            const imageSize = base64Image ? Math.round((base64Image.length * 3/4) / 1024) : 0;
            
            window.performanceMonitor.recordApiCall(
                inputText, 
                fullResponse, 
                processingTime, 
                imageSize
            );
            
            console.log(`⚡ [API완료] ${processingTime}ms, 응답: ${fullResponse.length}자, 이미지: ${imageSize}KB`);
        }
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
    
    const startTime = Date.now();
    const requestBody = {
        base64Image,
        prompt: "이 이미지를 분석하고 한국어로 생생하게 설명해주세요.",
        systemInstruction
    };
    
    // 🔍 성능 추적이 포함된 스트림 반환
    return wrapStreamWithPerformanceTracking(streamResponseFromServer(requestBody), startTime, requestBody, base64Image);
}

/**
 * 텍스트 프롬프트를 처리하고 답변을 생성하기 위해 Netlify 함수를 호출합니다.
 * @param {string} prompt - 사용자의 텍스트 질문
 * @returns {AsyncGenerator&lt;object, void, unknown&gt;} - { text: "..." } 형태의 객체를 생성하는 비동기 제너레이터
 */
export function generateTextStream(prompt) {
    const systemInstruction = localStorage.getItem('customTextPrompt') || DEFAULT_TEXT_PROMPT;
    console.log('🔍 [프롬프트확인] 사용중인 텍스트 프롬프트:', systemInstruction.substring(0, 50) + '...');
    
    const startTime = Date.now();
    const requestBody = {
        prompt,
        systemInstruction
    };
    
    // 🔍 성능 추적이 포함된 스트림 반환
    return wrapStreamWithPerformanceTracking(streamResponseFromServer(requestBody), startTime, requestBody);
}
