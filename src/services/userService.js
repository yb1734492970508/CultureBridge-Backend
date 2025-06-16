const { Web3 } = require('web3');
const jwt = require('jsonwebtoken');

class UserService {
    constructor() {
        this.users = new Map(); // 内存存储，生产环境应使用数据库
        this.userStats = new Map();
    }
    
    /**
     * 验证钱包签名
     */
    async verifyWalletSignature(walletAddress, signature, message) {
        try {
            const web3 = new Web3();
            const recoveredAddress = web3.eth.accounts.recover(message, signature);
            return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error('签名验证失败:', error);
            return false;
        }
    }
    
    /**
     * 根据钱包地址获取用户
     */
    async getUserByWallet(walletAddress) {
        for (const [id, user] of this.users) {
            if (user.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
                return { id, ...user };
            }
        }
        return null;
    }
    
    /**
     * 根据ID获取用户
     */
    async getUserById(userId) {
        const user = this.users.get(userId);
        return user ? { id: userId, ...user } : null;
    }
    
    /**
     * 创建用户
     */
    async createUser(userData) {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user = {
            ...userData,
            isAdmin: false,
            createdAt: new Date(),
            lastLoginAt: new Date()
        };
        
        this.users.set(userId, user);
        this.userStats.set(userId, {
            totalEarned: 0,
            totalSpent: 0,
            messagesCount: 0,
            translationsCount: 0,
            voiceMessagesCount: 0
        });
        
        return { id: userId, ...user };
    }
    
    /**
     * 更新用户信息
     */
    async updateUser(userId, updateData) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('用户不存在');
        }
        
        const updatedUser = { ...user, ...updateData, updatedAt: new Date() };
        this.users.set(userId, updatedUser);
        
        return { id: userId, ...updatedUser };
    }
    
    /**
     * 更新最后登录时间
     */
    async updateLastLogin(userId) {
        const user = this.users.get(userId);
        if (user) {
            user.lastLoginAt = new Date();
            this.users.set(userId, user);
        }
    }
    
    /**
     * 获取用户统计
     */
    async getUserStats(userId) {
        return this.userStats.get(userId) || {
            totalEarned: 0,
            totalSpent: 0,
            messagesCount: 0,
            translationsCount: 0,
            voiceMessagesCount: 0
        };
    }
    
    /**
     * 更新用户统计
     */
    async updateUserStats(userId, statType, increment = 1) {
        const stats = await this.getUserStats(userId);
        stats[statType] = (stats[statType] || 0) + increment;
        this.userStats.set(userId, stats);
    }
    
    /**
     * 计算用户等级
     */
    calculateUserLevel(cbtBalance) {
        if (cbtBalance >= 10000) return 'Diamond';
        if (cbtBalance >= 2000) return 'Platinum';
        if (cbtBalance >= 500) return 'Gold';
        if (cbtBalance >= 100) return 'Silver';
        return 'Bronze';
    }
    
    /**
     * 获取排行榜
     */
    async getLeaderboard(type = 'cbt', limit = 50) {
        // 模拟排行榜数据
        const leaderboard = [];
        let rank = 1;
        
        for (const [userId, user] of this.users) {
            if (rank > limit) break;
            
            const stats = await this.getUserStats(userId);
            leaderboard.push({
                rank,
                userId,
                username: user.username,
                walletAddress: user.walletAddress,
                cbtBalance: Math.random() * 10000, // 模拟余额
                totalEarned: stats.totalEarned,
                level: this.calculateUserLevel(Math.random() * 10000)
            });
            rank++;
        }
        
        // 根据类型排序
        if (type === 'cbt') {
            leaderboard.sort((a, b) => b.cbtBalance - a.cbtBalance);
        } else if (type === 'earned') {
            leaderboard.sort((a, b) => b.totalEarned - a.totalEarned);
        }
        
        return leaderboard;
    }
}

module.exports = UserService;

