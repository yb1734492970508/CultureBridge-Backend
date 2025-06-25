const express = require('express');
const router = express.Router();
const externalAudioService = require('../services/externalAudioTranslationService');

/**
 * @route   POST /api/external-audio/start-listening
 * @desc    启动外部音频监听
 * @access  Public
 */
router.post('/start-listening', async (req, res) => {
    try {
        const {
            sessionId,
            sourceLanguage = 'auto',
            targetLanguage = 'en-US',
            sensitivity = 0.5,
            noiseReduction = true,
            autoTranslate = true,
            continuousMode = true,
            maxDuration = 300000
        } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: '缺少会话ID'
            });
        }

        const result = await externalAudioService.startExternalAudioListening(sessionId, {
            sourceLanguage,
            targetLanguage,
            sensitivity,
            noiseReduction,
            autoTranslate,
            continuousMode,
            maxDuration
        });

        res.json({
            success: true,
            data: result,
            message: '外部音频监听已启动'
        });

    } catch (error) {
        console.error('启动外部音频监听失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '启动外部音频监听失败'
        });
    }
});

/**
 * @route   POST /api/external-audio/process
 * @desc    处理外部音频数据
 * @access  Public
 */
router.post('/process', externalAudioService.getUploadMiddleware(), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '未接收到音频文件'
            });
        }

        const {
            sessionId,
            sourceLanguage = 'auto',
            targetLanguage = 'en-US',
            audioFormat = 'webm',
            enhanceAudio = true,
            detectSpeakers = false
        } = req.body;

        const result = await externalAudioService.processExternalAudio(req.file.buffer, {
            sessionId,
            sourceLanguage,
            targetLanguage,
            audioFormat,
            enhanceAudio: enhanceAudio === 'true',
            detectSpeakers: detectSpeakers === 'true'
        });

        res.json({
            success: true,
            data: result,
            message: '外部音频处理完成'
        });

    } catch (error) {
        console.error('处理外部音频失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '外部音频处理失败'
        });
    }
});

/**
 * @route   POST /api/external-audio/stop-listening
 * @desc    停止外部音频监听
 * @access  Public
 */
router.post('/stop-listening', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: '缺少会话ID'
            });
        }

        const result = await externalAudioService.stopExternalAudioListening(sessionId);

        res.json({
            success: true,
            data: result,
            message: '外部音频监听已停止'
        });

    } catch (error) {
        console.error('停止外部音频监听失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '停止外部音频监听失败'
        });
    }
});

/**
 * @route   GET /api/external-audio/listener/:sessionId
 * @desc    获取监听器信息
 * @access  Public
 */
router.get('/listener/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const listenerData = externalAudioService.getActiveListener(sessionId);

        if (!listenerData) {
            return res.status(404).json({
                success: false,
                error: '监听器不存在'
            });
        }

        const duration = Date.now() - listenerData.startTime;
        const avgQuality = externalAudioService.calculateAvgQuality(listenerData.audioQualityHistory);

        res.json({
            success: true,
            data: {
                sessionId,
                sourceLanguage: listenerData.sourceLanguage,
                targetLanguage: listenerData.targetLanguage,
                isActive: listenerData.isActive,
                duration,
                translationCount: listenerData.translationCount,
                avgAudioQuality: avgQuality,
                sensitivity: listenerData.sensitivity,
                noiseReduction: listenerData.noiseReduction,
                autoTranslate: listenerData.autoTranslate,
                continuousMode: listenerData.continuousMode,
                backgroundNoiseLevel: listenerData.backgroundNoiseLevel,
                detectedSpeakers: Array.from(listenerData.detectedSpeakers),
                lastProcessTime: listenerData.lastProcessTime
            }
        });

    } catch (error) {
        console.error('获取监听器信息失败:', error);
        res.status(500).json({
            success: false,
            error: '获取监听器信息失败'
        });
    }
});

/**
 * @route   GET /api/external-audio/listeners
 * @desc    获取所有活动监听器
 * @access  Public
 */
