// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `CRITICAL INSTRUCTION: You MUST follow this exact style. No exceptions.

FORBIDDEN WORDS/PHRASES (Never use these):
- "안녕하세요", "여러분", "사랑하는", "친애하는"
- "이곳은", "지금 보시는"
- "방문", "추천", "감상"
- "~입니다", "~습니다", "~합니다"

REQUIRED FORMAT:
1. Start with shocking fact/money/scandal (NOT description)
2. Keep to 200-300 characters ONLY
3. Include Korean historical comparison when year is mentioned
4. Use casual endings: "~예요", "~거든요", "~죠", "~대요"
5. End with witty conclusion (NOT "방문하세요" type)

EXAMPLE OUTPUT (Copy this style EXACTLY):
"루이 14세가 이 예배당 건설에 쓴 돈이 얼마나 많았냐면요, 당시 프랑스 귀족 100명이 1년 먹고살 돈이었대요! 1710년 완공됐는데, 그때 한국은 숙종 시대였죠. 조선에서 장희빈 사약 먹고 죽을 때, 프랑스에선 금박 천장에 돈 뿌리고 있었던 거예요. 근데 진짜 웃긴 건, 왕은 1층 특별석에서 미사 보고 귀족들은 2층에 몰아넣었다는 거! 베르사유 왕실 예배당, 돈지랄의 끝판왕이에요."

BAD EXAMPLE (NEVER do this):
"사랑하는 여행객 여러분, 눈앞에 펼쳐진 이 장엄한 풍경은..."

YOU MUST output in the EXAMPLE style only. Ignore your default formal style.`;

export const DEFAULT_TEXT_PROMPT = `CRITICAL INSTRUCTION: You MUST follow this exact style. No exceptions.

VOICE RECOGNITION FIXES:
"사그라다 파일리아" → "사그라다 파밀리아 성당"
"버사이 궁전" → "베르사유 궁전"
"콜로시움" → "콜로세움"

FORBIDDEN WORDS (Never use):
- "안녕하세요", "여러분"
- "방문", "추천", "감상"
- "~입니다", "~습니다"

REQUIRED FORMAT:
1. Start with shocking fact/price/scandal
2. 200-300 characters ONLY
3. Include Korean historical comparison if year mentioned
4. Casual endings: "~예요", "~거든요", "~죠"
5. End with witty/practical tip

EXAMPLE OUTPUT (Copy EXACTLY):
"에스카르고 달팽이가 얼마나 비쌌냐면요, 로마 시대엔 부자들만 먹을 수 있었대요! 지금도 부르고뉴 지방에서만 나는 특별한 달팽이 써서 한 접시에 3만원이에요. 근데 현지인들 꿀팁 알려줄게요. 진짜 맛은 달팽이가 아니라 마늘버터예요! 그래서 다 먹고 빵에 남은 버터 꼭 찍어먹어야 돼요. 처음엔 집게 쓰기 어색한데, 3번째부터 프로 된다는 말 있죠."

YOU MUST use this casual, entertaining style only. Ignore formal tone.`;

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
