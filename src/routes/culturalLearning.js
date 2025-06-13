const express = require('express');
const router = express.Router();
const CulturalLearningService = require('../services/culturalLearningService');
const CulturalExchange = require('../models/CulturalExchange');
const LanguageLearningSession = require('../models/LanguageLearningSession');
const UserLearningProgress = require('../models/UserLearningProgress');
const { protect } = require('../middleware/auth');

// 初始化文化学习服务
const culturalLearningService = new CulturalLearningService();

/**
 * @desc    创建学习会话
 * @route   POST /api/v2/cultural-learning/sessions
 * @access  Private
 */
router.post('/sessions', protect, async (req, res) => {
    try {
        const { sessionType, targetLanguage, nativeLanguage, level, customContent } = req.body;
        
        if (!sessionType || !targetLanguage || !nativeLanguage || !level) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        const result = await culturalLearningService.createLearningSession(
            req.user.id,
            sessionType,
            targetLanguage,
            nativeLanguage,
            level,
            customContent
        );
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.status(201).json({
            success: true,
            message: '学习会话创建成功',
            data: result.session
        });
        
    } catch (error) {
        console.error('创建学习会话失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取用户学习会话列表
 * @route   GET /api/v2/cultural-learning/sessions
 * @access  Private
 */
router.get('/sessions', protect, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, sessionType, targetLanguage } = req.query;
        
        // 构建查询条件
        const query = { userId: req.user.id };
        if (status) query['progress.status'] = status;
        if (sessionType) query.sessionType = sessionType;
        if (targetLanguage) query.targetLanguage = targetLanguage;
        
        const sessions = await LanguageLearningSession.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await LanguageLearningSession.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                sessions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('获取学习会话列表失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取学习会话详情
 * @route   GET /api/v2/cultural-learning/sessions/:id
 * @access  Private
 */
router.get('/sessions/:id', protect, async (req, res) => {
    try {
        const session = await LanguageLearningSession.findById(req.params.id);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: '学习会话不存在'
            });
        }
        
        if (session.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '无权限访问此会话'
            });
        }
        
        res.json({
            success: true,
            data: session
        });
        
    } catch (error) {
        console.error('获取学习会话详情失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    提交练习答案
 * @route   POST /api/v2/cultural-learning/sessions/:id/exercises/:exerciseIndex
 * @access  Private
 */
router.post('/sessions/:id/exercises/:exerciseIndex', protect, async (req, res) => {
    try {
        const { userAnswer, timeSpent } = req.body;
        const { id, exerciseIndex } = req.params;
        
        const session = await LanguageLearningSession.findById(id);
        
        if (!session || session.userId.toString() !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: '学习会话不存在或无权限'
            });
        }
        
        if (session.progress.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: '会话已完成'
            });
        }
        
        const isCorrect = session.completeExercise(parseInt(exerciseIndex), userAnswer, timeSpent || 0);
        await session.save();
        
        res.json({
            success: true,
            data: {
                isCorrect,
                currentScore: session.progress.score,
                explanation: session.content.exercises[exerciseIndex]?.explanation
            }
        });
        
    } catch (error) {
        console.error('提交练习答案失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    完成学习会话
 * @route   POST /api/v2/cultural-learning/sessions/:id/complete
 * @access  Private
 */
router.post('/sessions/:id/complete', protect, async (req, res) => {
    try {
        const result = await culturalLearningService.completeSession(req.params.id, req.user.id);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            message: '学习会话完成',
            data: {
                session: result.session,
                rewards: result.rewards
            }
        });
        
    } catch (error) {
        console.error('完成学习会话失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取用户学习进度
 * @route   GET /api/v2/cultural-learning/progress
 * @access  Private
 */
router.get('/progress', protect, async (req, res) => {
    try {
        const result = await culturalLearningService.getUserLearningStats(req.user.id);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.data
        });
        
    } catch (error) {
        console.error('获取用户学习进度失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取推荐学习内容
 * @route   GET /api/v2/cultural-learning/recommendations
 * @access  Private
 */
router.get('/recommendations', protect, async (req, res) => {
    try {
        const { targetLanguage } = req.query;
        
        if (!targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '请指定目标语言'
            });
        }
        
        const result = await culturalLearningService.getRecommendedContent(req.user.id, targetLanguage);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.recommendations
        });
        
    } catch (error) {
        console.error('获取推荐内容失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    创建文化交流
 * @route   POST /api/v2/cultural-learning/exchanges
 * @access  Private
 */
router.post('/exchanges', protect, async (req, res) => {
    try {
        const exchangeData = req.body;
        
        // 验证必要字段
        if (!exchangeData.title || !exchangeData.description || !exchangeData.type || !exchangeData.category) {
            return res.status(400).json({
                success: false,
                error: '缺少必要字段'
            });
        }
        
        const result = await culturalLearningService.createCulturalExchange(req.user.id, exchangeData);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.status(201).json({
            success: true,
            message: '文化交流创建成功',
            data: result.exchange
        });
        
    } catch (error) {
        console.error('创建文化交流失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取文化交流列表
 * @route   GET /api/v2/cultural-learning/exchanges
 * @access  Private
 */
router.get('/exchanges', protect, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            type, 
            category, 
            targetLanguage, 
            culturalRegion,
            status = 'ACTIVE',
            search 
        } = req.query;
        
        // 构建查询条件
        const query = { status };
        if (type) query.type = type;
        if (category) query.category = category;
        if (targetLanguage) query.targetLanguages = targetLanguage;
        if (culturalRegion) query.culturalRegions = culturalRegion;
        
        // 文本搜索
        if (search) {
            query.$text = { $search: search };
        }
        
        const exchanges = await CulturalExchange.find(query)
            .populate('creator', 'username avatar')
            .populate('participants.user', 'username avatar')
            .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await CulturalExchange.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                exchanges,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('获取文化交流列表失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取文化交流详情
 * @route   GET /api/v2/cultural-learning/exchanges/:id
 * @access  Private
 */
router.get('/exchanges/:id', protect, async (req, res) => {
    try {
        const exchange = await CulturalExchange.findById(req.params.id)
            .populate('creator', 'username avatar')
            .populate('participants.user', 'username avatar')
            .populate('interactions.comments.user', 'username avatar')
            .populate('interactions.likes.user', 'username avatar');
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                error: '文化交流不存在'
            });
        }
        
        // 增加浏览量
        exchange.incrementViews();
        await exchange.save();
        
        res.json({
            success: true,
            data: exchange
        });
        
    } catch (error) {
        console.error('获取文化交流详情失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    参与文化交流
 * @route   POST /api/v2/cultural-learning/exchanges/:id/join
 * @access  Private
 */
router.post('/exchanges/:id/join', protect, async (req, res) => {
    try {
        const result = await culturalLearningService.joinCulturalExchange(req.params.id, req.user.id);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            message: result.message
        });
        
    } catch (error) {
        console.error('参与文化交流失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    点赞文化交流
 * @route   POST /api/v2/cultural-learning/exchanges/:id/like
 * @access  Private
 */
router.post('/exchanges/:id/like', protect, async (req, res) => {
    try {
        const exchange = await CulturalExchange.findById(req.params.id);
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                error: '文化交流不存在'
            });
        }
        
        const liked = exchange.addLike(req.user.id);
        await exchange.save();
        
        res.json({
            success: true,
            message: liked ? '点赞成功' : '已经点赞过',
            data: {
                likesCount: exchange.likesCount
            }
        });
        
    } catch (error) {
        console.error('点赞文化交流失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    取消点赞文化交流
 * @route   DELETE /api/v2/cultural-learning/exchanges/:id/like
 * @access  Private
 */
router.delete('/exchanges/:id/like', protect, async (req, res) => {
    try {
        const exchange = await CulturalExchange.findById(req.params.id);
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                error: '文化交流不存在'
            });
        }
        
        const unliked = exchange.removeLike(req.user.id);
        await exchange.save();
        
        res.json({
            success: true,
            message: unliked ? '取消点赞成功' : '未点赞过',
            data: {
                likesCount: exchange.likesCount
            }
        });
        
    } catch (error) {
        console.error('取消点赞失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    添加评论
 * @route   POST /api/v2/cultural-learning/exchanges/:id/comments
 * @access  Private
 */
router.post('/exchanges/:id/comments', protect, async (req, res) => {
    try {
        const { content, language } = req.body;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: '评论内容不能为空'
            });
        }
        
        const exchange = await CulturalExchange.findById(req.params.id);
        
        if (!exchange) {
            return res.status(404).json({
                success: false,
                error: '文化交流不存在'
            });
        }
        
        const comment = exchange.addComment(req.user.id, content.trim(), language);
        await exchange.save();
        
        // 更新参与者活动时间
        exchange.updateParticipantActivity(req.user.id);
        await exchange.save();
        
        res.status(201).json({
            success: true,
            message: '评论添加成功',
            data: comment
        });
        
    } catch (error) {
        console.error('添加评论失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取支持的语言列表
 * @route   GET /api/v2/cultural-learning/languages
 * @access  Public
 */
router.get('/languages', async (req, res) => {
    try {
        const languages = [
            { code: 'zh-CN', name: '中文（简体）', flag: '🇨🇳' },
            { code: 'zh-TW', name: '中文（繁体）', flag: '🇹🇼' },
            { code: 'en-US', name: '英语（美国）', flag: '🇺🇸' },
            { code: 'en-GB', name: '英语（英国）', flag: '🇬🇧' },
            { code: 'ja-JP', name: '日语', flag: '🇯🇵' },
            { code: 'ko-KR', name: '韩语', flag: '🇰🇷' },
            { code: 'fr-FR', name: '法语', flag: '🇫🇷' },
            { code: 'de-DE', name: '德语', flag: '🇩🇪' },
            { code: 'es-ES', name: '西班牙语', flag: '🇪🇸' },
            { code: 'it-IT', name: '意大利语', flag: '🇮🇹' },
            { code: 'pt-BR', name: '葡萄牙语（巴西）', flag: '🇧🇷' },
            { code: 'ru-RU', name: '俄语', flag: '🇷🇺' },
            { code: 'ar-XA', name: '阿拉伯语', flag: '🇸🇦' },
            { code: 'hi-IN', name: '印地语', flag: '🇮🇳' },
            { code: 'th-TH', name: '泰语', flag: '🇹🇭' },
            { code: 'vi-VN', name: '越南语', flag: '🇻🇳' }
        ];
        
        res.json({
            success: true,
            data: languages
        });
        
    } catch (error) {
        console.error('获取语言列表失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

module.exports = router;