router.get('/listeners', async (req, res) => {
    try {
        const activeListeners = externalAudioService.getAllActiveListeners();
        
        const listenersInfo = activeListeners.map(sessionId => {
            const listener = externalAudioService.getActiveListener(sessionId);
            return {
                sessionId,
                sourceLanguage: listener.sourceLanguage,
                targetLanguage: listener.targetLanguage,
                isActive: listener.isActive,
                duration: Date.now() - listener.startTime,
                translationCount: listener.translationCount,
                startTime: listener.startTime
            };
        });

        res.json({
            success: true,
            data: {
                listeners: listenersInfo,
                count: listenersInfo.length
            }
        });

    } catch (error) {
        console.error('获取活动监听器失败:', error);
        res.status(500).json({
            success: false,
            error: '获取活动监听器失败'
        });
    }
});

/**
 * @route   PUT /api/external-audio/listener/:sessionId/settings
 * @desc    更新监听器设置
 * @access  Public
 */
router.put('/listener/:sessionId/settings', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const {
            sensitivity,
            noiseReduction,
            autoTranslate,
            targetLanguage
        } = req.body;

        const listener = externalAudioService.getActiveListener(sessionId);
        if (!listener) {
            return res.status(404).json({
                success: false,
                error: '监听器不存在'
            });
        }

        // 更新设置
        if (sensitivity !== undefined) listener.sensitivity = sensitivity;
        if (noiseReduction !== undefined) listener.noiseReduction = noiseReduction;
        if (autoTranslate !== undefined) listener.autoTranslate = autoTranslate;
        if (targetLanguage !== undefined) listener.targetLanguage = targetLanguage;

        res.json({
            success: true,
            data: {
                sessionId,
                settings: {
                    sensitivity: listener.sensitivity,
                    noiseReduction: listener.noiseReduction,
                    autoTranslate: listener.autoTranslate,
                    targetLanguage: listener.targetLanguage
                }
            },
            message: '监听器设置已更新'
        });

    } catch (error) {
        console.error('更新监听器设置失败:', error);
        res.status(500).json({
            success: false,
            error: '更新监听器设置失败'
        });
    }
});

/**
 * @route   GET /api/external-audio/languages
 * @desc    获取支持的语言列表
 * @access  Public
 */
router.get('/languages', async (req, res) => {
    try {
        const languages = externalAudioService.getSupportedLanguages();

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
 * @route   POST /api/external-audio/cleanup
 * @desc    清理过期监听器
 * @access  Public
 */
router.post('/cleanup', async (req, res) => {
    try {
        const { maxAge = 1800000 } = req.body; // 默认30分钟

        externalAudioService.cleanupExpiredListeners(maxAge);

        res.json({
            success: true,
            message: '过期监听器清理完成'
        });

    } catch (error) {
        console.error('清理过期监听器失败:', error);
        res.status(500).json({
            success: false,
            error: '清理过期监听器失败'
        });
    }
});

/**
 * @route   GET /api/external-audio/stats
 * @desc    获取外部音频翻译统计信息
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        const activeListeners = externalAudioService.getAllActiveListeners();
        
        let totalTranslations = 0;
        let totalDuration = 0;
        const qualityDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
        
        activeListeners.forEach(sessionId => {
            const listener = externalAudioService.getActiveListener(sessionId);
            totalTranslations += listener.translationCount;
            totalDuration += Date.now() - listener.startTime;
            
            const avgQuality = externalAudioService.calculateAvgQuality(listener.audioQualityHistory);
            qualityDistribution[avgQuality]++;
        });

        res.json({
            success: true,
            data: {
                activeListeners: activeListeners.length,
                totalTranslations,
                avgDuration: activeListeners.length > 0 ? totalDuration / activeListeners.length : 0,
                qualityDistribution,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({
            success: false,
            error: '获取统计信息失败'
        });
    }
});

/**
 * @route   GET /api/external-audio/health
 * @desc    健康检查
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const activeListeners = externalAudioService.getAllActiveListeners();
        
        res.json({
            success: true,
            data: {
                status: 'healthy',
                activeListeners: activeListeners.length,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
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

