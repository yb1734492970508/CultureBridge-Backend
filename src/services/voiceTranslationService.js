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

class VoiceTranslationService {
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
        
        // 支持的语言配置
        this.supportedLanguages = {
            'zh': { name: '中文', voice: 'zh-CN-Wavenet-A' },
            'en': { name: 'English', voice: 'en-US-Wavenet-D' },
            'es': { name: 'Español', voice: 'es-ES-Wavenet-B' },
            'fr': { name: 'Français', voice: 'fr-FR-Wavenet-A' },
            'de': { name: 'Deutsch', voice: 'de-DE-Wavenet-A' },
            'ja': { name: '日本語', voice: 'ja-JP-Wavenet-A' },
            'ko': { name: '한국어', voice: 'ko-KR-Wavenet-A' },
            'pt': { name: 'Português', voice: 'pt-BR-Wavenet-A' },
            'ru': { name: 'Русский', voice: 'ru-RU-Wavenet-A' },
            'ar': { name: 'العربية', voice: 'ar-XA-Wavenet-A' }
        };
    }
    
    /**
     * 语音转文字
     * @param {Buffer} audioBuffer 音频数据
     * @param {string} language 语言代码，'auto'表示自动检测
     * @returns {Promise<Object>} 转录结果
     */
    async transcribeAudio(audioBuffer, language = 'auto') {
        try {
            const request = {
                audio: {
                    content: audioBuffer.toString('base64')
                },
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 48000,
                    languageCode: language === 'auto' ? 'zh-CN' : this.getLanguageCode(language),
                    alternativeLanguageCodes: language === 'auto' ? ['en-US', 'es-ES', 'fr-FR', 'de-DE'] : [],
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true,
                    model: 'latest_long'
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
            const detectedLanguage = response.results[0].languageCode || language;
            
            return {
                text: transcription,
                confidence,
                detectedLanguage: this.normalizeLanguageCode(detectedLanguage),
                wordTimings: response.results[0].alternatives[0].words || []
            };
        } catch (error) {
            console.error('语音转文字失败:', error);
            throw new Error('语音识别服务暂时不可用');
        }
    }
    
    /**
     * 文本翻译
     * @param {string} text 要翻译的文本
     * @param {string} sourceLanguage 源语言
     * @param {string} targetLanguage 目标语言
     * @returns {Promise<Object>} 翻译结果
     */
    async translateText(text, sourceLanguage, targetLanguage) {
        try {
            if (sourceLanguage === targetLanguage) {
                return {
                    text: text,
                    confidence: 1.0,
                    detectedLanguage: sourceLanguage
                };
            }
            
            const [translation, metadata] = await this.translateClient.translate(text, {
                from: sourceLanguage,
                to: targetLanguage
            });
            
            return {
                text: Array.isArray(translation) ? translation[0] : translation,
                confidence: 0.95, // Google Translate通常有很高的准确度
                detectedLanguage: metadata.data.translations[0].detectedSourceLanguage || sourceLanguage
            };
        } catch (error) {
            console.error('文本翻译失败:', error);
            throw new Error('翻译服务暂时不可用');
        }
    }
    
    /**
     * 文字转语音
     * @param {string} text 要合成的文本
     * @param {string} language 语言代码
     * @param {string} voiceType 语音类型
     * @returns {Promise<Buffer>} 音频数据
     */
    async synthesizeSpeech(text, language, voiceType = 'neutral') {
        try {
            const voiceName = this.supportedLanguages[language]?.voice || 'en-US-Wavenet-D';
            
            const request = {
                input: { text: text },
                voice: {
                    languageCode: this.getLanguageCode(language),
                    name: voiceName,
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0.0,
                    volumeGainDb: 0.0
                }
            };
            
            const [response] = await this.ttsClient.synthesizeSpeech(request);
            return response.audioContent;
        } catch (error) {
            console.error('语音合成失败:', error);
            throw new Error('语音合成服务暂时不可用');
        }
    }
    
    /**
     * 完整的语音翻译流程
     * @param {Buffer} audioBuffer 音频数据
     * @param {string} sourceLanguage 源语言
     * @param {Array} targetLanguages 目标语言数组
     * @param {string} userId 用户ID
     * @param {string} chatRoomId 聊天室ID（可选）
     * @returns {Promise<Object>} 翻译结果
     */
    async processVoiceMessage(audioBuffer, sourceLanguage, targetLanguages, userId, chatRoomId = null) {
        const voiceTranslation = new VoiceTranslation({
            user: userId,
            chatRoom: chatRoomId,
            originalAudio: {
                duration: 0, // 需要从音频文件中获取
                size: audioBuffer.length,
                format: 'webm'
            },
            processingStatus: 'processing'
        });
        
        try {
            // 保存原始音频文件
            const audioFileName = `voice_${Date.now()}_${userId}.webm`;
            const audioPath = path.join(process.env.UPLOAD_PATH || 'uploads', 'voice', audioFileName);
            await fs.writeFile(audioPath, audioBuffer);
            voiceTranslation.originalAudio.url = `/uploads/voice/${audioFileName}`;
            
            // 1. 语音转文字
            const transcriptionResult = await this.transcribeAudio(audioBuffer, sourceLanguage);
            voiceTranslation.transcription = {
                text: transcriptionResult.text,
                language: transcriptionResult.detectedLanguage,
                confidence: transcriptionResult.confidence
            };
            
            // 2. 翻译到目标语言
            const translations = [];
            for (const targetLang of targetLanguages) {
                if (targetLang === transcriptionResult.detectedLanguage) {
                    continue; // 跳过相同语言
                }
                
                const translationResult = await this.translateText(
                    transcriptionResult.text,
                    transcriptionResult.detectedLanguage,
                    targetLang
                );
                
                // 3. 合成目标语言语音
                const synthesizedAudio = await this.synthesizeSpeech(
                    translationResult.text,
                    targetLang
                );
                
                // 保存合成的音频文件
                const synthesizedFileName = `synthesized_${Date.now()}_${targetLang}.mp3`;
                const synthesizedPath = path.join(process.env.UPLOAD_PATH || 'uploads', 'voice', synthesizedFileName);
                await fs.writeFile(synthesizedPath, synthesizedAudio);
                
                translations.push({
                    language: targetLang,
                    text: translationResult.text,
                    audioUrl: `/uploads/voice/${synthesizedFileName}`,
                    confidence: translationResult.confidence
                });
            }
            
            voiceTranslation.translations = translations;
            voiceTranslation.processingStatus = 'completed';
            voiceTranslation.completedAt = new Date();
            
            await voiceTranslation.save();
            
            return {
                success: true,
                data: {
                    id: voiceTranslation._id,
                    originalText: transcriptionResult.text,
                    originalLanguage: transcriptionResult.detectedLanguage,
                    translations: translations,
                    confidence: transcriptionResult.confidence,
                    processingTime: Date.now() - voiceTranslation.createdAt.getTime()
                }
            };
            
        } catch (error) {
            voiceTranslation.processingStatus = 'failed';
            voiceTranslation.errorMessage = error.message;
            await voiceTranslation.save();
            
            throw error;
        }
    }
    
    /**
     * 获取支持的语言列表
     * @returns {Object} 支持的语言
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
    
    /**
     * 标准化语言代码
     * @param {string} languageCode 语言代码
     * @returns {string} 标准化的语言代码
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
            'de-DE': 'de',
            'ja-JP': 'ja',
            'ko-KR': 'ko',
            'pt-BR': 'pt',
            'pt-PT': 'pt',
            'ru-RU': 'ru',
            'ar-XA': 'ar'
        };
        
        return mapping[languageCode] || languageCode.split('-')[0];
    }
    
    /**
     * 获取完整的语言代码
     * @param {string} shortCode 短语言代码
     * @returns {string} 完整的语言代码
     */
    getLanguageCode(shortCode) {
        const mapping = {
            'zh': 'zh-CN',
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'pt': 'pt-BR',
            'ru': 'ru-RU',
            'ar': 'ar-XA'
        };
        
        return mapping[shortCode] || shortCode;
    }
    
    /**
     * 获取用户的语音翻译历史
     * @param {string} userId 用户ID
     * @param {number} limit 限制数量
     * @param {number} skip 跳过数量
     * @returns {Promise<Array>} 翻译历史
     */
    async getUserVoiceTranslations(userId, limit = 20, skip = 0) {
        try {
            const translations = await VoiceTranslation.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .populate('chatRoom', 'name type')
                .lean();
                
            return translations;
        } catch (error) {
            console.error('获取用户语音翻译历史失败:', error);
            throw new Error('获取翻译历史失败');
        }
    }
    
    /**
     * 删除语音翻译记录和相关文件
     * @param {string} translationId 翻译记录ID
     * @param {string} userId 用户ID
     * @returns {Promise<boolean>} 删除结果
     */
    async deleteVoiceTranslation(translationId, userId) {
        try {
            const translation = await VoiceTranslation.findOne({
                _id: translationId,
                user: userId
            });
            
            if (!translation) {
                throw new Error('翻译记录不存在');
            }
            
            // 删除音频文件
            const filesToDelete = [translation.originalAudio.url];
            translation.translations.forEach(t => {
                if (t.audioUrl) {
                    filesToDelete.push(t.audioUrl);
                }
            });
            
            for (const fileUrl of filesToDelete) {
                try {
                    const filePath = path.join(process.cwd(), fileUrl);
                    await fs.unlink(filePath);
                } catch (error) {
                    console.warn('删除文件失败:', fileUrl, error.message);
                }
            }
            
            // 删除数据库记录
            await VoiceTranslation.findByIdAndDelete(translationId);
            
            return true;
        } catch (error) {
            console.error('删除语音翻译记录失败:', error);
            throw error;
        }
    }
}

module.exports = VoiceTranslationService;

