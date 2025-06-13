const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const EnhancedVoiceTranslationService = require('../services/enhancedVoiceTranslationService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

const router = express.Router();
const voiceService = new EnhancedVoiceTranslationService();

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new ErrorResponse('只支持音频文件', 400), false);
        }
    }
});

/**
 * @desc    语音转文字
 * @route   POST /api/v1/voice/transcribe
 * @access  Private
 */
router.post('/transcribe', protect, upload.single('audio'), asyncHandler(async (req, res, next) => {
    if (!req.file) {
        return next(new ErrorResponse('请上传音频文件', 400));
    }
    
    const { language = 'auto' } = req.body;
    
    try {
        const result = await voiceService.transcribeAudio(req.file.buffer, language);
        
        res.status(200).json({
            success: true,
            data: {
                text: result.text,
                confidence: result.confidence,
                detectedLanguage: result.detectedLanguage,
                culturalContext: result.culturalContext,
                wordTimings: result.wordTimings,
                alternatives: result.alternatives
            }
        });
    } catch (error) {
        return next(new ErrorResponse(error.message, 500));
    }
}));

/**
 * @desc    文本翻译
 * @route   POST /api/v1/voice/translate
 * @access  Private
 */
router.post('/translate', protect, asyncHandler(async (req, res, next) => {
    const { text, sourceLanguage, targetLanguage, culturalContext } = req.body;
    
    if (!text || !sourceLanguage || !targetLanguage) {
        return next(new ErrorResponse('文本、源语言和目标语言不能为空', 400));
    }
    
    try {
        const result = await voiceService.translateText(text, sourceLanguage, targetLanguage, culturalContext);
        
        res.status(200).json({
            success: true,
            data: {
                originalText: result.originalText,
                translatedText: result.text,
                confidence: result.confidence,
                detectedLanguage: result.detectedLanguage,
                culturalNotes: result.culturalNotes
            }
        });
    } catch (error) {
        return next(new ErrorResponse(error.message, 500));
    }
}));

/**
 * @desc    文字转语音
 * @route   POST /api/v1/voice/synthesize
 * @access  Private
 */
router.post('/synthesize', protect, asyncHandler(async (req, res, next) => {
    const { text, language, options = {} } = req.body;
    
    if (!text || !language) {
        return next(new ErrorResponse('文本和语言不能为空', 400));
    }
    
    try {
        const audioBuffer = await voiceService.synthesizeSpeech(text, language, options);
        
        // 设置响应头
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Content-Disposition': 'attachment; filename="synthesized_speech.mp3"'
        });
        
        res.send(audioBuffer);
    } catch (error) {
        return next(new ErrorResponse(error.message, 500));
    }
}));

/**
 * @desc    完整语音翻译流程
 * @route   POST /api/v1/voice/translate-audio
 * @access  Private
 */
router.post('/translate-audio', protect, upload.single('audio'), asyncHandler(async (req, res, next) => {
    if (!req.file) {
        return next(new ErrorResponse('请上传音频文件', 400));
    }
    
    const { sourceLanguage = 'auto', targetLanguage, roomId } = req.body;
    
    if (!targetLanguage) {
        return next(new ErrorResponse('目标语言不能为空', 400));
    }
    
    try {
        const result = await voiceService.processVoiceMessage({
            audioData: req.file.buffer,
            sourceLanguage,
            targetLanguage,
            userId: req.user.id,
            roomId,
            startTime: Date.now()
        });
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: {
                    originalText: result.originalText,
                    translatedText: result.translatedText,
                    originalAudioUrl: result.originalAudioUrl,
                    translatedAudioUrl: result.translatedAudioUrl,
                    confidence: result.confidence,
                    culturalContext: result.culturalContext,
                    culturalNotes: result.culturalNotes,
                    detectedLanguage: result.detectedLanguage
                }
            });
        } else {
            return next(new ErrorResponse(result.error, 500));
        }
    } catch (error) {
        return next(new ErrorResponse(error.message, 500));
    }
}));

/**
 * @desc    获取支持的语言列表
 * @route   GET /api/v1/voice/languages
 * @access  Public
 */
router.get('/languages', asyncHandler(async (req, res, next) => {
    try {
        const languages = voiceService.getSupportedLanguages();
        
        res.status(200).json({
            success: true,
            count: languages.length,
            data: languages
        });
    } catch (error) {
        return next(new ErrorResponse('获取语言列表失败', 500));
    }
}));

