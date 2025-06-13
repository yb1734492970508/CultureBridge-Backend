const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const EnhancedVoiceTranslationService = require('../services/enhancedVoiceTranslationService');
const EnhancedBlockchainService = require('../services/enhancedBlockchainService');
const VoiceTranslation = require('../models/VoiceTranslation');
const User = require('../models/User');

const router = express.Router();

// 初始化服务
const voiceService = new EnhancedVoiceTranslationService();
const blockchainService = new EnhancedBlockchainService();

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // 检查文件类型
        const allowedMimes = [
            'audio/wav',
            'audio/mpeg',
            'audio/mp3',
            'audio/ogg',
            'audio/webm',
            'audio/flac'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ErrorResponse('不支持的音频格式', 400), false);
        }
    }
});

/**
 * @desc    获取支持的语言列表
 * @route   GET /api/v2/voice/languages
 * @access  Public
 */
router.get('/languages', asyncHandler(async (req, res, next) => {
    const languages = voiceService.getSupportedLanguages();
    
    res.status(200).json({
        success: true,
        count: languages.length,
        data: languages
    });
}));

/**
 * @desc    语音翻译（完整流程）
 * @route   POST /api/v2/voice/translate
 * @access  Private
 */
router.post('/translate', protect, upload.single('audio'), asyncHandler(async (req, res, next) => {
    const { sourceLanguage = 'auto', targetLanguages, chatRoomId } = req.body;
    
    // 验证输入
    if (!req.file) {
        return next(new ErrorResponse('请上传音频文件', 400));
    }
    
    if (!targetLanguages) {
        return next(new ErrorResponse('请指定目标语言', 400));
    }
    
    let parsedTargetLanguages;
    try {
        parsedTargetLanguages = Array.isArray(targetLanguages) 
            ? targetLanguages 
            : JSON.parse(targetLanguages);
    } catch (error) {
        return next(new ErrorResponse('目标语言格式错误', 400));
    }
    
    if (!Array.isArray(parsedTargetLanguages) || parsedTargetLanguages.length === 0) {
        return next(new ErrorResponse('请至少指定一种目标语言', 400));
    }
    
    try {
        // 处理语音翻译
        const result = await voiceService.processVoiceMessage(
            req.file.buffer,
            sourceLanguage,
            parsedTargetLanguages,
            req.user.id,
            chatRoomId
        );
        
        // 发放语音翻译奖励
        await distributeVoiceTranslationReward(req.user.id);
        
        res.status(200).json({
            success: true,
            data: result.data,
            message: '语音翻译完成'
        });
        
    } catch (error) {
        console.error('语音翻译失败:', error);
        return next(new ErrorResponse(error.message || '语音翻译失败', 500));
    }
}));

/**
 * @desc    仅语音识别（不翻译）
 * @route   POST /api/v2/voice/transcribe
 * @access  Private
 */
router.post('/transcribe', protect, upload.single('audio'), asyncHandler(async (req, res, next) => {
    const { language = 'auto' } = req.body;
    
    if (!req.file) {
        return next(new ErrorResponse('请上传音频文件', 400));
    }
    
    try {
        // 预处理音频
        const processedAudio = await voiceService.preprocessAudio(req.file.buffer);
        
        // 语音识别
        const transcription = await voiceService.transcribeAudio(
            processedAudio.buffer,
            language
        );
        
        // 清理临时文件
        await voiceService.cleanupTempFiles([processedAudio.filePath]);
        
        res.status(200).json({
            success: true,
            data: {
                text: transcription.text,
                confidence: transcription.confidence,
                detectedLanguage: transcription.detectedLanguage,
                wordTimings: transcription.wordTimings
            }
        });
        
    } catch (error) {
        console.error('语音识别失败:', error);
        return next(new ErrorResponse(error.message || '语音识别失败', 500));
    }
}));

/**
 * @desc    文字转语音
 * @route   POST /api/v2/voice/synthesize
 * @access  Private
 */
