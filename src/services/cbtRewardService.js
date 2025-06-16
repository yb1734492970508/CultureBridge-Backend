/**
 * CBT代币奖励服务
 * CBT Token Reward Service
 * 
 * 管理用户的CBT代币奖励机制
 * Manages CBT token reward mechanisms for users
 */

const Web3 = require('web3');
const { ethers } = require('ethers');
const User = require('../models/User');
const TokenTransaction = require('../models/TokenTransaction');
const blockchainService = require('./blockchainService');

class CBTRewardService {
    constructor() {
        this.rewardRates = {
            // 基础活动奖励 (CBT)
            DAILY_LOGIN: 1.0,
            PROFILE_COMPLETE: 5.0,
            FIRST_POST: 2.0,
            FIRST_COMMENT: 1.0,
            
            // 聊天相关奖励
            CHAT_MESSAGE: 0.1,
            VOICE_MESSAGE: 0.5,
            HELPFUL_RESPONSE: 2.0,
            LIKE_RECEIVED: 0.2,
            
            // 翻译相关奖励
            VOICE_TRANSLATION: 0.5,
            TEXT_TRANSLATION: 0.3,
            TRANSLATION_QUALITY_BONUS: 1.0,
            
            // 文化交流奖励
            CULTURAL_SHARE: 3.0,
            CULTURAL_INSIGHT: 5.0,
            CULTURAL_EVENT_PARTICIPATE: 10.0,
            CULTURAL_EVENT_HOST: 25.0,
            
            // 语言学习奖励
            LESSON_COMPLETE: 2.0,
            PRONUNCIATION_PRACTICE: 1.0,
            VOCABULARY_MASTERY: 1.5,
            LANGUAGE_MILESTONE: 20.0,
            
            // 社区贡献奖励
            HELPFUL_ANSWER: 5.0,
            RESOURCE_SHARE: 3.0,
            COMMUNITY_MODERATION: 10.0,
            CONTENT_CREATION: 8.0,
            
            // 特殊成就奖励
            WEEKLY_ACTIVE: 15.0,
            MONTHLY_ACTIVE: 50.0,
            REFERRAL_SUCCESS: 25.0,
            EARLY_ADOPTER: 100.0
        };

        this.multipliers = {
            // 用户等级倍数
            BRONZE: 1.0,
            SILVER: 1.2,
            GOLD: 1.5,
            PLATINUM: 2.0,
            DIAMOND: 3.0,
            
            // 连续活跃倍数
            STREAK_7_DAYS: 1.1,
            STREAK_30_DAYS: 1.3,
            STREAK_90_DAYS: 1.5,
            STREAK_365_DAYS: 2.0,
            
            // 特殊时期倍数
            WEEKEND_BONUS: 1.2,
            HOLIDAY_BONUS: 1.5,
            EVENT_PERIOD: 2.0
        };

        this.dailyLimits = {
            CHAT_MESSAGE: 50,
            VOICE_MESSAGE: 20,
            TRANSLATION: 30,
            LIKE_RECEIVED: 100
        };
    }

