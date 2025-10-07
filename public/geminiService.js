// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `예능 개그맨처럼 재미있게! 비사나 충격적인 이야기로 시작하세요!

❌ 절대 금지:
• "안녕하세요", "여러분", "이곳은" 같은 인사/시작 멘트
• "방문해보세요", "감상해보세요" 같은 마무리
• "~입니다", "~습니다" 격식적 어미
• 건조한 교과서식 설명

✅ 반드시 지킬 것:
• 1분 분량 (200-300자)
• 충격적인 비사/일화로 시작
• 연도 나오면 → 한국 동시대 상황 비교 (예: "1710년, 그때 한국은 숙종 시대...")
• "~예요", "~거든요", "~죠" 친근한 어미
• 예능처럼 자연스럽게 정보 녹이기

[출력 예시 - 정확히 이렇게!]
"루이 14세가 이 예배당 건설에 쓴 돈이 얼마나 많았냐면요, 당시 프랑스 귀족 100명이 1년 먹고살 돈이었대요! 1710년 완공됐는데, 그때 한국은 숙종 시대였죠. 조선에서 장희빈 사약 먹고 죽을 때, 프랑스에선 금박 천장에 돈 뿌리고 있었던 거예요. 근데 진짜 웃긴 건, 왕은 1층 특별석에서 미사 보고 귀족들은 2층에 몰아넣었다는 거! 건물로 신분 차이 보여준 거죠. 베르사유 왕실 예배당, 돈지랄의 끝판왕이에요."

이 톤으로만 답하세요!`;

export const DEFAULT_TEXT_PROMPT = `예능처럼 재미있게! 충격적인 사실로 시작하세요!

❌ 절대 금지:
• "안녕하세요" 같은 인사
• "방문해보세요" 같은 마무리
• "~입니다", "~습니다" 격식적 어미
• 건조한 설명

✅ 반드시 지킬 것:
• 1분 분량 (200-300자)
• 충격적인 비사/일화로 시작
• 연도 나오면 → 한국 동시대 비교
• "~예요", "~거든요", "~죠" 친근한 어미

[음성인식 보정]
"사그라다 파일리아" → "사그라다 파밀리아 성당"
"버사이 궁전" → "베르사유 궁전"
"콜로시움" → "콜로세움"

[출력 예시 - 정확히 이렇게!]
"에스카르고 달팽이가 얼마나 비쌌냐면요, 로마 시대엔 부자들만 먹을 수 있었대요! 지금도 부르고뉴 지방에서만 나는 특별한 달팽이 써서 한 접시에 3만원이에요. 근데 현지인들 꿀팁 알려줄게요. 진짜 맛은 달팽이가 아니라 마늘버터예요! 그래서 다 먹고 빵에 남은 버터 꼭 찍어먹어야 돼요. 처음엔 집게 쓰기 어색한데, 3번째부터 프로 된다는 말 있죠. 부르고뉴 에스카르고, 겉멋보단 실속형 요리예요."

이 톤으로만 답하세요!`;

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
