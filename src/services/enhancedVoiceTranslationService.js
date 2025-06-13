const VoiceTranslation = require('../models/VoiceTranslation');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Google Cloud APIs
const speech = require('@google-cloud/speech');
const { Translate } = require('@google-cloud/translate').v2;
const textToSpeech = require('@google-cloud/text-to-speech');

// Redis for caching
const redis = require('redis');

class EnhancedVoiceTranslationService {
    constructor() {
        // 初始化Google Cloud客户端
        this.speechClient = new speech.SpeechClient({
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        
        this.translateClient = new Translate({
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        
        this.ttsClient = new textToSpeech.TextToSpeechClient({
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        
        // Redis缓存客户端
        this.redisClient = redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379
        });
        
        // 支持的语言配置
        this.supportedLanguages = {
            'zh': { 
                name: '中文', 
                voice: 'zh-CN-Wavenet-A',
                speechCode: 'zh-CN',
                culturalContext: ['中华文化', '传统节日', '茶文化', '书法', '太极']
            },
            'en': { 
                name: 'English', 
                voice: 'en-US-Wavenet-D',
                speechCode: 'en-US',
                culturalContext: ['Western culture', 'holidays', 'coffee culture', 'sports', 'movies']
            },
            'es': { 
                name: 'Español', 
                voice: 'es-ES-Wavenet-B',
                speechCode: 'es-ES',
                culturalContext: ['cultura hispana', 'flamenco', 'siesta', 'tapas', 'fútbol']
            },
            'fr': { 
                name: 'Français', 
                voice: 'fr-FR-Wavenet-A',
                speechCode: 'fr-FR',
                culturalContext: ['culture française', 'cuisine', 'art', 'mode', 'vin']
            },
            'de': { 
                name: 'Deutsch', 
                voice: 'de-DE-Wavenet-A',
                speechCode: 'de-DE',
                culturalContext: ['deutsche Kultur', 'Oktoberfest', 'Bier', 'Musik', 'Technik']
            },
            'ja': { 
                name: '日本語', 
                voice: 'ja-JP-Wavenet-A',
                speechCode: 'ja-JP',
                culturalContext: ['日本文化', '茶道', '武道', 'アニメ', '桜']
            },
            'ko': { 
                name: '한국어', 
                voice: 'ko-KR-Wavenet-A',
                speechCode: 'ko-KR',
                culturalContext: ['한국 문화', 'K-pop', '김치', '태권도', '한복']
            },
            'pt': { 
                name: 'Português', 
                voice: 'pt-BR-Wavenet-A',
                speechCode: 'pt-BR',
                culturalContext: ['cultura brasileira', 'samba', 'futebol', 'carnaval', 'capoeira']
            },
            'ru': { 
                name: 'Русский', 
                voice: 'ru-RU-Wavenet-A',
                speechCode: 'ru-RU',
                culturalContext: ['русская культура', 'балет', 'водка', 'матрёшка', 'борщ']
            },
            'ar': { 
                name: 'العربية', 
                voice: 'ar-XA-Wavenet-A',
                speechCode: 'ar-SA',
                culturalContext: ['الثقافة العربية', 'الخط العربي', 'الشاي', 'الضيافة', 'الشعر']
            }
        };
        
        // 文化关键词检测
        this.culturalKeywords = {
            'zh': ['文化', '传统', '习俗', '节日', '历史', '艺术', '美食', '语言'],
            'en': ['culture', 'tradition', 'custom', 'festival', 'history', 'art', 'food', 'language'],
            'es': ['cultura', 'tradición', 'costumbre', 'festival', 'historia', 'arte', 'comida', 'idioma'],
            'fr': ['culture', 'tradition', 'coutume', 'festival', 'histoire', 'art', 'nourriture', 'langue'],
            'de': ['Kultur', 'Tradition', 'Brauch', 'Festival', 'Geschichte', 'Kunst', 'Essen', 'Sprache'],
            'ja': ['文化', '伝統', '習慣', '祭り', '歴史', '芸術', '料理', '言語'],
            'ko': ['문화', '전통', '관습', '축제', '역사', '예술', '음식', '언어'],
            'pt': ['cultura', 'tradição', 'costume', 'festival', 'história', 'arte', 'comida', 'idioma'],
            'ru': ['культура', 'традиция', 'обычай', 'фестиваль', 'история', 'искусство', 'еда', 'язык'],
            'ar': ['ثقافة', 'تقليد', 'عادة', 'مهرجان', 'تاريخ', 'فن', 'طعام', 'لغة']
        };
        
        // 流式识别配置
        this.streamingConfig = {
            config: {
                encoding: 'WEBM_OPUS',
                sampleRateHertz: 48000,
                languageCode: 'zh-CN',
                alternativeLanguageCodes: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'],
                enableAutomaticPunctuation: true,
                enableWordTimeOffsets: true,
                enableWordConfidence: true,
                model: 'latest_long',
                useEnhanced: true
            },
            interimResults: true,
            singleUtterance: false
        };
    }
    
    /**
     * 实时语音转文字（流式识别）
     * @param {ReadableStream} audioStream 音频流
     * @param {string} language 语言代码
     * @param {Function} onResult 结果回调函数
     * @param {Function} onError 错误回调函数
     * @returns {Promise<Object>} 流式识别对象
     */
    async startStreamingRecognition(audioStream, language = 'auto', onResult, onError) {
        try {
            const config = { ...this.streamingConfig };
            
            if (language !== 'auto') {
                config.config.languageCode = this.getLanguageCode(language);
                config.config.alternativeLanguageCodes = [];
            }
            
            const recognizeStream = this.speechClient
                .streamingRecognize(config)
                .on('error', (error) => {
                    console.error('流式识别错误:', error);
                    if (onError) onError(error);
                })
                .on('data', (data) => {
                    if (data.results[0] && data.results[0].alternatives[0]) {
                        const result = {
                            transcript: data.results[0].alternatives[0].transcript,
                            confidence: data.results[0].alternatives[0].confidence || 0,
                            isFinal: data.results[0].isFinal,
                            stability: data.results[0].stability || 0,
                            words: data.results[0].alternatives[0].words || [],
                            detectedLanguage: this.normalizeLanguageCode(data.results[0].languageCode || language)
                        };
                        
                        if (onResult) onResult(result);
                    }
                });
            
            // 将音频流连接到识别流
            audioStream.pipe(recognizeStream);
            
            return recognizeStream;
        } catch (error) {
            console.error('启动流式识别失败:', error);
            throw new Error('流式语音识别服务暂时不可用');
        }
    }
    
    /**
     * 语音转文字（批量识别）
     * @param {Buffer} audioBuffer 音频数据
     * @param {string} language 语言代码
     * @returns {Promise<Object>} 转录结果
     */
    async transcribeAudio(audioBuffer, language = 'auto') {
        try {
            // 检查缓存
            const cacheKey = `transcribe_${this.generateAudioHash(audioBuffer)}_${language}`;
            const cachedResult = await this.redisClient.get(cacheKey);
            
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }
            
            const request = {
                audio: {
                    content: audioBuffer.toString('base64')
                },
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 48000,
                    languageCode: language === 'auto' ? 'zh-CN' : this.getLanguageCode(language),
                    alternativeLanguageCodes: language === 'auto' ? ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'] : [],
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true,
                    enableWordConfidence: true,
                    model: 'latest_long',
                    useEnhanced: true,
                    profanityFilter: false,
                    enableSpeakerDiarization: false,
                    diarizationSpeakerCount: 1
                }
            };
            
            const [response] = await this.speechClient.recognize(request);
            
            if (!response.results || response.results.length === 0) {
                throw new Error('无法识别语音内容');
            }
            
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join(' ');
                
            const confidence = response.results[0].alternatives[0].confidence || 0;
            const detectedLanguage = this.normalizeLanguageCode(response.results[0].languageCode || language);
            
            // 检测文化内容
            const culturalContext = this.detectCulturalContent(transcription, detectedLanguage);
            
            const result = {
                text: transcription,
                confidence,
                detectedLanguage,
                culturalContext,
                wordTimings: response.results[0].alternatives[0].words || [],
                alternatives: response.results[0].alternatives.slice(1).map(alt => ({
                    text: alt.transcript,
                    confidence: alt.confidence || 0
                }))
            };
            
            // 缓存结果（1小时）
            await this.redisClient.setex(cacheKey, 3600, JSON.stringify(result));
            
            return result;
        } catch (error) {
            console.error('语音转文字失败:', error);
            throw new Error('语音识别服务暂时不可用');
        }
    }
    
    /**
     * 文本翻译（支持文化上下文）
     * @param {string} text 要翻译的文本
     * @param {string} sourceLanguage 源语言
     * @param {string} targetLanguage 目标语言
     * @param {string} culturalContext 文化上下文
     * @returns {Promise<Object>} 翻译结果
     */
    async translateText(text, sourceLanguage, targetLanguage, culturalContext = null) {
        try {
            if (sourceLanguage === targetLanguage) {
                return {
                    text: text,
                    confidence: 1.0,
                    detectedLanguage: sourceLanguage,
                    culturalNotes: []
                };
            }
            
            // 检查缓存
            const cacheKey = `translate_${this.generateTextHash(text)}_${sourceLanguage}_${targetLanguage}`;
            const cachedResult = await this.redisClient.get(cacheKey);
            
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }
            
            // 如果有文化上下文，添加到翻译文本中
            let textToTranslate = text;
            if (culturalContext) {
                textToTranslate = `[文化背景: ${culturalContext}] ${text}`;
            }
            
            const [translation, metadata] = await this.translateClient.translate(textToTranslate, {
                from: sourceLanguage,
                to: targetLanguage
            });
            
            let translatedText = Array.isArray(translation) ? translation[0] : translation;
            
            // 移除文化背景标记
            if (culturalContext) {
                translatedText = translatedText.replace(/^\[.*?\]\s*/, '');
            }
            
            // 生成文化注释
            const culturalNotes = this.generateCulturalNotes(text, sourceLanguage, targetLanguage);
            
            const result = {
                text: translatedText,
                confidence: 0.95,
                detectedLanguage: metadata.data.translations[0].detectedSourceLanguage || sourceLanguage,
                culturalNotes,
                originalText: text
            };
            
            // 缓存结果（24小时）
            await this.redisClient.setex(cacheKey, 86400, JSON.stringify(result));
            
            return result;
        } catch (error) {
            console.error('文本翻译失败:', error);
            throw new Error('翻译服务暂时不可用');
        }
    }
    
    /**
     * 文字转语音（支持情感和语调）
     * @param {string} text 要合成的文本
     * @param {string} language 语言代码
     * @param {Object} options 语音选项
     * @returns {Promise<Buffer>} 音频数据
     */
    async synthesizeSpeech(text, language, options = {}) {
        try {
            const {
                voiceType = 'neutral',
                speakingRate = 1.0,
                pitch = 0.0,
                volumeGain = 0.0,
                emotion = 'neutral'
            } = options;
            
            // 检查缓存
            const cacheKey = `tts_${this.generateTextHash(text)}_${language}_${JSON.stringify(options)}`;
            const cachedResult = await this.redisClient.get(cacheKey);
            
            if (cachedResult) {
                return Buffer.from(cachedResult, 'base64');
            }
            
            const voiceName = this.supportedLanguages[language]?.voice || 'en-US-Wavenet-D';
            
            // 根据情感调整语音参数
            let adjustedPitch = pitch;
            let adjustedRate = speakingRate;
            
            switch (emotion) {
                case 'happy':
                    adjustedPitch += 2.0;
                    adjustedRate += 0.1;
                    break;
                case 'sad':
                    adjustedPitch -= 2.0;
                    adjustedRate -= 0.1;
                    break;
                case 'excited':
                    adjustedPitch += 3.0;
                    adjustedRate += 0.2;
                    break;
                case 'calm':
                    adjustedPitch -= 1.0;
                    adjustedRate -= 0.05;
                    break;
            }
            
            const request = {
                input: { text: text },
                voice: {
                    languageCode: this.getLanguageCode(language),
                    name: voiceName,
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: Math.max(0.25, Math.min(4.0, adjustedRate)),
                    pitch: Math.max(-20.0, Math.min(20.0, adjustedPitch)),
                    volumeGainDb: Math.max(-96.0, Math.min(16.0, volumeGain)),
                    effectsProfileId: ['telephony-class-application']
                }
            };
            
            const [response] = await this.ttsClient.synthesizeSpeech(request);
            
            // 缓存结果（1小时）
            await this.redisClient.setex(cacheKey, 3600, response.audioContent.toString('base64'));
            
            return response.audioContent;
        } catch (error) {
            console.error('文字转语音失败:', error);
            throw new Error('语音合成服务暂时不可用');
        }
    }
    
    /**
     * 处理语音消息（完整流程）
     * @param {Object} data 语音消息数据
     * @returns {Promise<Object>} 处理结果
     */
    async processVoiceMessage(data) {
        try {
            const { audioData, sourceLanguage, targetLanguage, userId, roomId } = data;
            
            // 1. 语音转文字
            const transcriptionResult = await this.transcribeAudio(audioData, sourceLanguage);
            
            if (!transcriptionResult.text) {
                return { success: false, error: '无法识别语音内容' };
            }
            
            // 2. 翻译文本
            const translationResult = await this.translateText(
                transcriptionResult.text,
                transcriptionResult.detectedLanguage,
                targetLanguage,
                transcriptionResult.culturalContext
            );
            
            // 3. 生成翻译后的语音
            const translatedAudio = await this.synthesizeSpeech(
                translationResult.text,
                targetLanguage,
                { emotion: 'neutral', speakingRate: 1.0 }
            );
            
            // 4. 保存音频文件
            const originalAudioPath = await this.saveAudioFile(audioData, 'original', userId);
            const translatedAudioPath = await this.saveAudioFile(translatedAudio, 'translated', userId);
            
            // 5. 保存到数据库
            const voiceTranslation = new VoiceTranslation({
                user: userId,
                chatRoom: roomId,
                originalText: transcriptionResult.text,
                translatedText: translationResult.text,
                sourceLanguage: transcriptionResult.detectedLanguage,
                targetLanguage: targetLanguage,
                originalAudioPath: originalAudioPath,
                translatedAudioPath: translatedAudioPath,
                confidence: transcriptionResult.confidence,
                culturalContext: transcriptionResult.culturalContext,
                culturalNotes: translationResult.culturalNotes,
                processingTime: Date.now() - data.startTime || 0
            });
            
            await voiceTranslation.save();
            
            return {
                success: true,
                originalText: transcriptionResult.text,
                translatedText: translationResult.text,
                originalAudioUrl: `/audio/${path.basename(originalAudioPath)}`,
                translatedAudioUrl: `/audio/${path.basename(translatedAudioPath)}`,
                confidence: transcriptionResult.confidence,
                culturalContext: transcriptionResult.culturalContext,
                culturalNotes: translationResult.culturalNotes,
                detectedLanguage: transcriptionResult.detectedLanguage
            };
        } catch (error) {
            console.error('处理语音消息失败:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 检测文化内容
     * @param {string} text 文本内容
     * @param {string} language 语言代码
     * @returns {string|null} 文化上下文
     */
    detectCulturalContent(text, language) {
        const keywords = this.culturalKeywords[language] || [];
        const culturalContext = this.supportedLanguages[language]?.culturalContext || [];
        
        // 检查是否包含文化关键词
        const hasCulturalKeywords = keywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasCulturalKeywords) {
            // 尝试匹配具体的文化主题
            for (const context of culturalContext) {
                if (text.toLowerCase().includes(context.toLowerCase())) {
                    return context;
                }
            }
            return '文化交流';
        }
        
        return null;
    }
    
    /**
     * 生成文化注释
     * @param {string} text 原文本
     * @param {string} sourceLanguage 源语言
     * @param {string} targetLanguage 目标语言
     * @returns {Array} 文化注释数组
     */
    generateCulturalNotes(text, sourceLanguage, targetLanguage) {
        const notes = [];
        
        // 简化的文化注释生成逻辑
        const culturalTerms = {
            'zh': {
                '春节': 'Chinese New Year, the most important traditional festival in China',
                '中秋节': 'Mid-Autumn Festival, a harvest festival celebrated in Chinese culture',
                '茶文化': 'Tea culture, an important part of Chinese tradition',
                '太极': 'Tai Chi, a traditional Chinese martial art'
            },
            'en': {
                'thanksgiving': '感恩节，美国的传统节日，感谢丰收和祝福',
                'halloween': '万圣节，西方传统节日，孩子们会装扮成各种角色',
                'christmas': '圣诞节，庆祝耶稣基督诞生的基督教节日'
            }
        };
        
        const terms = culturalTerms[sourceLanguage] || {};
        
        for (const [term, explanation] of Object.entries(terms)) {
            if (text.toLowerCase().includes(term.toLowerCase())) {
                notes.push({
                    term: term,
                    explanation: explanation,
                    category: 'cultural'
                });
            }
        }
        
        return notes;
    }
    
    /**
     * 保存音频文件
     * @param {Buffer} audioData 音频数据
     * @param {string} type 文件类型
     * @param {string} userId 用户ID
     * @returns {Promise<string>} 文件路径
     */
    async saveAudioFile(audioData, type, userId) {
        try {
            const audioDir = path.join(process.cwd(), 'uploads', 'audio');
            await fs.mkdir(audioDir, { recursive: true });
            
            const filename = `${type}_${userId}_${Date.now()}.mp3`;
            const filepath = path.join(audioDir, filename);
            
            await fs.writeFile(filepath, audioData);
            
            return filepath;
        } catch (error) {
            console.error('保存音频文件失败:', error);
            throw new Error('保存音频文件失败');
        }
    }
    
    /**
     * 生成音频哈希
     * @param {Buffer} audioBuffer 音频数据
     * @returns {string} 哈希值
     */
    generateAudioHash(audioBuffer) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(audioBuffer).digest('hex');
    }
    
    /**
     * 生成文本哈希
     * @param {string} text 文本内容
     * @returns {string} 哈希值
     */
    generateTextHash(text) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(text).digest('hex');
    }
    
    /**
     * 获取语言代码
     * @param {string} language 简化语言代码
     * @returns {string} 完整语言代码
     */
    getLanguageCode(language) {
        return this.supportedLanguages[language]?.speechCode || 'en-US';
    }
    
    /**
     * 标准化语言代码
     * @param {string} languageCode 完整语言代码
     * @returns {string} 简化语言代码
     */
    normalizeLanguageCode(languageCode) {
        const mapping = {
            'zh-CN': 'zh',
            'zh-TW': 'zh',
            'en-US': 'en',
            'en-GB': 'en',
            'es-ES': 'es',
            'es-MX': 'es',
            'fr-FR': 'fr',
            'fr-CA': 'fr',
            'de-DE': 'de',
            'ja-JP': 'ja',
            'ko-KR': 'ko',
            'pt-BR': 'pt',
            'pt-PT': 'pt',
            'ru-RU': 'ru',
            'ar-SA': 'ar'
        };
        
        return mapping[languageCode] || languageCode.split('-')[0];
    }
    
    /**
     * 获取支持的语言列表
     * @returns {Array} 支持的语言列表
     */
    getSupportedLanguages() {
        return Object.entries(this.supportedLanguages).map(([code, info]) => ({
            code,
            name: info.name,
            culturalContext: info.culturalContext
        }));
    }
    
    /**
     * 关闭服务
     */
    async close() {
        if (this.redisClient) {
            await this.redisClient.quit();
        }
    }
}

module.exports = EnhancedVoiceTranslationService;

