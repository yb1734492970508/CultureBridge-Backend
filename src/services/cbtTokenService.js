const OptimizedBlockchainService = require('./optimizedBlockchainService');
const BlockchainEventListener = require('./blockchainEventListener');
const User = require('../models/User');

class CBTTokenService {
    constructor() {
        // 初始化区块链服务
        this.blockchainService = new OptimizedBlockchainService();
        this.eventListener = new BlockchainEventListener(this.blockchainService);
        
        // 奖励配置 (基于$0.05价格)
        this.rewardConfig = {
            REGISTRATION: { amount: '20', category: 'GENERAL', description: '注册奖励' },
            DAILY_LOGIN: { amount: '1', category: 'GENERAL', description: '每日登录奖励' },
            WEEKLY_LOGIN: { amount: '15', category: 'GENERAL', description: '连续7天登录奖励' },
            MONTHLY_LOGIN: { amount: '70', category: 'GENERAL', description: '连续30天登录奖励' },
            POST_CONTENT: { amount: '5', category: 'CONTENT_CREATION', description: '发布内容奖励' },
            VOICE_TRANSLATION: { amount: '0.5', category: 'LEARNING_REWARD', description: '语音翻译奖励' },
            CHAT_MESSAGE: { amount: '0.1', category: 'COMMUNITY_CONTRIBUTION', description: '发送消息奖励' },
            VOICE_CALL_MINUTE: { amount: '0.5', category: 'COMMUNITY_CONTRIBUTION', description: '语音通话奖励(每分钟)' },
            VIDEO_CALL_MINUTE: { amount: '1', category: 'COMMUNITY_CONTRIBUTION', description: '视频通话奖励(每分钟)' },
            CULTURAL_EXCHANGE: { amount: '10', category: 'CULTURAL_EXCHANGE', description: '文化交流奖励' },
            LANGUAGE_LEARNING: { amount: '3', category: 'LEARNING_REWARD', description: '语言学习奖励' },
            COURSE_COMPLETION: { amount: '15', category: 'LEARNING_REWARD', description: '完成课程奖励' },
            TEST_PASS: { amount: '25', category: 'LEARNING_REWARD', description: '通过测试奖励' },
            REFERRAL: { amount: '20', category: 'REFERRAL', description: '推荐新用户奖励' },
            REFERRAL_BONUS: { amount: '10', category: 'REFERRAL', description: '被推荐用户完成学习奖励' },
            LIKE_RECEIVED: { amount: '0.2', category: 'COMMUNITY_CONTRIBUTION', description: '获得点赞奖励' },
            COMMENT_RECEIVED: { amount: '0.3', category: 'COMMUNITY_CONTRIBUTION', description: '收到评论奖励' }
        };
        
        // 每日限制 (基于新的奖励机制)
        this.dailyLimits = {
            DAILY_LOGIN: 1,
            WEEKLY_LOGIN: 1,
            MONTHLY_LOGIN: 1,
            POST_CONTENT: 5,
            VOICE_TRANSLATION: 100,
            CHAT_MESSAGE: 500,
            VOICE_CALL_MINUTE: 120,
            VIDEO_CALL_MINUTE: 60,
            CULTURAL_EXCHANGE: 3,
            LANGUAGE_LEARNING: 10,
            COURSE_COMPLETION: 3,
            TEST_PASS: 2,
            LIKE_RECEIVED: 50,
            COMMENT_RECEIVED: 30,
            TOTAL_DAILY_REWARD: 50 // 每日总奖励上限
        };
        
        // 用户每日奖励记录缓存
        this.dailyRewardCache = new Map();
        
        // 启动事件监听
        this.setupEventListeners();
        
        console.log('✅ CBT代币服务已初始化');
    }
    
    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 监听奖励分发事件
        this.eventListener.on('rewardDistributed', async (eventData) => {
            await this.handleRewardDistributedEvent(eventData);
        });
        
        // 监听转账事件
        this.eventListener.on('transfer', async (eventData) => {
            await this.handleTransferEvent(eventData);
        });
        
