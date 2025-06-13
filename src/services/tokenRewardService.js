const TokenTransaction = require('../models/TokenTransaction');
const LanguageLearningProgress = require('../models/LanguageLearningProgress');
const User = require('../models/User');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

class TokenRewardService {
    constructor() {
        // 奖励配置
        this.rewardConfig = {
            // 注册奖励
            registration: { amount: 10, reason: '新用户注册奖励' },
            
            // 每日签到奖励
            dailyCheckin: {
                base: 1,
                streak: {
                    7: 2,   // 连续7天
                    14: 3,  // 连续14天
                    30: 5   // 连续30天
                }
            },
            
            // 内容创建奖励
            content: {
                post: { amount: 5, reason: '发布帖子奖励' },
                comment: { amount: 1, reason: '发表评论奖励' },
                resource: { amount: 10, reason: '分享学习资源奖励' },
                translation: { amount: 2, reason: '提供翻译帮助奖励' }
            },
            
            // 学习成就奖励
            learning: {
                vocabulary: { amount: 0.5, reason: '学习新词汇奖励' },
                lesson: { amount: 3, reason: '完成课程奖励' },
                quiz: { amount: 2, reason: '通过测试奖励' },
                streak: { amount: 1, reason: '学习连击奖励' }
            },
            
            // 社交互动奖励
            social: {
                like: { amount: 0.1, reason: '获得点赞奖励' },
                helpful: { amount: 2, reason: '帮助他人奖励' },
                invite: { amount: 20, reason: '邀请好友奖励' },
                event: { amount: 10, reason: '参加活动奖励' }
            }
        };
    }
    
