const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

class VoiceService {
    constructor() {
        // 配置文件上传
        this.storage = multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadDir = path.join(__dirname, '../../uploads/voice');
                try {
                    await fs.mkdir(uploadDir, { recursive: true });
                    cb(null, uploadDir);
                } catch (error) {
                    cb(error);
                }
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, `voice-${uniqueSuffix}${path.extname(file.originalname)}`);
            }
        });

        this.upload = multer({
            storage: this.storage,
            limits: {
                fileSize: 10 * 1024 * 1024 // 10MB限制
            },
            fileFilter: (req, file, cb) => {
                // 允许的音频格式
                const allowedMimes = [
                    'audio/wav',
                    'audio/mp3',
                    'audio/mpeg',
                    'audio/ogg',
                    'audio/webm',
                    'audio/m4a'
                ];
                
                if (allowedMimes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('不支持的音频格式'));
                }
            }
        });

        // 支持的语言配置
        this.supportedLanguages = {
            'zh': 'zh-CN',
            'en': 'en-US',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'es': 'es-ES',
            'ru': 'ru-RU',
            'ar': 'ar-SA',
            'pt': 'pt-BR',
            'it': 'it-IT',
            'th': 'th-TH',
            'vi': 'vi-VN'
        };
    }

    /**
     * 语音转文字
     * @param {string} audioFilePath 音频文件路径
     * @param {string} language 语言代码
     * @returns {Promise<Object>} 转换结果
     */
    async speechToText(audioFilePath, language = 'zh') {
        try {
            // 这里使用简化的实现，实际项目中应该集成真实的语音识别服务
            // 如Google Cloud Speech-to-Text, Azure Speech Service等
            
            const languageCode = this.supportedLanguages[language] || 'zh-CN';
            
            // 模拟语音识别结果
            const mockTranscription = this.generateMockTranscription(language);
            
            return {
                transcription: mockTranscription,
                language: language,
                confidence: 0.85,
                duration: await this.getAudioDuration(audioFilePath),
                audioUrl: audioFilePath
            };
        } catch (error) {
            console.error('语音转文字失败:', error);
            throw new Error('语音识别失败');
        }
    }

    /**
     * 文字转语音
     * @param {string} text 要转换的文字
     * @param {string} language 语言代码
     * @param {string} voice 语音类型
     * @returns {Promise<Object>} 转换结果
     */
    async textToSpeech(text, language = 'zh', voice = 'female') {
        try {
            // 这里使用简化的实现，实际项目中应该集成真实的TTS服务
            const languageCode = this.supportedLanguages[language] || 'zh-CN';
            
            // 生成音频文件路径
            const audioFileName = `tts-${Date.now()}-${Math.round(Math.random() * 1E9)}.mp3`;
            const audioFilePath = path.join(__dirname, '../../uploads/voice', audioFileName);
            
            // 模拟生成音频文件
            await this.generateMockAudio(audioFilePath, text, language);
            
            return {
                audioUrl: `/uploads/voice/${audioFileName}`,
                text: text,
                language: language,
                voice: voice,
                duration: Math.ceil(text.length * 0.1) // 估算时长
            };
        } catch (error) {
            console.error('文字转语音失败:', error);
            throw new Error('语音合成失败');
        }
    }

    /**
     * 语音翻译（语音转文字 + 翻译 + 文字转语音）
     * @param {string} audioFilePath 音频文件路径
     * @param {string} fromLanguage 源语言
     * @param {string} toLanguage 目标语言
     * @returns {Promise<Object>} 翻译结果
     */
    async voiceTranslation(audioFilePath, fromLanguage, toLanguage) {
        try {
            // 1. 语音转文字
            const sttResult = await this.speechToText(audioFilePath, fromLanguage);
            
            // 2. 文字翻译
            const TranslationService = require('./translationService');
            const translationService = new TranslationService();
            const translationResult = await translationService.translateText(
                sttResult.transcription,
                fromLanguage,
                toLanguage
            );
            
            // 3. 文字转语音
            const ttsResult = await this.textToSpeech(
                translationResult.translatedText,
                toLanguage
            );
            
            return {
                original: {
                    text: sttResult.transcription,
                    language: fromLanguage,
                    audioUrl: audioFilePath,
                    confidence: sttResult.confidence
                },
                translated: {
                    text: translationResult.translatedText,
                    language: toLanguage,
                    audioUrl: ttsResult.audioUrl,
                    confidence: translationResult.confidence
                },
                duration: {
                    original: sttResult.duration,
                    translated: ttsResult.duration
                }
            };
        } catch (error) {
            console.error('语音翻译失败:', error);
            throw new Error('语音翻译失败');
        }
    }

    /**
     * 实时语音翻译流处理
     * @param {ReadableStream} audioStream 音频流
     * @param {string} fromLanguage 源语言
     * @param {string} toLanguage 目标语言
     * @param {Function} callback 回调函数
     */
    async streamVoiceTranslation(audioStream, fromLanguage, toLanguage, callback) {
        try {
            // 这里应该实现实时流处理
            // 暂时作为占位符
            callback({
                type: 'interim',
                text: '实时翻译功能开发中...',
                language: toLanguage
            });
        } catch (error) {
            console.error('实时语音翻译失败:', error);
            callback({
                type: 'error',
                message: '实时翻译失败'
            });
        }
    }

    /**
     * 获取音频时长
     * @param {string} audioFilePath 音频文件路径
     * @returns {Promise<number>} 时长（秒）
     */
    async getAudioDuration(audioFilePath) {
        try {
            // 这里应该使用音频处理库获取真实时长
            // 暂时返回模拟值
            return Math.random() * 30 + 5; // 5-35秒
        } catch (error) {
            console.error('获取音频时长失败:', error);
            return 10; // 默认10秒
        }
    }

    /**
     * 生成模拟转录文本
     * @param {string} language 语言代码
     * @returns {string} 模拟转录文本
     */
    generateMockTranscription(language) {
        const mockTexts = {
            'zh': '你好，这是一条语音消息，感谢使用CultureBridge平台进行跨文化交流。',
            'en': 'Hello, this is a voice message. Thank you for using CultureBridge platform for cross-cultural communication.',
            'ja': 'こんにちは、これは音声メッセージです。CultureBridgeプラットフォームをご利用いただき、ありがとうございます。',
            'ko': '안녕하세요, 이것은 음성 메시지입니다. CultureBridge 플랫폼을 이용해 주셔서 감사합니다.',
            'fr': 'Bonjour, ceci est un message vocal. Merci d\'utiliser la plateforme CultureBridge.',
            'de': 'Hallo, das ist eine Sprachnachricht. Vielen Dank für die Nutzung der CultureBridge-Plattform.',
            'es': 'Hola, este es un mensaje de voz. Gracias por usar la plataforma CultureBridge.',
            'ru': 'Привет, это голосовое сообщение. Спасибо за использование платформы CultureBridge.'
        };
        
        return mockTexts[language] || mockTexts['en'];
    }

    /**
     * 生成模拟音频文件
     * @param {string} filePath 文件路径
     * @param {string} text 文本内容
     * @param {string} language 语言
     */
    async generateMockAudio(filePath, text, language) {
        try {
            // 创建一个空的音频文件作为占位符
            // 实际项目中应该调用TTS服务生成真实音频
            const mockAudioData = Buffer.from('mock audio data for: ' + text);
            await fs.writeFile(filePath, mockAudioData);
        } catch (error) {
            console.error('生成模拟音频失败:', error);
            throw error;
        }
    }

    /**
     * 删除音频文件
     * @param {string} filePath 文件路径
     */
    async deleteAudioFile(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.warn('删除音频文件失败:', error);
        }
    }

    /**
     * 获取支持的语言列表
     * @returns {Array} 支持的语言列表
     */
    getSupportedLanguages() {
        return Object.keys(this.supportedLanguages).map(code => ({
            code,
            name: this.getLanguageName(code),
            googleCode: this.supportedLanguages[code]
        }));
    }

    /**
     * 获取语言名称
     * @param {string} code 语言代码
     * @returns {string} 语言名称
     */
    getLanguageName(code) {
        const names = {
            'zh': '中文',
            'en': 'English',
            'ja': '日本語',
            'ko': '한국어',
            'fr': 'Français',
            'de': 'Deutsch',
            'es': 'Español',
            'ru': 'Русский',
            'ar': 'العربية',
            'pt': 'Português',
            'it': 'Italiano',
            'th': 'ไทย',
            'vi': 'Tiếng Việt'
        };
        return names[code] || code;
    }

    /**
     * 验证音频文件
     * @param {string} filePath 文件路径
     * @returns {Promise<boolean>} 是否有效
     */
    async validateAudioFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.isFile() && stats.size > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取文件上传中间件
     * @returns {Function} Multer中间件
     */
    getUploadMiddleware() {
        return this.upload.single('audio');
    }
}

module.exports = VoiceService;

