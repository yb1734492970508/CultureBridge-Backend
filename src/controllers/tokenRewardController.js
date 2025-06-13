const TokenRewardService = require('../services/tokenRewardService');
const BlockchainService = require('../services/blockchainService');
const User = require('../models/User');
const TokenTransaction = require('../models/TokenTransaction');
const LanguageLearningProgress = require('../models/LanguageLearningProgress');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

class TokenRewardController {
    constructor() {
        this.rewardService = new TokenRewardService();
        this.blockchainService = new BlockchainService();
    }
    
    /**
     * @desc    每日签到奖励
     * @route   POST /api/v1/tokens/daily-checkin
     * @access  Private
     */
    dailyCheckin = asyncHandler(async (req, res, next) => {
        const userId = req.user.id;
        
        try {
            // 检查今日是否已签到
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const existingCheckin = await TokenTransaction.findOne({
                relatedUser: userId,
                purpose: { $regex: /每日签到奖励/ },
                createdAt: { $gte: today }
            });
            
            if (existingCheckin) {
                return next(new ErrorResponse('今日已签到', 400));
            }
            
            // 计算连续签到天数
            const user = await User.findById(userId);
            const lastCheckin = await TokenTransaction.findOne({
                relatedUser: userId,
                purpose: { $regex: /每日签到奖励/ }
            }).sort({ createdAt: -1 });
            
            let streak = 1;
            if (lastCheckin) {
                const lastCheckinDate = new Date(lastCheckin.createdAt);
                lastCheckinDate.setHours(0, 0, 0, 0);
                
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (lastCheckinDate.getTime() === yesterday.getTime()) {
                    // 连续签到
                    const lastStreak = parseInt(lastCheckin.purpose.match(/连续(\d+)天/)?.[1] || '1');
                    streak = lastStreak + 1;
                }
            }
            
            // 奖励代币
            const result = await this.rewardService.awardTokens(userId, 'dailyCheckin', { streak });
            
            res.status(200).json({
                success: true,
                data: {
                    ...result.data,
                    streak,
                    message: `签到成功！连续签到${streak}天`
                }
            });
            
        } catch (error) {
            console.error('每日签到失败:', error);
            return next(new ErrorResponse('签到失败', 500));
        }
    });
    
    /**
     * @desc    学习成就奖励
     * @route   POST /api/v1/tokens/learning-reward
     * @access  Private
     */
    learningReward = asyncHandler(async (req, res, next) => {
        const { type, language, details = {} } = req.body;
        const userId = req.user.id;
        
        if (!type || !language) {
            return next(new ErrorResponse('请提供奖励类型和语言', 400));
        }
        
        const validTypes = ['vocabulary', 'lesson', 'quiz', 'streak'];
        if (!validTypes.includes(type)) {
            return next(new ErrorResponse('无效的奖励类型', 400));
        }
        
        try {
            const rewardType = `learning.${type}`;
            const rewardDetails = {
                language,
                ...details
            };
            
            const result = await this.rewardService.awardTokens(userId, rewardType, rewardDetails);
            
            if (!result.success) {
                return next(new ErrorResponse(result.message, 400));
            }
            
            res.status(200).json({
                success: true,
                data: result.data
            });
            
        } catch (error) {
            console.error('学习奖励失败:', error);
            return next(new ErrorResponse('奖励失败', 500));
        }
    });
    
    /**
     * @desc    内容创建奖励
     * @route   POST /api/v1/tokens/content-reward
     * @access  Private
     */
    contentReward = asyncHandler(async (req, res, next) => {
        const { type, contentId, contentType } = req.body;
        const userId = req.user.id;
        
        if (!type || !contentId) {
            return next(new ErrorResponse('请提供奖励类型和内容ID', 400));
        }
        
        const validTypes = ['post', 'comment', 'resource', 'translation'];
        if (!validTypes.includes(type)) {
            return next(new ErrorResponse('无效的奖励类型', 400));
        }
        
        try {
            const rewardType = `content.${type}`;
            const rewardDetails = {
                contentId,
                contentType: contentType || type
            };
            
            const result = await this.rewardService.awardTokens(userId, rewardType, rewardDetails);
            
            if (!result.success) {
                return next(new ErrorResponse(result.message, 400));
            }
            
            res.status(200).json({
                success: true,
                data: result.data
            });
            
        } catch (error) {
            console.error('内容奖励失败:', error);
            return next(new ErrorResponse('奖励失败', 500));
        }
    });
    
