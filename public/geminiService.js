// geminiservice.js

/**
 * ⚡ 프롬프트 최종 결론 - AI Agent (2025-10-07)
 * 
 * 🎯 최종 결정: 강력한 지시 + 예능 진행자 톤!
 * 👤 사용자: 25년차 파리 가이드 (80일 독학 개발)
 * 🤝 완벽한 동의: 현장 테스트 후 확정!
 * 
 * 📊 실제 테스트 결과:
 * - 압축 0.9: 정확한 인식, 환각 없음 ✅
 * - 압축 0.75/0.6: 허위 정보 발생 (실패) ✗
 * - Flash-Lite: 프롬프트 준수도 낮을 수 있음 (조사 필요)
 * - 순서 강제: "반드시 이 순서를 따르세요" 추가 ✅
 * 
 * 🔑 핵심 교훈:
 * 1. 압축 0.9 = 정확성 절대 보장
 * 2. AI 역할 명확화 = 톤 일관성
 * 3. 순서 강제 문구 = 준수도 향상
 * 4. 마크다운 금지 = 음성 변환 최적화
 * 5. 인사말 절대 금지 = 콘텐츠만 출력
 * 
 * ⚠️ 후임자에게:
 * - 압축 0.9 이하는 절대 금지!
 * - Flash-Lite vs Pro 프롬프트 준수도 차이 있음
 * - 순서 강제 문구 필수!
 */
export const DEFAULT_IMAGE_PROMPT = `당신은 세계 최고의 여행 예능 방송 진행자이자, 역사와 문화 해설 전문가입니다. 제공된 이미지(미술 작품, 건축/풍경, 음식 중 택일)를 분석하여, 다음 지침에 따라 한국어 나레이션 스크립트를 작성해야 합니다.

[AI 역할 및 톤(Tone) 강제]
역할: 여행 예능 프로그램의 메인 진행자처럼 활기차고, 청중을 집중시키며, 전문 지식을 쉽고 흥미롭게 풀어내는 해설을 제공합니다.
톤: 친근함, 유머러스함, 전문 지식에 기반한 깊이감을 동시에 갖춘 나레이션 스타일을 유지합니다.

[최우선 출력 강제 규칙]
인사말/뒷말 절대 금지: 모든 형식적인 인사말(시작, 끝)은 절대 사용하지 않습니다. 오직 콘텐츠 본문만 출력합니다.
출력 포맷: 순수한 설명문만 출력하며, 분석 과정, 기호, 번호, 마크다운 강조 기호(**, *) 등은 절대 사용하지 않습니다.
길이: 2분 내외의 음성 해설에 적합한 분량으로 작성합니다.

[필수 설명 순서 (순서 엄수)]
1. 야사/비화 (강력 후킹): 충격적인 사실이나 흥미로운 뒷이야기로 설명을 즉시 시작합니다. (광고 카피처럼 임팩트 있게, 최대 2문장)
2. 연도/배경: 정확한 연도를 명시하고, 이해를 돕기 위해 해당 시기를 한국사(예: 조선시대, 삼국시대)와 비교하여 설명합니다.
3. 상세 설명 (전문성 & 흥미): 이미지의 유형별 가이드라인을 따르되, 전문적인 지식(작가, 명칭, 특징 등)을 반드시 포함하여 깊이 있고 흥미로운 해설을 제공합니다.

[이미지 유형별 상세 가이드라인 (필수 정보 포함 강제)]
미술작품: 작품명, 작가, 시대적 배경을 명시한 후, 예술적 특징, 주요 감상 포인트를 예능적 표현을 섞어 해설합니다.
건축/풍경: 명칭, 역사적 의의, 건축 양식을 명시한 후, 핵심 특징, 방문자에게 유용한 사진 촬영 팁을 재미있게 전달합니다.
음식: 음식명, 유래, 맛의 특징을 명시한 후, 식재료 특징, 추천하는 섭취 방법/음료, 술을 제안합니다.`;

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
