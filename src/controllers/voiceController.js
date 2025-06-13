const VoiceTranslationService = require('../services/voiceTranslationService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const multer = require('multer');
const path = require('path');

class VoiceController {
    constructor() {
        this.voiceService = new VoiceTranslationService();
        
        // 配置multer用于音频文件上传
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 10 * 1024 * 1024 // 10MB限制
            },
            fileFilter: (req, file, cb) => {
                const allowedMimes = [
                    'audio/webm',
                    'audio/wav',
                    'audio/mp3',
                    'audio/mpeg',
                    'audio/ogg'
                ];
                
                if (allowedMimes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('不支持的音频格式'), false);
                }
            }
        });
    }
    
    /**
     * @desc    上传并翻译语音消息
     * @route   POST /api/v1/voice/translate
     * @access  Private
     */
    translateVoice = asyncHandler(async (req, res, next) => {
        const { targetLanguages, sourceLanguage = 'auto', chatRoomId } = req.body;
        
        if (!req.file) {
            return next(new ErrorResponse('请上传音频文件', 400));
        }
        
        if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
            return next(new ErrorResponse('请指定目标语言', 400));
        }
        
        try {
            const result = await this.voiceService.processVoiceMessage(
                req.file.buffer,
                sourceLanguage,
                targetLanguages,
                req.user.id,
                chatRoomId
            );
            
            res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('语音翻译失败:', error);
            return next(new ErrorResponse(error.message || '语音翻译失败', 500));
        }
    });
    
    /**
     * @desc    获取支持的语言列表
     * @route   GET /api/v1/voice/languages
     * @access  Public
     */
    getSupportedLanguages = asyncHandler(async (req, res, next) => {
        const languages = this.voiceService.getSupportedLanguages();
        
        res.status(200).json({
            success: true,
            data: languages
        });
    });
    
    /**
     * @desc    获取用户的语音翻译历史
     * @route   GET /api/v1/voice/history
     * @access  Private
     */
    getVoiceHistory = asyncHandler(async (req, res, next) => {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        try {
            const translations = await this.voiceService.getUserVoiceTranslations(
                req.user.id,
                parseInt(limit),
                parseInt(skip)
            );
            
            res.status(200).json({
                success: true,
                count: translations.length,
                data: translations
            });
        } catch (error) {
            console.error('获取语音翻译历史失败:', error);
            return next(new ErrorResponse('获取翻译历史失败', 500));
        }
    });
    
    /**
     * @desc    删除语音翻译记录
     * @route   DELETE /api/v1/voice/translation/:id
     * @access  Private
     */
    deleteVoiceTranslation = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        
        try {
            await this.voiceService.deleteVoiceTranslation(id, req.user.id);
            
            res.status(200).json({
                success: true,
                message: '翻译记录已删除'
            });
        } catch (error) {
            console.error('删除语音翻译记录失败:', error);
            return next(new ErrorResponse(error.message || '删除失败', 500));
        }
    });
    
    /**
     * @desc    仅语音转文字（不翻译）
     * @route   POST /api/v1/voice/transcribe
     * @access  Private
     */
    transcribeVoice = asyncHandler(async (req, res, next) => {
        const { language = 'auto' } = req.body;
        
        if (!req.file) {
            return next(new ErrorResponse('请上传音频文件', 400));
        }
        
        try {
            const result = await this.voiceService.transcribeAudio(req.file.buffer, language);
            
            res.status(200).json({
                success: true,
                data: {
                    text: result.text,
                    confidence: result.confidence,
                    detectedLanguage: result.detectedLanguage,
                    wordTimings: result.wordTimings
                }
            });
        } catch (error) {
            console.error('语音转文字失败:', error);
            return next(new ErrorResponse(error.message || '语音识别失败', 500));
        }
    });
    
    /**
     * @desc    文字转语音
     * @route   POST /api/v1/voice/synthesize
     * @access  Private
     */
    synthesizeVoice = asyncHandler(async (req, res, next) => {
        const { text, language, voiceType = 'neutral' } = req.body;
        
        if (!text || !language) {
            return next(new ErrorResponse('请提供文本和语言', 400));
        }
        
        try {
            const audioBuffer = await this.voiceService.synthesizeSpeech(text, language, voiceType);
            
            // 设置响应头
            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length,
                'Content-Disposition': 'attachment; filename="synthesized_voice.mp3"'
            });
            
            res.send(audioBuffer);
        } catch (error) {
            console.error('语音合成失败:', error);
            return next(new ErrorResponse(error.message || '语音合成失败', 500));
        }
    });
    
    /**
     * @desc    实时语音翻译状态检查
     * @route   GET /api/v1/voice/translation/:id/status
     * @access  Private
     */
    getTranslationStatus = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        
        try {
            const VoiceTranslation = require('../models/VoiceTranslation');
            const translation = await VoiceTranslation.findOne({
                _id: id,
                user: req.user.id
            }).select('processingStatus errorMessage completedAt');
            
            if (!translation) {
                return next(new ErrorResponse('翻译记录不存在', 404));
            }
            
            res.status(200).json({
                success: true,
                data: {
                    status: translation.processingStatus,
                    errorMessage: translation.errorMessage,
                    completedAt: translation.completedAt
                }
            });
        } catch (error) {
            console.error('获取翻译状态失败:', error);
            return next(new ErrorResponse('获取状态失败', 500));
        }
    });
}

module.exports = new VoiceController();