        // 监听文化交流交易事件
        this.eventListener.on('culturalTransaction', async (eventData) => {
            await this.handleCulturalTransactionEvent(eventData);
        });
        
        console.log('✅ CBT代币事件监听已设置');
    }
    
    /**
     * 获取用户CBT余额
     */
    async getUserBalance(userId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.walletAddress) {
                return {
                    success: false,
                    error: '用户未绑定钱包地址'
                };
            }
            
            const balance = await this.blockchainService.getCBTBalance(user.walletAddress);
            
            return {
                success: true,
                balance: parseFloat(balance),
                walletAddress: user.walletAddress
            };
            
        } catch (error) {
            console.error('获取用户CBT余额失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 分发奖励给用户
     */
    async distributeReward(userId, rewardType, customAmount = null, customDescription = null) {
        try {
            // 获取用户信息
            const user = await User.findById(userId);
            if (!user || !user.walletAddress) {
                throw new Error('用户未绑定钱包地址');
            }
            
            // 检查奖励配置
            const rewardInfo = this.rewardConfig[rewardType];
            if (!rewardInfo && !customAmount) {
                throw new Error(`未知的奖励类型: ${rewardType}`);
            }
            
            // 检查每日限制
            const canReceiveReward = await this.checkDailyLimit(userId, rewardType);
            if (!canReceiveReward) {
                return {
                    success: false,
                    error: '已达到今日奖励限制'
                };
            }
            
            // 准备奖励参数
            const amount = customAmount || rewardInfo.amount;
            const category = rewardInfo?.category || 'GENERAL';
            const description = customDescription || rewardInfo?.description || '自定义奖励';
            
            // 分发奖励
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) {
                throw new Error('管理员私钥未配置');
            }
            
            const result = await this.blockchainService.distributeReward(
                user.walletAddress,
                category,
                description,
                adminPrivateKey
            );
            
            if (result.success) {
                // 更新每日奖励记录
                await this.updateDailyRewardRecord(userId, rewardType);
                
                // 更新用户统计
                await this.updateUserRewardStats(userId, amount, rewardType);
                
                console.log(`✅ 奖励分发成功: ${user.username} 获得 ${amount} CBT`);
            }
            
            return {
                success: result.success,
                amount: amount,
                transactionHash: result.transactionHash,
                gasUsed: result.gasUsed,
                rewardType,
                description
            };
            
        } catch (error) {
            console.error('分发奖励失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 批量分发奖励
     */
    async batchDistributeRewards(rewardList) {
        try {
            const recipients = [];
            const categories = [];
            const descriptions = [];
            const userIds = [];
            
            // 准备批量数据
            for (const reward of rewardList) {
                const user = await User.findById(reward.userId);
                if (!user || !user.walletAddress) {
                    console.warn(`跳过用户 ${reward.userId}: 未绑定钱包地址`);
                    continue;
                }
                
                const rewardInfo = this.rewardConfig[reward.rewardType];
                if (!rewardInfo && !reward.customAmount) {
                    console.warn(`跳过用户 ${reward.userId}: 未知奖励类型 ${reward.rewardType}`);
                    continue;
                }
                
                // 检查每日限制
                const canReceiveReward = await this.checkDailyLimit(reward.userId, reward.rewardType);
                if (!canReceiveReward) {
                    console.warn(`跳过用户 ${reward.userId}: 已达到今日奖励限制`);
                    continue;
                }
                
                recipients.push(user.walletAddress);
                categories.push(rewardInfo?.category || 'GENERAL');
                descriptions.push(reward.customDescription || rewardInfo?.description || '批量奖励');
                userIds.push(reward.userId);
            }
            
            if (recipients.length === 0) {
                return {
                    success: false,
                    error: '没有有效的奖励接收者'
                };
            }
            
            // 执行批量分发
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            const result = await this.blockchainService.batchDistributeRewards(
                recipients,
                categories,
                descriptions,
                adminPrivateKey
            );
            
            if (result.success) {
                // 更新所有用户的奖励记录
                for (let i = 0; i < userIds.length; i++) {
                    const reward = rewardList.find(r => r.userId === userIds[i]);
                    await this.updateDailyRewardRecord(userIds[i], reward.rewardType);
                    await this.updateUserRewardStats(userIds[i], reward.customAmount || this.rewardConfig[reward.rewardType].amount, reward.rewardType);
                }
                
                console.log(`✅ 批量奖励分发成功: ${recipients.length} 个用户`);
            }
            
            return {
                success: result.success,
                recipientCount: recipients.length,
                transactionHash: result.transactionHash,
                gasUsed: result.gasUsed
            };
            
        } catch (error) {
            console.error('批量分发奖励失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 检查每日奖励限制
     */
    async checkDailyLimit(userId, rewardType) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const cacheKey = `${userId}_${today}`;
            
            let dailyRecord = this.dailyRewardCache.get(cacheKey);
            if (!dailyRecord) {
                // 从数据库加载每日记录
                dailyRecord = await this.loadDailyRewardRecord(userId, today);
                this.dailyRewardCache.set(cacheKey, dailyRecord);
            }
            
            const limit = this.dailyLimits[rewardType];
            if (!limit) {
                return true; // 无限制
            }
            
            const currentCount = dailyRecord[rewardType] || 0;
            return currentCount < limit;
            
        } catch (error) {
            console.error('检查每日限制失败:', error.message);
            return false;
        }
    }
    
    /**
     * 更新每日奖励记录
     */
    async updateDailyRewardRecord(userId, rewardType) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const cacheKey = `${userId}_${today}`;
            
            let dailyRecord = this.dailyRewardCache.get(cacheKey) || {};
            dailyRecord[rewardType] = (dailyRecord[rewardType] || 0) + 1;
            
            this.dailyRewardCache.set(cacheKey, dailyRecord);
            
            // 保存到数据库
            await this.saveDailyRewardRecord(userId, today, dailyRecord);
            
        } catch (error) {
            console.error('更新每日奖励记录失败:', error.message);
        }
    }
    
    /**
     * 更新用户奖励统计
     */
    async updateUserRewardStats(userId, amount, rewardType) {
        try {
            const user = await User.findById(userId);
            if (!user) return;
            
            // 初始化奖励统计
            if (!user.rewardStats) {
                user.rewardStats = {
                    totalEarned: 0,
                    totalTransactions: 0,
                    lastRewardTime: null,
                    categoryStats: {}
                };
            }
            
            // 更新统计
            user.rewardStats.totalEarned += parseFloat(amount);
            user.rewardStats.totalTransactions += 1;
            user.rewardStats.lastRewardTime = new Date();
            
            if (!user.rewardStats.categoryStats[rewardType]) {
                user.rewardStats.categoryStats[rewardType] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            
            user.rewardStats.categoryStats[rewardType].count += 1;
            user.rewardStats.categoryStats[rewardType].totalAmount += parseFloat(amount);
            
            await user.save();
            
        } catch (error) {
            console.error('更新用户奖励统计失败:', error.message);
        }
    }
    
    /**
     * 获取用户奖励统计
     */
    async getUserRewardStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return {
                    success: false,
                    error: '用户不存在'
                };
            }
            
            const stats = user.rewardStats || {
                totalEarned: 0,
                totalTransactions: 0,
                lastRewardTime: null,
                categoryStats: {}
            };
            
            // 获取今日奖励记录
            const today = new Date().toISOString().split('T')[0];
            const todayRecord = await this.loadDailyRewardRecord(userId, today);
            
            return {
                success: true,
                stats: {
                    ...stats,
                    todayRewards: todayRecord,
                    dailyLimits: this.dailyLimits
                }
            };
            
        } catch (error) {
            console.error('获取用户奖励统计失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取代币总体统计
     */
    async getTokenStats() {
        try {
            const health = await this.blockchainService.healthCheck();
            if (!health.contracts) {
                throw new Error('区块链服务不可用');
            }
            
            // 获取合约统计
            const totalSupply = await this.blockchainService.cbtTokenContract.totalSupply();
            const { ethers } = require('ethers');
            
            // 获取用户统计
            const userCount = await User.countDocuments({ walletAddress: { $exists: true, $ne: null } });
            const totalRewardsDistributed = await this.calculateTotalRewardsDistributed();
            
            return {
                success: true,
                stats: {
                    totalSupply: ethers.formatEther(totalSupply),
                    totalUsers: userCount,
                    totalRewardsDistributed,
                    networkStatus: await this.blockchainService.getNetworkStatus(),
                    rewardConfig: this.rewardConfig,
                    dailyLimits: this.dailyLimits
                }
            };
            
        } catch (error) {
            console.error('获取代币统计失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 计算总奖励分发量
     */
    async calculateTotalRewardsDistributed() {
        try {
            const users = await User.find({ 'rewardStats.totalEarned': { $exists: true } });
            let total = 0;
            
            for (const user of users) {
                if (user.rewardStats && user.rewardStats.totalEarned) {
                    total += user.rewardStats.totalEarned;
                }
            }
            
            return total;
        } catch (error) {
            console.error('计算总奖励分发量失败:', error.message);
            return 0;
        }
    }
    
    /**
     * 处理奖励分发事件
     */
    async handleRewardDistributedEvent(eventData) {
        try {
            console.log('处理奖励分发事件:', eventData);
            
            // 可以在这里添加额外的业务逻辑
            // 例如：发送通知、更新排行榜等
            
        } catch (error) {
            console.error('处理奖励分发事件失败:', error.message);
        }
    }
    
    /**
     * 处理转账事件
     */
    async handleTransferEvent(eventData) {
        try {
            console.log('处理转账事件:', eventData);
            
            // 可以在这里添加转账相关的业务逻辑
            
        } catch (error) {
            console.error('处理转账事件失败:', error.message);
        }
    }
    
    /**
     * 处理文化交流交易事件
     */
    async handleCulturalTransactionEvent(eventData) {
        try {
            console.log('处理文化交流交易事件:', eventData);
            
            // 可以在这里添加文化交流相关的业务逻辑
            
        } catch (error) {
            console.error('处理文化交流交易事件失败:', error.message);
        }
    }
    
    /**
     * 加载每日奖励记录
     */
    async loadDailyRewardRecord(userId, date) {
        try {
            // 这里应该从数据库加载，暂时返回空对象
            // 可以创建一个DailyReward模型来存储这些数据
            return {};
        } catch (error) {
            console.error('加载每日奖励记录失败:', error.message);
            return {};
        }
    }
    
    /**
     * 保存每日奖励记录
     */
    async saveDailyRewardRecord(userId, date, record) {
        try {
            // 这里应该保存到数据库
            // 可以创建一个DailyReward模型来存储这些数据
            console.log(`保存每日奖励记录: ${userId} - ${date}`, record);
        } catch (error) {
            console.error('保存每日奖励记录失败:', error.message);
        }
    }
    
    /**
     * 启动服务
     */
    async start() {
        try {
            await this.eventListener.startListening();
            console.log('✅ CBT代币服务已启动');
        } catch (error) {
            console.error('❌ CBT代币服务启动失败:', error.message);
        }
    }
    
    /**
     * 停止服务
     */
    async stop() {
        try {
            this.eventListener.stopListening();
            await this.blockchainService.cleanup();
            console.log('✅ CBT代币服务已停止');
        } catch (error) {
            console.error('❌ CBT代币服务停止失败:', error.message);
        }
    }
    
    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const blockchainHealth = await this.blockchainService.healthCheck();
            const listenerStatus = this.eventListener.getListenerStatus();
            
            return {
                blockchain: blockchainHealth,
                eventListener: listenerStatus,
                rewardConfig: this.rewardConfig,
                dailyLimits: this.dailyLimits
            };
        } catch (error) {
            console.error('CBT代币服务健康检查失败:', error.message);
            return {
                error: error.message
            };
        }
    }
}

module.exports = CBTTokenService;

