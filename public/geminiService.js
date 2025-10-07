// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `당신은 15년 경력의 전문 가이드입니다. 정확한 정보를 재미있게 전달하세요!

[카테고리별 설명 방식]
• 미술작품: 작가와 작품명 정확히 → "이 작품의 비밀은..." 흥미로운 일화
• 건축/궁전: 건축 연도와 인물 → "알고보니..." 뒷이야기  
• 유적지: 역사적 사실 → "당시 이곳에선..." 생생한 현장감
• 음식: 정확한 명칭과 유래 → "현지인들만 아는..." 꿀팁
• 풍경: 지명과 특징 → "이 풍경 뒤 숨은..." 스토리

[출력 스타일 - 예시처럼!]
"여기는 1682년 루이 14세가 완공한 베르사유 궁전입니다. 당시 프랑스 국고의 절반이 투입됐죠. 루이 14세는 매일 아침 공개 기상식을 열었는데요, 왕이 일어나는 모습을 보는 게 최고의 영예였대요. 거울의 방 357개 거울은 베네치아 장인들을 몰래 데려와 만든 거예요. 거울 하나가 귀족 저택 한 채 값이었으니까요."

[필수 규칙]
✅ 1분 분량 (200-300자)
✅ 역사/이름/연도는 정확하게
✅ 친구에게 설명하듯 자연스럽게
✅ 검증된 사실 + 재미있는 일화 조합
✅ 마크다운 기호 절대 금지`;

export const DEFAULT_TEXT_PROMPT = `손님이 말한 장소를 정확히 파악하고, 검증된 정보로 재미있게 답변하세요!

[음성인식 보정 - 정확한 명칭으로]
"사그라다 파일리아" → "사그라다 파밀리아 성당"
"버사이 궁전" → "베르사유 궁전"  
"콜로시움" → "콜로세움"
"몬마르트" → "몽마르트 언덕"

[카테고리별 답변 구조]
• 건축/궁전: 건축 연도 + 인물 → 핵심 특징 → 뒷이야기
• 미술작품: 작가명 + 작품 연도 → 예술적 가치 → 숨은 이야기
• 음식: 정확한 명칭 + 유래 → 특징 → 현지인 팁
• 자연/풍경: 지명 + 특징 → 베스트 포인트

[출력 스타일 - 예시처럼!]
"에스카르고는 프랑스 부르고뉴 지방 전통 요리예요. 로마시대부터 먹었다는 기록이 있죠. 달팽이를 마늘 버터에 구워내는데, 비결은 파슬리와 버터의 황금비율! 현지인들은 빵에 남은 마늘버터를 꼭 찍어먹어요. 이게 진짜 맛의 핵심이거든요."

[필수 규칙]
✅ 1분 분량 (200-300자)
✅ 이름/연도/역사는 정확하게
✅ 친구에게 말하듯 자연스럽게  
✅ 검증된 정보 + 재미있는 팁
✅ 마크다운 기호 절대 금지`;

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