    /**
     * 奖励用户代币
     * @param {string} userId 用户ID
     * @param {string} type 奖励类型
     * @param {Object} details 奖励详情
     * @returns {Promise<Object>} 奖励结果
     */
    async awardTokens(userId, type, details = {}) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }
            
            const rewardAmount = this.calculateReward(type, details);
            if (rewardAmount <= 0) {
                return { success: false, message: '无效的奖励类型' };
            }
            
            // 检查是否重复奖励
            const isDuplicate = await this.checkDuplicateReward(userId, type, details);
            if (isDuplicate) {
                return { success: false, message: '重复奖励' };
            }
            
            // 创建交易记录
            const transaction = new TokenTransaction({
                type: 'reward',
                to: user.walletAddress,
                amount: rewardAmount,
                purpose: this.getRewardReason(type, details),
                category: this.getRewardCategory(type),
                relatedUser: userId,
                relatedContent: details.contentId ? {
                    contentType: details.contentType,
                    contentId: details.contentId
                } : undefined,
                status: 'confirmed', // 奖励直接确认
                transactionHash: this.generateTransactionHash(),
                confirmedAt: new Date()
            });
            
            await transaction.save();
            
            // 更新用户奖励记录
            user.tokenRewards.push({
                amount: rewardAmount,
                reason: transaction.purpose,
                transactionHash: transaction.transactionHash,
                timestamp: new Date()
            });
            
            await user.save();
            
            // 更新学习进度（如果是学习相关奖励）
            if (type.startsWith('learning.')) {
                await this.updateLearningProgress(userId, type, details);
            }
            
            return {
                success: true,
                data: {
                    amount: rewardAmount,
                    reason: transaction.purpose,
                    transactionHash: transaction.transactionHash,
                    newBalance: await this.getUserTokenBalance(userId)
                }
            };
            
        } catch (error) {
            console.error('奖励代币失败:', error);
            throw error;
        }
    }
    
    /**
     * 计算奖励金额
     * @param {string} type 奖励类型
     * @param {Object} details 奖励详情
     * @returns {number} 奖励金额
     */
    calculateReward(type, details) {
        const parts = type.split('.');
        const category = parts[0];
        const action = parts[1];
        
        switch (category) {
            case 'registration':
                return this.rewardConfig.registration.amount;
                
            case 'dailyCheckin':
                const streak = details.streak || 1;
                let amount = this.rewardConfig.dailyCheckin.base;
                
                // 连击奖励
                for (const [days, bonus] of Object.entries(this.rewardConfig.dailyCheckin.streak)) {
                    if (streak >= parseInt(days)) {
                        amount = bonus;
                    }
                }
                return amount;
                
            case 'content':
                return this.rewardConfig.content[action]?.amount || 0;
                
            case 'learning':
                let baseAmount = this.rewardConfig.learning[action]?.amount || 0;
                
                // 根据难度调整奖励
                if (details.difficulty) {
                    const multiplier = {
                        'beginner': 1,
                        'intermediate': 1.5,
                        'advanced': 2
                    };
                    baseAmount *= multiplier[details.difficulty] || 1;
                }
                
                return baseAmount;
                
            case 'social':
                return this.rewardConfig.social[action]?.amount || 0;
                
            default:
                return 0;
        }
    }
    
    /**
     * 获取奖励原因
     * @param {string} type 奖励类型
     * @param {Object} details 奖励详情
     * @returns {string} 奖励原因
     */
    getRewardReason(type, details) {
        const parts = type.split('.');
        const category = parts[0];
        const action = parts[1];
        
        switch (category) {
            case 'registration':
                return this.rewardConfig.registration.reason;
            case 'dailyCheckin':
                return `每日签到奖励 (连续${details.streak || 1}天)`;
            case 'content':
                return this.rewardConfig.content[action]?.reason || '内容创建奖励';
            case 'learning':
                return this.rewardConfig.learning[action]?.reason || '学习成就奖励';
            case 'social':
                return this.rewardConfig.social[action]?.reason || '社交互动奖励';
            default:
                return '系统奖励';
        }
    }
    
    /**
     * 获取奖励类别
     * @param {string} type 奖励类型
     * @returns {string} 奖励类别
     */
    getRewardCategory(type) {
        const category = type.split('.')[0];
        const mapping = {
            'registration': 'general',
            'dailyCheckin': 'general',
            'content': 'content_creation',
            'learning': 'language_learning',
            'social': 'community_participation'
        };
        return mapping[category] || 'general';
    }
    
    /**
     * 检查重复奖励
     * @param {string} userId 用户ID
     * @param {string} type 奖励类型
     * @param {Object} details 奖励详情
     * @returns {Promise<boolean>} 是否重复
     */
    async checkDuplicateReward(userId, type, details) {
        // 每日签到检查
        if (type === 'dailyCheckin') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const existingReward = await TokenTransaction.findOne({
                relatedUser: userId,
                purpose: { $regex: /每日签到奖励/ },
                createdAt: { $gte: today }
            });
            
            return !!existingReward;
        }
        
        // 内容相关奖励检查
        if (type.startsWith('content.') && details.contentId) {
            const existingReward = await TokenTransaction.findOne({
                relatedUser: userId,
                'relatedContent.contentId': details.contentId,
                purpose: { $regex: new RegExp(this.getRewardReason(type, details)) }
            });
            
            return !!existingReward;
        }
        
        return false;
    }
    
    /**
     * 更新学习进度
     * @param {string} userId 用户ID
     * @param {string} type 奖励类型
     * @param {Object} details 奖励详情
     */
    async updateLearningProgress(userId, type, details) {
        if (!details.language) return;
        
        let progress = await LanguageLearningProgress.findOne({
            user: userId,
            language: details.language
        });
        
        if (!progress) {
            progress = new LanguageLearningProgress({
                user: userId,
                language: details.language
            });
        }
        
        const action = type.split('.')[1];
        
        switch (action) {
            case 'vocabulary':
                progress.vocabularyLearned += 1;
                break;
            case 'lesson':
                progress.totalStudyTime += details.duration || 30;
                break;
            case 'quiz':
                // 根据分数更新技能等级
                if (details.skill && details.score) {
                    const currentLevel = progress.skillLevels[details.skill] || 0;
                    const improvement = Math.floor(details.score / 10);
                    progress.skillLevels[details.skill] = Math.min(100, currentLevel + improvement);
                }
                break;
        }
        
        // 更新学习连击
        const today = new Date();
        const lastStudy = progress.studyStreak.lastStudyDate;
        
        if (!lastStudy || this.isNewDay(lastStudy, today)) {
            if (lastStudy && this.isConsecutiveDay(lastStudy, today)) {
                progress.studyStreak.current += 1;
            } else {
                progress.studyStreak.current = 1;
            }
            
            progress.studyStreak.longest = Math.max(
                progress.studyStreak.longest,
                progress.studyStreak.current
            );
            progress.studyStreak.lastStudyDate = today;
        }
        
        await progress.save();
    }
    
    /**
     * 获取用户代币余额
     * @param {string} userId 用户ID
     * @returns {Promise<number>} 代币余额
     */
    async getUserTokenBalance(userId) {
        const user = await User.findById(userId);
        if (!user || !user.walletAddress) {
            return 0;
        }
        
        // 计算总收入
        const totalIncome = await TokenTransaction.aggregate([
            {
                $match: {
                    to: user.walletAddress,
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
        
        // 计算总支出
        const totalExpense = await TokenTransaction.aggregate([
            {
                $match: {
                    from: user.walletAddress,
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
        
        const income = totalIncome[0]?.total || 0;
        const expense = totalExpense[0]?.total || 0;
        
        return income - expense;
    }
    
    /**
     * 生成交易哈希
     * @returns {string} 交易哈希
     */
    generateTransactionHash() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * 检查是否是新的一天
     * @param {Date} lastDate 上次日期
     * @param {Date} currentDate 当前日期
     * @returns {boolean} 是否是新的一天
     */
    isNewDay(lastDate, currentDate) {
        return lastDate.toDateString() !== currentDate.toDateString();
    }
    
    /**
     * 检查是否是连续的一天
     * @param {Date} lastDate 上次日期
     * @param {Date} currentDate 当前日期
     * @returns {boolean} 是否是连续的一天
     */
    isConsecutiveDay(lastDate, currentDate) {
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
    }
}

module.exports = TokenRewardService;

