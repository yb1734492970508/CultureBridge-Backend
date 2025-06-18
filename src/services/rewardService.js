const UserReward = require('../models/UserReward');
const User = require('../models/User');

class RewardService {
  constructor() {
    // 成就定义
    this.achievements = {
      first_lesson: {
        id: 'first_lesson',
        title: '初学者',
        description: '完成第一节课程',
        icon: '🎓',
        points: 10,
        condition: (user, action) => action.type === 'lesson_completed' && action.isFirst,
      },
      week_streak: {
        id: 'week_streak',
        title: '坚持不懈',
        description: '连续签到7天',
        icon: '🔥',
        points: 50,
        condition: (user, action) => action.type === 'check_in' && action.streak >= 7,
      },
      social_butterfly: {
        id: 'social_butterfly',
        title: '社交达人',
        description: '发布10篇内容',
        icon: '🦋',
        points: 30,
        condition: (user, action) => action.type === 'content_published' && action.totalPosts >= 10,
      },
      helper: {
        id: 'helper',
        title: '乐于助人',
        description: '帮助其他用户50次',
        icon: '🤝',
        points: 100,
        condition: (user, action) => action.type === 'help_provided' && action.totalHelps >= 50,
      },
      master: {
        id: 'master',
        title: '文化大师',
        description: '达到10级',
        icon: '👑',
        points: 500,
        condition: (user, action) => action.type === 'level_up' && user.level.current >= 10,
      },
      translator: {
        id: 'translator',
        title: '翻译专家',
        description: '纠正100个翻译错误',
        icon: '🌐',
        points: 200,
        condition: (user, action) => action.type === 'translation_corrected' && action.totalCorrections >= 100,
      },
      communicator: {
        id: 'communicator',
        title: '沟通达人',
        description: '参与100次聊天对话',
        icon: '💬',
        points: 75,
        condition: (user, action) => action.type === 'chat_participated' && action.totalChats >= 100,
      },
      learner: {
        id: 'learner',
        title: '学习之星',
        description: '完成50节课程',
        icon: '⭐',
        points: 150,
        condition: (user, action) => action.type === 'lesson_completed' && action.totalLessons >= 50,
      },
    };
    
    // 奖励商品定义
    this.rewardShop = {
      avatar_frame_1: {
        id: 'avatar_frame_1',
        name: '金色头像框',
        description: '彰显您的尊贵身份',
        type: 'cosmetic',
        cost: 100,
        currency: 'learningPoints',
        available: true,
      },
      avatar_frame_2: {
        id: 'avatar_frame_2',
        name: '钻石头像框',
        description: '最高级别的身份象征',
        type: 'cosmetic',
        cost: 500,
        currency: 'totalPoints',
        available: true,
      },
      theme_dark: {
        id: 'theme_dark',
        name: '深色主题',
        description: '护眼的深色界面主题',
        type: 'theme',
        cost: 50,
        currency: 'engagementPoints',
        available: true,
      },
      theme_custom: {
        id: 'theme_custom',
        name: '自定义主题',
        description: '个性化定制界面主题',
        type: 'theme',
        cost: 200,
        currency: 'totalPoints',
        available: true,
      },
      premium_course: {
        id: 'premium_course',
        name: '高级课程体验券',
        description: '免费体验任意高级课程7天',
        type: 'service',
        cost: 200,
        currency: 'learningPoints',
        available: true,
      },
      tutor_session: {
        id: 'tutor_session',
        name: '一对一辅导券',
        description: '30分钟专业导师一对一辅导',
        type: 'service',
        cost: 300,
        currency: 'totalPoints',
        available: true,
      },
      gift_card_10: {
        id: 'gift_card_10',
        name: '10元礼品卡',
        description: '可在合作商家使用的礼品卡',
        type: 'gift',
        cost: 1000,
        currency: 'totalPoints',
        available: true,
      },
      gift_card_50: {
        id: 'gift_card_50',
        name: '50元礼品卡',
        description: '可在合作商家使用的礼品卡',
        type: 'gift',
        cost: 5000,
        currency: 'totalPoints',
        available: true,
      },
    };
  }
  
  // 获取或创建用户奖励记录
  async getUserReward(userId) {
    try {
      let userReward = await UserReward.findOne({ userId });
      
      if (!userReward) {
        userReward = new UserReward({ userId });
        await userReward.save();
      }
      
      return userReward;
    } catch (error) {
      throw new Error(`Failed to get user reward: ${error.message}`);
    }
  }
  
  // 添加积分
  async addPoints(userId, type, amount, reason) {
    try {
      const userReward = await this.getUserReward(userId);
      const oldLevel = userReward.level.current;
      
      userReward.addPoints(type, amount, reason);
      await userReward.save();
      
      // 检查是否升级
      const leveledUp = userReward.level.current > oldLevel;
      
      // 检查成就
      await this.checkAchievements(userId, {
        type: 'points_earned',
        pointType: type,
        amount,
        reason,
        leveledUp,
        newLevel: userReward.level.current,
      });
      
      return {
        success: true,
        userReward,
        leveledUp,
        newLevel: userReward.level.current,
      };
    } catch (error) {
      throw new Error(`Failed to add points: ${error.message}`);
    }
  }
  
