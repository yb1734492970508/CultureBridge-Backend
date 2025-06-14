const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

class AdvancedVoiceTranslationService {
    constructor() {
        this.supportedLanguages = {
            'zh-CN': { name: '中文（简体）', voice: 'zh-CN-XiaoxiaoNeural' },
            'zh-TW': { name: '中文（繁体）', voice: 'zh-TW-HsiaoyuNeural' },
            'en-US': { name: '英语（美国）', voice: 'en-US-JennyNeural' },
            'en-GB': { name: '英语（英国）', voice: 'en-GB-SoniaNeural' },
            'ja-JP': { name: '日语', voice: 'ja-JP-NanamiNeural' },
            'ko-KR': { name: '韩语', voice: 'ko-KR-SunHiNeural' },
            'fr-FR': { name: '法语', voice: 'fr-FR-DeniseNeural' },
            'de-DE': { name: '德语', voice: 'de-DE-KatjaNeural' },
            'es-ES': { name: '西班牙语', voice: 'es-ES-ElviraNeural' },
            'it-IT': { name: '意大利语', voice: 'it-IT-ElsaNeural' },
            'pt-BR': { name: '葡萄牙语（巴西）', voice: 'pt-BR-FranciscaNeural' },
            'ru-RU': { name: '俄语', voice: 'ru-RU-SvetlanaNeural' },
            'ar-XA': { name: '阿拉伯语', voice: 'ar-XA-ZariyahNeural' },
            'hi-IN': { name: '印地语', voice: 'hi-IN-SwaraNeural' },
            'th-TH': { name: '泰语', voice: 'th-TH-PremwadeeNeural' },
            'vi-VN': { name: '越南语', voice: 'vi-VN-HoaiMyNeural' }
        };
        
        this.translationCache = new Map();
        this.speechCache = new Map();
        
        // 配置API密钥（从环境变量获取）
        this.azureConfig = {
            speechKey: process.env.AZURE_SPEECH_KEY,
            speechRegion: process.env.AZURE_SPEECH_REGION || 'eastus',
            translatorKey: process.env.AZURE_TRANSLATOR_KEY,
            translatorRegion: process.env.AZURE_TRANSLATOR_REGION || 'global'
        };
        
        this.googleConfig = {
            apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
            speechApiKey: process.env.GOOGLE_SPEECH_API_KEY
        };
        
        // 备用翻译服务配置
        this.baiduConfig = {
            appId: process.env.BAIDU_TRANSLATE_APP_ID,
            secretKey: process.env.BAIDU_TRANSLATE_SECRET_KEY
        };
        
        console.log('✅ 高级语音翻译服务已初始化');
    }
    
    /**
     * 语音识别 - 将音频转换为文本
     */
    async speechToText(audioBuffer, sourceLanguage = 'auto', options = {}) {
        try {
            const {
                format = 'webm',
                sampleRate = 16000,
                channels = 1,
                enablePunctuation = true,
                enableWordTimestamps = false,
                profanityFilter = true
            } = options;
            
            // 优先使用Azure Speech Services
            if (this.azureConfig.speechKey) {
                return await this.azureSpeechToText(audioBuffer, sourceLanguage, {
                    format,
                    sampleRate,
                    channels,
                    enablePunctuation,
                    enableWordTimestamps,
                    profanityFilter
                });
            }
            
            // 备用Google Speech-to-Text
            if (this.googleConfig.speechApiKey) {
                return await this.googleSpeechToText(audioBuffer, sourceLanguage, options);
            }
            
            // 本地语音识别（基础实现）
            return await this.localSpeechToText(audioBuffer, sourceLanguage, options);
            
        } catch (error) {
            console.error('语音识别失败:', error.message);
            return {
                success: false,
                error: error.message,
                text: '',
                confidence: 0,
                language: sourceLanguage
            };
        }
    }
    
