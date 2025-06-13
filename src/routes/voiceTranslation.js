const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AdvancedVoiceTranslationService = require('../services/advancedVoiceTranslationService');
const { protect } = require('../middleware/auth');

// 初始化语音翻译服务
const voiceTranslationService = new AdvancedVoiceTranslationService();

// 配置文件上传
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'voice');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 10
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /webm|mp3|wav|ogg|m4a|aac|flac/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只支持音频文件格式: webm, mp3, wav, ogg, m4a, aac, flac'));
        }
    }
});

/**
 * @desc    语音识别
 * @route   POST /api/v2/voice/speech-to-text
 * @access  Private
 */
router.post('/speech-to-text', protect, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '请上传音频文件'
            });
        }
        
        const {
            sourceLanguage = 'auto',
            enablePunctuation = true,
            enableWordTimestamps = false,
            profanityFilter = true
        } = req.body;
        
        // 读取音频文件
        const audioBuffer = await fs.readFile(req.file.path);
        
        // 执行语音识别
        const result = await voiceTranslationService.speechToText(audioBuffer, sourceLanguage, {
            format: path.extname(req.file.originalname).slice(1),
            enablePunctuation: enablePunctuation === 'true',
            enableWordTimestamps: enableWordTimestamps === 'true',
            profanityFilter: profanityFilter === 'true'
        });
        
        // 清理临时文件
        await fs.unlink(req.file.path).catch(console.error);
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    text: result.text,
                    language: result.language,
                    confidence: result.confidence,
                    alternatives: result.alternatives,
                    wordTimestamps: result.wordTimestamps
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('语音识别失败:', error);
        
        // 清理临时文件
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({
            success: false,
            error: '语音识别服务暂时不可用'
        });
    }
});

/**
 * @desc    文本翻译
 * @route   POST /api/v2/voice/translate-text
 * @access  Private
 */
router.post('/translate-text', protect, async (req, res) => {
    try {
        const {
            text,
            targetLanguage,
            sourceLanguage = 'auto',
            preserveFormatting = true,
            includeAlternatives = true
        } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '文本和目标语言不能为空'
            });
        }
        
        const result = await voiceTranslationService.translateText(text, targetLanguage, sourceLanguage, {
            preserveFormatting,
            includeAlternatives
        });
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    originalText: result.originalText,
                    translatedText: result.translatedText,
                    sourceLanguage: result.sourceLanguage,
                    targetLanguage: result.targetLanguage,
                    confidence: result.confidence,
                    alternatives: result.alternatives
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('文本翻译失败:', error);
        res.status(500).json({
            success: false,
            error: '翻译服务暂时不可用'
        });
    }
});

/**
 * @desc    文本转语音
 * @route   POST /api/v2/voice/text-to-speech
 * @access  Private
 */
router.post('/text-to-speech', protect, async (req, res) => {
    try {
        const {
            text,
            targetLanguage,
            voice,
            speed = 1.0,
            pitch = 1.0,
            volume = 1.0,
            format = 'mp3',
            quality = 'high'
        } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '文本和目标语言不能为空'
            });
        }
        
        const result = await voiceTranslationService.textToSpeech(text, targetLanguage, {
            voice,
            speed: parseFloat(speed),
            pitch: parseFloat(pitch),
            volume: parseFloat(volume),
            format,
            quality
        });
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    audioUrl: result.audioUrl,
                    duration: result.duration,
                    format: result.format,
                    size: result.size
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('文本转语音失败:', error);
        res.status(500).json({
            success: false,
            error: '语音合成服务暂时不可用'
        });
    }
});

/**
 * @desc    完整语音翻译
 * @route   POST /api/v2/voice/translate-voice
 * @access  Private
 */
router.post('/translate-voice', protect, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '请上传音频文件'
            });
        }
        
        const {
            targetLanguage,
            sourceLanguage = 'auto',
            includeOriginalAudio = true,
            includeTranslatedAudio = true,
            audioFormat = 'mp3',
            voiceSpeed = 1.0,
            voicePitch = 1.0,
            voiceVolume = 1.0
        } = req.body;
        
        if (!targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '目标语言不能为空'
            });
        }
        
        // 读取音频文件
        const audioBuffer = await fs.readFile(req.file.path);
        
        // 执行完整语音翻译
        const result = await voiceTranslationService.translateVoice(audioBuffer, targetLanguage, sourceLanguage, {
            includeOriginalAudio: includeOriginalAudio === 'true',
            includeTranslatedAudio: includeTranslatedAudio === 'true',
            audioFormat,
            voiceOptions: {
                speed: parseFloat(voiceSpeed),
                pitch: parseFloat(voicePitch),
                volume: parseFloat(voiceVolume)
            },
            speechOptions: {
                format: path.extname(req.file.originalname).slice(1)
            },
            startTime: Date.now()
        });
        
        // 清理临时文件
        await fs.unlink(req.file.path).catch(console.error);
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    speechRecognition: result.speechRecognition,
                    translation: result.translation,
                    synthesizedAudio: result.synthesizedAudio,
                    processingTime: result.processingTime
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('语音翻译失败:', error);
        
        // 清理临时文件
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({
            success: false,
            error: '语音翻译服务暂时不可用'
        });
    }
});

/**
 * @desc    批量语音翻译
 * @route   POST /api/v2/voice/batch-translate
 * @access  Private
 */
