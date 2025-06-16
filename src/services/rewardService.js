class RewardService {
    constructor() {
        this.rewards = new Map(); // 用户奖励记录
        this.dailyClaims = new Map(); // 每日领取记录
        this.rewardRates = {
            CHAT_MESSAGE: 0.1,
            VOICE_MESSAGE: 0.2,
            TEXT_TRANSLATION: 0.5,
            VOICE_TRANSLATION: 1.0,
            DAILY_LOGIN: 1.0,
            CULTURAL_EXCHANGE: 2.0,
            CONTENT_CREATION: 5.0
        };
    }
    
    /**
     * 记录奖励
     */
    async recordReward(rewardData) {
        const rewardId = `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const reward = {
            id: rewardId,
            ...rewardData,
            timestamp: new Date()
        };
        
        // 获取用户奖励列表
        const userRewards = this.rewards.get(rewardData.recipient) || [];
        userRewards.push(reward);
        this.rewards.set(rewardData.recipient, userRewards);
        
        return reward;
    }
    
    /**
     * 获取用户奖励历史
     */
    async getUserRewards(userId, page = 1, limit = 20) {
        const userRewards = this.rewards.get(userId) || [];
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        return userRewards
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(startIndex, endIndex);
    }
    
    /**
     * 奖励聊天积分
     */
    async awardChatPoints(userId) {
        const amount = this.rewardRates.CHAT_MESSAGE;
        return await this.recordReward({
            recipient: userId,
            amount,
            reason: '发送聊天消息',
            category: 'CHAT_MESSAGE',
            type: 'automatic'
        });
    }
    
    /**
     * 奖励语音消息积分
     */
    async awardVoicePoints(userId) {
        const amount = this.rewardRates.VOICE_MESSAGE;
        return await this.recordReward({
            recipient: userId,
            amount,
            reason: '发送语音消息',
            category: 'VOICE_MESSAGE',
            type: 'automatic'
        });
    }
    
    /**
     * 奖励翻译积分
     */
    async awardTranslationPoints(userId, translationType) {
        const amount = this.rewardRates[translationType] || 0.5;
        const reason = translationType === 'VOICE_TRANSLATION' ? '语音翻译' : '文本翻译';
        
        return await this.recordReward({
            recipient: userId,
            amount,
            reason,
            category: translationType,
            type: 'automatic'
        });
    }
    
    /**
     * 领取每日奖励
     */
    async claimDailyReward(userId) {
        const today = new Date().toDateString();
        const userClaims = this.dailyClaims.get(userId) || {};
        
        if (userClaims[today]) {
            return {
                success: false,
                message: '今日奖励已领取'
            };
        }
        
        const amount = this.rewardRates.DAILY_LOGIN;
        const reward = await this.recordReward({
            recipient: userId,
            amount,
            reason: '每日登录奖励',
            category: 'DAILY_LOGIN',
            type: 'daily'
        });
        
        // 记录领取状态
        userClaims[today] = true;
        this.dailyClaims.set(userId, userClaims);
        
        return {
            success: true,
            reward
        };
    }
    
    /**
     * 获取奖励统计
     */
    async getRewardStats(userId) {
        const userRewards = this.rewards.get(userId) || [];
        
        const stats = {
            totalRewards: userRewards.length,
            totalAmount: 0,
            todayAmount: 0,
            weekAmount: 0,
            monthAmount: 0,
            categoryStats: {}
        };
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        userRewards.forEach(reward => {
            const rewardDate = new Date(reward.timestamp);
            const amount = parseFloat(reward.amount);
            
            stats.totalAmount += amount;
            
            if (rewardDate >= today) {
                stats.todayAmount += amount;
            }
            
            if (rewardDate >= weekAgo) {
                stats.weekAmount += amount;
            }
            
            if (rewardDate >= monthAgo) {
                stats.monthAmount += amount;
            }
            
            // 分类统计
            const category = reward.category;
            if (!stats.categoryStats[category]) {
                stats.categoryStats[category] = {
                    count: 0,
                    amount: 0
                };
            }
            stats.categoryStats[category].count++;
            stats.categoryStats[category].amount += amount;
        });
        
        return stats;
    }
    
    /**
     * 检查是否可以领取每日奖励
     */
    async canClaimDailyReward(userId) {
        const today = new Date().toDateString();
        const userClaims = this.dailyClaims.get(userId) || {};
        return !userClaims[today];
    }
}

module.exports = RewardService;