    /**
     * @desc    社交互动奖励
     * @route   POST /api/v1/tokens/social-reward
     * @access  Private
     */
    socialReward = asyncHandler(async (req, res, next) => {
        const { type, details = {} } = req.body;
        const userId = req.user.id;
        
        if (!type) {
            return next(new ErrorResponse('请提供奖励类型', 400));
        }
        
        const validTypes = ['like', 'helpful', 'invite', 'event'];
        if (!validTypes.includes(type)) {
            return next(new ErrorResponse('无效的奖励类型', 400));
        }
        
        try {
            const rewardType = `social.${type}`;
            const result = await this.rewardService.awardTokens(userId, rewardType, details);
            
            if (!result.success) {
                return next(new ErrorResponse(result.message, 400));
            }
            
            res.status(200).json({
                success: true,
                data: result.data
            });
            
        } catch (error) {
            console.error('社交奖励失败:', error);
            return next(new ErrorResponse('奖励失败', 500));
        }
    });
    
    /**
     * @desc    获取用户代币余额
     * @route   GET /api/v1/tokens/balance
     * @access  Private
     */
    getBalance = asyncHandler(async (req, res, next) => {
        const userId = req.user.id;
        
        try {
            const balance = await this.rewardService.getUserTokenBalance(userId);
            
            // 获取用户钱包地址
            const user = await User.findById(userId).select('walletAddress');
            
            res.status(200).json({
                success: true,
                data: {
                    balance,
                    walletAddress: user.walletAddress,
                    timestamp: new Date()
                }
            });
            
        } catch (error) {
            console.error('获取余额失败:', error);
            return next(new ErrorResponse('获取余额失败', 500));
        }
    });
    
    /**
     * @desc    获取用户奖励历史
     * @route   GET /api/v1/tokens/rewards
     * @access  Private
     */
    getRewardHistory = asyncHandler(async (req, res, next) => {
        const { page = 1, limit = 20, category } = req.query;
        const userId = req.user.id;
        
        try {
            const query = {
                relatedUser: userId,
                type: 'reward'
            };
            
            if (category) {
                query.category = category;
            }
            
            const rewards = await TokenTransaction.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('amount purpose category transactionHash createdAt');
            
            const total = await TokenTransaction.countDocuments(query);
            
            res.status(200).json({
                success: true,
                count: rewards.length,
                total,
                data: rewards
            });
            
        } catch (error) {
            console.error('获取奖励历史失败:', error);
            return next(new ErrorResponse('获取奖励历史失败', 500));
        }
    });
    
    /**
     * @desc    获取用户学习进度
     * @route   GET /api/v1/tokens/learning-progress
     * @access  Private
     */
    getLearningProgress = asyncHandler(async (req, res, next) => {
        const { language } = req.query;
        const userId = req.user.id;
        
        try {
            const query = { user: userId };
            if (language) {
                query.language = language;
            }
            
            const progress = await LanguageLearningProgress.find(query)
                .sort({ updatedAt: -1 });
            
            res.status(200).json({
                success: true,
                count: progress.length,
                data: progress
            });
            
        } catch (error) {
            console.error('获取学习进度失败:', error);
            return next(new ErrorResponse('获取学习进度失败', 500));
        }
    });
    
