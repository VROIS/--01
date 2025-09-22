// 성능 모니터링 시스템
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: parseInt(localStorage.getItem('apiCallCount')) || 0,
            totalCost: parseFloat(localStorage.getItem('totalApiCost')) || 0,
            processingSpeeds: JSON.parse(localStorage.getItem('processingSpeeds')) || [],
            memoryPeaks: JSON.parse(localStorage.getItem('memoryPeaks')) || []
        };
        
        // 5분마다 메모리 사용량 체크
        setInterval(() => this.checkMemoryUsage(), 300000);
    }
    
    // API 비용 계산 (Gemini 1.5 Flash 기준)
    calculateGeminiCost(inputTokens, outputTokens) {
        const inputCost = inputTokens * (0.075 / 1000000);  // $0.075/1M tokens
        const outputCost = outputTokens * (0.30 / 1000000); // $0.30/1M tokens
        return inputCost + outputCost;
    }
    
    // 한글 텍스트를 토큰 수로 추정
    estimateTokens(text) {
        return Math.ceil(text.length / 2.5); // 한글 평균 2.5글자 = 1토큰
    }
    
    // API 호출 기록
    recordApiCall(inputText, outputText, processingTimeMs, imageSize) {
        const inputTokens = this.estimateTokens(inputText);
        const outputTokens = this.estimateTokens(outputText);
        const cost = this.calculateGeminiCost(inputTokens, outputTokens);
        
        this.metrics.apiCalls++;
        this.metrics.totalCost += cost;
        this.metrics.processingSpeeds.push({
            time: processingTimeMs,
            imageSize: imageSize,
            outputLength: outputText.length,
            timestamp: Date.now()
        });
        
        // 최근 100개만 보관
        if (this.metrics.processingSpeeds.length > 100) {
            this.metrics.processingSpeeds = this.metrics.processingSpeeds.slice(-100);
        }
        
        this.saveMetrics();
        this.logResults(cost, processingTimeMs, inputTokens, outputTokens);
    }
    
    // 메모리 사용량 체크
    checkMemoryUsage() {
        if (performance.memory) {
            const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
            const limitMB = performance.memory.jsHeapSizeLimit / 1024 / 1024;
            
            this.metrics.memoryPeaks.push({
                used: usedMB,
                limit: limitMB,
                timestamp: Date.now()
            });
            
            // 최근 50개만 보관
            if (this.metrics.memoryPeaks.length > 50) {
                this.metrics.memoryPeaks = this.metrics.memoryPeaks.slice(-50);
            }
            
            console.log(`🧠 [메모리] 사용량: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB (${(usedMB/limitMB*100).toFixed(1)}%)`);
            
            // 메모리 사용량이 80% 초과시 경고
            if (usedMB / limitMB > 0.8) {
                console.warn('⚠️ [메모리경고] 사용량이 80%를 초과했습니다!');
            }
            
            this.saveMetrics();
            return usedMB;
        }
        return 0;
    }
    
    // 결과 로깅
    logResults(cost, processingTime, inputTokens, outputTokens) {
        console.log(`💰 [API비용] 이번 호출: $${cost.toFixed(6)}, 누적: $${this.metrics.totalCost.toFixed(4)}`);
        console.log(`⏱️ [처리속도] ${processingTime}ms, 토큰: ${inputTokens}→${outputTokens}`);
        console.log(`📈 [통계] 총 ${this.metrics.apiCalls}회 호출`);
    }
    
    // 성능 리포트 생성
    generateReport() {
        const speeds = this.metrics.processingSpeeds;
        if (speeds.length === 0) return;
        
        const avgSpeed = speeds.reduce((sum, s) => sum + s.time, 0) / speeds.length;
        const recentSpeeds = speeds.slice(-10);
        const recentAvg = recentSpeeds.reduce((sum, s) => sum + s.time, 0) / recentSpeeds.length;
        
        console.log(`📊 [성능리포트]
평균 처리시간: ${avgSpeed.toFixed(0)}ms
최근 10회 평균: ${recentAvg.toFixed(0)}ms  
총 API 호출: ${this.metrics.apiCalls}회
누적 비용: $${this.metrics.totalCost.toFixed(4)}
메모리 피크: ${Math.max(...this.metrics.memoryPeaks.map(m => m.used)).toFixed(1)}MB`);
    }
    
    // 압축률별 성능 비교
    analyzeCompressionPerformance() {
        const speeds = this.metrics.processingSpeeds.filter(s => s.imageSize);
        const groups = {};
        
        speeds.forEach(s => {
            const sizeRange = s.imageSize < 100 ? 'small' : s.imageSize < 500 ? 'medium' : 'large';
            if (!groups[sizeRange]) groups[sizeRange] = [];
            groups[sizeRange].push(s.time);
        });
        
        Object.entries(groups).forEach(([size, times]) => {
            const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
            console.log(`📊 [압축분석] ${size} 이미지 평균: ${avg.toFixed(0)}ms (${times.length}개)`);
        });
    }
    
    // 메트릭스 저장
    saveMetrics() {
        localStorage.setItem('apiCallCount', this.metrics.apiCalls);
        localStorage.setItem('totalApiCost', this.metrics.totalCost);
        localStorage.setItem('processingSpeeds', JSON.stringify(this.metrics.processingSpeeds));
        localStorage.setItem('memoryPeaks', JSON.stringify(this.metrics.memoryPeaks));
    }
    
    // 통계 초기화
    resetStats() {
        this.metrics = { apiCalls: 0, totalCost: 0, processingSpeeds: [], memoryPeaks: [] };
        localStorage.removeItem('apiCallCount');
        localStorage.removeItem('totalApiCost');
        localStorage.removeItem('processingSpeeds');
        localStorage.removeItem('memoryPeaks');
        console.log('📊 [통계초기화] 모든 성능 통계가 초기화되었습니다.');
    }
}

// 전역 모니터 인스턴스
window.performanceMonitor = new PerformanceMonitor();

// 콘솔 명령어 추가
window.showPerformanceReport = () => window.performanceMonitor.generateReport();
window.analyzeCompression = () => window.performanceMonitor.analyzeCompressionPerformance();
window.resetPerformanceStats = () => window.performanceMonitor.resetStats();
window.setImageQuality = (quality) => {
    localStorage.setItem('imageQuality', quality);
    console.log(`📊 [압축설정] 이미지 품질을 ${quality}로 설정했습니다.`);
};

console.log('🔍 [모니터링] 성능 모니터링 시스템이 로드되었습니다.');
console.log('💡 [사용법] showPerformanceReport(), analyzeCompression(), setImageQuality(0.7), resetPerformanceStats()');