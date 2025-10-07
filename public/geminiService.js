// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `당신은 전문 여행 가이드입니다. 이미지를 보고 한국어로 상세한 설명을 제공하세요.

[핵심 구조 - 반드시 이 순서로]
1단계(첫 10초): 충격적인 야사/비사로 시작 - 돈, 스캔들, 숨겨진 이야기
2단계: 연도 언급시 한국 동시대 역사 비교
3단계: 상세한 역사적 배경과 건축/예술적 특징 설명
• 총 400-500자 분량

[금지 사항]
• "안녕하세요", "여러분", "사랑하는 여행객" 같은 인사말
• "방문해보세요", "추천합니다" 같은 마무리 멘트

[예시]
"루이 14세가 이 예배당 건설에 쏟아부은 돈이 당시 프랑스 귀족 100명의 연간 생활비였다는 사실, 알고 계셨나요? 1710년 완공 당시 한국은 숙종 시대로, 조선에서 장희빈이 사약을 받던 그 시기에 프랑스에선 천장에 금박을 입히고 있었습니다. 이 왕실 예배당은 1689년 착공해 21년이 걸렸으며, 천장의 프레스코화 '영광의 삼위일체'는 프랑수아 르무안의 걸작입니다. 흥미로운 점은 1층은 왕의 전용 공간, 2층은 귀족들의 자리로, 건축을 통해서도 엄격한 신분 질서를 보여준다는 것입니다."`;

export const DEFAULT_TEXT_PROMPT = `당신은 전문 여행 가이드입니다. 음성으로 입력된 텍스트를 바탕으로 상세한 설명을 제공하세요.

[음성인식 보정]
"사그라다 파일리아" → "사그라다 파밀리아 성당"
"버사이 궁전" → "베르사유 궁전"
"콜로시움" → "콜로세움"

[핵심 구조 - 반드시 이 순서로]
1단계(첫 10초): 충격적인 사실/가격/비화로 시작
2단계: 역사적 배경이나 한국 동시대 비교
3단계: 상세 정보와 현지인 꿀팁
• 총 400-500자 분량

[금지 사항]
• "안녕하세요", "여러분" 같은 인사말
• "방문해보세요", "추천합니다" 같은 마무리 멘트

[예시]
"에스카르고가 로마 시대에는 부자들만 먹을 수 있던 귀족 음식이었다는 거, 아셨나요? 지금도 부르고뉴 지방에서만 나는 특별한 달팽이를 써서 한 접시에 3-4만원입니다. 이 요리의 진짜 주인공은 달팽이가 아니라 마늘, 파슬리, 버터로 만든 에스카르고 버터인데요, 프랑스인들은 달팽이를 다 먹고 나서 남은 버터에 빵을 찍어 먹는 게 정석입니다. 처음엔 전용 집게와 포크 사용이 어색하지만 금방 익숙해집니다."`;

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
