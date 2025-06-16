/**
 * 代币相关API路由
 * Token Related API Routes
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const cbtRewardService = require('../services/cbtRewardService');
const TokenTransaction = require('../models/TokenTransaction');
const User = require('../models/User');

/**
 * @desc    获取用户代币余额
 * @route   GET /api/v1/tokens/balance
 * @access  Private
 */
router.get('/balance', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('tokenBalance');
        
        res.json({
            success: true,
            data: {
                cbt: user.tokenBalance?.cbt || 0,
                lastUpdated: user.tokenBalance?.lastUpdated || new Date()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取余额失败',
            error: error.message
        });
    }
});

/**
 * @desc    获取用户奖励统计
 * @route   GET /api/v1/tokens/rewards/stats
 * @access  Private
 */
router.get('/rewards/stats', protect, async (req, res) => {
    try {
        const stats = await cbtRewardService.getUserRewardStats(req.user.id);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取奖励统计失败',
            error: error.message
        });
    }
});

/**
 * @desc    手动奖励用户（测试用）
 * @route   POST /api/v1/tokens/rewards/manual
 * @access  Private
 */
router.post('/rewards/manual', protect, async (req, res) => {
    try {
        const { activityType, options = {} } = req.body;
        
        if (!activityType) {
            return res.status(400).json({
                success: false,
                message: '活动类型不能为空'
            });
        }

        const result = await cbtRewardService.rewardUser(req.user.id, activityType, options);
        
        res.json({
            success: result.success,
            data: result,
            message: result.message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '奖励失败',
            error: error.message
        });
    }
});

/**
 * @desc    获取交易历史
 * @route   GET /api/v1/tokens/transactions
 * @access  Private
 */
router.get('/transactions', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type;
        const activityType = req.query.activityType;

        const query = { user: req.user.id };
        if (type) query.type = type;
        if (activityType) query.activityType = activityType;

        const transactions = await TokenTransaction.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('fromUser', 'username')
            .populate('toUser', 'username');

        const total = await TokenTransaction.countDocuments(query);

        res.json({
            success: true,
            data: transactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取交易历史失败',
            error: error.message
        });
    }
});

/**
 * @desc    转账CBT代币
 * @route   POST /api/v1/tokens/transfer
 * @access  Private
 */
router.post('/transfer', protect, async (req, res) => {
    try {
        const { toUserId, amount, message } = req.body;
        
        if (!toUserId || !amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: '参数无效'
            });
        }

        const fromUser = await User.findById(req.user.id);
        const toUser = await User.findById(toUserId);

        if (!toUser) {
            return res.status(404).json({
                success: false,
                message: '目标用户不存在'
            });
        }

        if (fromUser.tokenBalance?.cbt < amount) {
            return res.status(400).json({
                success: false,
                message: 'CBT余额不足'
            });
        }

        // 创建转账交易记录
        const transaction = new TokenTransaction({
            user: req.user.id,
            type: 'TRANSFER',
            amount: -amount,
            description: `转账给 ${toUser.username}`,
            status: 'COMPLETED',
            fromUser: req.user.id,
            toUser: toUserId,
            metadata: { message }
        });

        const receiveTransaction = new TokenTransaction({
            user: toUserId,
            type: 'TRANSFER',
            amount: amount,
            description: `收到来自 ${fromUser.username} 的转账`,
            status: 'COMPLETED',
            fromUser: req.user.id,
            toUser: toUserId,
            metadata: { message }
        });

        // 更新用户余额
        await User.findByIdAndUpdate(req.user.id, {
            $inc: { 'tokenBalance.cbt': -amount }
        });

        await User.findByIdAndUpdate(toUserId, {
            $inc: { 'tokenBalance.cbt': amount }
        });

        await transaction.save();
        await receiveTransaction.save();

        res.json({
            success: true,
            data: {
                transactionId: transaction._id,
                amount,
                toUser: {
                    id: toUser._id,
                    username: toUser.username
                }
            },
            message: '转账成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '转账失败',
            error: error.message
        });
    }
});

