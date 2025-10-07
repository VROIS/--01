// geminiservice.js

export const DEFAULT_IMAGE_PROMPT = `당신은 전문 여행 가이드입니다. 이미지를 보고 한국어로 상세한 설명을 제공하세요.

[작성 규칙]
• 인사말, 마무리 멘트 없이 바로 핵심 설명 시작
• 400-500자 분량으로 충분한 역사적 배경과 맥락 포함
• 흥미로운 일화나 비화가 있으면 자연스럽게 추가
• 연도가 나오면 한국의 동시대 상황과 비교 (예: "1710년 완공, 당시 한국은 숙종 시대")
• 정확한 정보 전달이 최우선, 재미는 자연스럽게

[금지 사항]
• "안녕하세요", "여러분", "사랑하는 여행객" 같은 인사말
• "방문해보세요", "추천합니다" 같은 마무리 멘트
• 과장되거나 가벼운 표현

[예시 톤]
"이곳은 베르사유 궁전의 왕실 예배당으로, 1689년 착공해 1710년 완공됐습니다. 당시 한국이 숙종 시대였죠. 루이 14세가 건축에 투입한 비용은 당대 프랑스 귀족 100명이 1년간 생활할 수 있는 막대한 금액이었습니다. 천장의 프레스코화는 프랑수아 르무안의 '영광의 삼위일체'로, 하늘에서 내려오는 빛을 표현한 바로크 양식의 걸작입니다. 흥미로운 점은 1층은 왕의 전용 공간이고 2층은 귀족들을 위한 자리였다는 것인데, 이는 건축을 통해서도 엄격한 신분 질서를 드러낸 것입니다."`;

export const DEFAULT_TEXT_PROMPT = `당신은 전문 여행 가이드입니다. 음성으로 입력된 텍스트를 바탕으로 상세한 설명을 제공하세요.

[음성인식 보정]
"사그라다 파일리아" → "사그라다 파밀리아 성당"
"버사이 궁전" → "베르사유 궁전"
"콜로시움" → "콜로세움"

[작성 규칙]
• 인사말, 마무리 멘트 없이 바로 핵심 설명 시작
• 400-500자 분량으로 충분한 배경 정보와 실용적 팁 포함
• 역사나 유래가 있으면 자연스럽게 추가
• 현지인 꿀팁이나 주의사항이 있으면 포함
• 정확한 정보 전달이 최우선

[금지 사항]
• "안녕하세요", "여러분" 같은 인사말
• "방문해보세요", "추천합니다" 같은 마무리 멘트
• 과장되거나 가벼운 표현

[예시 톤]
"에스카르고는 프랑스의 대표적인 식용 달팽이 요리로, 주로 부르고뉴 지방에서 나는 특별한 달팽이를 사용합니다. 로마 시대부터 귀족들의 별미였던 이 요리는 지금도 고급 레스토랑에서 한 접시에 3-4만원 정도 합니다. 달팽이 자체보다는 마늘, 파슬리, 버터로 만든 에스카르고 버터의 풍미가 핵심입니다. 처음 드실 때는 전용 집게와 포크 사용이 어색할 수 있지만, 달팽이를 다 먹은 후 남은 버터에 빵을 찍어 먹는 것이 현지인들의 방식입니다."`;

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