  // 签到
  async checkIn(userId) {
    try {
      const userReward = await this.getUserReward(userId);
      const result = userReward.checkIn();
      await userReward.save();
      
      // 检查连续签到成就
      await this.checkAchievements(userId, {
        type: 'check_in',
        streak: result.streak,
        reward: result.reward,
      });
      
      return {
        success: true,
        streak: result.streak,
        reward: result.reward,
        userReward,
      };
    } catch (error) {
      throw new Error(`Failed to check in: ${error.message}`);
    }
  }
  
  // 解锁成就
  async unlockAchievement(userId, achievementId) {
    try {
      const userReward = await this.getUserReward(userId);
      const achievement = this.achievements[achievementId];
      
      if (!achievement) {
        throw new Error('Achievement not found');
      }
      
      userReward.unlockAchievement(achievementId, achievement.points);
      await userReward.save();
      
      return {
        success: true,
        achievement,
        userReward,
      };
    } catch (error) {
      throw new Error(`Failed to unlock achievement: ${error.message}`);
    }
  }
  
  // 检查成就
  async checkAchievements(userId, action) {
    try {
      const userReward = await this.getUserReward(userId);
      const unlockedAchievements = [];
      
      for (const [achievementId, achievement] of Object.entries(this.achievements)) {
        // 检查是否已解锁
        const alreadyUnlocked = userReward.achievements.some(a => a.achievementId === achievementId);
        if (alreadyUnlocked) continue;
        
        // 检查解锁条件
        if (achievement.condition(userReward, action)) {
          try {
            await this.unlockAchievement(userId, achievementId);
            unlockedAchievements.push(achievement);
          } catch (error) {
            console.error(`Failed to unlock achievement ${achievementId}:`, error);
          }
        }
      }
      
      return unlockedAchievements;
    } catch (error) {
      console.error('Failed to check achievements:', error);
      return [];
    }
  }
  
  // 购买奖励
  async purchaseReward(userId, rewardId) {
    try {
      const userReward = await this.getUserReward(userId);
      const reward = this.rewardShop[rewardId];
      
      if (!reward) {
        throw new Error('Reward not found');
      }
      
      if (!reward.available) {
        throw new Error('Reward not available');
      }
      
      userReward.purchaseReward(rewardId, reward.name, reward.cost, reward.currency);
      await userReward.save();
      
      return {
        success: true,
        reward,
        userReward,
      };
    } catch (error) {
      throw new Error(`Failed to purchase reward: ${error.message}`);
    }
  }
  
  // 获取排行榜
  async getLeaderboard(type = 'total', limit = 10) {
    try {
      return await UserReward.getLeaderboard(type, limit);
    } catch (error) {
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
  }
  
  // 获取全局统计
  async getGlobalStats() {
    try {
      const stats = await UserReward.getGlobalStats();
      return stats[0] || {};
    } catch (error) {
      throw new Error(`Failed to get global stats: ${error.message}`);
    }
  }
  
  // 获取用户统计
  async getUserStats(userId) {
    try {
      const userReward = await this.getUserReward(userId);
      const user = await User.findById(userId).select('username avatar createdAt');
      
      return {
        user,
        points: userReward.points,
        level: userReward.level,
        achievements: userReward.achievements,
        checkIn: userReward.checkInData,
        stats: userReward.stats,
        recentHistory: userReward.pointsHistory.slice(0, 10),
      };
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }
  
  // 获取奖励商店
  getRewardShop() {
    return Object.values(this.rewardShop);
  }
  
  // 获取成就列表
  getAchievements() {
    return Object.values(this.achievements);
  }
  
  // 记录用户行为（用于成就检查）
  async recordUserAction(userId, actionType, actionData = {}) {
    try {
      const action = {
        type: actionType,
        ...actionData,
        timestamp: new Date(),
      };
      
      // 根据行为类型给予积分
      let pointsAwarded = 0;
      let pointType = 'engagementPoints';
      let reason = '';
      
      switch (actionType) {
        case 'lesson_completed':
          pointsAwarded = 10;
          pointType = 'learningPoints';
          reason = '完成课程';
          break;
        case 'content_published':
          pointsAwarded = 5;
          pointType = 'engagementPoints';
          reason = '发布内容';
          break;
        case 'comment_posted':
          pointsAwarded = 2;
          pointType = 'engagementPoints';
          reason = '发表评论';
          break;
        case 'help_provided':
          pointsAwarded = 3;
          pointType = 'contributionPoints';
          reason = '帮助他人';
          break;
        case 'translation_corrected':
          pointsAwarded = 5;
          pointType = 'contributionPoints';
          reason = '纠正翻译';
          break;
        case 'chat_participated':
          pointsAwarded = 1;
          pointType = 'engagementPoints';
          reason = '参与聊天';
          break;
        default:
          // 不给予积分的行为
          break;
      }
      
      if (pointsAwarded > 0) {
        await this.addPoints(userId, pointType, pointsAwarded, reason);
      }
      
      // 检查成就
      await this.checkAchievements(userId, action);
      
      return { success: true, pointsAwarded, action };
    } catch (error) {
      throw new Error(`Failed to record user action: ${error.message}`);
    }
  }
}

module.exports = new RewardService();

