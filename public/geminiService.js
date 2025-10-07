// geminiservice.js

/**
 * ⚡ 프롬프트 최적화 로직 - AI Agent (2025-10-07)
 * 
 * 🎯 최종 결정: v10 균형 프롬프트 (38자)
 * 👤 사용자: 25년차 파리 가이드 (80일 독학 개발)
 * 🤝 완벽한 동의: 속도 vs 품질 테스트 후 38자 선택
 * 
 * 📊 최적화 여정:
 * - v5: 원본 프롬프트 (10초 후킹 전략 성공)
 * - v7: 50자로 압축 (속도 향상, 품질 유지)
 * - v8: Gemini 2.5 Flash-Lite 적용 (2.5배 빠름)
 * - v9: 28자로 극압축 (0.5초 빨라짐, 디테일 손실)
 * - v10: 38자 균형점 (속도 2-2.5초, 디테일 복원) ✅
 * 
 * 🔑 핵심 인사이트:
 * 1. "전문가이드" = AI가 전문성 유지
 * 2. "디테일중요" = 깊이 있는 설명 유도
 * 3. 야사→한국→상세 = 10초 후킹 구조
 * 4. 400-500자 = 음성 1분 30초~2분 (최적)
 * 
 * ⚠️ 후임자에게:
 * - 프롬프트 길이 = 속도/품질 트레이드오프
 * - 28자 미만: 너무 빠르지만 얕음
 * - 50자 이상: 깊지만 느림
 * - 38자: 최적 균형점 (검증됨)
 */
export const DEFAULT_IMAGE_PROMPT = `전문가이드.한국어.

야사→연도한국비교→상세
400-500자.디테일중요

금지:인사마무리`;

export const DEFAULT_TEXT_PROMPT = `전문가이드.한국어.

비화→역사한국비교→팁
400-500자.디테일중요

금지:인사마무리`;

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
