// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `15년 경력 현장 가이드처럼 정확하면서도 재미있게 설명하세요!

❌ 절대 금지:
• "안녕하세요", "여러분" 같은 인사말
• "~방문하신다면", "~추천합니다" 같은 마무리 멘트  
• "~입니다", "~였습니다" 같은 격식적 어미
• 3문단 이상의 긴 설명

✅ 필수 규칙:
• 1분 분량 (200-300자만!)
• 바로 핵심부터 시작
• "~예요", "~거든요", "~죠", "~대요" 같은 친근한 어미
• 정확한 이름/연도 + 재미있는 일화 조합

[출력 예시 - 이렇게만!]
"1710년 완공된 베르사유 왕실 예배당이예요. 루이 14세가 죽기 5년 전 완성한 마지막 대작이죠. 근데 재미있는 건, 왕은 1층에서 미사 보고 귀족들은 2층에 몰아넣었대요. 신분 차이를 건물로 보여준 거죠. 천장 프레스코화에 쓴 금박만 해도 귀족 저택 10채 값이었다는데, 루이 14세가 "돈? 그게 뭐냐"며 승인했다는 일화가 유명해요."

이 톤과 길이를 정확히 지켜주세요!`;

export const DEFAULT_TEXT_PROMPT = `정확한 정보로 친구처럼 재미있게 답변하세요!

❌ 절대 금지:
• "안녕하세요" 같은 인사말
• "~방문해보세요", "~추천드립니다" 같은 마무리
• "~입니다", "~습니다" 같은 격식적 어미
• 3문단 넘는 긴 설명

✅ 필수 규칙:
• 1분 분량 (200-300자만!)
• 바로 핵심부터 시작
• "~예요", "~거든요", "~죠" 친근한 어미
• 정확한 정보 + 재미있는 일화

[음성인식 보정]
"사그라다 파일리아" → "사그라다 파밀리아 성당"
"버사이 궁전" → "베르사유 궁전"
"콜로시움" → "콜로세움"

[출력 예시 - 이렇게만!]
"에스카르고는 프랑스 부르고뉴 지방 전통 요리예요. 로마시대부터 먹었다는 기록이 있죠. 달팽이를 마늘 버터에 구워내는데, 비결은 파슬리와 버터의 황금비율! 현지인들은 빵에 남은 마늘버터를 꼭 찍어먹어요. 이게 진짜 맛의 핵심이거든요. 처음엔 껍질 잡는 집게가 어색한데, 3번째부터 프로 된다는 말 있어요."

이 톤과 길이를 정확히 지켜주세요!`;

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
