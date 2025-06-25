const express = require('express');
const router = express.Router();
const crossBorderCallService = require('../services/crossBorderVoiceCallService');

/**
 * @route   POST /api/voice-call/join-queue
 * @desc    加入语音通话匹配队列
 * @access  Public
 */
router.post('/join-queue', async (req, res) => {
    try {
        const {
            userId,
            nativeLanguage,
            targetLanguage,
            country,
            interests = [],
            ageGroup = 'adult',
            gender = 'any',
            callPreferences = {}
        } = req.body;

        if (!userId || !nativeLanguage || !targetLanguage || !country) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数：userId, nativeLanguage, targetLanguage, country'
            });
        }

        const userProfile = {
            nativeLanguage,
            targetLanguage,
            country,
            interests,
            ageGroup,
            gender,
            callPreferences: {
                enableTranslation: true,
                callDuration: 'medium',
                topicPreference: 'any',
                ...callPreferences
            }
        };

        const result = await crossBorderCallService.joinMatchingQueue(userId, userProfile);

        res.json({
            success: true,
            data: result,
            message: '成功加入匹配队列'
        });

    } catch (error) {
        console.error('加入匹配队列失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '加入匹配队列失败'
        });
    }
});

/**
 * @route   POST /api/voice-call/leave-queue
 * @desc    离开语音通话匹配队列
 * @access  Public
 */
router.post('/leave-queue', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: '缺少用户ID'
            });
        }

        const result = await crossBorderCallService.leaveMatchingQueue(userId);

        res.json({
            success: true,
            data: result,
            message: '成功离开匹配队列'
        });

    } catch (error) {
        console.error('离开匹配队列失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '离开匹配队列失败'
        });
    }
});

/**
 * @route   POST /api/voice-call/start-call
 * @desc    开始语音通话
 * @access  Public
 */
router.post('/start-call', async (req, res) => {
    try {
        const {
            matchId,
            initiatorId,
            callOptions = {}
        } = req.body;

        if (!matchId || !initiatorId) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数：matchId, initiatorId'
            });
        }

        const result = await crossBorderCallService.startCall(matchId, initiatorId, callOptions);

        res.json({
            success: true,
            data: result,
            message: '通话已发起'
        });

    } catch (error) {
        console.error('开始通话失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '开始通话失败'
        });
    }
});

/**
 * @route   POST /api/voice-call/end-call
 * @desc    结束语音通话
 * @access  Public
 */
router.post('/end-call', async (req, res) => {
    try {
        const {
            callId,
            userId,
            reason = 'user_ended'
        } = req.body;

        if (!callId || !userId) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数：callId, userId'
            });
        }

        const result = await crossBorderCallService.endCall(callId, userId, reason);

        res.json({
            success: true,
            data: result,
            message: '通话已结束'
        });

    } catch (error) {
        console.error('结束通话失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '结束通话失败'
        });
    }
});

/**
 * @route   POST /api/voice-call/webrtc-signal
 * @desc    处理WebRTC信令
 * @access  Public
 */
router.post('/webrtc-signal', async (req, res) => {
    try {
        const {
            callId,
            userId,
            signalType,
            signalData
        } = req.body;

        if (!callId || !userId || !signalType || !signalData) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数：callId, userId, signalType, signalData'
            });
        }

        const result = await crossBorderCallService.handleWebRTCSignaling(
            callId, 
            userId, 
            signalType, 
            signalData
        );

        res.json({
            success: true,
            data: result,
            message: '信令处理成功'
        });

    } catch (error) {
        console.error('处理WebRTC信令失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '信令处理失败'
        });
    }
});

/**
 * @route   POST /api/voice-call/translate
 * @desc    处理通话中的翻译
 * @access  Public
 */
router.post('/translate', async (req, res) => {
    try {
        const {
            callId,
            userId,
            audioData,
            options = {}
        } = req.body;

        if (!callId || !userId || !audioData) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数：callId, userId, audioData'
            });
        }

        const result = await crossBorderCallService.processCallTranslation(
            callId, 
            userId, 
            audioData, 
            options
        );

        res.json({
            success: true,
            data: result,
            message: '翻译处理完成'
        });

    } catch (error) {
        console.error('处理通话翻译失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '翻译处理失败'
        });
    }
});

/**
 * @route   GET /api/voice-call/user-status/:userId
 * @desc    获取用户状态
 * @access  Public
 */
router.get('/user-status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const userStatus = crossBorderCallService.getUserStatus(userId);

        res.json({
            success: true,
            data: userStatus
        });

    } catch (error) {
        console.error('获取用户状态失败:', error);
        res.status(500).json({
            success: false,
            error: '获取用户状态失败'
        });
    }
});

/**
 * @route   GET /api/voice-call/languages
 * @desc    获取支持的语言列表
 * @access  Public
 */
router.get('/languages', async (req, res) => {
    try {
        const languages = crossBorderCallService.getSupportedLanguages();

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
 * @route   GET /api/voice-call/statistics
 * @desc    获取服务统计信息
 * @access  Public
 */
router.get('/statistics', async (req, res) => {
    try {
        const stats = crossBorderCallService.getStatistics();

        res.json({
            success: true,
            data: {
                ...stats,
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
 * @route   GET /api/voice-call/health
 * @desc    健康检查
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const stats = crossBorderCallService.getStatistics();
        
        res.json({
            success: true,
            data: {
                status: 'healthy',
                ...stats,
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

// WebSocket事件处理（如果使用Socket.IO）
const setupSocketEvents = (io) => {
    // 监听匹配找到事件
    crossBorderCallService.on('match_found', (data) => {
        io.to(data.user1Id).emit('match_found', {
            matchId: data.matchId,
            partner: data.match.user2,
            match: data.match
        });
        
        io.to(data.user2Id).emit('match_found', {
            matchId: data.matchId,
            partner: data.match.user1,
            match: data.match
        });
    });

    // 监听匹配超时事件
    crossBorderCallService.on('matching_timeout', (data) => {
        io.to(data.userId).emit('matching_timeout', {
            message: '匹配超时，请重新尝试',
            waitTime: data.waitTime
        });
    });

    // 监听通话发起事件
    crossBorderCallService.on('call_initiated', (data) => {
        data.participants.forEach(participant => {
            io.to(participant.userId).emit('call_initiated', {
                callId: data.callId,
                initiator: data.initiator,
                participants: data.participants,
                isInitiator: participant.userId === data.initiator
            });
        });
    });

    // 监听WebRTC信令事件
    crossBorderCallService.on('webrtc_signal', (data) => {
        data.toUserIds.forEach(userId => {
            io.to(userId).emit('webrtc_signal', {
                callId: data.callId,
                fromUserId: data.fromUserId,
                signalType: data.signalType,
                signalData: data.signalData
            });
        });
    });

    // 监听翻译就绪事件
    crossBorderCallService.on('translation_ready', (data) => {
        io.to(data.toUserId).emit('translation_ready', {
            callId: data.callId,
            fromUserId: data.fromUserId,
            translation: data.translation
        });
    });

    // 监听通话结束事件
    crossBorderCallService.on('call_ended', (data) => {
        data.participants.forEach(participant => {
            io.to(participant.userId).emit('call_ended', {
                callId: data.callId,
                duration: data.duration,
                reason: data.reason,
                stats: {
                    duration: data.duration,
                    translationCount: data.callRecord.translationCount
                }
            });
        });
    });
};

// 导出路由和Socket事件设置函数
module.exports = {
    router,
    setupSocketEvents
};

