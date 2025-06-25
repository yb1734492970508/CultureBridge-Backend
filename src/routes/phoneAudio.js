const express = require('express');
const router = express.Router();
const phoneAudioService = require('../services/phoneAudioTranslationService');

/**
 * @route   POST /api/phone-audio/translate
 * @desc    处理手机播放内容音频翻译
 * @access  Public
 */
router.post('/translate', phoneAudioService.getUploadMiddleware(), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '未接收到音频文件'
            });
        }

        const {
            sourceLanguage = 'auto',
            targetLanguage = 'en-US',
            sessionId,
            audioFormat = 'webm'
        } = req.body;

        const result = await phoneAudioService.processPhoneAudio(req.file.buffer, {
            sourceLanguage,
            targetLanguage,
            sessionId,
            audioFormat
        });

        res.json({
            success: true,
            data: result,
            message: '音频翻译完成'
        });

    } catch (error) {
        console.error('手机音频翻译失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '音频翻译失败'
        });
    }
});

/**
 * @route   POST /api/phone-audio/start-realtime
 * @desc    启动实时音频翻译
 * @access  Public
 */
router.post('/start-realtime', async (req, res) => {
    try {
        const {
            sessionId,
            sourceLanguage = 'auto',
            targetLanguage = 'en-US',
            chunkSize = 1024,
            bufferDuration = 3000
        } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: '缺少会话ID'
            });
        }

        const result = await phoneAudioService.startRealTimeTranslation(sessionId, {
            sourceLanguage,
            targetLanguage,
            chunkSize,
            bufferDuration
        });

        res.json({
            success: true,
            data: result,
            message: '实时翻译已启动'
        });

    } catch (error) {
        console.error('启动实时翻译失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '启动实时翻译失败'
        });
    }
});

/**
 * @route   POST /api/phone-audio/process-chunk
 * @desc    处理音频流数据块
 * @access  Public
 */
router.post('/process-chunk', phoneAudioService.getUploadMiddleware(), async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: '缺少会话ID'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '未接收到音频数据'
            });
        }

        const result = await phoneAudioService.processAudioChunk(sessionId, req.file.buffer);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('处理音频块失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '处理音频块失败'
        });
    }
});

/**
 * @route   POST /api/phone-audio/stop-realtime
 * @desc    停止实时音频翻译
 * @access  Public
 */
router.post('/stop-realtime', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: '缺少会话ID'
            });
        }

        const result = await phoneAudioService.stopRealTimeTranslation(sessionId);

        res.json({
            success: true,
            data: result,
            message: '实时翻译已停止'
        });

    } catch (error) {
        console.error('停止实时翻译失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '停止实时翻译失败'
        });
    }
});

/**
 * @route   GET /api/phone-audio/session/:sessionId
 * @desc    获取会话信息
 * @access  Public
 */
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionData = phoneAudioService.getActiveSession(sessionId);

        if (!sessionData) {
            return res.status(404).json({
                success: false,
                error: '会话不存在'
            });
        }

        res.json({
            success: true,
            data: {
                sessionId,
                sourceLanguage: sessionData.sourceLanguage,
                targetLanguage: sessionData.targetLanguage,
                isActive: sessionData.isActive,
                bufferSize: sessionData.audioBuffer.length,
                lastProcessTime: sessionData.lastProcessTime
            }
        });

    } catch (error) {
        console.error('获取会话信息失败:', error);
        res.status(500).json({
            success: false,
            error: '获取会话信息失败'
        });
    }
});

/**
 * @route   GET /api/phone-audio/sessions
 * @desc    获取所有活动会话
 * @access  Public
 */
router.get('/sessions', async (req, res) => {
    try {
        const activeSessions = phoneAudioService.getAllActiveSessions();

        res.json({
            success: true,
            data: {
                sessions: activeSessions,
                count: activeSessions.length
            }
        });

    } catch (error) {
        console.error('获取活动会话失败:', error);
        res.status(500).json({
            success: false,
            error: '获取活动会话失败'
        });
    }
});

/**
 * @route   GET /api/phone-audio/languages
 * @desc    获取支持的语言列表
 * @access  Public
 */
router.get('/languages', async (req, res) => {
    try {
        const languages = phoneAudioService.getSupportedLanguages();

        res.json({
            success: true,
            data: {
                languages,
                count: languages.length
            }
        });

    } catch (error) {
        console.error('获取语言列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取语言列表失败'
        });
    }
});

/**
 * @route   POST /api/phone-audio/cleanup
 * @desc    清理过期会话
 * @access  Public
 */
router.post('/cleanup', async (req, res) => {
    try {
        const { maxAge = 3600000 } = req.body; // 默认1小时

        phoneAudioService.cleanupExpiredSessions(maxAge);

        res.json({
            success: true,
            message: '过期会话清理完成'
        });

    } catch (error) {
        console.error('清理过期会话失败:', error);
        res.status(500).json({
            success: false,
            error: '清理过期会话失败'
        });
    }
});

/**
 * @route   GET /api/phone-audio/health
 * @desc    健康检查
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const activeSessions = phoneAudioService.getAllActiveSessions();
        
        res.json({
            success: true,
            data: {
                status: 'healthy',
                activeSessions: activeSessions.length,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }
        });

    } catch (error) {
        console.error('健康检查失败:', error);
        res.status(500).json({
            success: false,
            error: '健康检查失败'
        });
    }
});

module.exports = router;

