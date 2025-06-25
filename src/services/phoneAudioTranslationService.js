const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/wav',
            'audio/mp3',
            'audio/mpeg',
            'audio/webm',
            'audio/ogg',
            'audio/m4a'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的音频格式'));
        }
    }
});

class PhoneAudioTranslationService {
    constructor() {
        this.activeStreams = new Map();
        this.translationQueue = new Map();
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
            { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' }
        ];
    }

    // 获取上传中间件
    getUploadMiddleware() {
        return upload.single('audio');
    }

    // 处理手机播放内容音频
    async processPhoneAudio(audioBuffer, options = {}) {
        try {
            const {
                sourceLanguage = 'auto',
                targetLanguage = 'en-US',
                sessionId = uuidv4(),
                audioFormat = 'webm',
                sampleRate = 44100
            } = options;

            // 保存音频文件
            const audioId = uuidv4();
            const audioPath = path.join(__dirname, '../temp', `${audioId}.${audioFormat}`);
            
            // 确保临时目录存在
            const tempDir = path.dirname(audioPath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(audioPath, audioBuffer);

            // 模拟音频处理和语音识别
            const transcriptionResult = await this.transcribeAudio(audioPath, sourceLanguage);
            
            // 翻译文本
            const translationResult = await this.translateText(
                transcriptionResult.text,
                sourceLanguage,
                targetLanguage
            );

            // 生成翻译语音
            const translatedAudioPath = await this.generateSpeech(
                translationResult.translatedText,
                targetLanguage
            );

            // 清理临时文件
            setTimeout(() => {
                if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                }
            }, 60000); // 1分钟后清理

            return {
                sessionId,
                audioId,
                transcription: {
                    text: transcriptionResult.text,
                    language: transcriptionResult.detectedLanguage || sourceLanguage,
                    confidence: transcriptionResult.confidence || 0.95
                },
                translation: {
                    text: translationResult.translatedText,
                    language: targetLanguage,
                    confidence: translationResult.confidence || 0.92
                },
                audio: {
                    originalPath: audioPath,
                    translatedPath: translatedAudioPath,
                    format: audioFormat,
                    duration: transcriptionResult.duration || 0
                },
                metadata: {
                    processingTime: Date.now(),
                    audioQuality: this.analyzeAudioQuality(audioBuffer),
                    sourceType: 'phone_playback'
                }
            };

        } catch (error) {
            console.error('处理手机音频失败:', error);
            throw new Error(`音频处理失败: ${error.message}`);
        }
    }

    // 实时音频流处理
    async startRealTimeTranslation(sessionId, options = {}) {
        try {
            const {
                sourceLanguage = 'auto',
                targetLanguage = 'en-US',
                chunkSize = 1024,
                bufferDuration = 3000 // 3秒缓冲
            } = options;

            const streamData = {
                sessionId,
                sourceLanguage,
                targetLanguage,
                audioBuffer: Buffer.alloc(0),
                lastProcessTime: Date.now(),
                isActive: true,
                chunkSize,
                bufferDuration
            };

            this.activeStreams.set(sessionId, streamData);

            return {
                sessionId,
                status: 'started',
                message: '实时翻译已启动'
            };

        } catch (error) {
            console.error('启动实时翻译失败:', error);
            throw new Error(`启动实时翻译失败: ${error.message}`);
        }
    }

    // 处理音频流数据块
    async processAudioChunk(sessionId, audioChunk) {
        try {
            const streamData = this.activeStreams.get(sessionId);
            if (!streamData || !streamData.isActive) {
                throw new Error('无效的会话ID或会话已结束');
            }

            // 将音频块添加到缓冲区
            streamData.audioBuffer = Buffer.concat([streamData.audioBuffer, audioChunk]);

            // 检查是否需要处理缓冲区
            const now = Date.now();
            if (now - streamData.lastProcessTime >= streamData.bufferDuration) {
                const result = await this.processBufferedAudio(sessionId);
                streamData.lastProcessTime = now;
                streamData.audioBuffer = Buffer.alloc(0); // 清空缓冲区
                return result;
            }

            return {
                sessionId,
                status: 'buffering',
                bufferSize: streamData.audioBuffer.length
            };

        } catch (error) {
            console.error('处理音频块失败:', error);
            throw new Error(`处理音频块失败: ${error.message}`);
        }
    }

    // 处理缓冲的音频
    async processBufferedAudio(sessionId) {
        try {
            const streamData = this.activeStreams.get(sessionId);
            if (!streamData || streamData.audioBuffer.length === 0) {
                return null;
            }

            const result = await this.processPhoneAudio(streamData.audioBuffer, {
                sourceLanguage: streamData.sourceLanguage,
                targetLanguage: streamData.targetLanguage,
                sessionId: sessionId,
                audioFormat: 'webm'
            });

            return {
                sessionId,
                status: 'processed',
                result: result
            };

        } catch (error) {
            console.error('处理缓冲音频失败:', error);
            return {
                sessionId,
                status: 'error',
                error: error.message
            };
        }
    }

