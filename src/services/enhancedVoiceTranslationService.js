const VoiceTranslation = require('../models/VoiceTranslation');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// 语音识别和翻译服务（使用开源替代方案）
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');

class EnhancedVoiceTranslationService {
    constructor() {
        // 配置多个翻译服务提供商
        this.translationProviders = {
            libre: {
                url: process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de/translate',
                apiKey: process.env.LIBRE_TRANSLATE_API_KEY
            },
            mymemory: {
                url: 'https://api.mymemory.translated.net/get',
                email: process.env.MYMEMORY_EMAIL
            },
            azure: {
                url: process.env.AZURE_TRANSLATE_URL,
                apiKey: process.env.AZURE_TRANSLATE_KEY,
                region: process.env.AZURE_TRANSLATE_REGION
            }
        };
        
        // 语音识别服务配置
        this.speechProviders = {
            whisper: {
                url: process.env.WHISPER_API_URL || 'http://localhost:9000/asr',
                model: 'whisper-1'
            },
            azure: {
                url: process.env.AZURE_SPEECH_URL,
                apiKey: process.env.AZURE_SPEECH_KEY,
                region: process.env.AZURE_SPEECH_REGION
            }
        };
        
        // 支持的语言配置
        this.supportedLanguages = {
            'zh': { name: '中文', code: 'zh-CN', whisperCode: 'zh' },
            'en': { name: 'English', code: 'en-US', whisperCode: 'en' },
            'es': { name: 'Español', code: 'es-ES', whisperCode: 'es' },
            'fr': { name: 'Français', code: 'fr-FR', whisperCode: 'fr' },
            'de': { name: 'Deutsch', code: 'de-DE', whisperCode: 'de' },
            'ja': { name: '日本語', code: 'ja-JP', whisperCode: 'ja' },
            'ko': { name: '한국어', code: 'ko-KR', whisperCode: 'ko' },
            'pt': { name: 'Português', code: 'pt-BR', whisperCode: 'pt' },
            'ru': { name: 'Русский', code: 'ru-RU', whisperCode: 'ru' },
            'ar': { name: 'العربية', code: 'ar-SA', whisperCode: 'ar' },
            'it': { name: 'Italiano', code: 'it-IT', whisperCode: 'it' },
            'nl': { name: 'Nederlands', code: 'nl-NL', whisperCode: 'nl' },
            'pl': { name: 'Polski', code: 'pl-PL', whisperCode: 'pl' },
            'tr': { name: 'Türkçe', code: 'tr-TR', whisperCode: 'tr' },
            'hi': { name: 'हिन्दी', code: 'hi-IN', whisperCode: 'hi' }
        };
        
        // 音频格式配置
        this.audioConfig = {
            sampleRate: 16000,
            channels: 1,
            format: 'wav',
            maxDuration: 300, // 5分钟
            maxFileSize: 50 * 1024 * 1024 // 50MB
        };
        
        // 缓存配置
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30分钟
        
        this.initializeServices();
    }
    
    async initializeServices() {
        try {
            // 检查Whisper服务可用性
            if (this.speechProviders.whisper.url) {
                try {
                    await axios.get(this.speechProviders.whisper.url.replace('/asr', '/health'));
                    console.log('Whisper语音识别服务已连接');
                } catch (error) {
                    console.warn('Whisper服务不可用，将使用备用方案');
                }
            }
            
            // 检查翻译服务可用性
            await this.testTranslationServices();
            
        } catch (error) {
            console.error('初始化语音翻译服务失败:', error);
        }
    }
    
    /**
     * 测试翻译服务可用性
     */
    async testTranslationServices() {
        for (const [provider, config] of Object.entries(this.translationProviders)) {
            try {
                if (provider === 'libre' && config.url) {
                    const response = await axios.post(config.url, {
                        q: 'hello',
                        source: 'en',
                        target: 'zh',
                        format: 'text'
                    }, {
                        headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
                        timeout: 5000
                    });
                    
                    if (response.data && response.data.translatedText) {
                        console.log(`${provider}翻译服务可用`);
                    }
                }
            } catch (error) {
                console.warn(`${provider}翻译服务不可用:`, error.message);
            }
        }
    }
    
