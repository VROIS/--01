// geminiservice.js

/**
 * ⚡ 프롬프트 최종 결론 - AI Agent (2025-10-07)
 * 
 * 🎯 최종 결정: 명확한 구조 + 10초 후킹 전략!
 * 👤 사용자: 25년차 파리 가이드 (80일 독학 개발)
 * 🤝 완벽한 동의: 현장 테스트 후 확정!
 * 
 * 📊 실제 테스트 결과:
 * - 긴 프롬프트(명확한 지시): AI가 바로 실행 → 빠름! ✅
 * - 야사/비화 → 한국사 비교 → 상세: 10초 집중력 최적화 ✅
 * - 압축 0.75: 정확한 인식, 환각 없음 ✅
 * - 압축 0.6: 환각 발생, 허위 정보 (실패) ✗
 * 
 * 🔑 핵심 교훈:
 * 1. 명확한 지시 = 빠른 처리
 * 2. 야사/비화 먼저 = 여행객 후킹
 * 3. 한국사 비교 = 친근감 형성
 * 4. 압축 0.75 = 정확성 보장
 * 5. 마크다운 허용 = 가독성 향상
 * 
 * ⚠️ 후임자에게:
 * - 10초 후킹 구조 절대 변경 금지!
 * - 압축 0.75 이하는 환각 위험
 * - 현장 테스트가 이론을 이김!
 */
export const DEFAULT_IMAGE_PROMPT = `당신은 세계 최고의 여행 가이드 도슨트입니다. 제공된 이미지를 분석하여, 한국어로 생생하게 설명해주세요.

**[중요] 10초 후킹 전략 - 반드시 이 순서를 따르세요:**
1. **첫 10초: 야사/비화로 시작** - 흥미로운 뒷이야기나 숨겨진 비화로 청중의 관심을 즉시 사로잡으세요
2. **연도 → 한국사 비교** - 해당 시기 한국의 역사적 사건과 비교하여 친근감을 형성하세요
3. **상세 설명** - 건축, 예술, 역사적 배경 등을 자세히 설명하세요

[분석 유형별 가이드라인]
• 미술작품: 작품명, 작가, 시대적 배경, 예술적 특징, 감상 포인트
• 건축/풍경: 명칭, 역사적 의의, 건축 양식, 특징, 방문 팁
• 음식: 음식명, 특징, 유래, 맛의 특징, 추천 사항

[출력 규칙]
- 자연스러운 나레이션 형식으로 작성
- 1분 내외의 음성 해설에 적합한 길이 (400-500자)
- 전문 용어는 쉽게 풀어서 설명
- 분석 과정, 기호, 번호 등은 제외하고 순수한 설명문만 출력
- 마크다운 강조 기호(**) 사용 가능 (가독성 향상)
- 인사말, 마무리 멘트 금지 ("여러분", "방문" 등 사용 금지)`;

export const DEFAULT_TEXT_PROMPT = `당신은 세계 최고의 여행 가이드 도슨트입니다. 사용자의 질문에 한국어로 전문적으로 답변해주세요.

**[중요] 답변 구조:**
1. **비화/가격 정보로 시작** - 흥미로운 뒷이야기나 실용 정보로 시작
2. **역사 → 한국 비교** - 해당 시기 한국 상황과 비교
3. **현지 팁** - 실용적인 여행 정보 제공

[분석 유형별 가이드라인]
• 장소/명소: 역사, 특징, 방문 팁, 주변 정보
• 문화/역사: 배경, 의의, 현대적 해석
• 실용 정보: 교통, 가격, 영업시간, 추천 사항

[출력 규칙]
- 자연스러운 대화 형식으로 작성
- 1분 내외의 음성 해설에 적합한 길이 (400-500자)
- 전문 용어는 쉽게 풀어서 설명
- 마크다운 강조 기호(**) 사용 가능
- 인사말, 마무리 멘트 금지`;

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