/**
 * @desc    获取奖励排行榜
 * @route   GET /api/v1/tokens/leaderboard
 * @access  Public
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const period = req.query.period || 'all'; // all, monthly, weekly, daily
        const limit = parseInt(req.query.limit) || 10;

        let dateFilter = {};
        const now = new Date();

        switch (period) {
            case 'daily':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                dateFilter = { 'stats.lastRewardDate': { $gte: today } };
                break;
            case 'weekly':
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = { 'stats.lastRewardDate': { $gte: weekStart } };
                break;
            case 'monthly':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = { 'stats.lastRewardDate': { $gte: monthStart } };
                break;
        }

        const users = await User.find(dateFilter)
            .select('username level stats.totalEarned tokenBalance.cbt consecutiveActiveDays')
            .sort({ 'stats.totalEarned': -1 })
            .limit(limit);

        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            username: user.username,
            level: user.level || 'BRONZE',
            totalEarned: user.stats?.totalEarned || 0,
            currentBalance: user.tokenBalance?.cbt || 0,
            consecutiveActiveDays: user.consecutiveActiveDays || 0
        }));

        res.json({
            success: true,
            data: leaderboard,
            period
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取排行榜失败',
            error: error.message
        });
    }
});

/**
 * @desc    获取奖励活动列表
 * @route   GET /api/v1/tokens/activities
 * @access  Public
 */
router.get('/activities', async (req, res) => {
    try {
        const activities = [
            {
                type: 'DAILY_LOGIN',
                name: '每日登录',
                description: '每天登录获得奖励',
                reward: '1.0 CBT',
                category: 'daily'
            },
            {
                type: 'CHAT_MESSAGE',
                name: '发送消息',
                description: '在聊天室发送消息',
                reward: '0.1 CBT',
                category: 'social',
                dailyLimit: 50
            },
            {
                type: 'VOICE_TRANSLATION',
                name: '语音翻译',
                description: '使用语音翻译功能',
                reward: '0.5 CBT',
                category: 'translation',
                dailyLimit: 30
            },
            {
                type: 'CULTURAL_SHARE',
                name: '文化分享',
                description: '分享文化内容',
                reward: '3.0 CBT',
                category: 'culture'
            },
            {
                type: 'LANGUAGE_MILESTONE',
                name: '语言里程碑',
                description: '达成语言学习里程碑',
                reward: '20.0 CBT',
                category: 'learning'
            }
        ];

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取活动列表失败',
            error: error.message
        });
    }
});

/**
 * @desc    获取用户等级信息
 * @route   GET /api/v1/tokens/level
 * @access  Private
 */
router.get('/level', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const rewardService = require('../services/cbtRewardService');
        const levelProgress = rewardService.calculateLevelProgress(user);

        const levelInfo = {
            currentLevel: user.level || 'BRONZE',
            totalEarned: user.stats?.totalEarned || 0,
            consecutiveActiveDays: user.consecutiveActiveDays || 0,
            progress: levelProgress,
            benefits: {
                BRONZE: { multiplier: 1.0, features: ['基础奖励'] },
                SILVER: { multiplier: 1.2, features: ['基础奖励', '20%奖励加成'] },
                GOLD: { multiplier: 1.5, features: ['基础奖励', '50%奖励加成', '专属徽章'] },
                PLATINUM: { multiplier: 2.0, features: ['基础奖励', '100%奖励加成', '专属徽章', '优先客服'] },
                DIAMOND: { multiplier: 3.0, features: ['基础奖励', '200%奖励加成', '专属徽章', '优先客服', '专属活动'] }
            }
        };

        res.json({
            success: true,
            data: levelInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取等级信息失败',
            error: error.message
        });
    }
});

module.exports = router;