    /**
     * 处理语音消息
     * @param {Buffer} audioBuffer 音频数据
     * @param {string} sourceLanguage 源语言
     * @param {string[]} targetLanguages 目标语言列表
     * @param {string} userId 用户ID
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 处理结果
     */
    async processVoiceMessage(audioBuffer, sourceLanguage = 'auto', targetLanguages = ['en'], userId, roomId) {
        try {
            // 验证音频数据
            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('音频数据为空');
            }
            
            if (audioBuffer.length > this.audioConfig.maxFileSize) {
                throw new Error('音频文件过大');
            }
            
            // 生成唯一ID
            const translationId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 保存原始音频文件
            const audioPath = await this.saveAudioFile(audioBuffer, translationId);
            
            // 转换音频格式
            const processedAudioPath = await this.convertAudio(audioPath);
            
            // 语音转文字
            const transcriptionResult = await this.speechToText(processedAudioPath, sourceLanguage);
            
            if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
                throw new Error('语音识别失败，未检测到有效文本');
            }
            
            // 检测语言（如果是自动检测）
            let detectedLanguage = sourceLanguage;
            if (sourceLanguage === 'auto') {
                detectedLanguage = await this.detectLanguage(transcriptionResult.text);
            }
            
            // 翻译文本
            const translations = [];
            for (const targetLang of targetLanguages) {
                if (targetLang !== detectedLanguage) {
                    try {
                        const translation = await this.translateText(
                            transcriptionResult.text,
                            detectedLanguage,
                            targetLang
                        );
                        translations.push({
                            language: targetLang,
                            text: translation.text,
                            confidence: translation.confidence || 0.8
                        });
                    } catch (error) {
                        console.warn(`翻译到${targetLang}失败:`, error);
                        translations.push({
                            language: targetLang,
                            text: transcriptionResult.text,
                            confidence: 0.1,
                            error: error.message
                        });
                    }
                }
            }
            
            // 生成翻译后的语音（可选）
            const audioUrls = {};
            for (const translation of translations) {
                try {
                    const audioUrl = await this.textToSpeech(
                        translation.text,
                        translation.language,
                        translationId
                    );
                    audioUrls[translation.language] = audioUrl;
                } catch (error) {
                    console.warn(`生成${translation.language}语音失败:`, error);
                }
            }
            
            // 保存到数据库
            const voiceTranslation = new VoiceTranslation({
                user: userId,
                chatRoom: roomId,
                originalText: transcriptionResult.text,
                originalLanguage: detectedLanguage,
                originalAudioUrl: `/uploads/voice/${path.basename(audioPath)}`,
                translations: translations.map(t => ({
                    language: t.language,
                    text: t.text,
                    confidence: t.confidence,
                    audioUrl: audioUrls[t.language] || null
                })),
                confidence: transcriptionResult.confidence || 0.8,
                processingTime: Date.now() - parseInt(translationId.split('_')[1]),
                metadata: {
                    audioFormat: 'wav',
                    sampleRate: this.audioConfig.sampleRate,
                    duration: transcriptionResult.duration || 0,
                    fileSize: audioBuffer.length
                }
            });
            
            await voiceTranslation.save();
            
            // 清理临时文件
            this.cleanupTempFiles([audioPath, processedAudioPath]);
            