    /**
     * @desc    代币支付功能
     * @route   POST /api/v1/tokens/payment
     * @access  Private
     */
    makePayment = asyncHandler(async (req, res, next) => {
        const { amount, purpose, recipientId, category = 'general' } = req.body;
        const userId = req.user.id;
        
        if (!amount || !purpose) {
            return next(new ErrorResponse('请提供支付金额和目的', 400));
        }
        
        if (amount <= 0) {
            return next(new ErrorResponse('支付金额必须大于0', 400));
        }
        
        try {
            // 检查用户余额
            const balance = await this.rewardService.getUserTokenBalance(userId);
            if (balance < amount) {
                return next(new ErrorResponse('余额不足', 400));
            }
            
            // 获取用户信息
            const user = await User.findById(userId);
            if (!user.walletAddress) {
                return next(new ErrorResponse('用户钱包未初始化', 400));
            }
            
            let recipientAddress = null;
            if (recipientId) {
                const recipient = await User.findById(recipientId);
                if (!recipient || !recipient.walletAddress) {
                    return next(new ErrorResponse('接收者钱包未初始化', 400));
                }
                recipientAddress = recipient.walletAddress;
            }
            
            // 创建支付交易记录
            const transaction = new TokenTransaction({
                type: 'purchase',
                from: user.walletAddress,
                to: recipientAddress || 'system',
                amount,
                purpose,
                category,
                relatedUser: userId,
                status: 'confirmed',
                transactionHash: this.generateTransactionHash(),
                confirmedAt: new Date()
            });
            
            await transaction.save();
            
            // 如果有接收者，创建接收记录
            if (recipientId && recipientAddress) {
                const receiveTransaction = new TokenTransaction({
                    type: 'transfer',
                    from: user.walletAddress,
                    to: recipientAddress,
                    amount,
                    purpose,
                    category,
                    relatedUser: recipientId,
                    status: 'confirmed',
                    transactionHash: transaction.transactionHash,
                    confirmedAt: new Date()
                });
                
                await receiveTransaction.save();
            }
            
            res.status(200).json({
                success: true,
                data: {
                    transactionHash: transaction.transactionHash,
                    amount,
                    purpose,
                    newBalance: await this.rewardService.getUserTokenBalance(userId),
                    timestamp: new Date()
                }
            });
            
        } catch (error) {
            console.error('支付失败:', error);
            return next(new ErrorResponse('支付失败', 500));
        }
    });
    
    /**
     * @desc    获取代币统计信息
     * @route   GET /api/v1/tokens/stats
     * @access  Private
     */
    getTokenStats = asyncHandler(async (req, res, next) => {
        const userId = req.user.id;
        
        try {
            // 总收入
            const totalIncome = await TokenTransaction.aggregate([
                {
                    $match: {
                        relatedUser: userId,
                        type: { $in: ['reward', 'transfer'] },
                        status: 'confirmed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ]);
            
            // 总支出
            const totalExpense = await TokenTransaction.aggregate([
                {
                    $match: {
                        relatedUser: userId,
                        type: { $in: ['purchase'] },
                        status: 'confirmed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' }
                    }
                }
            ]);
            
            // 按类别统计奖励
            const rewardsByCategory = await TokenTransaction.aggregate([
                {
                    $match: {
                        relatedUser: userId,
                        type: 'reward',
                        status: 'confirmed'
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            // 本月奖励
            const thisMonth = new Date();
            thisMonth.setDate(1);
            thisMonth.setHours(0, 0, 0, 0);
            
            const monthlyRewards = await TokenTransaction.aggregate([
                {
                    $match: {
                        relatedUser: userId,
                        type: 'reward',
                        status: 'confirmed',
                        createdAt: { $gte: thisMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            res.status(200).json({
                success: true,
                data: {
                    totalIncome: totalIncome[0]?.total || 0,
                    totalExpense: totalExpense[0]?.total || 0,
                    currentBalance: await this.rewardService.getUserTokenBalance(userId),
                    rewardsByCategory,
                    monthlyRewards: monthlyRewards[0] || { total: 0, count: 0 }
                }
            });
            
        } catch (error) {
            console.error('获取代币统计失败:', error);
            return next(new ErrorResponse('获取统计信息失败', 500));
        }
    });
    
    /**
     * 生成交易哈希
     * @returns {string} 交易哈希
     */
    generateTransactionHash() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = new TokenRewardController();

