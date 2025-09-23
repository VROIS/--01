interface ShareItem {
  id: string;
  title: string;
  description: string;
  imageBase64: string;
  location?: string;
}

interface SharePageData {
  title: string;
  items: ShareItem[];
  createdAt: string;
  location?: string;
  includeAudio: boolean;
}

export function generateShareHtml(data: SharePageData): string {
  const { title, items, createdAt, location, includeAudio } = data;
  
  // 최대 20개 아이템으로 제한 (2*10 그리드)
  const limitedItems = items.slice(0, 20);
  
  // 갤러리 아이템 생성
  const galleryItemsHtml = limitedItems.map((item, index) => `
    <div class="gallery-item" data-id="${item.id}">
      <img src="data:image/jpeg;base64,${item.imageBase64}" alt="${item.title}">
      <p>${item.title}</p>
    </div>
  `).join('');

  // 데이터 스토리지 생성
  const dataStorageHtml = limitedItems.map(item => `
    <div data-id="${item.id}">${item.description}</div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 내손가이드</title>
  <meta property="og:title" content="${title} - 내손가이드">
  <meta property="og:description" content="${limitedItems[0]?.description?.substring(0, 100) || '친구가 공유한 여행 가이드'}">
  <meta property="og:type" content="website">
  <meta name="created-at" content="${createdAt}">
  ${location ? `<meta name="location" content="${location}">` : ''}
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      background-color: #f0f2f5;
      padding-bottom: 100px; /* 하단 고정 버튼 공간 확보 */
    }
    
    .hidden { display: none !important; }
    
    .header {
      padding: 20px;
      background-color: #343a40;
      color: #fff;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    
    .meta-info {
      margin-top: 10px;
      font-size: 14px;
      opacity: 0.8;
    }
    
    .voice-selector {
      margin-top: 15px;
    }
    
    .voice-selector label {
      margin-right: 10px;
    }
    
    .voice-selector select {
      padding: 5px;
      border-radius: 5px;
    }
    
    #gallery-view {
      padding: 15px;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }
    
    /* 2*10 그리드 최적화 */
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr); /* 모바일에서 2열 고정 */
      gap: 15px;
      max-width: 500px;
      margin: 0 auto;
    }
    
    .gallery-item {
      cursor: pointer;
      text-align: center;
      transition: transform 0.2s;
    }
    
    .gallery-item:hover {
      transform: scale(1.02);
    }
    
    .gallery-item img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0,0,0,.1);
      background-color: #e9e9e9;
    }
    
    .gallery-item p {
      margin: 8px 0 0;
      font-weight: 700;
      color: #333;
      font-size: 14px;
      line-height: 1.3;
    }
    
    /* 상세뷰 */
    #detail-view {
      padding: 20px;
      max-width: 800px;
      margin: auto;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 100px);
      box-sizing: border-box;
    }
    
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-shrink: 0;
    }
    
    .back-button {
      padding: 10px 15px;
      background-color: #6c757d;
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    
    #detail-title {
      font-size: 24px;
      font-weight: 700;
      color: #1c2b33;
      margin: 0;
      text-align: right;
      flex-grow: 1;
    }
    
    .detail-image-container {
      flex-grow: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    
    .detail-image {
      width: 100%;
      max-width: 500px;
      max-height: 70vh;
      object-fit: contain;
      display: block;
      border-radius: 12px;
      box-shadow: 0 5px 20px rgba(0,0,0,.15);
    }
    
    .controls {
      text-align: center;
      margin-bottom: 20px;
      flex-shrink: 0;
    }
    
    .audio-button, .text-toggle-button {
      padding: 12px 25px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      font-weight: 700;
      margin: 0 10px;
    }
    
    .audio-button {
      background-color: #007bff;
      color: #fff;
    }
    
    .audio-button.playing {
      background-color: #dc3545;
    }
    
    .text-toggle-button {
      background-color: #f0f2f5;
      color: #333;
      border: 1px solid #ccc;
    }
    
    #detail-text {
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
      line-height: 1.8;
      margin-top: 20px;
      max-height: 40vh;
      overflow-y: auto;
    }
    
    /* 하단 고정 네비게이션 */
    .fixed-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 80px;
      background-color: #fff;
      border-top: 1px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: space-around;
      box-shadow: 0 -2px 10px rgba(0,0,0,.1);
      z-index: 50;
    }
    
    .nav-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 16px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      transition: color 0.2s;
    }
    
    .nav-button:hover {
      color: #007bff;
    }
    
    .nav-icon {
      font-size: 24px;
      margin-bottom: 4px;
    }
    
    /* 모바일 최적화 */
    @media (max-width: 480px) {
      .gallery-grid {
        gap: 10px;
        padding: 0 10px;
      }
      
      .gallery-item img {
        height: 120px;
      }
      
      .gallery-item p {
        font-size: 12px;
      }
      
      .header h1 {
        font-size: 24px;
      }
      
      #detail-title {
        font-size: 20px;
      }
    }
  </style>
</head>

<body>
  <!-- 헤더 -->
  <div class="header">
    <h1>${title}</h1>
    <div class="meta-info">
      ${location ? `📍 ${location} • ` : ''}📅 ${new Date(createdAt).toLocaleDateString('ko-KR')}
    </div>
    ${includeAudio ? `
    <div class="voice-selector">
      <label for="voice-select">목소리 선택:</label>
      <select id="voice-select"></select>
    </div>
    ` : ''}
  </div>

  <!-- 갤러리 뷰 -->
  <div id="gallery-view">
    <div class="gallery-grid">
      ${galleryItemsHtml}
    </div>
  </div>

  <!-- 상세 뷰 -->
  <div id="detail-view" class="hidden">
    <div class="detail-header">
      <button class="back-button">&larr; 목록으로</button>
      <h2 id="detail-title"></h2>
    </div>
    <div class="detail-image-container">
      <img id="detail-image" src="">
    </div>
    <div class="controls">
      ${includeAudio ? '<button id="detail-audio-button" class="audio-button">▶ 재생</button>' : ''}
      <button id="detail-text-toggle" class="text-toggle-button">해설 보기</button>
    </div>
    <div id="detail-text" class="hidden"></div>
  </div>

  <!-- 데이터 스토리지 -->
  <div id="data-storage" class="hidden">
    ${dataStorageHtml}
  </div>

  <!-- 하단 고정 네비게이션 -->
  <div class="fixed-bottom-nav">
    <button class="nav-button" onclick="goToApp()">
      <div class="nav-icon">🏠</div>
      <div>앱으로 가기</div>
    </button>
    <button class="nav-button" onclick="shareAgain()">
      <div class="nav-icon">📤</div>
      <div>공유하기</div>
    </button>
    <button class="nav-button" onclick="showInfo()">
      <div class="nav-icon">ℹ️</div>
      <div>정보</div>
    </button>
  </div>

  <script>
    // 데이터 초기화
    const galleryView = document.getElementById("gallery-view");
    const detailView = document.getElementById("detail-view");
    const header = document.querySelector(".header");
    const works = [];

    // 작품 데이터 수집
    document.querySelectorAll("#data-storage > div").forEach(div => {
      const id = div.dataset.id;
      const galleryItem = document.querySelector(\`[data-id="\${id}"]\`);
      if (galleryItem) {
        works.push({
          id: id,
          title: galleryItem.querySelector("p").textContent,
          imgSrc: galleryItem.querySelector("img").src,
          text: div.innerHTML
        });
      }
    });

    ${includeAudio ? `
    // TTS 기능
    const synth = window.speechSynthesis;
    const voiceSelect = document.getElementById("voice-select");
    let voices = [];

    function populateVoiceList() {
      voices = synth.getVoices().filter(voice => voice.lang.startsWith("ko"));
      const selectedVoice = voiceSelect.value;
      voiceSelect.innerHTML = "";
      
      voices.forEach(voice => {
        const option = document.createElement("option");
        option.textContent = voice.name + " (" + voice.lang + ")";
        option.value = voice.name;
        voiceSelect.appendChild(option);
      });
      
      voiceSelect.value = selectedVoice;
    }

    function stopAudio() {
      if (synth.speaking) {
        synth.cancel();
      }
    }

    function playAudio(text) {
      stopAudio();
      
      const utterance = new SpeechSynthesisUtterance(text.replace(/<br\\s*\\/?>/gi, " "));
      const selectedVoice = voices.find(voice => voice.name === voiceSelect.value);
      
      utterance.voice = selectedVoice;
      utterance.lang = "ko-KR";
      utterance.rate = 1.0;
      
      const audioButton = document.getElementById("detail-audio-button");
      
      utterance.onstart = () => {
        audioButton.textContent = "❚❚ 일시정지";
        audioButton.classList.add("playing");
      };
      
      utterance.onend = () => {
        audioButton.textContent = "▶ 다시듣기";
        audioButton.classList.remove("playing");
      };
      
      synth.speak(utterance);
    }

    // 음성 목록 초기화
    populateVoiceList();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateVoiceList;
    }
    ` : ''}

    // 갤러리 아이템 클릭 이벤트
    document.querySelectorAll(".gallery-item").forEach(item => {
      item.addEventListener("click", () => {
        const work = works.find(w => w.id === item.dataset.id);
        
        document.getElementById("detail-title").textContent = work.title;
        document.getElementById("detail-image").src = work.imgSrc;
        document.getElementById("detail-text").innerHTML = work.text;
        document.getElementById("detail-text").classList.add("hidden");
        document.getElementById("detail-text-toggle").textContent = "해설 보기";
        
        galleryView.classList.add("hidden");
        header.classList.add("hidden");
        detailView.classList.remove("hidden");
        
        ${includeAudio ? 'playAudio(work.text);' : ''}
      });
    });

    // 뒤로가기 버튼
    document.querySelector(".back-button").addEventListener("click", () => {
      ${includeAudio ? 'stopAudio();' : ''}
      detailView.classList.add("hidden");
      header.classList.remove("hidden");
      galleryView.classList.remove("hidden");
    });

    ${includeAudio ? `
    // 오디오 버튼
    document.getElementById("detail-audio-button")?.addEventListener("click", () => {
      const currentWork = works.find(w => w.title === document.getElementById("detail-title").textContent);
      if (currentWork) {
        if (synth.speaking) {
          stopAudio();
        } else {
          playAudio(currentWork.text);
        }
      }
    });
    ` : ''}

    // 텍스트 토글 버튼
    document.getElementById("detail-text-toggle").addEventListener("click", () => {
      const textDiv = document.getElementById("detail-text");
      const toggleButton = document.getElementById("detail-text-toggle");
      
      if (textDiv.classList.contains("hidden")) {
        textDiv.classList.remove("hidden");
        toggleButton.textContent = "해설 숨기기";
      } else {
        textDiv.classList.add("hidden");
        toggleButton.textContent = "해설 보기";
      }
    });

    // 하단 네비게이션 기능들
    function goToApp() {
      const currentHost = window.location.host;
      window.open(\`https://\${currentHost}\`, '_blank');
    }

    function shareAgain() {
      if (navigator.share) {
        navigator.share({
          title: '${title} - 내손가이드',
          text: '친구가 공유한 여행 가이드를 확인해보세요!',
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          alert('링크가 클립보드에 복사되었습니다!');
        });
      }
    }

    function showInfo() {
      alert(\`📍 생성 위치: \${${location ? `"${location}"` : '"위치 정보 없음"'}}\\n📅 생성 일시: \${new Date("${createdAt}").toLocaleString('ko-KR')}\\n📊 콘텐츠 수: \${works.length}개\`);
    }

    // 초기 화면 설정
    galleryView.classList.remove("hidden");
  </script>
</body>
</html>`;
}