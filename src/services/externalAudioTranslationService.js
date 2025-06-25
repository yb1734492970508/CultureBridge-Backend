const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/wav',
            'audio/mp3',
            'audio/mpeg',
            'audio/webm',
            'audio/ogg',
            'audio/m4a',
            'audio/flac'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的音频格式'));
        }
    }
});

class ExternalAudioTranslationService {
    constructor() {
        this.activeListeners = new Map();
        this.audioProcessingQueue = new Map();
        this.noiseProfiles = new Map();
        this.supportedLanguages = [
            { code: 'zh-CN', name: '中文(简体)', flag: '🇨🇳' },
            { code: 'en-US', name: 'English', flag: '🇺🇸' },
            { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
            { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
            { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
            { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
            { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
            { code: 'pt-PT', name: 'Português', flag: '🇵🇹' },
            { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
            { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
            { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
            { code: 'th-TH', name: 'ไทย', flag: '🇹🇭' },
            { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' }
        ];
        
        // 音频处理配置
        this.audioConfig = {
            sampleRate: 44100,
            channels: 1,
            bitDepth: 16,
            chunkDuration: 2000, // 2秒
            silenceThreshold: 0.01,
            noiseReductionLevel: 0.5
        };
    }

    // 获取上传中间件
    getUploadMiddleware() {
        return upload.single('audio');
    }

    // 启动外部音频监听
    async startExternalAudioListening(sessionId, options = {}) {
        try {
            const {
                sourceLanguage = 'auto',
                targetLanguage = 'en-US',
                sensitivity = 0.5,
                noiseReduction = true,
                autoTranslate = true,
                continuousMode = true,
                maxDuration = 300000 // 5分钟最大监听时间
            } = options;

            const listenerData = {
                sessionId,
                sourceLanguage,
                targetLanguage,
                sensitivity,
                noiseReduction,
                autoTranslate,
                continuousMode,
                maxDuration,
                startTime: Date.now(),
                isActive: true,
                audioBuffer: Buffer.alloc(0),
                lastProcessTime: Date.now(),
                translationCount: 0,
                audioQualityHistory: [],
                detectedSpeakers: new Set(),
                backgroundNoiseLevel: 0
            };

            this.activeListeners.set(sessionId, listenerData);

            // 初始化噪音配置文件
            await this.initializeNoiseProfile(sessionId);

            return {
                sessionId,
                status: 'listening',
                config: {
                    sourceLanguage,
                    targetLanguage,
                    sensitivity,
                    noiseReduction,
                    autoTranslate,
                    continuousMode
                },
                message: '外部音频监听已启动'
            };

        } catch (error) {
            console.error('启动外部音频监听失败:', error);
            throw new Error(`启动外部音频监听失败: ${error.message}`);
        }
    }

    // 处理外部音频数据
    async processExternalAudio(audioBuffer, options = {}) {
        try {
            const {
                sessionId = uuidv4(),
                sourceLanguage = 'auto',
                targetLanguage = 'en-US',
                audioFormat = 'webm',
                enhanceAudio = true,
                detectSpeakers = false
            } = options;

            // 保存原始音频
            const audioId = uuidv4();
            const audioPath = path.join(__dirname, '../temp', `external_${audioId}.${audioFormat}`);
            
            const tempDir = path.dirname(audioPath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(audioPath, audioBuffer);

            // 音频预处理
            const preprocessedAudio = await this.preprocessAudio(audioBuffer, sessionId, {
                enhanceAudio,
                detectSpeakers
            });

            // 检测语音活动
            const voiceActivity = await this.detectVoiceActivity(preprocessedAudio.audioData);
            
            if (!voiceActivity.hasVoice) {
                return {
                    sessionId,
                    audioId,
                    status: 'no_voice_detected',
                    message: '未检测到语音内容',
                    metadata: {
                        audioQuality: preprocessedAudio.quality,
                        noiseLevel: voiceActivity.noiseLevel,
                        duration: preprocessedAudio.duration
                    }
                };
            }

            // 语音识别
            const transcriptionResult = await this.transcribeExternalAudio(
                preprocessedAudio.audioData, 
                sourceLanguage,
                {
                    speakerInfo: preprocessedAudio.speakerInfo,
                    audioQuality: preprocessedAudio.quality
                }
            );

            // 翻译文本
            const translationResult = await this.translateExternalText(
                transcriptionResult.text,
                sourceLanguage,
                targetLanguage,
                {
                    context: transcriptionResult.context,
                    confidence: transcriptionResult.confidence
                }
            );

            // 生成翻译语音
            const translatedAudioPath = await this.generateTranslatedSpeech(
                translationResult.translatedText,
                targetLanguage,
                {
                    voiceStyle: 'natural',
                    speed: 1.0,
                    pitch: 0
                }
            );

            // 更新监听器统计
            await this.updateListenerStats(sessionId, {
                transcriptionResult,
                translationResult,
                audioQuality: preprocessedAudio.quality
            });

            // 清理临时文件
            setTimeout(() => {
                if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                }
            }, 120000); // 2分钟后清理

            return {
                sessionId,
                audioId,
                status: 'success',
                transcription: {
                    text: transcriptionResult.text,
                    language: transcriptionResult.detectedLanguage || sourceLanguage,
                    confidence: transcriptionResult.confidence,
                    speakers: transcriptionResult.speakers || [],
                    timestamps: transcriptionResult.timestamps || []
                },
                translation: {
                    text: translationResult.translatedText,
                    language: targetLanguage,
                    confidence: translationResult.confidence,
                    context: translationResult.context || 'general'
                },
                audio: {
                    originalPath: audioPath,
                    translatedPath: translatedAudioPath,
                    format: audioFormat,
                    duration: preprocessedAudio.duration,
                    quality: preprocessedAudio.quality
                },
                metadata: {
                    processingTime: Date.now(),
                    voiceActivity: voiceActivity,
                    speakerInfo: preprocessedAudio.speakerInfo,
                    sourceType: 'external_audio',
                    enhancementApplied: enhanceAudio
                }
            };

        } catch (error) {
            console.error('处理外部音频失败:', error);
            throw new Error(`外部音频处理失败: ${error.message}`);
        }
    }

    // 音频预处理
    async preprocessAudio(audioBuffer, sessionId, options = {}) {
        try {
            const { enhanceAudio = true, detectSpeakers = false } = options;
            
            let processedAudio = audioBuffer;
            let quality = this.analyzeAudioQuality(audioBuffer);
            let speakerInfo = null;

            // 噪音降噪
            if (enhanceAudio) {
                processedAudio = await this.applyNoiseReduction(processedAudio, sessionId);
                quality = this.analyzeAudioQuality(processedAudio);
            }

            // 说话人检测
            if (detectSpeakers) {
                speakerInfo = await this.detectSpeakers(processedAudio);
            }

            // 音频增强
            if (enhanceAudio && quality.quality === 'poor') {
                processedAudio = await this.enhanceAudioQuality(processedAudio);
                quality = this.analyzeAudioQuality(processedAudio);
            }

            return {
                audioData: processedAudio,
                quality: quality,
                speakerInfo: speakerInfo,
                duration: this.calculateAudioDuration(processedAudio)
            };

        } catch (error) {
            console.error('音频预处理失败:', error);
            return {
                audioData: audioBuffer,
                quality: this.analyzeAudioQuality(audioBuffer),
                speakerInfo: null,
                duration: this.calculateAudioDuration(audioBuffer)
            };
        }
    }

    // 检测语音活动
    async detectVoiceActivity(audioBuffer) {
        try {
            // 简单的语音活动检测算法
            const samples = this.audioBufferToSamples(audioBuffer);
            const frameSize = 1024;
            const hopSize = 512;
            
            let voiceFrames = 0;
            let totalFrames = 0;
            let maxAmplitude = 0;
            let avgAmplitude = 0;
            let totalAmplitude = 0;

            for (let i = 0; i < samples.length - frameSize; i += hopSize) {
                const frame = samples.slice(i, i + frameSize);
                const energy = frame.reduce((sum, sample) => sum + sample * sample, 0) / frameSize;
                const amplitude = Math.sqrt(energy);
                
                totalAmplitude += amplitude;
                maxAmplitude = Math.max(maxAmplitude, amplitude);
                totalFrames++;

                // 简单的语音检测阈值
                if (amplitude > this.audioConfig.silenceThreshold) {
                    voiceFrames++;
                }
            }

            avgAmplitude = totalAmplitude / totalFrames;
            const voiceRatio = voiceFrames / totalFrames;
            const hasVoice = voiceRatio > 0.1; // 至少10%的帧包含语音

            return {
                hasVoice,
                voiceRatio,
                maxAmplitude,
                avgAmplitude,
                noiseLevel: avgAmplitude,
                confidence: hasVoice ? Math.min(voiceRatio * 2, 1.0) : 0
            };

        } catch (error) {
            console.error('语音活动检测失败:', error);
            return {
                hasVoice: true, // 默认假设有语音
                voiceRatio: 0.5,
                maxAmplitude: 0.1,
                avgAmplitude: 0.05,
                noiseLevel: 0.05,
                confidence: 0.5
            };
        }
    }

    // 外部音频转录
    async transcribeExternalAudio(audioData, language, options = {}) {
        try {
            const { speakerInfo, audioQuality } = options;

            // 模拟外部音频转录
            const mockTranscriptions = {
                'zh-CN': [
                    '请问这个产品的价格是多少？',
                    '今天的会议几点开始？',
                    '这道菜的味道真不错',
                    '请帮我预订明天的机票',
                    '这个地方的风景很美'
                ],
                'en-US': [
                    'What is the price of this product?',
                    'What time does the meeting start today?',
                    'This dish tastes really good',
                    'Please help me book a flight for tomorrow',
                    'The scenery here is beautiful'
                ],
                'ja-JP': [
                    'この商品の価格はいくらですか？',
                    '今日の会議は何時に始まりますか？',
                    'この料理はとても美味しいです',
                    '明日の航空券を予約してください',
                    'ここの景色はとても美しいです'
                ]
            };

            const texts = mockTranscriptions[language] || mockTranscriptions['en-US'];
            const randomText = texts[Math.floor(Math.random() * texts.length)];

            // 模拟说话人信息
            const speakers = speakerInfo ? speakerInfo.speakers : [
                { id: 'speaker_1', confidence: 0.9, gender: 'unknown' }
            ];

            return {
                text: randomText,
                detectedLanguage: language,
                confidence: 0.88 + (audioQuality.quality === 'excellent' ? 0.1 : 0),
                speakers: speakers,
                timestamps: [
                    { start: 0, end: randomText.length * 100, text: randomText }
                ],
                context: this.detectContext(randomText)
            };

        } catch (error) {
            console.error('外部音频转录失败:', error);
            throw new Error(`转录失败: ${error.message}`);
        }
    }

    // 翻译外部文本
    async translateExternalText(text, sourceLanguage, targetLanguage, options = {}) {
        try {
            const { context = 'general', confidence = 0.9 } = options;

            // 根据上下文调整翻译
            const contextualTranslations = {
                'business': {
                    'zh-CN_en-US': {
                        '请问这个产品的价格是多少？': 'What is the price of this product?',
                        '今天的会议几点开始？': 'What time does the meeting start today?',
                        '请帮我预订明天的机票': 'Please help me book a flight for tomorrow'
                    }
                },
                'casual': {
                    'zh-CN_en-US': {
                        '这道菜的味道真不错': 'This dish tastes really good',
                        '这个地方的风景很美': 'The scenery here is beautiful'
                    }
                }
            };

            const translationKey = `${sourceLanguage}_${targetLanguage}`;
            let translatedText = text;

            // 尝试上下文翻译
            if (contextualTranslations[context] && contextualTranslations[context][translationKey]) {
                const contextTranslations = contextualTranslations[context][translationKey];
                if (contextTranslations[text]) {
                    translatedText = contextTranslations[text];
                }
            }

            // 通用翻译
            if (translatedText === text) {
                const generalTranslations = {
                    'zh-CN_en-US': {
                        '请问这个产品的价格是多少？': 'What is the price of this product?',
                        '今天的会议几点开始？': 'What time does the meeting start today?',
                        '这道菜的味道真不错': 'This dish tastes really good',
                        '请帮我预订明天的机票': 'Please help me book a flight for tomorrow',
                        '这个地方的风景很美': 'The scenery here is beautiful'
                    }
                };

                if (generalTranslations[translationKey] && generalTranslations[translationKey][text]) {
                    translatedText = generalTranslations[translationKey][text];
                } else {
                    translatedText = `[${targetLanguage}] ${text}`;
                }
            }

            return {
                translatedText,
                confidence: Math.min(confidence + 0.05, 0.98),
                context: context
            };

        } catch (error) {
            console.error('外部文本翻译失败:', error);
            throw new Error(`翻译失败: ${error.message}`);
        }
    }

    // 生成翻译语音
    async generateTranslatedSpeech(text, language, options = {}) {
        try {
            const { voiceStyle = 'natural', speed = 1.0, pitch = 0 } = options;
            
            const audioId = uuidv4();
            const audioPath = path.join(__dirname, '../temp', `external_speech_${audioId}.mp3`);
            
            const tempDir = path.dirname(audioPath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // 创建模拟音频文件
            const mp3Header = Buffer.from([
                0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
            fs.writeFileSync(audioPath, mp3Header);

            return audioPath;

        } catch (error) {
            console.error('生成翻译语音失败:', error);
            throw new Error(`语音生成失败: ${error.message}`);
        }
    }

    // 初始化噪音配置文件
    async initializeNoiseProfile(sessionId) {
        try {
            const noiseProfile = {
                sessionId,
                backgroundNoise: 0.02,
                frequencyProfile: new Array(256).fill(0),
                adaptiveThreshold: this.audioConfig.silenceThreshold,
                lastUpdate: Date.now()
            };

            this.noiseProfiles.set(sessionId, noiseProfile);
            return noiseProfile;

        } catch (error) {
            console.error('初始化噪音配置文件失败:', error);
            return null;
        }
    }

    // 应用噪音降噪
    async applyNoiseReduction(audioBuffer, sessionId) {
        try {
            const noiseProfile = this.noiseProfiles.get(sessionId);
            if (!noiseProfile) {
                return audioBuffer;
            }

            // 简单的噪音降噪算法
            const samples = this.audioBufferToSamples(audioBuffer);
            const processedSamples = samples.map(sample => {
                const amplitude = Math.abs(sample);
                if (amplitude < noiseProfile.adaptiveThreshold) {
                    return sample * 0.1; // 降低低幅度信号
                }
                return sample;
            });

            return this.samplesToAudioBuffer(processedSamples);

        } catch (error) {
            console.error('噪音降噪失败:', error);
            return audioBuffer;
        }
    }

    // 检测说话人
    async detectSpeakers(audioBuffer) {
        try {
            // 简单的说话人检测模拟
            const speakers = [
                {
                    id: 'speaker_1',
                    confidence: 0.85 + Math.random() * 0.1,
                    gender: Math.random() > 0.5 ? 'male' : 'female',
                    ageGroup: ['young', 'adult', 'senior'][Math.floor(Math.random() * 3)],
                    segments: [{ start: 0, end: this.calculateAudioDuration(audioBuffer) }]
                }
            ];

            return {
                speakers,
                speakerCount: speakers.length,
                confidence: speakers[0].confidence
            };

        } catch (error) {
            console.error('说话人检测失败:', error);
            return null;
        }
    }

    // 增强音频质量
    async enhanceAudioQuality(audioBuffer) {
        try {
            // 简单的音频增强
            const samples = this.audioBufferToSamples(audioBuffer);
            const enhancedSamples = samples.map(sample => {
                // 简单的增益和压缩
                const gained = sample * 1.5;
                return Math.tanh(gained); // 软限制
            });

            return this.samplesToAudioBuffer(enhancedSamples);

        } catch (error) {
            console.error('音频增强失败:', error);
            return audioBuffer;
        }
    }

    // 检测上下文
    detectContext(text) {
        const businessKeywords = ['价格', '会议', '预订', '机票', '产品', 'price', 'meeting', 'book', 'product'];
        const casualKeywords = ['味道', '风景', '美', 'taste', 'scenery', 'beautiful'];

        const lowerText = text.toLowerCase();
        
        if (businessKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return 'business';
        } else if (casualKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return 'casual';
        }
        
        return 'general';
    }

    // 更新监听器统计
    async updateListenerStats(sessionId, data) {
        try {
            const listener = this.activeListeners.get(sessionId);
            if (!listener) return;

            listener.translationCount++;
            listener.audioQualityHistory.push(data.audioQuality);
            listener.lastProcessTime = Date.now();

            // 保持历史记录在合理范围内
            if (listener.audioQualityHistory.length > 100) {
                listener.audioQualityHistory = listener.audioQualityHistory.slice(-50);
            }

        } catch (error) {
            console.error('更新监听器统计失败:', error);
        }
    }

    // 停止外部音频监听
    async stopExternalAudioListening(sessionId) {
        try {
            const listener = this.activeListeners.get(sessionId);
            if (!listener) {
                return {
                    sessionId,
                    status: 'not_found',
                    message: '监听会话不存在'
                };
            }

            listener.isActive = false;
            const duration = Date.now() - listener.startTime;

            const stats = {
                sessionId,
                duration,
                translationCount: listener.translationCount,
                avgAudioQuality: this.calculateAvgQuality(listener.audioQualityHistory),
                detectedSpeakers: Array.from(listener.detectedSpeakers)
            };

            this.activeListeners.delete(sessionId);
            this.noiseProfiles.delete(sessionId);

            return {
                sessionId,
                status: 'stopped',
                stats,
                message: '外部音频监听已停止'
            };

        } catch (error) {
            console.error('停止外部音频监听失败:', error);
            throw new Error(`停止监听失败: ${error.message}`);
        }
    }

    // 辅助方法
    audioBufferToSamples(buffer) {
        const samples = [];
        for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i) / 32768.0;
            samples.push(sample);
        }
        return samples;
    }

    samplesToAudioBuffer(samples) {
        const buffer = Buffer.alloc(samples.length * 2);
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            buffer.writeInt16LE(Math.round(sample * 32767), i * 2);
        }
        return buffer;
    }

    calculateAudioDuration(audioBuffer) {
        return (audioBuffer.length / 2) / this.audioConfig.sampleRate;
    }

    analyzeAudioQuality(audioBuffer) {
        const size = audioBuffer.length;
        const samples = this.audioBufferToSamples(audioBuffer);
        const avgAmplitude = samples.reduce((sum, sample) => sum + Math.abs(sample), 0) / samples.length;
        
        let quality = 'good';
        if (avgAmplitude < 0.01) {
            quality = 'poor';
        } else if (avgAmplitude < 0.05) {
            quality = 'fair';
        } else if (avgAmplitude > 0.3) {
            quality = 'excellent';
        }

        return {
            quality,
            size,
            avgAmplitude,
            estimatedDuration: this.calculateAudioDuration(audioBuffer)
        };
    }

    calculateAvgQuality(qualityHistory) {
        if (qualityHistory.length === 0) return 'unknown';
        
        const qualityScores = qualityHistory.map(q => {
            switch (q.quality) {
                case 'excellent': return 4;
                case 'good': return 3;
                case 'fair': return 2;
                case 'poor': return 1;
                default: return 2;
            }
        });

        const avgScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        
        if (avgScore >= 3.5) return 'excellent';
        if (avgScore >= 2.5) return 'good';
        if (avgScore >= 1.5) return 'fair';
        return 'poor';
    }

    // 获取支持的语言列表
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 获取活动监听器
    getActiveListener(sessionId) {
        return this.activeListeners.get(sessionId);
    }

    // 获取所有活动监听器
    getAllActiveListeners() {
        return Array.from(this.activeListeners.keys());
    }

    // 清理过期监听器
    cleanupExpiredListeners(maxAge = 1800000) { // 30分钟
        const now = Date.now();
        for (const [sessionId, listener] of this.activeListeners.entries()) {
            if (now - listener.lastProcessTime > maxAge || now - listener.startTime > listener.maxDuration) {
                this.stopExternalAudioListening(sessionId);
            }
        }
    }
}

module.exports = new ExternalAudioTranslationService();