            return {
                success: true,
                data: {
                    id: voiceTranslation._id,
                    originalText: transcriptionResult.text,
                    originalLanguage: detectedLanguage,
                    translations,
                    confidence: transcriptionResult.confidence || 0.8,
                    audioUrl: voiceTranslation.originalAudioUrl,
                    audioUrls,
                    duration: transcriptionResult.duration || 0,
                    processingTime: voiceTranslation.processingTime
                }
            };
            
        } catch (error) {
            console.error('处理语音消息失败:', error);
            throw new ErrorResponse(`语音处理失败: ${error.message}`, 500);
        }
    }
    
    /**
     * 语音转文字
     * @param {string} audioPath 音频文件路径
     * @param {string} language 语言代码
     * @returns {Promise<Object>} 转录结果
     */
    async speechToText(audioPath, language = 'auto') {
        try {
            // 优先使用Whisper
            if (this.speechProviders.whisper.url) {
                return await this.whisperSpeechToText(audioPath, language);
            }
            
            // 备用方案：Azure语音服务
            if (this.speechProviders.azure.apiKey) {
                return await this.azureSpeechToText(audioPath, language);
            }
            
            // 最后备用方案：本地处理
            return await this.localSpeechToText(audioPath, language);
            
        } catch (error) {
            console.error('语音转文字失败:', error);
            throw error;
        }
    }
    
    /**
     * 使用Whisper进行语音识别
     */
    async whisperSpeechToText(audioPath, language) {
        try {
            const formData = new FormData();
            const audioBuffer = await fs.readFile(audioPath);
            formData.append('audio_file', audioBuffer, 'audio.wav');
            
            if (language !== 'auto' && this.supportedLanguages[language]) {
                formData.append('language', this.supportedLanguages[language].whisperCode);
            }
            
            const response = await axios.post(this.speechProviders.whisper.url, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 30000
            });
            
            if (response.data && response.data.text) {
                return {
                    text: response.data.text.trim(),
                    confidence: response.data.confidence || 0.8,
                    language: response.data.language || language,
                    duration: response.data.duration || 0
                };
            }
            
            throw new Error('Whisper返回无效结果');
            
        } catch (error) {
            console.error('Whisper语音识别失败:', error);
            throw error;
        }
    }
    
    /**
     * 文本翻译
     * @param {string} text 待翻译文本
     * @param {string} sourceLanguage 源语言
     * @param {string} targetLanguage 目标语言
     * @returns {Promise<Object>} 翻译结果
     */
    async translateText(text, sourceLanguage, targetLanguage) {
        try {
            // 检查缓存
            const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                }
                this.cache.delete(cacheKey);
            }
            
            let result = null;
            
            // 尝试LibreTranslate
            if (this.translationProviders.libre.url) {
                try {
                    result = await this.libreTranslate(text, sourceLanguage, targetLanguage);
                } catch (error) {
                    console.warn('LibreTranslate失败:', error.message);
                }
            }
            
            // 备用方案：MyMemory
            if (!result) {
                try {
                    result = await this.myMemoryTranslate(text, sourceLanguage, targetLanguage);
                } catch (error) {
                    console.warn('MyMemory翻译失败:', error.message);
                }
            }
            
            // 最后备用方案：Azure翻译
            if (!result && this.translationProviders.azure.apiKey) {
                try {
                    result = await this.azureTranslate(text, sourceLanguage, targetLanguage);
                } catch (error) {
                    console.warn('Azure翻译失败:', error.message);
                }
            }
            
            if (!result) {
                throw new Error('所有翻译服务都不可用');
            }
            
            // 缓存结果
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
            
        } catch (error) {
            console.error('文本翻译失败:', error);
            throw error;
        }
    }
    
    /**
     * LibreTranslate翻译
     */
    async libreTranslate(text, sourceLanguage, targetLanguage) {
        const response = await axios.post(this.translationProviders.libre.url, {
            q: text,
            source: sourceLanguage === 'auto' ? 'auto' : sourceLanguage,
            target: targetLanguage,
            format: 'text'
        }, {
            headers: this.translationProviders.libre.apiKey ? {
                'Authorization': `Bearer ${this.translationProviders.libre.apiKey}`
            } : {},
            timeout: 10000
        });
        
        if (response.data && response.data.translatedText) {
            return {
                text: response.data.translatedText,
                confidence: 0.8,
                provider: 'libre'
            };
        }
        
        throw new Error('LibreTranslate返回无效结果');
    }
    
    /**
     * MyMemory翻译
     */
    async myMemoryTranslate(text, sourceLanguage, targetLanguage) {
        const langPair = `${sourceLanguage}|${targetLanguage}`;
        const params = {
            q: text,
            langpair: langPair
        };
        
        if (this.translationProviders.mymemory.email) {
            params.de = this.translationProviders.mymemory.email;
        }
        
        const response = await axios.get(this.translationProviders.mymemory.url, {
            params,
            timeout: 10000
        });
        
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            return {
                text: response.data.responseData.translatedText,
                confidence: response.data.responseData.match || 0.7,
                provider: 'mymemory'
            };
        }
        
        throw new Error('MyMemory返回无效结果');
    }
    
    /**
     * 语言检测
     */
    async detectLanguage(text) {
        try {
            // 简单的语言检测逻辑
            const chineseRegex = /[\u4e00-\u9fff]/;
            const arabicRegex = /[\u0600-\u06ff]/;
            const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
            const koreanRegex = /[\uac00-\ud7af]/;
            
            if (chineseRegex.test(text)) return 'zh';
            if (arabicRegex.test(text)) return 'ar';
            if (japaneseRegex.test(text)) return 'ja';
            if (koreanRegex.test(text)) return 'ko';
            
            // 默认返回英语
            return 'en';
        } catch (error) {
            console.warn('语言检测失败:', error);
            return 'en';
        }
    }
    
    /**
     * 文本转语音
     */
    async textToSpeech(text, language, translationId) {
        try {
            // 这里可以集成TTS服务，暂时返回null
            console.log(`TTS请求: ${text} (${language})`);
            return null;
        } catch (error) {
            console.error('文本转语音失败:', error);
            return null;
        }
    }
    
    /**
     * 保存音频文件
     */
    async saveAudioFile(audioBuffer, translationId) {
        const uploadDir = path.join(__dirname, '../../uploads/voice');
        await fs.mkdir(uploadDir, { recursive: true });
        
        const filename = `${translationId}_original.wav`;
        const filepath = path.join(uploadDir, filename);
        
        await fs.writeFile(filepath, audioBuffer);
        return filepath;
    }
    
    /**
     * 转换音频格式
     */
    async convertAudio(inputPath) {
        return new Promise((resolve, reject) => {
            const outputPath = inputPath.replace('.wav', '_processed.wav');
            
            ffmpeg(inputPath)
                .audioFrequency(this.audioConfig.sampleRate)
                .audioChannels(this.audioConfig.channels)
                .audioCodec('pcm_s16le')
                .format('wav')
                .on('end', () => resolve(outputPath))
                .on('error', reject)
                .save(outputPath);
        });
    }
    
    /**
     * 清理临时文件
     */
    async cleanupTempFiles(filePaths) {
        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                console.warn(`清理文件失败: ${filePath}`, error);
            }
        }
    }
    
    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
    
    /**
     * 获取服务状态
     */
    async getServiceStatus() {
        const status = {
            whisper: false,
            libre: false,
            mymemory: false,
            azure: false
        };
        
        // 检查各服务状态
        try {
            if (this.speechProviders.whisper.url) {
                await axios.get(this.speechProviders.whisper.url.replace('/asr', '/health'), { timeout: 3000 });
                status.whisper = true;
            }
        } catch (error) {
            // Whisper不可用
        }
        
        try {
            if (this.translationProviders.libre.url) {
                await axios.post(this.translationProviders.libre.url, {
                    q: 'test',
                    source: 'en',
                    target: 'zh',
                    format: 'text'
                }, { timeout: 3000 });
                status.libre = true;
            }
        } catch (error) {
            // LibreTranslate不可用
        }
        
        return status;
    }
}

module.exports = EnhancedVoiceTranslationService;