    /**
     * 奖励用户CBT代币
     * @param {string} userId - 用户ID
     * @param {string} activityType - 活动类型
     * @param {Object} options - 额外选项
     * @returns {Promise<Object>} 奖励结果
     */
    async rewardUser(userId, activityType, options = {}) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }

            // 检查每日限制
            if (await this.checkDailyLimit(userId, activityType)) {
                return {
                    success: false,
                    message: '今日该活动奖励已达上限',
                    amount: 0
                };
            }

            // 计算基础奖励
            let baseAmount = this.rewardRates[activityType] || 0;
            if (baseAmount === 0) {
                throw new Error(`未知的活动类型: ${activityType}`);
            }

            // 应用倍数
            const multiplier = await this.calculateMultiplier(user, activityType, options);
            const finalAmount = baseAmount * multiplier;

            // 记录交易
            const transaction = await this.recordTransaction(userId, activityType, finalAmount, options);

            // 更新用户余额
            await this.updateUserBalance(userId, finalAmount);

            // 发送区块链交易（如果启用）
            if (process.env.BLOCKCHAIN_ENABLED === 'true') {
                await this.sendBlockchainReward(user.walletAddress, finalAmount, transaction._id);
            }

            // 更新用户统计
            await this.updateUserStats(userId, activityType, finalAmount);

            return {
                success: true,
                amount: finalAmount,
                baseAmount,
                multiplier,
                transactionId: transaction._id,
                message: `获得 ${finalAmount} CBT 奖励！`
            };

        } catch (error) {
            console.error('奖励用户失败:', error);
            return {
                success: false,
                message: error.message,
                amount: 0
            };
        }
    }

    /**
     * 检查每日限制
     */
    async checkDailyLimit(userId, activityType) {
        const limit = this.dailyLimits[activityType];
        if (!limit) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = await TokenTransaction.countDocuments({
            user: userId,
            activityType,
            createdAt: { $gte: today }
        });

        return count >= limit;
    }

    /**
     * 计算奖励倍数
     */
    async calculateMultiplier(user, activityType, options) {
        let multiplier = 1.0;

        // 用户等级倍数
        const levelMultiplier = this.multipliers[user.level] || 1.0;
        multiplier *= levelMultiplier;

        // 连续活跃倍数
        const streakMultiplier = await this.getStreakMultiplier(user);
        multiplier *= streakMultiplier;

        // 特殊时期倍数
        const timeMultiplier = this.getTimeMultiplier();
        multiplier *= timeMultiplier;

        // 质量倍数（基于用户评分等）
        if (options.qualityScore) {
            const qualityMultiplier = Math.min(options.qualityScore / 100 * 2, 2.0);
            multiplier *= qualityMultiplier;
        }

        return Math.round(multiplier * 100) / 100; // 保留两位小数
    }

    /**
     * 获取连续活跃倍数
     */
    async getStreakMultiplier(user) {
        const streakDays = user.consecutiveActiveDays || 0;
        
        if (streakDays >= 365) return this.multipliers.STREAK_365_DAYS;
        if (streakDays >= 90) return this.multipliers.STREAK_90_DAYS;
        if (streakDays >= 30) return this.multipliers.STREAK_30_DAYS;
        if (streakDays >= 7) return this.multipliers.STREAK_7_DAYS;
        
        return 1.0;
    }

    /**
     * 获取时间倍数
     */
    getTimeMultiplier() {
        const now = new Date();
        const day = now.getDay();
        
        // 周末奖励
        if (day === 0 || day === 6) {
            return this.multipliers.WEEKEND_BONUS;
        }
        
        // 这里可以添加节假日检查
        // if (this.isHoliday(now)) {
        //     return this.multipliers.HOLIDAY_BONUS;
        // }
        
        return 1.0;
    }

    /**
     * 记录交易
     */
    async recordTransaction(userId, activityType, amount, options) {
        const transaction = new TokenTransaction({
            user: userId,
            type: 'REWARD',
            amount,
            activityType,
            description: this.getActivityDescription(activityType),
            metadata: {
                ...options,
                timestamp: new Date()
            },
            status: 'COMPLETED'
        });

        return await transaction.save();
    }

    /**
     * 更新用户余额
     */
    async updateUserBalance(userId, amount) {
        await User.findByIdAndUpdate(userId, {
            $inc: { 
                'tokenBalance.cbt': amount,
                'stats.totalEarned': amount
            },
            $set: {
                'stats.lastRewardDate': new Date()
            }
        });
    }

    /**
     * 发送区块链奖励
     */
    async sendBlockchainReward(walletAddress, amount, transactionId) {
        try {
            if (!walletAddress) {
                console.log('用户未连接钱包，跳过区块链奖励');
                return;
            }

            const result = await blockchainService.mintTokens(
                walletAddress,
                ethers.utils.parseEther(amount.toString())
            );

            // 更新交易记录
            await TokenTransaction.findByIdAndUpdate(transactionId, {
                'blockchain.txHash': result.transactionHash,
                'blockchain.blockNumber': result.blockNumber,
                'blockchain.status': 'CONFIRMED'
            });

            console.log(`区块链奖励发送成功: ${amount} CBT -> ${walletAddress}`);
            return result;

        } catch (error) {
            console.error('发送区块链奖励失败:', error);
            
            // 更新交易状态为失败
            await TokenTransaction.findByIdAndUpdate(transactionId, {
                'blockchain.status': 'FAILED',
                'blockchain.error': error.message
            });
            
            throw error;
        }
    }

    /**
     * 更新用户统计
     */
    async updateUserStats(userId, activityType, amount) {
        const updateData = {
            $inc: {
                [`stats.activities.${activityType}`]: 1,
                'stats.totalTransactions': 1
            },
            $set: {
                'stats.lastActivityDate': new Date()
            }
        };

        // 更新连续活跃天数
        const user = await User.findById(userId);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const lastActive = user.stats?.lastActivityDate;
        if (lastActive) {
            const lastActiveDate = new Date(lastActive);
            lastActiveDate.setHours(0, 0, 0, 0);
            
            const daysDiff = (today - lastActiveDate) / (1000 * 60 * 60 * 24);
            
            if (daysDiff === 1) {
                // 连续活跃
                updateData.$inc['consecutiveActiveDays'] = 1;
            } else if (daysDiff > 1) {
                // 中断了，重新开始
                updateData.$set['consecutiveActiveDays'] = 1;
            }
            // daysDiff === 0 表示今天已经活跃过，不更新
        } else {
            // 第一次活跃
            updateData.$set['consecutiveActiveDays'] = 1;
        }

        await User.findByIdAndUpdate(userId, updateData);
    }

    /**
     * 获取活动描述
     */
    getActivityDescription(activityType) {
        const descriptions = {
            DAILY_LOGIN: '每日登录奖励',
            PROFILE_COMPLETE: '完善个人资料',
            FIRST_POST: '首次发帖',
            FIRST_COMMENT: '首次评论',
            CHAT_MESSAGE: '发送聊天消息',
            VOICE_MESSAGE: '发送语音消息',
            HELPFUL_RESPONSE: '有用回复',
            LIKE_RECEIVED: '收到点赞',
            VOICE_TRANSLATION: '语音翻译',
            TEXT_TRANSLATION: '文本翻译',
            TRANSLATION_QUALITY_BONUS: '翻译质量奖励',
            CULTURAL_SHARE: '文化分享',
            CULTURAL_INSIGHT: '文化见解',
            CULTURAL_EVENT_PARTICIPATE: '参与文化活动',
            CULTURAL_EVENT_HOST: '主办文化活动',
            LESSON_COMPLETE: '完成课程',
            PRONUNCIATION_PRACTICE: '发音练习',
            VOCABULARY_MASTERY: '词汇掌握',
            LANGUAGE_MILESTONE: '语言里程碑',
            HELPFUL_ANSWER: '有用回答',
            RESOURCE_SHARE: '资源分享',
            COMMUNITY_MODERATION: '社区管理',
            CONTENT_CREATION: '内容创作',
            WEEKLY_ACTIVE: '周活跃奖励',
            MONTHLY_ACTIVE: '月活跃奖励',
            REFERRAL_SUCCESS: '成功推荐',
            EARLY_ADOPTER: '早期用户奖励'
        };

        return descriptions[activityType] || '未知活动';
    }

    /**
     * 获取用户奖励统计
     */
    async getUserRewardStats(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('用户不存在');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // 今日奖励
        const todayRewards = await TokenTransaction.aggregate([
            {
                $match: {
                    user: user._id,
                    type: 'REWARD',
                    createdAt: { $gte: today }
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

        // 本月奖励
        const monthlyRewards = await TokenTransaction.aggregate([
            {
                $match: {
                    user: user._id,
                    type: 'REWARD',
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

        // 活动类型统计
        const activityStats = await TokenTransaction.aggregate([
            {
                $match: {
                    user: user._id,
                    type: 'REWARD'
                }
            },
            {
                $group: {
                    _id: '$activityType',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        return {
            currentBalance: user.tokenBalance?.cbt || 0,
            totalEarned: user.stats?.totalEarned || 0,
            todayEarned: todayRewards[0]?.total || 0,
            todayTransactions: todayRewards[0]?.count || 0,
            monthlyEarned: monthlyRewards[0]?.total || 0,
            monthlyTransactions: monthlyRewards[0]?.count || 0,
            consecutiveActiveDays: user.consecutiveActiveDays || 0,
            level: user.level || 'BRONZE',
            activityStats,
            nextLevelProgress: this.calculateLevelProgress(user)
        };
    }

    /**
     * 计算等级进度
     */
    calculateLevelProgress(user) {
        const totalEarned = user.stats?.totalEarned || 0;
        const levelThresholds = {
            BRONZE: 0,
            SILVER: 100,
            GOLD: 500,
            PLATINUM: 2000,
            DIAMOND: 10000
        };

        const currentLevel = user.level || 'BRONZE';
        const levels = Object.keys(levelThresholds);
        const currentIndex = levels.indexOf(currentLevel);
        
        if (currentIndex === levels.length - 1) {
            return { progress: 100, nextLevel: null };
        }

        const nextLevel = levels[currentIndex + 1];
        const currentThreshold = levelThresholds[currentLevel];
        const nextThreshold = levelThresholds[nextLevel];
        
        const progress = Math.min(
            ((totalEarned - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
            100
        );

        return {
            progress: Math.round(progress),
            nextLevel,
            required: nextThreshold - totalEarned
        };
    }

    /**
     * 批量奖励用户
     */
    async batchRewardUsers(rewards) {
        const results = [];
        
        for (const reward of rewards) {
            try {
                const result = await this.rewardUser(
                    reward.userId,
                    reward.activityType,
                    reward.options
                );
                results.push({ ...reward, result });
            } catch (error) {
                results.push({
                    ...reward,
                    result: { success: false, message: error.message, amount: 0 }
                });
            }
        }

        return results;
    }
}

module.exports = new CBTRewardService();