    // 停止实时翻译
    async stopRealTimeTranslation(sessionId) {
        try {
            const streamData = this.activeStreams.get(sessionId);
            if (streamData) {
                streamData.isActive = false;
                
                // 处理剩余的缓冲音频
                let finalResult = null;
                if (streamData.audioBuffer.length > 0) {
                    finalResult = await this.processBufferedAudio(sessionId);
                }

                this.activeStreams.delete(sessionId);

                return {
                    sessionId,
                    status: 'stopped',
                    finalResult: finalResult
                };
            }

            return {
                sessionId,
                status: 'not_found',
                message: '会话不存在'
            };

        } catch (error) {
            console.error('停止实时翻译失败:', error);
            throw new Error(`停止实时翻译失败: ${error.message}`);
        }
    }

    // 音频转录（模拟实现）
    async transcribeAudio(audioPath, language) {
        // 这里应该集成真实的语音识别服务，如Google Speech-to-Text, Azure Speech等
        // 目前使用模拟数据
        
        const mockTranscriptions = {
            'zh-CN': [
                '你好，这是一个测试音频',
                '今天天气很好',
                '我正在学习新的语言',
                '这个应用程序很有用'
            ],
            'en-US': [
                'Hello, this is a test audio',
                'The weather is nice today',
                'I am learning a new language',
                'This application is very useful'
            ],
            'ja-JP': [
                'こんにちは、これはテストオーディオです',
                '今日は天気がいいです',
                '新しい言語を学んでいます',
                'このアプリケーションはとても便利です'
            ]
        };

        const texts = mockTranscriptions[language] || mockTranscriptions['en-US'];
        const randomText = texts[Math.floor(Math.random() * texts.length)];

        return {
            text: randomText,
            detectedLanguage: language,
            confidence: 0.95,
            duration: Math.random() * 5 + 2 // 2-7秒
        };
    }

    // 文本翻译
    async translateText(text, sourceLanguage, targetLanguage) {
        // 这里应该集成真实的翻译服务，如Google Translate, Azure Translator等
        // 目前使用模拟数据
        
        const mockTranslations = {
            'zh-CN_en-US': {
                '你好，这是一个测试音频': 'Hello, this is a test audio',
                '今天天气很好': 'The weather is nice today',
                '我正在学习新的语言': 'I am learning a new language',
                '这个应用程序很有用': 'This application is very useful'
            },
            'en-US_zh-CN': {
                'Hello, this is a test audio': '你好，这是一个测试音频',
                'The weather is nice today': '今天天气很好',
                'I am learning a new language': '我正在学习新的语言',
                'This application is very useful': '这个应用程序很有用'
            }
        };

        const translationKey = `${sourceLanguage}_${targetLanguage}`;
        const translations = mockTranslations[translationKey];
        
        let translatedText = text;
        if (translations && translations[text]) {
            translatedText = translations[text];
        } else {
            // 简单的模拟翻译
            translatedText = `[${targetLanguage}] ${text}`;
        }

        return {
            translatedText,
            confidence: 0.92
        };
    }

    // 生成语音（模拟实现）
    async generateSpeech(text, language) {
        // 这里应该集成真实的语音合成服务，如Google Text-to-Speech, Azure Speech等
        // 目前返回模拟路径
        
        const audioId = uuidv4();
        const audioPath = path.join(__dirname, '../temp', `speech_${audioId}.mp3`);
        
        // 创建一个空的音频文件作为占位符
        const tempDir = path.dirname(audioPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 写入一个最小的MP3文件头
        const mp3Header = Buffer.from([
            0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        fs.writeFileSync(audioPath, mp3Header);

        return audioPath;
    }

    // 分析音频质量
    analyzeAudioQuality(audioBuffer) {
        // 简单的音频质量分析
        const size = audioBuffer.length;
        let quality = 'good';
        
        if (size < 1024) {
            quality = 'poor';
        } else if (size < 10240) {
            quality = 'fair';
        } else if (size > 1024000) {
            quality = 'excellent';
        }

        return {
            quality,
            size,
            estimatedDuration: Math.round(size / 16000) // 假设16kHz采样率
        };
    }

    // 获取支持的语言列表
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 获取活动会话信息
    getActiveSession(sessionId) {
        return this.activeStreams.get(sessionId);
    }

    // 获取所有活动会话
    getAllActiveSessions() {
        return Array.from(this.activeStreams.keys());
    }

    // 清理过期会话
    cleanupExpiredSessions(maxAge = 3600000) { // 1小时
        const now = Date.now();
        for (const [sessionId, streamData] of this.activeStreams.entries()) {
            if (now - streamData.lastProcessTime > maxAge) {
                this.activeStreams.delete(sessionId);
            }
        }
    }
}

module.exports = new PhoneAudioTranslationService();

