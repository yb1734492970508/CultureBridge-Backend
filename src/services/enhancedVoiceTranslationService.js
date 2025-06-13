const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const translate = require('@google-cloud/translate').v2.Translate;
const VoiceTranslation = require('../models/VoiceTranslation');
const User = require('../models/User');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EnhancedVoiceTranslationService {
    constructor() {
        // 初始化Google Cloud服务
        this.initializeGoogleCloudServices();
        
        // 支持的语言配置
        this.supportedLanguages = {
            'zh-CN': { name: '中文（简体）', voice: 'cmn-CN-Wavenet-A' },
            'zh-TW': { name: '中文（繁体）', voice: 'cmn-TW-Wavenet-A' },
            'en-US': { name: '英语（美国）', voice: 'en-US-Wavenet-D' },
            'en-GB': { name: '英语（英国）', voice: 'en-GB-Wavenet-A' },
            'ja-JP': { name: '日语', voice: 'ja-JP-Wavenet-A' },
            'ko-KR': { name: '韩语', voice: 'ko-KR-Wavenet-A' },
            'fr-FR': { name: '法语', voice: 'fr-FR-Wavenet-A' },
            'de-DE': { name: '德语', voice: 'de-DE-Wavenet-A' },
            'es-ES': { name: '西班牙语', voice: 'es-ES-Wavenet-A' },
            'it-IT': { name: '意大利语', voice: 'it-IT-Wavenet-A' },
            'pt-BR': { name: '葡萄牙语（巴西）', voice: 'pt-BR-Wavenet-A' },
            'ru-RU': { name: '俄语', voice: 'ru-RU-Wavenet-A' },
            'ar-XA': { name: '阿拉伯语', voice: 'ar-XA-Wavenet-A' },
            'hi-IN': { name: '印地语', voice: 'hi-IN-Wavenet-A' },
            'th-TH': { name: '泰语', voice: 'th-TH-Wavenet-A' },
            'vi-VN': { name: '越南语', voice: 'vi-VN-Wavenet-A' }
        };
        
        // 音频处理配置
        this.audioConfig = {
            maxFileSize: 10 * 1024 * 1024, // 10MB
            supportedFormats: ['wav', 'mp3', 'ogg', 'webm', 'flac'],
            sampleRate: 16000,
            channels: 1
        };
        
        // 创建临时文件目录
        this.tempDir = path.join(process.cwd(), 'temp', 'audio');
        this.ensureTempDirectory();
    }
    /**
     * 初始化Google Cloud服务
     */
    async initializeGoogleCloudServices() {
        try {
            const keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
            const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
            
            if (!keyFilename || !projectId) {
                console.warn('⚠️ Google Cloud配置不完整，语音功能可能受限');
                return;
            }
            
            // 暂时跳过Google Cloud初始化，避免阻止应用启动
            console.log('⚠️ Google Cloud服务暂时跳过初始化');
            
        } catch (error) {
            console.error('❌ Google Cloud服务初始化失败:', error);
        }
    }    
    /**
     * 确保临时目录存在
     */
    async ensureTempDirectory() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('创建临时目录失败:', error);
        }
    }
    
    /**
     * 处理语音消息（完整流程）
     */
    async processVoiceMessage(audioBuffer, sourceLanguage, targetLanguages, userId, chatRoomId) {
        const startTime = Date.now();
        let tempFiles = [];
        
        try {
            // 1. 验证输入
            this.validateInput(audioBuffer, targetLanguages);
            
            // 2. 预处理音频
            const processedAudio = await this.preprocessAudio(audioBuffer);
            tempFiles.push(processedAudio.filePath);
            
            // 3. 语音转文字
            const transcription = await this.transcribeAudio(
                processedAudio.buffer, 
                sourceLanguage
            );
            
            if (!transcription.text || transcription.text.trim().length === 0) {
                throw new Error('无法识别语音内容，请重新录制');
            }
            
            // 4. 文本翻译
            const translations = await this.translateText(
                transcription.text,
                transcription.detectedLanguage || sourceLanguage,
                targetLanguages
            );
            
            // 5. 文字转语音（为每种目标语言生成）
            const audioTranslations = await this.generateAudioTranslations(
                translations,
                targetLanguages
            );
            
            // 6. 保存翻译记录
            const translationRecord = await this.saveTranslationRecord({
                userId,
                chatRoomId,
                originalText: transcription.text,
                sourceLanguage: transcription.detectedLanguage || sourceLanguage,
                translations,
                audioTranslations,
                confidence: transcription.confidence,
                processingTime: Date.now() - startTime
            });
            
            // 7. 清理临时文件
            await this.cleanupTempFiles(tempFiles);
            
            return {
                success: true,
                data: {
                    id: translationRecord._id,
                    originalText: transcription.text,
                    sourceLanguage: transcription.detectedLanguage || sourceLanguage,
                    confidence: transcription.confidence,
                    translations,
                    audioTranslations,
                    processingTime: Date.now() - startTime
                }
            };
            
        } catch (error) {
            // 清理临时文件
            await this.cleanupTempFiles(tempFiles);
            throw error;
        }
    }
    
    /**
     * 验证输入参数
     */
    validateInput(audioBuffer, targetLanguages) {
        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('音频数据为空');
        }
        
        if (audioBuffer.length > this.audioConfig.maxFileSize) {
            throw new Error(`音频文件过大，最大支持${this.audioConfig.maxFileSize / 1024 / 1024}MB`);
        }
        
        if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
            throw new Error('请指定至少一种目标语言');
        }
        
        // 验证目标语言是否支持
        const unsupportedLanguages = targetLanguages.filter(
            lang => !this.supportedLanguages[lang]
        );
        
        if (unsupportedLanguages.length > 0) {
            throw new Error(`不支持的语言: ${unsupportedLanguages.join(', ')}`);
        }
    }
    
    /**
     * 预处理音频
     */
    async preprocessAudio(audioBuffer) {
        const tempFileName = `audio_${crypto.randomUUID()}.wav`;
        const tempFilePath = path.join(this.tempDir, tempFileName);
        const outputFileName = `processed_${crypto.randomUUID()}.wav`;
        const outputFilePath = path.join(this.tempDir, outputFileName);
        
        try {
            // 保存原始音频文件
            await fs.writeFile(tempFilePath, audioBuffer);
            
            // 使用ffmpeg处理音频
            await new Promise((resolve, reject) => {
                ffmpeg(tempFilePath)
                    .audioFrequency(this.audioConfig.sampleRate)
                    .audioChannels(this.audioConfig.channels)
                    .audioCodec('pcm_s16le')
                    .format('wav')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputFilePath);
            });
            
            // 读取处理后的音频
            const processedBuffer = await fs.readFile(outputFilePath);
            
            return {
                buffer: processedBuffer,
                filePath: outputFilePath,
                originalPath: tempFilePath
            };
            
        } catch (error) {
            console.error('音频预处理失败:', error);
            throw new Error('音频格式处理失败，请检查音频文件');
        }
    }
    
    /**
     * 语音转文字（增强版）
     */
    async transcribeAudio(audioBuffer, language = 'auto') {
        if (!this.speechClient) {
            throw new Error('语音识别服务未初始化');
        }
        
        try {
            // 配置识别请求
            const request = {
                audio: {
                    content: audioBuffer.toString('base64')
                },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: this.audioConfig.sampleRate,
                    languageCode: language === 'auto' ? 'zh-CN' : language,
                    alternativeLanguageCodes: language === 'auto' ? ['en-US', 'ja-JP', 'ko-KR'] : [],
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true,
                    enableWordConfidence: true,
                    model: 'latest_long'
                }
            };
            
            // 执行语音识别
            const [response] = await this.speechClient.recognize(request);
            
            if (!response.results || response.results.length === 0) {
                throw new Error('无法识别语音内容');
            }
            
            const result = response.results[0];
            const alternative = result.alternatives[0];
            
            // 提取词语时间信息
            const wordTimings = alternative.words ? alternative.words.map(word => ({
                word: word.word,
                startTime: word.startTime ? parseFloat(word.startTime.seconds || 0) + (word.startTime.nanos || 0) / 1e9 : 0,
                endTime: word.endTime ? parseFloat(word.endTime.seconds || 0) + (word.endTime.nanos || 0) / 1e9 : 0,
                confidence: word.confidence || 0
            })) : [];
            
            return {
                text: alternative.transcript,
                confidence: alternative.confidence || 0,
                detectedLanguage: result.languageCode || language,
                wordTimings
            };
            
        } catch (error) {
            console.error('语音识别失败:', error);
            throw new Error('语音识别失败，请重新尝试');
        }
    }
    
    /**
     * 文本翻译（批量）
     */
    async translateText(text, sourceLanguage, targetLanguages) {
        if (!this.translateClient) {
            throw new Error('翻译服务未初始化');
        }
        
        try {
            const translations = {};
            
            // 并行翻译到所有目标语言
            const translationPromises = targetLanguages.map(async (targetLang) => {
                if (targetLang === sourceLanguage) {
                    translations[targetLang] = {
                        text: text,
                        confidence: 1.0,
                        isOriginal: true
                    };
                    return;
                }
                
                try {
                    const [translation] = await this.translateClient.translate(text, {
                        from: sourceLanguage,
                        to: targetLang
                    });
                    
                    translations[targetLang] = {
                        text: translation,
                        confidence: 0.9, // Google Translate通常有较高的准确性
                        isOriginal: false
                    };
                } catch (error) {
                    console.error(`翻译到${targetLang}失败:`, error);
                    translations[targetLang] = {
                        text: text, // 翻译失败时返回原文
                        confidence: 0,
                        isOriginal: true,
                        error: error.message
                    };
                }
            });
            
            await Promise.all(translationPromises);
            
            return translations;
            
        } catch (error) {
            console.error('批量翻译失败:', error);
            throw new Error('翻译服务暂时不可用');
        }
    }
    
    /**
     * 生成音频翻译
     */
    async generateAudioTranslations(translations, targetLanguages) {
        if (!this.ttsClient) {
            console.warn('语音合成服务未初始化，跳过音频生成');
            return {};
        }
        
        const audioTranslations = {};
        
        // 并行生成所有语言的音频
        const audioPromises = targetLanguages.map(async (language) => {
            const translation = translations[language];
            if (!translation || !translation.text) return;
            
            try {
                const audioBuffer = await this.synthesizeSpeech(
                    translation.text,
                    language,
                    'neutral'
                );
                
                // 将音频保存为base64编码
                audioTranslations[language] = {
                    audioData: audioBuffer.toString('base64'),
                    mimeType: 'audio/mpeg',
                    duration: this.estimateAudioDuration(translation.text, language)
                };
                
            } catch (error) {
                console.error(`生成${language}音频失败:`, error);
                audioTranslations[language] = {
                    error: error.message
                };
            }
        });
        
        await Promise.all(audioPromises);
        
        return audioTranslations;
    }
    
    /**
     * 语音合成（增强版）
     */
    async synthesizeSpeech(text, language, voiceType = 'neutral') {
        if (!this.ttsClient) {
            throw new Error('语音合成服务未初始化');
        }
        
        try {
            const languageConfig = this.supportedLanguages[language];
            if (!languageConfig) {
                throw new Error(`不支持的语言: ${language}`);
            }
            
            // 选择语音类型
            let voiceName = languageConfig.voice;
            if (voiceType === 'male') {
                voiceName = voiceName.replace('-A', '-B');
            } else if (voiceType === 'female') {
                voiceName = voiceName.replace('-B', '-A');
            }
            
            const request = {
                input: { text },
                voice: {
                    languageCode: language,
                    name: voiceName,
                    ssmlGender: voiceType === 'male' ? 'MALE' : 'FEMALE'
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
            throw new Error('语音合成失败，请重新尝试');
        }
    }
    
    /**
     * 估算音频时长
     */
    estimateAudioDuration(text, language) {
        // 基于文本长度和语言特性估算时长（秒）
        const baseRate = {
            'zh-CN': 3.5, // 中文每秒约3.5个字符
            'en-US': 12,  // 英文每秒约12个字符
            'ja-JP': 4,   // 日文每秒约4个字符
            'ko-KR': 4    // 韩文每秒约4个字符
        };
        
        const rate = baseRate[language] || 8; // 默认每秒8个字符
        return Math.ceil(text.length / rate);
    }
    
    /**
     * 保存翻译记录
     */
    async saveTranslationRecord(data) {
        try {
            const record = new VoiceTranslation({
                user: data.userId,
                chatRoom: data.chatRoomId,
                originalText: data.originalText,
                sourceLanguage: data.sourceLanguage,
                translations: data.translations,
                audioTranslations: data.audioTranslations,
                confidence: data.confidence,
                processingTime: data.processingTime,
                processingStatus: 'completed'
            });
            
            await record.save();
            
            // 更新用户统计
            await this.updateUserTranslationStats(data.userId);
            
            return record;
            
        } catch (error) {
            console.error('保存翻译记录失败:', error);
            throw new Error('保存翻译记录失败');
        }
    }
    
    /**
     * 更新用户翻译统计
     */
    async updateUserTranslationStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) return;
            
            // 增加翻译计数
            user.translationCount = (user.translationCount || 0) + 1;
            user.lastTranslationAt = new Date();
            
            await user.save();
            
        } catch (error) {
            console.error('更新用户翻译统计失败:', error);
        }
    }
    
    /**
     * 获取用户翻译历史
     */
    async getUserVoiceTranslations(userId, limit = 20, skip = 0) {
        try {
            const translations = await VoiceTranslation.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .populate('chatRoom', 'name type')
                .select('-audioTranslations'); // 不返回音频数据以节省带宽
            
            return translations;
            
        } catch (error) {
            console.error('获取用户翻译历史失败:', error);
            throw new Error('获取翻译历史失败');
        }
    }
    
    /**
     * 删除翻译记录
     */
    async deleteVoiceTranslation(translationId, userId) {
        try {
            const translation = await VoiceTranslation.findOne({
                _id: translationId,
                user: userId
            });
            
            if (!translation) {
                throw new Error('翻译记录不存在或无权限删除');
            }
            
            await translation.deleteOne();
            
        } catch (error) {
            console.error('删除翻译记录失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return Object.entries(this.supportedLanguages).map(([code, config]) => ({
            code,
            name: config.name,
            hasVoice: !!config.voice
        }));
    }
    
    /**
     * 清理临时文件
     */
    async cleanupTempFiles(filePaths) {
        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                console.warn(`清理临时文件失败: ${filePath}`, error);
            }
        }
    }
    
    /**
     * 健康检查
     */
    async healthCheck() {
        const status = {
            speechRecognition: !!this.speechClient,
            textToSpeech: !!this.ttsClient,
            translation: !!this.translateClient,
            tempDirectory: false
        };
        
        try {
            // 检查临时目录
            await fs.access(this.tempDir);
            status.tempDirectory = true;
        } catch (error) {
            console.warn('临时目录不可访问:', error);
        }
        
        return status;
    }
    
    /**
     * 获取服务统计信息
     */
    async getServiceStats() {
        try {
            const stats = await VoiceTranslation.aggregate([
                {
                    $group: {
                        _id: null,
                        totalTranslations: { $sum: 1 },
                        avgConfidence: { $avg: '$confidence' },
                        avgProcessingTime: { $avg: '$processingTime' },
                        languageDistribution: {
                            $push: '$sourceLanguage'
                        }
                    }
                }
            ]);
            
            return stats[0] || {
                totalTranslations: 0,
                avgConfidence: 0,
                avgProcessingTime: 0,
                languageDistribution: []
            };
            
        } catch (error) {
            console.error('获取服务统计失败:', error);
            return null;
        }
    }
}

module.exports = EnhancedVoiceTranslationService;