router.post('/batch-translate', protect, upload.array('audios', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请上传至少一个音频文件'
            });
        }
        
        const {
            targetLanguages,
            sourceLanguage = 'auto',
            maxConcurrent = 3,
            timeout = 60000
        } = req.body;
        
        if (!targetLanguages) {
            return res.status(400).json({
                success: false,
                error: '目标语言不能为空'
            });
        }
        
        const targetLangs = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
        const audioFiles = req.files.map(file => ({
            name: file.originalname,
            path: file.path
        }));
        
        // 执行批量翻译
        const result = await voiceTranslationService.batchTranslateVoice(
            audioFiles,
            targetLangs,
            sourceLanguage,
            {
                maxConcurrent: parseInt(maxConcurrent),
                timeout: parseInt(timeout)
            }
        );
        
        // 清理临时文件
        for (const file of req.files) {
            await fs.unlink(file.path).catch(console.error);
        }
        
        res.json({
            success: result.success,
            data: result
        });
        
    } catch (error) {
        console.error('批量语音翻译失败:', error);
        
        // 清理临时文件
        if (req.files) {
            for (const file of req.files) {
                await fs.unlink(file.path).catch(console.error);
            }
        }
        
        res.status(500).json({
            success: false,
            error: '批量翻译服务暂时不可用'
        });
    }
});

/**
 * @desc    语言检测
 * @route   POST /api/v2/voice/detect-language
 * @access  Private
 */
router.post('/detect-language', protect, async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                error: '文本不能为空'
            });
        }
        
        const result = await voiceTranslationService.detectLanguage(text);
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    language: result.language,
                    confidence: result.confidence,
                    alternatives: result.alternatives
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('语言检测失败:', error);
        res.status(500).json({
            success: false,
            error: '语言检测服务暂时不可用'
        });
    }
});

/**
 * @desc    获取支持的语言列表
 * @route   GET /api/v2/voice/supported-languages
 * @access  Private
 */
router.get('/supported-languages', protect, async (req, res) => {
    try {
        const languages = voiceTranslationService.getSupportedLanguages();
        
        res.json({
            success: true,
            data: {
                languages: languages,
                count: Object.keys(languages).length
            }
        });
        
    } catch (error) {
        console.error('获取支持语言失败:', error);
        res.status(500).json({
            success: false,
            error: '服务暂时不可用'
        });
    }
});

/**
 * @desc    获取服务状态
 * @route   GET /api/v2/voice/service-status
 * @access  Private
 */
router.get('/service-status', protect, async (req, res) => {
    try {
        const status = voiceTranslationService.getServiceStatus();
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        console.error('获取服务状态失败:', error);
        res.status(500).json({
            success: false,
            error: '服务暂时不可用'
        });
    }
});

/**
 * @desc    清理缓存
 * @route   POST /api/v2/voice/clear-cache
 * @access  Private
 */
router.post('/clear-cache', protect, async (req, res) => {
    try {
        // 这里可以添加管理员权限检查
        voiceTranslationService.clearCache();
        
        res.json({
            success: true,
            message: '缓存已清理'
        });
        
    } catch (error) {
        console.error('清理缓存失败:', error);
        res.status(500).json({
            success: false,
            error: '清理缓存失败'
        });
    }
});

/**
 * @desc    实时语音翻译（WebSocket支持）
 * @route   WebSocket /api/v2/voice/realtime
 * @access  Private
 */
router.ws('/realtime', async (ws, req) => {
    try {
        // 验证用户身份
        const token = req.query.token;
        if (!token) {
            ws.close(1008, 'Authentication required');
            return;
        }
        
        // 这里应该验证JWT token
        // const user = await verifyToken(token);
        
        console.log('实时语音翻译连接建立');
        
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                switch (data.type) {
                    case 'audio_chunk':
                        // 处理音频块
                        const audioBuffer = Buffer.from(data.audio, 'base64');
                        
                        // 这里可以实现流式语音识别
                        // 暂时使用完整音频处理
                        const result = await voiceTranslationService.speechToText(
                            audioBuffer,
                            data.sourceLanguage || 'auto'
                        );
                        
                        if (result.success && data.targetLanguage) {
                            const translation = await voiceTranslationService.translateText(
                                result.text,
                                data.targetLanguage,
                                result.language
                            );
                            
                            ws.send(JSON.stringify({
                                type: 'translation_result',
                                data: {
                                    originalText: result.text,
                                    translatedText: translation.translatedText,
                                    sourceLanguage: result.language,
                                    targetLanguage: data.targetLanguage,
                                    confidence: result.confidence
                                }
                            }));
                        }
                        break;
                        
                    case 'text_translate':
                        // 处理文本翻译
                        const textResult = await voiceTranslationService.translateText(
                            data.text,
                            data.targetLanguage,
                            data.sourceLanguage || 'auto'
                        );
                        
                        ws.send(JSON.stringify({
                            type: 'text_translation_result',
                            data: textResult
                        }));
                        break;
                        
                    default:
                        ws.send(JSON.stringify({
                            type: 'error',
                            error: '未知的消息类型'
                        }));
                }
                
            } catch (error) {
                console.error('处理WebSocket消息失败:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    error: '处理消息失败'
                }));
            }
        });
        
        ws.on('close', () => {
            console.log('实时语音翻译连接关闭');
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket错误:', error);
        });
        
        // 发送连接成功消息
        ws.send(JSON.stringify({
            type: 'connected',
            message: '实时语音翻译服务已连接'
        }));
        
    } catch (error) {
        console.error('WebSocket连接失败:', error);
        ws.close(1011, 'Internal server error');
    }
});

module.exports = router;