/**
 * @desc    实时语音识别（WebSocket连接信息）
 * @route   GET /api/v1/voice/streaming-info
 * @access  Private
 */
router.get('/streaming-info', protect, asyncHandler(async (req, res, next) => {
    try {
        const streamingInfo = {
            endpoint: '/voice-streaming',
            supportedFormats: ['webm', 'opus', 'wav'],
            sampleRate: 48000,
            encoding: 'WEBM_OPUS',
            maxDuration: 300, // 5分钟
            languages: voiceService.getSupportedLanguages().map(lang => ({
                code: lang.code,
                name: lang.name
            })),
            events: {
                connect: 'voice:connect',
                start: 'voice:start',
                data: 'voice:data',
                result: 'voice:result',
                end: 'voice:end',
                error: 'voice:error'
            }
        };
        
        res.status(200).json({
            success: true,
            data: streamingInfo
        });
    } catch (error) {
        return next(new ErrorResponse('获取流式识别信息失败', 500));
    }
}));

/**
 * @desc    获取用户语音翻译历史
 * @route   GET /api/v1/voice/history
 * @access  Private
 */
router.get('/history', protect, asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20, language, roomId } = req.query;
    
    try {
        const VoiceTranslation = require('../models/VoiceTranslation');
        
        const query = { user: req.user.id };
        
        if (language) {
            query.$or = [
                { sourceLanguage: language },
                { targetLanguage: language }
            ];
        }
        
        if (roomId) {
            query.chatRoom = roomId;
        }
        
        const skip = (page - 1) * limit;
        
        const [translations, total] = await Promise.all([
            VoiceTranslation.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('chatRoom', 'name type')
                .lean(),
            VoiceTranslation.countDocuments(query)
        ]);
        
        res.status(200).json({
            success: true,
            count: translations.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: translations
        });
    } catch (error) {
        return next(new ErrorResponse('获取翻译历史失败', 500));
    }
}));

/**
 * @desc    获取语音翻译统计
 * @route   GET /api/v1/voice/stats
 * @access  Private
 */
router.get('/stats', protect, asyncHandler(async (req, res, next) => {
    try {
        const VoiceTranslation = require('../models/VoiceTranslation');
        
        const userId = req.user.id;
        
        const [
            totalTranslations,
            languageStats,
            recentActivity
        ] = await Promise.all([
            VoiceTranslation.countDocuments({ user: userId }),
            VoiceTranslation.aggregate([
                { $match: { user: userId } },
                { $group: {
                    _id: '$sourceLanguage',
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' }
                }},
                { $sort: { count: -1 } }
            ]),
            VoiceTranslation.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(7)
                .select('createdAt sourceLanguage targetLanguage confidence')
                .lean()
        ]);
        
        const stats = {
            totalTranslations,
            languageStats,
            recentActivity,
            averageConfidence: languageStats.reduce((sum, stat) => sum + stat.avgConfidence, 0) / languageStats.length || 0,
            mostUsedLanguage: languageStats[0]?._id || null
        };
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        return next(new ErrorResponse('获取统计信息失败', 500));
    }
}));

/**
 * @desc    删除语音翻译记录
 * @route   DELETE /api/v1/voice/:id
 * @access  Private
 */
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
    try {
        const VoiceTranslation = require('../models/VoiceTranslation');
        const fs = require('fs').promises;
        
        const translation = await VoiceTranslation.findById(req.params.id);
        
        if (!translation) {
            return next(new ErrorResponse('翻译记录不存在', 404));
        }
        
        // 检查权限
        if (translation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return next(new ErrorResponse('权限不足', 403));
        }
        
        // 删除音频文件
        try {
            if (translation.originalAudioPath) {
                await fs.unlink(translation.originalAudioPath);
            }
            if (translation.translatedAudioPath) {
                await fs.unlink(translation.translatedAudioPath);
            }
        } catch (fileError) {
            console.error('删除音频文件失败:', fileError);
        }
        
        await translation.deleteOne();
        
        res.status(200).json({
            success: true,
            message: '翻译记录已删除'
        });
    } catch (error) {
        return next(new ErrorResponse('删除记录失败', 500));
    }
}));

module.exports = router;