    /**
     * Azure语音识别
     */
    async azureSpeechToText(audioBuffer, sourceLanguage, options) {
        try {
            const endpoint = `https://${this.azureConfig.speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
            
            const params = new URLSearchParams({
                'language': sourceLanguage === 'auto' ? 'zh-CN' : sourceLanguage,
                'format': 'detailed',
                'profanity': options.profanityFilter ? 'masked' : 'raw'
            });
            
            const response = await axios.post(`${endpoint}?${params}`, audioBuffer, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.azureConfig.speechKey,
                    'Content-Type': `audio/${options.format}; codecs=opus`,
                    'Accept': 'application/json'
                },
                timeout: 30000
            });
            
            const result = response.data;
            
            if (result.RecognitionStatus === 'Success') {
                return {
                    success: true,
                    text: result.DisplayText,
                    confidence: result.NBest?.[0]?.Confidence || 0.9,
                    language: result.NBest?.[0]?.Lexical ? sourceLanguage : 'unknown',
                    alternatives: result.NBest?.slice(1, 3).map(item => ({
                        text: item.Display,
                        confidence: item.Confidence
                    })) || [],
                    wordTimestamps: options.enableWordTimestamps ? this.extractWordTimestamps(result) : []
                };
            } else {
                throw new Error(`Azure语音识别失败: ${result.RecognitionStatus}`);
            }
            
        } catch (error) {
            console.error('Azure语音识别错误:', error.message);
            throw error;
        }
    }
    
    /**
     * Google语音识别
     */
    async googleSpeechToText(audioBuffer, sourceLanguage, options) {
        try {
            const endpoint = 'https://speech.googleapis.com/v1/speech:recognize';
            
            const requestBody = {
                config: {
                    encoding: options.format.toUpperCase(),
                    sampleRateHertz: options.sampleRate,
                    audioChannelCount: options.channels,
                    languageCode: sourceLanguage === 'auto' ? 'zh-CN' : sourceLanguage,
                    enableAutomaticPunctuation: options.enablePunctuation,
                    enableWordTimeOffsets: options.enableWordTimestamps,
                    profanityFilter: options.profanityFilter,
                    alternativeLanguageCodes: ['en-US', 'zh-CN', 'ja-JP', 'ko-KR']
                },
                audio: {
                    content: audioBuffer.toString('base64')
                }
            };
            
            const response = await axios.post(`${endpoint}?key=${this.googleConfig.speechApiKey}`, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            const result = response.data;
            
            if (result.results && result.results.length > 0) {
                const bestResult = result.results[0];
                const alternative = bestResult.alternatives[0];
                
                return {
                    success: true,
                    text: alternative.transcript,
                    confidence: alternative.confidence || 0.9,
                    language: sourceLanguage,
                    alternatives: bestResult.alternatives.slice(1, 3).map(alt => ({
                        text: alt.transcript,
                        confidence: alt.confidence
                    })),
                    wordTimestamps: alternative.words?.map(word => ({
                        word: word.word,
                        startTime: parseFloat(word.startTime?.replace('s', '') || '0'),
                        endTime: parseFloat(word.endTime?.replace('s', '') || '0')
                    })) || []
                };
            } else {
                throw new Error('Google语音识别未返回结果');
            }
            
        } catch (error) {
            console.error('Google语音识别错误:', error.message);
            throw error;
        }
    }
    
    /**
     * 本地语音识别（基础实现）
     */
    async localSpeechToText(audioBuffer, sourceLanguage, options) {
        // 这里可以集成开源的语音识别库，如 DeepSpeech 或 Wav2Vec2
        // 暂时返回模拟结果
        return {
            success: true,
            text: '[本地语音识别] 检测到语音内容',
            confidence: 0.7,
            language: sourceLanguage,
            alternatives: [],
            wordTimestamps: []
        };
    }
    
    /**
     * 文本翻译
     */
    async translateText(text, targetLanguage, sourceLanguage = 'auto', options = {}) {
        try {
            if (!text || text.trim().length === 0) {
                throw new Error('翻译文本不能为空');
            }
            
            // 检查缓存
            const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}`;
            if (this.translationCache.has(cacheKey)) {
                return this.translationCache.get(cacheKey);
            }
            
            const {
                preserveFormatting = true,
                includeAlternatives = true,
                category = 'general',
                profanityAction = 'NoAction'
            } = options;
            
            let result;
            
            // 优先使用Azure Translator
            if (this.azureConfig.translatorKey) {
                result = await this.azureTranslateText(text, targetLanguage, sourceLanguage, {
                    preserveFormatting,
                    includeAlternatives,
                    category,
                    profanityAction
                });
            }
            // 备用Google Translate
            else if (this.googleConfig.apiKey) {
                result = await this.googleTranslateText(text, targetLanguage, sourceLanguage, options);
            }
            // 备用百度翻译
            else if (this.baiduConfig.appId) {
                result = await this.baiduTranslateText(text, targetLanguage, sourceLanguage, options);
            }
            // 本地翻译（基础实现）
            else {
                result = await this.localTranslateText(text, targetLanguage, sourceLanguage, options);
            }
            
            // 缓存结果
            if (result.success) {
                this.translationCache.set(cacheKey, result);
                
                // 限制缓存大小
                if (this.translationCache.size > 1000) {
                    const firstKey = this.translationCache.keys().next().value;
                    this.translationCache.delete(firstKey);
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('文本翻译失败:', error.message);
            return {
                success: false,
                error: error.message,
                originalText: text,
                translatedText: '',
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                confidence: 0
            };
        }
    }
    
    /**
     * Azure文本翻译
     */
    async azureTranslateText(text, targetLanguage, sourceLanguage, options) {
        try {
            const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
            
            const params = new URLSearchParams({
                'api-version': '3.0',
                'to': targetLanguage
            });
            
            if (sourceLanguage !== 'auto') {
                params.append('from', sourceLanguage);
            }
            
            if (options.includeAlternatives) {
                params.append('includeAlignment', 'true');
                params.append('includeSentenceLength', 'true');
            }
            
            const requestBody = [{
                text: text
            }];
            
            const response = await axios.post(`${endpoint}?${params}`, requestBody, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.azureConfig.translatorKey,
                    'Ocp-Apim-Subscription-Region': this.azureConfig.translatorRegion,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            
            const result = response.data[0];
            
            if (result.translations && result.translations.length > 0) {
                const translation = result.translations[0];
                
                return {
                    success: true,
                    originalText: text,
                    translatedText: translation.text,
                    sourceLanguage: result.detectedLanguage?.language || sourceLanguage,
                    targetLanguage: targetLanguage,
                    confidence: result.detectedLanguage?.score || 0.9,
                    alternatives: result.translations.slice(1, 3).map(t => t.text) || [],
                    alignment: translation.alignment,
                    sentenceLength: translation.sentLen
                };
            } else {
                throw new Error('Azure翻译未返回结果');
            }
            
        } catch (error) {
            console.error('Azure翻译错误:', error.message);
            throw error;
        }
    }
    
    /**
     * Google文本翻译
     */
    async googleTranslateText(text, targetLanguage, sourceLanguage, options) {
        try {
            const endpoint = 'https://translation.googleapis.com/language/translate/v2';
            
            const params = new URLSearchParams({
                'key': this.googleConfig.apiKey,
                'q': text,
                'target': targetLanguage,
                'format': 'text'
            });
            
            if (sourceLanguage !== 'auto') {
                params.append('source', sourceLanguage);
            }
            
            const response = await axios.post(endpoint, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            });
            
            const result = response.data.data.translations[0];
            
            return {
                success: true,
                originalText: text,
                translatedText: result.translatedText,
                sourceLanguage: result.detectedSourceLanguage || sourceLanguage,
                targetLanguage: targetLanguage,
                confidence: 0.9,
                alternatives: []
            };
            
        } catch (error) {
            console.error('Google翻译错误:', error.message);
            throw error;
        }
    }
    
    /**
     * 百度文本翻译
     */
    async baiduTranslateText(text, targetLanguage, sourceLanguage, options) {
        try {
            const crypto = require('crypto');
            const endpoint = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
            
            const salt = Date.now().toString();
            const sign = crypto.createHash('md5')
                .update(this.baiduConfig.appId + text + salt + this.baiduConfig.secretKey)
                .digest('hex');
            
            const params = new URLSearchParams({
                'q': text,
                'from': sourceLanguage === 'auto' ? 'auto' : this.mapLanguageCodeToBaidu(sourceLanguage),
                'to': this.mapLanguageCodeToBaidu(targetLanguage),
                'appid': this.baiduConfig.appId,
                'salt': salt,
                'sign': sign
            });
            
            const response = await axios.post(endpoint, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            });
            
            const result = response.data;
            
            if (result.trans_result && result.trans_result.length > 0) {
                return {
                    success: true,
                    originalText: text,
                    translatedText: result.trans_result[0].dst,
                    sourceLanguage: result.from || sourceLanguage,
                    targetLanguage: result.to || targetLanguage,
                    confidence: 0.8,
                    alternatives: []
                };
            } else {
                throw new Error(`百度翻译错误: ${result.error_msg || '未知错误'}`);
            }
            
        } catch (error) {
            console.error('百度翻译错误:', error.message);
            throw error;
        }
    }
    
    /**
     * 本地文本翻译（基础实现）
     */
    async localTranslateText(text, targetLanguage, sourceLanguage, options) {
        // 这里可以集成开源翻译模型，如 MarianMT 或 T5
        // 暂时返回模拟结果
        return {
            success: true,
            originalText: text,
            translatedText: `[本地翻译到${targetLanguage}] ${text}`,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            confidence: 0.7,
            alternatives: []
        };
    }
    
    /**
     * 文本转语音
     */
    async textToSpeech(text, targetLanguage, options = {}) {
        try {
            if (!text || text.trim().length === 0) {
                throw new Error('合成文本不能为空');
            }
            
            // 检查缓存
            const cacheKey = `${text}_${targetLanguage}_${JSON.stringify(options)}`;
            if (this.speechCache.has(cacheKey)) {
                return this.speechCache.get(cacheKey);
            }
            
            const {
                voice = this.supportedLanguages[targetLanguage]?.voice,
                speed = 1.0,
                pitch = 1.0,
                volume = 1.0,
                format = 'mp3',
                quality = 'high'
            } = options;
            
            let result;
            
            // 优先使用Azure Speech Services
            if (this.azureConfig.speechKey) {
                result = await this.azureTextToSpeech(text, targetLanguage, {
                    voice,
                    speed,
                    pitch,
                    volume,
                    format,
                    quality
                });
            }
            // 备用Google Text-to-Speech
            else if (this.googleConfig.speechApiKey) {
                result = await this.googleTextToSpeech(text, targetLanguage, options);
            }
            // 本地语音合成
            else {
                result = await this.localTextToSpeech(text, targetLanguage, options);
            }
            
            // 缓存结果
            if (result.success) {
                this.speechCache.set(cacheKey, result);
                
                // 限制缓存大小
                if (this.speechCache.size > 100) {
                    const firstKey = this.speechCache.keys().next().value;
                    this.speechCache.delete(firstKey);
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('文本转语音失败:', error.message);
            return {
                success: false,
                error: error.message,
                audioBuffer: null,
                audioUrl: null,
                duration: 0,
                format: options.format || 'mp3'
            };
        }
    }
    
    /**
     * Azure文本转语音
     */
    async azureTextToSpeech(text, targetLanguage, options) {
        try {
            const endpoint = `https://${this.azureConfig.speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
            
            const ssml = this.generateSSML(text, options.voice, {
                speed: options.speed,
                pitch: options.pitch,
                volume: options.volume
            });
            
            const response = await axios.post(endpoint, ssml, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.azureConfig.speechKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': this.getAzureOutputFormat(options.format, options.quality),
                    'User-Agent': 'CultureBridge'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            const audioBuffer = Buffer.from(response.data);
            const audioUrl = await this.saveAudioFile(audioBuffer, options.format);
            
            return {
                success: true,
                audioBuffer: audioBuffer,
                audioUrl: audioUrl,
                duration: this.estimateAudioDuration(text, options.speed),
                format: options.format,
                size: audioBuffer.length
            };
            
        } catch (error) {
            console.error('Azure语音合成错误:', error.message);
            throw error;
        }
    }
    
    /**
     * Google文本转语音
     */
    async googleTextToSpeech(text, targetLanguage, options) {
        try {
            const endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
            
            const requestBody = {
                input: { text: text },
                voice: {
                    languageCode: targetLanguage,
                    name: options.voice,
                    ssmlGender: 'NEUTRAL'
                },
                audioConfig: {
                    audioEncoding: options.format.toUpperCase(),
                    speakingRate: options.speed,
                    pitch: options.pitch,
                    volumeGainDb: (options.volume - 1) * 6
                }
            };
            
            const response = await axios.post(`${endpoint}?key=${this.googleConfig.speechApiKey}`, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            
            const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
            const audioUrl = await this.saveAudioFile(audioBuffer, options.format);
            
            return {
                success: true,
                audioBuffer: audioBuffer,
                audioUrl: audioUrl,
                duration: this.estimateAudioDuration(text, options.speed),
                format: options.format,
                size: audioBuffer.length
            };
            
        } catch (error) {
            console.error('Google语音合成错误:', error.message);
            throw error;
        }
    }
    
    /**
     * 本地文本转语音
     */
    async localTextToSpeech(text, targetLanguage, options) {
        // 这里可以集成开源TTS引擎，如 eSpeak 或 Festival
        // 暂时返回模拟结果
        const mockAudioBuffer = Buffer.from('mock audio data');
        const audioUrl = await this.saveAudioFile(mockAudioBuffer, options.format);
        
        return {
            success: true,
            audioBuffer: mockAudioBuffer,
            audioUrl: audioUrl,
            duration: this.estimateAudioDuration(text, options.speed),
            format: options.format,
            size: mockAudioBuffer.length
        };
    }
    
    /**
     * 完整的语音翻译流程
     */
    async translateVoice(audioBuffer, targetLanguage, sourceLanguage = 'auto', options = {}) {
        try {
            const {
                includeOriginalAudio = true,
                includeTranslatedAudio = true,
                audioFormat = 'mp3',
                voiceOptions = {}
            } = options;
            
            // 步骤1: 语音识别
            console.log('开始语音识别...');
            const speechResult = await this.speechToText(audioBuffer, sourceLanguage, options.speechOptions);
            
            if (!speechResult.success) {
                throw new Error(`语音识别失败: ${speechResult.error}`);
            }
            
            // 步骤2: 文本翻译
            console.log('开始文本翻译...');
            const translationResult = await this.translateText(
                speechResult.text,
                targetLanguage,
                speechResult.language,
                options.translationOptions
            );
            
            if (!translationResult.success) {
                throw new Error(`文本翻译失败: ${translationResult.error}`);
            }
            
            // 步骤3: 语音合成（可选）
            let synthesisResult = null;
            if (includeTranslatedAudio) {
                console.log('开始语音合成...');
                synthesisResult = await this.textToSpeech(
                    translationResult.translatedText,
                    targetLanguage,
                    { ...voiceOptions, format: audioFormat }
                );
            }
            
            return {
                success: true,
                originalAudio: includeOriginalAudio ? {
                    buffer: audioBuffer,
                    duration: options.originalDuration
                } : null,
                speechRecognition: {
                    text: speechResult.text,
                    language: speechResult.language,
                    confidence: speechResult.confidence,
                    alternatives: speechResult.alternatives,
                    wordTimestamps: speechResult.wordTimestamps
                },
                translation: {
                    originalText: translationResult.originalText,
                    translatedText: translationResult.translatedText,
                    sourceLanguage: translationResult.sourceLanguage,
                    targetLanguage: translationResult.targetLanguage,
                    confidence: translationResult.confidence,
                    alternatives: translationResult.alternatives
                },
                synthesizedAudio: synthesisResult ? {
                    buffer: synthesisResult.audioBuffer,
                    url: synthesisResult.audioUrl,
                    duration: synthesisResult.duration,
                    format: synthesisResult.format,
                    size: synthesisResult.size
                } : null,
                processingTime: Date.now() - (options.startTime || Date.now())
            };
            
        } catch (error) {
            console.error('语音翻译失败:', error.message);
            return {
                success: false,
                error: error.message,
                originalAudio: null,
                speechRecognition: null,
                translation: null,
                synthesizedAudio: null,
                processingTime: Date.now() - (options.startTime || Date.now())
            };
        }
    }
    
    /**
     * 批量语音翻译
     */
    async batchTranslateVoice(audioFiles, targetLanguages, sourceLanguage = 'auto', options = {}) {
        try {
            const results = [];
            const {
                maxConcurrent = 3,
                timeout = 60000
            } = options;
            
            // 分批处理
            for (let i = 0; i < audioFiles.length; i += maxConcurrent) {
                const batch = audioFiles.slice(i, i + maxConcurrent);
                const batchPromises = batch.map(async (audioFile, index) => {
                    try {
                        const audioBuffer = await fs.readFile(audioFile.path);
                        const batchResults = [];
                        
                        for (const targetLang of targetLanguages) {
                            const result = await Promise.race([
                                this.translateVoice(audioBuffer, targetLang, sourceLanguage, {
                                    ...options,
                                    startTime: Date.now()
                                }),
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('翻译超时')), timeout)
                                )
                            ]);
                            
                            batchResults.push({
                                fileIndex: i + index,
                                fileName: audioFile.name,
                                targetLanguage: targetLang,
                                result: result
                            });
                        }
                        
                        return batchResults;
                    } catch (error) {
                        console.error(`处理文件 ${audioFile.name} 失败:`, error.message);
                        return targetLanguages.map(targetLang => ({
                            fileIndex: i + index,
                            fileName: audioFile.name,
                            targetLanguage: targetLang,
                            result: {
                                success: false,
                                error: error.message
                            }
                        }));
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults.flat());
            }
            
            return {
                success: true,
                results: results,
                totalFiles: audioFiles.length,
                totalTranslations: results.length,
                successCount: results.filter(r => r.result.success).length,
                failureCount: results.filter(r => !r.result.success).length
            };
            
        } catch (error) {
            console.error('批量语音翻译失败:', error.message);
            return {
                success: false,
                error: error.message,
                results: [],
                totalFiles: audioFiles.length,
                totalTranslations: 0,
                successCount: 0,
                failureCount: audioFiles.length * targetLanguages.length
            };
        }
    }
    
    /**
     * 辅助方法
     */
    generateSSML(text, voice, options) {
        const { speed = 1.0, pitch = 1.0, volume = 1.0 } = options;
        
        return `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="${speed}" pitch="${pitch > 1 ? '+' : ''}${((pitch - 1) * 50).toFixed(0)}%" volume="${(volume * 100).toFixed(0)}%">
                        ${text}
                    </prosody>
                </voice>
            </speak>
        `.trim();
    }
    
    getAzureOutputFormat(format, quality) {
        const formatMap = {
            'mp3': quality === 'high' ? 'audio-24khz-48kbitrate-mono-mp3' : 'audio-16khz-32kbitrate-mono-mp3',
            'wav': quality === 'high' ? 'riff-24khz-16bit-mono-pcm' : 'riff-16khz-16bit-mono-pcm',
            'ogg': 'ogg-24khz-16bit-mono-opus'
        };
        
        return formatMap[format] || formatMap['mp3'];
    }
    
    async saveAudioFile(audioBuffer, format) {
        try {
            const uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
            await fs.mkdir(uploadsDir, { recursive: true });
            
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${format}`;
            const filePath = path.join(uploadsDir, fileName);
            
            await fs.writeFile(filePath, audioBuffer);
            
            return `/uploads/audio/${fileName}`;
        } catch (error) {
            console.error('保存音频文件失败:', error.message);
            return null;
        }
    }
    
    estimateAudioDuration(text, speed = 1.0) {
        // 估算语音时长：平均每分钟150个单词，中文按字符计算
        const wordCount = text.split(/\s+/).length;
        const charCount = text.length;
        
        // 英文按单词计算，中文按字符计算
        const estimatedMinutes = text.match(/[\u4e00-\u9fa5]/) 
            ? charCount / (200 * speed) // 中文每分钟约200字符
            : wordCount / (150 * speed); // 英文每分钟约150单词
        
        return Math.max(estimatedMinutes * 60, 1); // 最少1秒
    }
    
    extractWordTimestamps(azureResult) {
        // 从Azure结果中提取单词时间戳
        if (azureResult.NBest && azureResult.NBest[0] && azureResult.NBest[0].Words) {
            return azureResult.NBest[0].Words.map(word => ({
                word: word.Word,
                startTime: word.Offset / 10000000, // 转换为秒
                endTime: (word.Offset + word.Duration) / 10000000,
                confidence: word.Confidence
            }));
        }
        return [];
    }
    
    mapLanguageCodeToBaidu(languageCode) {
        const mapping = {
            'zh-CN': 'zh',
            'zh-TW': 'cht',
            'en-US': 'en',
            'en-GB': 'en',
            'ja-JP': 'jp',
            'ko-KR': 'kor',
            'fr-FR': 'fra',
            'de-DE': 'de',
            'es-ES': 'spa',
            'it-IT': 'it',
            'pt-BR': 'pt',
            'ru-RU': 'ru',
            'ar-XA': 'ara',
            'hi-IN': 'hi',
            'th-TH': 'th',
            'vi-VN': 'vie'
        };
        
        return mapping[languageCode] || 'auto';
    }
    
    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
    
    /**
     * 检测语言
     */
    async detectLanguage(text) {
        try {
            if (this.azureConfig.translatorKey) {
                const endpoint = 'https://api.cognitive.microsofttranslator.com/detect';
                const params = new URLSearchParams({ 'api-version': '3.0' });
                
                const response = await axios.post(`${endpoint}?${params}`, [{ text }], {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.azureConfig.translatorKey,
                        'Ocp-Apim-Subscription-Region': this.azureConfig.translatorRegion,
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = response.data[0];
                return {
                    success: true,
                    language: result.language,
                    confidence: result.score,
                    alternatives: result.alternatives || []
                };
            }
            
            // 简单的语言检测逻辑
            if (/[\u4e00-\u9fa5]/.test(text)) {
                return { success: true, language: 'zh-CN', confidence: 0.9 };
            } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
                return { success: true, language: 'ja-JP', confidence: 0.9 };
            } else if (/[\uac00-\ud7af]/.test(text)) {
                return { success: true, language: 'ko-KR', confidence: 0.9 };
            } else {
                return { success: true, language: 'en-US', confidence: 0.7 };
            }
            
        } catch (error) {
            console.error('语言检测失败:', error.message);
            return {
                success: false,
                error: error.message,
                language: 'unknown',
                confidence: 0
            };
        }
    }
    
    /**
     * 清理缓存
     */
    clearCache() {
        this.translationCache.clear();
        this.speechCache.clear();
        console.log('✅ 语音翻译缓存已清理');
    }
    
    /**
     * 获取服务状态
     */
    getServiceStatus() {
        return {
            azureConfigured: !!(this.azureConfig.speechKey && this.azureConfig.translatorKey),
            googleConfigured: !!(this.googleConfig.apiKey && this.googleConfig.speechApiKey),
            baiduConfigured: !!(this.baiduConfig.appId && this.baiduConfig.secretKey),
            cacheSize: {
                translation: this.translationCache.size,
                speech: this.speechCache.size
            },
            supportedLanguages: Object.keys(this.supportedLanguages).length
        };
    }
}

module.exports = AdvancedVoiceTranslationService;