router.post('/synthesize', protect, asyncHandler(async (req, res, next) => {
    const { text, language, voiceType = 'neutral' } = req.body;
    
    if (!text || !language) {
        return next(new ErrorResponse('请提供文本和语言', 400));
    }
    
    if (text.length > 5000) {
        return next(new ErrorResponse('文本长度不能超过5000字符', 400));
    }
    
    try {
        const audioBuffer = await voiceService.synthesizeSpeech(text, language, voiceType);
        const duration = voiceService.estimateAudioDuration(text, language);
        
        res.status(200).json({
            success: true,
            data: {
                audioData: audioBuffer.toString('base64'),
                mimeType: 'audio/mpeg',
                duration,
                text,
                language,
                voiceType
            }
        });
        
    } catch (error) {
        console.error('语音合成失败:', error);
        return next(new ErrorResponse(error.message || '语音合成失败', 500));
    }
}));

/**
 * @desc    批量文本翻译
 * @route   POST /api/v2/voice/translate-text
 * @access  Private
 */
router.post('/translate-text', protect, asyncHandler(async (req, res, next) => {
    const { text, sourceLanguage, targetLanguages } = req.body;
    
    if (!text || !targetLanguages) {
        return next(new ErrorResponse('请提供文本和目标语言', 400));
    }
    
    if (text.length > 5000) {
        return next(new ErrorResponse('文本长度不能超过5000字符', 400));
    }
    
    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
        return next(new ErrorResponse('请至少指定一种目标语言', 400));
    }
    
    try {
        const translations = await voiceService.translateText(
            text,
            sourceLanguage || 'auto',
            targetLanguages
        );
        
        res.status(200).json({
            success: true,
            data: {
                originalText: text,
                sourceLanguage,
                translations
            }
        });
        
    } catch (error) {
        console.error('文本翻译失败:', error);
        return next(new ErrorResponse(error.message || '文本翻译失败', 500));
    }
}));

/**
 * @desc    获取用户翻译历史
 * @route   GET /api/v2/voice/history
 * @access  Private
 */
router.get('/history', protect, asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20, chatRoomId } = req.query;
    const skip = (page - 1) * limit;
    
    try {
        let query = { user: req.user.id };
        if (chatRoomId) {
            query.chatRoom = chatRoomId;
        }
        
        const [translations, total] = await Promise.all([
            VoiceTranslation.find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(skip)
                .populate('chatRoom', 'name type')
                .select('-audioTranslations'), // 不返回音频数据
            VoiceTranslation.countDocuments(query)
        ]);
        
        res.status(200).json({
            success: true,
            count: translations.length,
            total,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            },
            data: translations
        });
        
    } catch (error) {
        console.error('获取翻译历史失败:', error);
        return next(new ErrorResponse('获取翻译历史失败', 500));
    }
}));

/**
 * @desc    获取翻译详情（包含音频）
 * @route   GET /api/v2/voice/translation/:id
 * @access  Private
 */
router.get('/translation/:id', protect, asyncHandler(async (req, res, next) => {
    try {
        const translation = await VoiceTranslation.findOne({
            _id: req.params.id,
            user: req.user.id
        }).populate('chatRoom', 'name type');
        
        if (!translation) {
            return next(new ErrorResponse('翻译记录不存在', 404));
        }
        
        res.status(200).json({
            success: true,
            data: translation
        });
        
    } catch (error) {
        console.error('获取翻译详情失败:', error);
        return next(new ErrorResponse('获取翻译详情失败', 500));
    }
}));

/**
 * @desc    删除翻译记录
 * @route   DELETE /api/v2/voice/translation/:id
 * @access  Private
 */
router.delete('/translation/:id', protect, asyncHandler(async (req, res, next) => {
    try {
        await voiceService.deleteVoiceTranslation(req.params.id, req.user.id);
        
        res.status(200).json({
            success: true,
            message: '翻译记录已删除'
        });
        
    } catch (error) {
        console.error('删除翻译记录失败:', error);
        return next(new ErrorResponse(error.message || '删除翻译记录失败', 500));
    }
}));

/**
 * @desc    获取用户语音统计
 * @route   GET /api/v2/voice/stats
 * @access  Private
 */
