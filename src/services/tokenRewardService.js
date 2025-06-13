const User = require('../models/User');
const CulturalExchange = require('../models/CulturalExchange');
const LanguageLearningSession = require('../models/LanguageLearningSession');
const EnhancedBlockchainService = require('./enhancedBlockchainService');

class TokenRewardService {
    constructor() {
        this.blockchainService = new EnhancedBlockchainService();
        
        // 奖励配置
        this.rewardConfig = {
            // 文化交流活动奖励
            culturalExchange: {
                creation: 10,           // 创建活动奖励
                participation: 5,       // 参与活动奖励
                completion: 8,          // 完成活动奖励
                highRating: 3,          // 高评分额外奖励
                organizer: 15           // 组织者额外奖励
            },
            
            // 语言学习奖励
            languageLearning: {
                sessionCreation: 12,    // 创建学习会话奖励
                enrollment: 3,          // 注册学习奖励
                lessonCompletion: 2,    // 完成课程奖励
                assignmentSubmission: 1,// 提交作业奖励
                perfectAttendance: 10,  // 完美出勤奖励
                progressMilestone: 5,   // 进度里程碑奖励
                sessionCompletion: 15   // 完成整个会话奖励
            },
            
            // 社区贡献奖励
            community: {
                postCreation: 1,        // 发帖奖励
                commentCreation: 0.5,   // 评论奖励
                helpfulContent: 2,      // 有用内容奖励
                moderatorAction: 3,     // 管理员行为奖励
                reportValidation: 1     // 有效举报奖励
            },
            
            // 特殊成就奖励
            achievements: {
                firstPost: 5,           // 首次发帖
                firstExchange: 8,       // 首次文化交流
                firstLearning: 6,       // 首次语言学习
                weeklyActive: 10,       // 周活跃用户
                monthlyActive: 25,      // 月活跃用户
                culturalAmbassador: 50, // 文化大使
                languageMentor: 40      // 语言导师
            },
            
            // 每日限制
            dailyLimits: {
                maxDailyReward: 100,    // 每日最大奖励
                maxPostReward: 10,      // 每日发帖最大奖励
                maxCommentReward: 5     // 每日评论最大奖励
            }
        };
    }
    
    /**
     * 奖励用户CBT代币
     */
    async awardTokens(userId, amount, reason, category = 'general') {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }
            
            // 检查每日奖励限制
            const todayRewards = await this.getTodayUserRewards(userId);
            if (todayRewards + amount > this.rewardConfig.dailyLimits.maxDailyReward) {
                throw new Error('超出每日奖励限制');
            }
            
            // 如果用户有钱包地址，直接在区块链上奖励
            if (user.walletAddress) {
                const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
                if (adminPrivateKey) {
                    try {
                        const result = await this.blockchainService.awardTokens(
                            user.walletAddress,
                            amount,
                            reason,
                            category,
                            adminPrivateKey
                        );
                        
                        // 记录到数据库
                        user.tokenRewards.push({
                            amount,
                            reason,
                            transactionHash: result.transactionHash,
                            timestamp: new Date()
                        });
                        await user.save();
                        
                        return result;
                    } catch (blockchainError) {
                        console.error('区块链奖励失败，记录到数据库:', blockchainError);
                    }
                }
            }
            
            // 如果区块链奖励失败或用户没有钱包，记录到数据库
            user.tokenRewards.push({
                amount,
                reason,
                transactionHash: 'pending_blockchain',
                timestamp: new Date()
            });
            await user.save();
            