router.get('/stats', protect, asyncHandler(async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // 获取用户翻译统计
        const stats = await VoiceTranslation.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalTranslations: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' },
                    avgProcessingTime: { $avg: '$processingTime' },
                    languageUsage: {
                        $push: {
                            source: '$sourceLanguage',
                            targets: { $objectToArray: '$translations' }
                        }
                    }
                }
            }
        ]);
        
        // 获取最近7天的使用情况
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentActivity = await VoiceTranslation.aggregate([
            {
                $match: {
                    user: userId,
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        const result = {
            overall: stats[0] || {
                totalTranslations: 0,
                avgConfidence: 0,
                avgProcessingTime: 0,
                languageUsage: []
            },
            recentActivity,
            user: {
                translationCount: req.user.translationCount || 0,
                lastTranslationAt: req.user.lastTranslationAt
            }
        };
        
        res.status(200).json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('获取语音统计失败:', error);
        return next(new ErrorResponse('获取语音统计失败', 500));
    }
}));

/**
 * @desc    语音翻译服务健康检查
 * @route   GET /api/v2/voice/health
 * @access  Public
 */
router.get('/health', asyncHandler(async (req, res, next) => {
    try {
        const healthStatus = await voiceService.healthCheck();
        const serviceStats = await voiceService.getServiceStats();
        
        res.status(200).json({
            success: true,
            data: {
                health: healthStatus,
                stats: serviceStats,
                supportedLanguages: voiceService.getSupportedLanguages().length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('语音服务健康检查失败:', error);
        return next(new ErrorResponse('语音服务健康检查失败', 500));
    }
}));

/**
 * @desc    语音翻译配置
 * @route   GET /api/v2/voice/config
 * @access  Private
 */
router.get('/config', protect, asyncHandler(async (req, res, next) => {
    const config = {
        maxFileSize: '10MB',
        supportedFormats: ['wav', 'mp3', 'ogg', 'webm', 'flac'],
        maxTextLength: 5000,
        supportedLanguages: voiceService.getSupportedLanguages(),
        features: {
            speechRecognition: true,
            textToSpeech: true,
            translation: true,
            voiceMessages: true,
            batchTranslation: true
        },
        rewards: {
            voiceTranslation: '2 CBT',
            dailyUsage: '最多10次免费翻译',
            premiumFeatures: '无限制使用'
        }
    };
    
    res.status(200).json({
        success: true,
        data: config
    });
}));

/**
 * @desc    实时语音翻译（WebSocket支持）
 * @route   POST /api/v2/voice/realtime
 * @access  Private
 */
router.post('/realtime', protect, asyncHandler(async (req, res, next) => {
    const { sessionId, audioChunk, isLast = false } = req.body;
    
    if (!sessionId || !audioChunk) {
        return next(new ErrorResponse('请提供会话ID和音频数据', 400));
    }
    
    try {
        // 这里可以实现实时语音翻译的逻辑
        // 暂时返回占位符响应
        res.status(200).json({
            success: true,
            data: {
                sessionId,
                isProcessing: !isLast,
                partialResult: isLast ? '实时翻译结果' : null
            },
            message: '实时语音翻译功能开发中'
        });
        
    } catch (error) {
        console.error('实时语音翻译失败:', error);
        return next(new ErrorResponse('实时语音翻译失败', 500));
    }
}));

/**
 * 发放语音翻译奖励
 */
async function distributeVoiceTranslationReward(userId) {
    try {
        const user = await User.findById(userId);
        if (!user.walletAddress) return;
        
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
        if (!adminPrivateKey) return;
        
        await blockchainService.distributeReward(
            user.walletAddress,
            2, // 2 CBT语音翻译奖励
            '使用语音翻译奖励',
            'LEARNING_REWARD',
            adminPrivateKey
        );
        
        console.log(`✅ 语音翻译奖励已发放给用户: ${user.username}`);
        
    } catch (error) {
        console.error('发放语音翻译奖励失败:', error);
    }
}

module.exports = router;