            return {
                success: true,
                amount,
                reason,
                category,
                method: 'database'
            };
        } catch (error) {
            console.error('奖励代币失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量奖励代币
     */
    async batchAwardTokens(rewards) {
        try {
            const results = [];
            
            for (const reward of rewards) {
                try {
                    const result = await this.awardTokens(
                        reward.userId,
                        reward.amount,
                        reward.reason,
                        reward.category
                    );
                    results.push({ ...reward, success: true, result });
                } catch (error) {
                    results.push({ ...reward, success: false, error: error.message });
                }
            }
            
            return results;
        } catch (error) {
            console.error('批量奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 文化交流活动奖励
     */
    async rewardCulturalExchange(exchangeId, action, userId) {
        try {
            const exchange = await CulturalExchange.findById(exchangeId);
            if (!exchange) {
                throw new Error('文化交流活动不存在');
            }
            
            let amount = 0;
            let reason = '';
            
            switch (action) {
                case 'creation':
                    amount = this.rewardConfig.culturalExchange.creation;
                    reason = `创建文化交流活动: ${exchange.title}`;
                    break;
                case 'participation':
                    amount = this.rewardConfig.culturalExchange.participation;
                    reason = `参与文化交流活动: ${exchange.title}`;
                    break;
                case 'completion':
                    amount = this.rewardConfig.culturalExchange.completion;
                    reason = `完成文化交流活动: ${exchange.title}`;
                    break;
                case 'high_rating':
                    amount = this.rewardConfig.culturalExchange.highRating;
                    reason = `文化交流活动高评分奖励: ${exchange.title}`;
                    break;
                case 'organizer_bonus':
                    amount = this.rewardConfig.culturalExchange.organizer;
                    reason = `文化交流活动组织者奖励: ${exchange.title}`;
                    break;
                default:
                    throw new Error('未知的奖励行为');
            }
            
            return await this.awardTokens(userId, amount, reason, 'cultural_exchange');
        } catch (error) {
            console.error('文化交流奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 语言学习奖励
     */
    async rewardLanguageLearning(sessionId, action, userId) {
        try {
            const session = await LanguageLearningSession.findById(sessionId);
            if (!session) {
                throw new Error('语言学习会话不存在');
            }
            
            let amount = 0;
            let reason = '';
            
            switch (action) {
                case 'session_creation':
                    amount = this.rewardConfig.languageLearning.sessionCreation;
                    reason = `创建语言学习会话: ${session.title}`;
                    break;
                case 'enrollment':
                    amount = this.rewardConfig.languageLearning.enrollment;
                    reason = `注册语言学习会话: ${session.title}`;
                    break;
                case 'lesson_completion':
                    amount = this.rewardConfig.languageLearning.lessonCompletion;
                    reason = `完成课程: ${session.title}`;
                    break;
                case 'assignment_submission':
                    amount = this.rewardConfig.languageLearning.assignmentSubmission;
                    reason = `提交作业: ${session.title}`;
                    break;
                case 'perfect_attendance':
                    amount = this.rewardConfig.languageLearning.perfectAttendance;
                    reason = `完美出勤奖励: ${session.title}`;
                    break;
                case 'progress_milestone':
                    amount = this.rewardConfig.languageLearning.progressMilestone;
                    reason = `学习进度里程碑: ${session.title}`;
                    break;
                case 'session_completion':
                    amount = this.rewardConfig.languageLearning.sessionCompletion;
                    reason = `完成语言学习会话: ${session.title}`;
                    break;
                default:
                    throw new Error('未知的奖励行为');
            }
            
            return await this.awardTokens(userId, amount, reason, 'language_learning');
        } catch (error) {
            console.error('语言学习奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 社区贡献奖励
     */
    async rewardCommunityContribution(action, userId, details = {}) {
        try {
            let amount = 0;
            let reason = '';
            
            switch (action) {
                case 'post_creation':
                    amount = this.rewardConfig.community.postCreation;
                    reason = `发布帖子: ${details.title || ''}`;
                    break;
                case 'comment_creation':
                    amount = this.rewardConfig.community.commentCreation;
                    reason = `发表评论`;
                    break;
                case 'helpful_content':
                    amount = this.rewardConfig.community.helpfulContent;
                    reason = `有用内容奖励`;
                    break;
                case 'moderator_action':
                    amount = this.rewardConfig.community.moderatorAction;
                    reason = `管理员行为奖励`;
                    break;
                case 'report_validation':
                    amount = this.rewardConfig.community.reportValidation;
                    reason = `有效举报奖励`;
                    break;
                default:
                    throw new Error('未知的奖励行为');
            }
            
            return await this.awardTokens(userId, amount, reason, 'community');
        } catch (error) {
            console.error('社区贡献奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 特殊成就奖励
     */
    async rewardAchievement(achievement, userId) {
        try {
            const amount = this.rewardConfig.achievements[achievement];
            if (!amount) {
                throw new Error('未知的成就类型');
            }
            
            const reason = `成就解锁: ${achievement}`;
            
            return await this.awardTokens(userId, amount, reason, 'achievement');
        } catch (error) {
            console.error('成就奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户今日奖励总额
     */
    async getTodayUserRewards(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return 0;
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayRewards = user.tokenRewards.filter(reward => 
                reward.timestamp >= today
            );
            
            return todayRewards.reduce((sum, reward) => sum + reward.amount, 0);
        } catch (error) {
            console.error('获取今日奖励失败:', error);
            return 0;
        }
    }
    
    /**
     * 获取用户奖励统计
     */
    async getUserRewardStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('用户不存在');
            }
            
            const totalRewards = user.tokenRewards.reduce((sum, reward) => sum + reward.amount, 0);
            const todayRewards = await this.getTodayUserRewards(userId);
            
            // 按类别统计
            const categoryStats = {};
            user.tokenRewards.forEach(reward => {
                const category = reward.reason.includes('文化交流') ? 'cultural_exchange' :
                               reward.reason.includes('语言学习') ? 'language_learning' :
                               reward.reason.includes('社区') ? 'community' : 'other';
                
                categoryStats[category] = (categoryStats[category] || 0) + reward.amount;
            });
            
            return {
                totalRewards,
                todayRewards,
                rewardCount: user.tokenRewards.length,
                categoryStats,
                dailyLimit: this.rewardConfig.dailyLimits.maxDailyReward,
                remainingToday: Math.max(0, this.rewardConfig.dailyLimits.maxDailyReward - todayRewards)
            };
        } catch (error) {
            console.error('获取用户奖励统计失败:', error);
            throw error;
        }
    }
    
    /**
     * 同步区块链奖励到数据库
     */
    async syncBlockchainRewards(userId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.walletAddress) {
                return { success: false, message: '用户没有钱包地址' };
            }
            
            // 获取区块链上的奖励历史
            const blockchainRewards = await this.blockchainService.getUserTransactions(user.walletAddress);
            
            // 同步到数据库
            let syncCount = 0;
            for (const reward of blockchainRewards) {
                const existingReward = user.tokenRewards.find(r => 
                    r.transactionHash === reward.transactionHash
                );
                
                if (!existingReward) {
                    user.tokenRewards.push({
                        amount: parseFloat(reward.amount),
                        reason: reward.purpose,
                        transactionHash: reward.transactionHash,
                        timestamp: reward.timestamp
                    });
                    syncCount++;
                }
            }
            
            if (syncCount > 0) {
                await user.save();
            }
            
            return {
                success: true,
                syncCount,
                message: `同步了${syncCount}条奖励记录`
            };
        } catch (error) {
            console.error('同步区块链奖励失败:', error);
            throw error;
        }
    }
}

module.exports = TokenRewardService;

