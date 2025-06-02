/**
 * 用户画像系统升级模块
 * 
 * 该模块实现了用户画像系统的核心功能，包括:
 * - 多维度用户标签体系
 * - 兴趣偏好自动识别
 * - 活跃度与参与度评分
 * - 价值潜力预测模型
 * 
 * @module services/userAcquisition/userProfile
 */

const mongoose = require('mongoose');
const User = require('../../models/user.model');
const UserEvent = require('../../models/userEvent.model');
const { userTracker, TRACKER_CONFIG } = require('./userTracker');
const logger = require('../../utils/logger');
const { performance } = require('perf_hooks');
const config = require('../../config');

// 用户画像系统配置
const PROFILE_CONFIG = {
  // 用户标签类别
  tagCategories: {
    DEMOGRAPHIC: 'demographic',
    INTEREST: 'interest',
    BEHAVIOR: 'behavior',
    ENGAGEMENT: 'engagement',
    VALUE: 'value'
  },
  
  // 活跃度等级
  activityLevels: {
    INACTIVE: 'inactive',     // 30天内无活动
    LOW: 'low',               // 30天内1-5次活动
    MEDIUM: 'medium',         // 30天内6-20次活动
    HIGH: 'high',             // 30天内21-50次活动
    VERY_HIGH: 'very_high'    // 30天内50次以上活动
  },
  
  // 参与度等级
  engagementLevels: {
    LURKER: 'lurker',         // 仅浏览，无互动
    REACTOR: 'reactor',       // 点赞等轻互动
    COMMENTER: 'commenter',   // 评论等中度互动
    CONTRIBUTOR: 'contributor', // 创建内容
    ADVOCATE: 'advocate'      // 分享、推荐等高度参与
  },
  
  // 价值潜力等级
  valuePotentialLevels: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    VERY_HIGH: 'very_high',
    WHALE: 'whale'
  },
  
  // 用户画像更新频率（毫秒）
  updateFrequency: 24 * 60 * 60 * 1000, // 每天
  
  // 用户行为分析窗口（天）
  behaviorWindow: {
    SHORT: 7,
    MEDIUM: 30,
    LONG: 90
  }
};

/**
 * 用户画像管理器
 * 管理用户画像相关功能
 */
class UserProfileManager {
  constructor() {
    // 设置定期更新定时器
    this.updateInterval = setInterval(() => {
      this.batchUpdateProfiles();
    }, PROFILE_CONFIG.updateFrequency);
    
    logger.info('用户画像系统已初始化');
  }

  /**
   * 批量更新用户画像
   * @param {number} batchSize - 批次大小
   * @returns {Promise<Object>} 更新结果
   */
  async batchUpdateProfiles(batchSize = 100) {
    try {
      const startTime = performance.now();
      
      // 查找最近未更新的用户
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 1); // 1天前
      
      const users = await User.find({
        $or: [
          { lastProfileUpdate: { $lt: cutoffDate } },
          { lastProfileUpdate: { $exists: false } }
        ]
      })
      .select('_id')
      .limit(batchSize);
      
      if (users.length === 0) {
        return {
          success: true,
          message: '没有需要更新的用户画像',
          updatedCount: 0
        };
      }
      
      // 更新每个用户的画像
      let updatedCount = 0;
      for (const user of users) {
        const updated = await this.updateUserProfile(user._id);
        if (updated) {
          updatedCount++;
        }
      }
      
      // 计算处理时间
      const processingTime = performance.now() - startTime;
      
      logger.info(`批量更新了 ${updatedCount} 个用户画像，耗时 ${processingTime.toFixed(2)}ms`);
      return {
        success: true,
        updatedCount,
        processingTime: `${processingTime.toFixed(2)}ms`
      };
    } catch (error) {
      logger.error(`批量更新用户画像失败: ${error.message}`);
      throw new Error(`批量更新用户画像失败: ${error.message}`);
    }
  }

  /**
   * 更新单个用户画像
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateUserProfile(userId) {
    try {
      // 获取用户
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`用户不存在: ${userId}`);
        return false;
      }
      
      // 获取用户事件数据
      const shortTermDate = new Date();
      shortTermDate.setDate(shortTermDate.getDate() - PROFILE_CONFIG.behaviorWindow.SHORT);
      
      const mediumTermDate = new Date();
      mediumTermDate.setDate(mediumTermDate.getDate() - PROFILE_CONFIG.behaviorWindow.MEDIUM);
      
      const longTermDate = new Date();
      longTermDate.setDate(longTermDate.getDate() - PROFILE_CONFIG.behaviorWindow.LONG);
      
      // 获取短期活动数据
      const shortTermEvents = await UserEvent.find({
        userId,
        timestamp: { $gte: shortTermDate }
      });
      
      // 获取中期活动数据
      const mediumTermEvents = await UserEvent.find({
        userId,
        timestamp: { $gte: mediumTermDate }
      });
      
      // 获取长期活动数据（可选，根据需要）
      // const longTermEvents = await UserEvent.find({
      //   userId,
      //   timestamp: { $gte: longTermDate }
      // });
      
      // 更新用户标签
      await this.updateUserTags(user, shortTermEvents, mediumTermEvents);
      
      // 更新活跃度评分
      await this.updateActivityScore(user, shortTermEvents, mediumTermEvents);
      
      // 更新参与度评分
      await this.updateEngagementScore(user, shortTermEvents, mediumTermEvents);
      
      // 更新价值潜力评分
      await this.updateValuePotentialScore(user, shortTermEvents, mediumTermEvents);
      
      // 更新最后更新时间
      user.lastProfileUpdate = new Date();
      
      // 保存用户
      await user.save();
      
      logger.info(`更新了用户 ${userId} 的画像`);
      return true;
    } catch (error) {
      logger.error(`更新用户 ${userId} 画像失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 更新用户标签
   * @param {Object} user - 用户对象
   * @param {Array<Object>} shortTermEvents - 短期事件列表
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  async updateUserTags(user, shortTermEvents, mediumTermEvents) {
    try {
      // 初始化标签映射
      const tags = user.tags || {};
      
      // 处理人口统计学标签
      this.updateDemographicTags(user, tags);
      
      // 处理兴趣标签
      this.updateInterestTags(user, tags, mediumTermEvents);
      
      // 处理行为标签
      this.updateBehaviorTags(user, tags, shortTermEvents, mediumTermEvents);
      
      // 处理参与度标签
      this.updateEngagementTags(user, tags, shortTermEvents, mediumTermEvents);
      
      // 处理价值标签
      this.updateValueTags(user, tags, mediumTermEvents);
      
      // 更新用户标签
      user.tags = tags;
    } catch (error) {
      logger.error(`更新用户 ${user._id} 标签失败: ${error.message}`);
    }
  }

  /**
   * 更新人口统计学标签
   * @param {Object} user - 用户对象
   * @param {Object} tags - 标签映射
   */
  updateDemographicTags(user, tags) {
    // 初始化人口统计学标签
    tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC] = tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC] || {};
    
    // 添加年龄段标签
    if (user.birthDate) {
      const age = this.calculateAge(user.birthDate);
      let ageGroup = '';
      
      if (age < 18) ageGroup = 'under_18';
      else if (age < 25) ageGroup = '18_24';
      else if (age < 35) ageGroup = '25_34';
      else if (age < 45) ageGroup = '35_44';
      else if (age < 55) ageGroup = '45_54';
      else if (age < 65) ageGroup = '55_64';
      else ageGroup = '65_plus';
      
      tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].age_group = ageGroup;
    }
    
    // 添加性别标签
    if (user.gender) {
      tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].gender = user.gender;
    }
    
    // 添加位置标签
    if (user.location) {
      if (user.location.country) {
        tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].country = user.location.country;
      }
      
      if (user.location.region) {
        tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].region = user.location.region;
      }
      
      if (user.location.city) {
        tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].city = user.location.city;
      }
    }
    
    // 添加语言标签
    if (user.languages && Array.isArray(user.languages)) {
      tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].languages = user.languages;
    }
    
    // 添加注册时长标签
    if (user.createdAt) {
      const registrationDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      let userTenure = '';
      
      if (registrationDays < 7) userTenure = 'new';
      else if (registrationDays < 30) userTenure = 'recent';
      else if (registrationDays < 90) userTenure = 'established';
      else if (registrationDays < 365) userTenure = 'loyal';
      else userTenure = 'veteran';
      
      tags[PROFILE_CONFIG.tagCategories.DEMOGRAPHIC].user_tenure = userTenure;
    }
  }

  /**
   * 计算年龄
   * @param {Date} birthDate - 出生日期
   * @returns {number} 年龄
   */
  calculateAge(birthDate) {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * 更新兴趣标签
   * @param {Object} user - 用户对象
   * @param {Object} tags - 标签映射
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  updateInterestTags(user, tags, mediumTermEvents) {
    // 初始化兴趣标签
    tags[PROFILE_CONFIG.tagCategories.INTEREST] = tags[PROFILE_CONFIG.tagCategories.INTEREST] || {};
    
    // 如果用户已有兴趣数据，直接使用
    if (user.interests && Object.keys(user.interests).length > 0) {
      // 获取前5个主要兴趣
      const topInterests = Object.entries(user.interests)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category]) => category);
      
      tags[PROFILE_CONFIG.tagCategories.INTEREST].top_interests = topInterests;
      
      // 添加兴趣强度标签
      topInterests.forEach(interest => {
        const score = user.interests[interest];
        let intensity = '';
        
        if (score < 10) intensity = 'low';
        else if (score < 30) intensity = 'medium';
        else if (score < 60) intensity = 'high';
        else intensity = 'very_high';
        
        tags[PROFILE_CONFIG.tagCategories.INTEREST][`${interest}_intensity`] = intensity;
      });
    }
    // 否则，从事件中分析兴趣
    else if (mediumTermEvents.length > 0) {
      // 统计内容交互事件中的类别
      const categoryCount = {};
      
      mediumTermEvents.forEach(event => {
        if (event.eventType === TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION) {
          const { categories } = event.properties;
          
          if (categories && Array.isArray(categories)) {
            categories.forEach(category => {
              if (TRACKER_CONFIG.interestCategories.includes(category)) {
                categoryCount[category] = (categoryCount[category] || 0) + 1;
              }
            });
          }
        }
      });
      
      // 获取前5个主要兴趣
      const topInterests = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category]) => category);
      
      tags[PROFILE_CONFIG.tagCategories.INTEREST].top_interests = topInterests;
    }
    
    // 添加内容类型偏好标签
    const contentTypeCount = {};
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION) {
        const { contentType } = event.properties;
        
        if (contentType) {
          contentTypeCount[contentType] = (contentTypeCount[contentType] || 0) + 1;
        }
      }
    });
    
    // 获取前3个主要内容类型
    const topContentTypes = Object.entries(contentTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([contentType]) => contentType);
    
    if (topContentTypes.length > 0) {
      tags[PROFILE_CONFIG.tagCategories.INTEREST].preferred_content_types = topContentTypes;
    }
  }

  /**
   * 更新行为标签
   * @param {Object} user - 用户对象
   * @param {Object} tags - 标签映射
   * @param {Array<Object>} shortTermEvents - 短期事件列表
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  updateBehaviorTags(user, tags, shortTermEvents, mediumTermEvents) {
    // 初始化行为标签
    tags[PROFILE_CONFIG.tagCategories.BEHAVIOR] = tags[PROFILE_CONFIG.tagCategories.BEHAVIOR] || {};
    
    // 分析活跃时间
    const hourCounts = Array(24).fill(0);
    
    mediumTermEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    // 找出最活跃的时段
    let maxCount = 0;
    let activeHour = 0;
    
    for (let i = 0; i < 24; i++) {
      if (hourCounts[i] > maxCount) {
        maxCount = hourCounts[i];
        activeHour = i;
      }
    }
    
    // 确定活跃时段
    let activePeriod = '';
    if (activeHour >= 5 && activeHour < 12) activePeriod = 'morning';
    else if (activeHour >= 12 && activeHour < 17) activePeriod = 'afternoon';
    else if (activeHour >= 17 && activeHour < 22) activePeriod = 'evening';
    else activePeriod = 'night';
    
    tags[PROFILE_CONFIG.tagCategories.BEHAVIOR].active_period = activePeriod;
    
    // 分析设备使用
    const deviceCounts = {};
    
    mediumTermEvents.forEach(event => {
      if (event.properties && event.properties.device) {
        const { device } = event.properties;
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      }
    });
    
    // 找出最常用的设备
    if (Object.keys(deviceCounts).length > 0) {
      const primaryDevice = Object.entries(deviceCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      tags[PROFILE_CONFIG.tagCategories.BEHAVIOR].primary_device = primaryDevice;
    }
    
    // 分析会话频率
    const sessionIds = new Set();
    mediumTermEvents.forEach(event => {
      if (event.sessionId) {
        sessionIds.add(event.sessionId);
      }
    });
    
    const sessionCount = sessionIds.size;
    const daysSinceRegistration = Math.max(1, Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const sessionsPerWeek = (sessionCount / daysSinceRegistration) * 7;
    
    let visitFrequency = '';
    if (sessionsPerWeek < 1) visitFrequency = 'rare';
    else if (sessionsPerWeek < 3) visitFrequency = 'occasional';
    else if (sessionsPerWeek < 7) visitFrequency = 'regular';
    else if (sessionsPerWeek < 14) visitFrequency = 'frequent';
    else visitFrequency = 'daily_multiple';
    
    tags[PROFILE_CONFIG.tagCategories.BEHAVIOR].visit_frequency = visitFrequency;
    
    // 分析功能使用偏好
    const featureCounts = {};
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.FEATURE_USE) {
        const { featureId } = event.properties;
        
        if (featureId) {
          featureCounts[featureId] = (featureCounts[featureId] || 0) + 1;
        }
      }
    });
    
    // 获取前3个最常用功能
    const topFeatures = Object.entries(featureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([featureId]) => featureId);
    
    if (topFeatures.length > 0) {
      tags[PROFILE_CONFIG.tagCategories.BEHAVIOR].top_features = topFeatures;
    }
  }

  /**
   * 更新参与度标签
   * @param {Object} user - 用户对象
   * @param {Object} tags - 标签映射
   * @param {Array<Object>} shortTermEvents - 短期事件列表
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  updateEngagementTags(user, tags, shortTermEvents, mediumTermEvents) {
    // 初始化参与度标签
    tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT] = tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT] || {};
    
    // 统计各类交互次数
    let viewCount = 0;
    let likeCount = 0;
    let commentCount = 0;
    let shareCount = 0;
    let createCount = 0;
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION) {
        const { interactionType } = event.properties;
        
        switch (interactionType) {
          case 'view':
            viewCount++;
            break;
          case 'like':
            likeCount++;
            break;
          case 'comment':
            commentCount++;
            break;
          case 'share':
            shareCount++;
            break;
          case 'create':
            createCount++;
            break;
        }
      }
    });
    
    // 确定参与类型
    if (createCount > 0) {
      tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].engagement_type = 'creator';
    } else if (commentCount > 0 || shareCount > 0) {
      tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].engagement_type = 'contributor';
    } else if (likeCount > 0) {
      tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].engagement_type = 'reactor';
    } else if (viewCount > 0) {
      tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].engagement_type = 'consumer';
    } else {
      tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].engagement_type = 'inactive';
    }
    
    // 统计社交活动
    let referralCount = 0;
    let inviteCount = 0;
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.SOCIAL_ACTION) {
        const { action } = event.properties;
        
        if (action === 'referral') {
          referralCount++;
        } else if (action === 'invite') {
          inviteCount++;
        }
      }
    });
    
    // 确定社交影响力
    let socialInfluence = '';
    const totalSocialActions = referralCount + inviteCount;
    
    if (totalSocialActions === 0) {
      socialInfluence = 'none';
    } else if (totalSocialActions < 3) {
      socialInfluence = 'low';
    } else if (totalSocialActions < 10) {
      socialInfluence = 'medium';
    } else {
      socialInfluence = 'high';
    }
    
    tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].social_influence = socialInfluence;
    
    // 统计反馈活动
    let feedbackCount = 0;
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.FEATURE_USE && 
          event.properties.featureCategory === 'feedback') {
        feedbackCount++;
      }
    });
    
    // 确定反馈参与度
    let feedbackEngagement = '';
    
    if (feedbackCount === 0) {
      feedbackEngagement = 'none';
    } else if (feedbackCount < 3) {
      feedbackEngagement = 'low';
    } else if (feedbackCount < 10) {
      feedbackEngagement = 'medium';
    } else {
      feedbackEngagement = 'high';
    }
    
    tags[PROFILE_CONFIG.tagCategories.ENGAGEMENT].feedback_engagement = feedbackEngagement;
  }

  /**
   * 更新价值标签
   * @param {Object} user - 用户对象
   * @param {Object} tags - 标签映射
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  updateValueTags(user, tags, mediumTermEvents) {
    // 初始化价值标签
    tags[PROFILE_CONFIG.tagCategories.VALUE] = tags[PROFILE_CONFIG.tagCategories.VALUE] || {};
    
    // 统计交易金额
    let totalSpent = 0;
    let transactionCount = 0;
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.TRANSACTION) {
        const { amount } = event.properties;
        
        if (amount) {
          totalSpent += parseFloat(amount);
          transactionCount++;
        }
      }
    });
    
    // 确定消费水平
    let spendingLevel = '';
    
    if (totalSpent === 0) {
      spendingLevel = 'non_spender';
    } else if (totalSpent < 50) {
      spendingLevel = 'low_spender';
    } else if (totalSpent < 200) {
      spendingLevel = 'medium_spender';
    } else if (totalSpent < 1000) {
      spendingLevel = 'high_spender';
    } else {
      spendingLevel = 'whale';
    }
    
    tags[PROFILE_CONFIG.tagCategories.VALUE].spending_level = spendingLevel;
    
    // 计算平均交易金额
    if (transactionCount > 0) {
      const avgTransactionValue = totalSpent / transactionCount;
      tags[PROFILE_CONFIG.tagCategories.VALUE].avg_transaction_value = avgTransactionValue.toFixed(2);
    }
    
    // 统计NFT活动
    let nftMintCount = 0;
    let nftPurchaseCount = 0;
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.TRANSACTION) {
        const { transactionType } = event.properties;
        
        if (transactionType === 'nft_mint') {
          nftMintCount++;
        } else if (transactionType === 'nft_purchase') {
          nftPurchaseCount++;
        }
      }
    });
    
    // 确定NFT参与度
    let nftEngagement = '';
    const totalNftActions = nftMintCount + nftPurchaseCount;
    
    if (totalNftActions === 0) {
      nftEngagement = 'none';
    } else if (totalNftActions < 3) {
      nftEngagement = 'low';
    } else if (totalNftActions < 10) {
      nftEngagement = 'medium';
    } else {
      nftEngagement = 'high';
    }
    
    tags[PROFILE_CONFIG.tagCategories.VALUE].nft_engagement = nftEngagement;
    
    // 统计代币活动
    let tokenStakeCount = 0;
    let tokenTransferCount = 0;
    
    mediumTermEvents.forEach(event => {
      if (event.eventType === TRACKER_CONFIG.eventTypes.TRANSACTION) {
        const { transactionType } = event.properties;
        
        if (transactionType === 'token_stake') {
          tokenStakeCount++;
        } else if (transactionType === 'token_transfer') {
          tokenTransferCount++;
        }
      }
    });
    
    // 确定代币参与度
    let tokenEngagement = '';
    const totalTokenActions = tokenStakeCount + tokenTransferCount;
    
    if (totalTokenActions === 0) {
      tokenEngagement = 'none';
    } else if (totalTokenActions < 5) {
      tokenEngagement = 'low';
    } else if (totalTokenActions < 20) {
      tokenEngagement = 'medium';
    } else {
      tokenEngagement = 'high';
    }
    
    tags[PROFILE_CONFIG.tagCategories.VALUE].token_engagement = tokenEngagement;
  }

  /**
   * 更新活跃度评分
   * @param {Object} user - 用户对象
   * @param {Array<Object>} shortTermEvents - 短期事件列表
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  async updateActivityScore(user, shortTermEvents, mediumTermEvents) {
    try {
      // 计算短期活动分数
      const shortTermScore = this.calculateActivityScore(shortTermEvents);
      
      // 计算中期活动分数
      const mediumTermScore = this.calculateActivityScore(mediumTermEvents);
      
      // 计算加权活动分数（短期占60%，中期占40%）
      const activityScore = (shortTermScore * 0.6) + (mediumTermScore * 0.4);
      
      // 确定活跃度等级
      let activityLevel = '';
      
      if (activityScore === 0) {
        activityLevel = PROFILE_CONFIG.activityLevels.INACTIVE;
      } else if (activityScore < 20) {
        activityLevel = PROFILE_CONFIG.activityLevels.LOW;
      } else if (activityScore < 50) {
        activityLevel = PROFILE_CONFIG.activityLevels.MEDIUM;
      } else if (activityScore < 100) {
        activityLevel = PROFILE_CONFIG.activityLevels.HIGH;
      } else {
        activityLevel = PROFILE_CONFIG.activityLevels.VERY_HIGH;
      }
      
      // 更新用户活跃度
      user.activityScore = activityScore;
      user.activityLevel = activityLevel;
    } catch (error) {
      logger.error(`更新用户 ${user._id} 活跃度评分失败: ${error.message}`);
    }
  }

  /**
   * 计算活跃度评分
   * @param {Array<Object>} events - 事件列表
   * @returns {number} 活跃度评分
   */
  calculateActivityScore(events) {
    if (!events || events.length === 0) {
      return 0;
    }
    
    // 统计各类事件
    let pageViewCount = 0;
    let featureUseCount = 0;
    let contentInteractionCount = 0;
    let socialActionCount = 0;
    let transactionCount = 0;
    
    events.forEach(event => {
      switch (event.eventType) {
        case TRACKER_CONFIG.eventTypes.PAGE_VIEW:
          pageViewCount++;
          break;
        case TRACKER_CONFIG.eventTypes.FEATURE_USE:
          featureUseCount++;
          break;
        case TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION:
          contentInteractionCount++;
          break;
        case TRACKER_CONFIG.eventTypes.SOCIAL_ACTION:
          socialActionCount++;
          break;
        case TRACKER_CONFIG.eventTypes.TRANSACTION:
          transactionCount++;
          break;
      }
    });
    
    // 计算加权分数
    const score = (pageViewCount * 1) +
                 (featureUseCount * 2) +
                 (contentInteractionCount * 3) +
                 (socialActionCount * 4) +
                 (transactionCount * 5);
    
    return score;
  }

  /**
   * 更新参与度评分
   * @param {Object} user - 用户对象
   * @param {Array<Object>} shortTermEvents - 短期事件列表
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  async updateEngagementScore(user, shortTermEvents, mediumTermEvents) {
    try {
      // 统计各类交互次数
      let viewCount = 0;
      let likeCount = 0;
      let commentCount = 0;
      let shareCount = 0;
      let createCount = 0;
      let referralCount = 0;
      
      mediumTermEvents.forEach(event => {
        if (event.eventType === TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION) {
          const { interactionType } = event.properties;
          
          switch (interactionType) {
            case 'view':
              viewCount++;
              break;
            case 'like':
              likeCount++;
              break;
            case 'comment':
              commentCount++;
              break;
            case 'share':
              shareCount++;
              break;
            case 'create':
              createCount++;
              break;
          }
        } else if (event.eventType === TRACKER_CONFIG.eventTypes.SOCIAL_ACTION) {
          const { action } = event.properties;
          
          if (action === 'referral') {
            referralCount++;
          }
        }
      });
      
      // 计算加权参与度分数
      const engagementScore = (viewCount * 1) +
                             (likeCount * 2) +
                             (commentCount * 5) +
                             (shareCount * 10) +
                             (createCount * 20) +
                             (referralCount * 15);
      
      // 确定参与度等级
      let engagementLevel = '';
      
      if (createCount > 0) {
        engagementLevel = PROFILE_CONFIG.engagementLevels.CONTRIBUTOR;
      } else if (shareCount > 0 || referralCount > 0) {
        engagementLevel = PROFILE_CONFIG.engagementLevels.ADVOCATE;
      } else if (commentCount > 0) {
        engagementLevel = PROFILE_CONFIG.engagementLevels.COMMENTER;
      } else if (likeCount > 0) {
        engagementLevel = PROFILE_CONFIG.engagementLevels.REACTOR;
      } else {
        engagementLevel = PROFILE_CONFIG.engagementLevels.LURKER;
      }
      
      // 更新用户参与度
      user.engagementScore = engagementScore;
      user.engagementLevel = engagementLevel;
    } catch (error) {
      logger.error(`更新用户 ${user._id} 参与度评分失败: ${error.message}`);
    }
  }

  /**
   * 更新价值潜力评分
   * @param {Object} user - 用户对象
   * @param {Array<Object>} shortTermEvents - 短期事件列表
   * @param {Array<Object>} mediumTermEvents - 中期事件列表
   */
  async updateValuePotentialScore(user, shortTermEvents, mediumTermEvents) {
    try {
      // 基础分数因素
      let baseScore = 50;
      
      // 根据活跃度调整分数
      if (user.activityLevel) {
        switch (user.activityLevel) {
          case PROFILE_CONFIG.activityLevels.INACTIVE:
            baseScore -= 30;
            break;
          case PROFILE_CONFIG.activityLevels.LOW:
            baseScore -= 15;
            break;
          case PROFILE_CONFIG.activityLevels.MEDIUM:
            break;
          case PROFILE_CONFIG.activityLevels.HIGH:
            baseScore += 15;
            break;
          case PROFILE_CONFIG.activityLevels.VERY_HIGH:
            baseScore += 30;
            break;
        }
      }
      
      // 根据参与度调整分数
      if (user.engagementLevel) {
        switch (user.engagementLevel) {
          case PROFILE_CONFIG.engagementLevels.LURKER:
            baseScore -= 20;
            break;
          case PROFILE_CONFIG.engagementLevels.REACTOR:
            baseScore -= 10;
            break;
          case PROFILE_CONFIG.engagementLevels.COMMENTER:
            break;
          case PROFILE_CONFIG.engagementLevels.CONTRIBUTOR:
            baseScore += 20;
            break;
          case PROFILE_CONFIG.engagementLevels.ADVOCATE:
            baseScore += 30;
            break;
        }
      }
      
      // 统计交易行为
      let totalSpent = 0;
      let transactionCount = 0;
      let nftCount = 0;
      let tokenStakeCount = 0;
      
      mediumTermEvents.forEach(event => {
        if (event.eventType === TRACKER_CONFIG.eventTypes.TRANSACTION) {
          const { amount, transactionType } = event.properties;
          
          if (amount) {
            totalSpent += parseFloat(amount);
            transactionCount++;
          }
          
          if (transactionType === 'nft_mint' || transactionType === 'nft_purchase') {
            nftCount++;
          } else if (transactionType === 'token_stake') {
            tokenStakeCount++;
          }
        }
      });
      
      // 根据消费行为调整分数
      if (totalSpent > 0) {
        if (totalSpent < 50) {
          baseScore += 5;
        } else if (totalSpent < 200) {
          baseScore += 15;
        } else if (totalSpent < 1000) {
          baseScore += 30;
        } else {
          baseScore += 50;
        }
      }
      
      // 根据NFT参与度调整分数
      if (nftCount > 0) {
        if (nftCount < 3) {
          baseScore += 10;
        } else if (nftCount < 10) {
          baseScore += 20;
        } else {
          baseScore += 30;
        }
      }
      
      // 根据代币质押调整分数
      if (tokenStakeCount > 0) {
        if (tokenStakeCount < 3) {
          baseScore += 10;
        } else if (tokenStakeCount < 10) {
          baseScore += 20;
        } else {
          baseScore += 30;
        }
      }
      
      // 确保分数在0-100范围内
      const valuePotentialScore = Math.max(0, Math.min(100, baseScore));
      
      // 确定价值潜力等级
      let valuePotentialLevel = '';
      
      if (valuePotentialScore < 20) {
        valuePotentialLevel = PROFILE_CONFIG.valuePotentialLevels.LOW;
      } else if (valuePotentialScore < 50) {
        valuePotentialLevel = PROFILE_CONFIG.valuePotentialLevels.MEDIUM;
      } else if (valuePotentialScore < 80) {
        valuePotentialLevel = PROFILE_CONFIG.valuePotentialLevels.HIGH;
      } else if (valuePotentialScore < 95) {
        valuePotentialLevel = PROFILE_CONFIG.valuePotentialLevels.VERY_HIGH;
      } else {
        valuePotentialLevel = PROFILE_CONFIG.valuePotentialLevels.WHALE;
      }
      
      // 更新用户价值潜力
      user.valuePotentialScore = valuePotentialScore;
      user.valuePotentialLevel = valuePotentialLevel;
    } catch (error) {
      logger.error(`更新用户 ${user._id} 价值潜力评分失败: ${error.message}`);
    }
  }

  /**
   * 获取用户画像
   * @param {string} userId - 用户ID
   * @param {boolean} forceUpdate - 是否强制更新
   * @returns {Promise<Object>} 用户画像
   */
  async getUserProfile(userId, forceUpdate = false) {
    try {
      // 获取用户
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      // 如果强制更新或者用户画像过期，则更新用户画像
      const profileAge = user.lastProfileUpdate ? Date.now() - user.lastProfileUpdate.getTime() : Infinity;
      
      if (forceUpdate || profileAge > PROFILE_CONFIG.updateFrequency) {
        await this.updateUserProfile(userId);
        
        // 重新获取用户
        const updatedUser = await User.findById(userId);
        
        return this.formatUserProfile(updatedUser);
      }
      
      // 返回现有用户画像
      return this.formatUserProfile(user);
    } catch (error) {
      logger.error(`获取用户 ${userId} 画像失败: ${error.message}`);
      throw new Error(`获取用户画像失败: ${error.message}`);
    }
  }

  /**
   * 格式化用户画像
   * @param {Object} user - 用户对象
   * @returns {Object} 格式化的用户画像
   */
  formatUserProfile(user) {
    return {
      userId: user._id,
      username: user.username,
      tags: user.tags || {},
      interests: user.interests || {},
      primaryInterests: user.primaryInterests || [],
      activityScore: user.activityScore || 0,
      activityLevel: user.activityLevel || PROFILE_CONFIG.activityLevels.INACTIVE,
      engagementScore: user.engagementScore || 0,
      engagementLevel: user.engagementLevel || PROFILE_CONFIG.engagementLevels.LURKER,
      valuePotentialScore: user.valuePotentialScore || 0,
      valuePotentialLevel: user.valuePotentialLevel || PROFILE_CONFIG.valuePotentialLevels.LOW,
      lastProfileUpdate: user.lastProfileUpdate || null
    };
  }

  /**
   * 查找相似用户
   * @param {string} userId - 用户ID
   * @param {number} limit - 结果数量限制
   * @returns {Promise<Array<Object>>} 相似用户列表
   */
  async findSimilarUsers(userId, limit = 10) {
    try {
      // 获取用户画像
      const userProfile = await this.getUserProfile(userId);
      
      if (!userProfile.primaryInterests || userProfile.primaryInterests.length === 0) {
        throw new Error('用户没有足够的兴趣数据来查找相似用户');
      }
      
      // 查找具有相似兴趣的用户
      const similarUsers = await User.find({
        _id: { $ne: userId },
        primaryInterests: { $in: userProfile.primaryInterests }
      })
      .select('_id username primaryInterests activityLevel engagementLevel')
      .limit(limit * 2); // 获取更多用户，然后进行排序
      
      // 计算相似度分数
      const scoredUsers = similarUsers.map(user => {
        // 计算兴趣重叠数
        const interestOverlap = user.primaryInterests.filter(interest => 
          userProfile.primaryInterests.includes(interest)
        ).length;
        
        // 计算活跃度匹配分数
        const activityMatch = user.activityLevel === userProfile.activityLevel ? 1 : 0;
        
        // 计算参与度匹配分数
        const engagementMatch = user.engagementLevel === userProfile.engagementLevel ? 1 : 0;
        
        // 计算总相似度分数
        const similarityScore = (interestOverlap * 3) + (activityMatch * 2) + (engagementMatch * 2);
        
        return {
          userId: user._id,
          username: user.username,
          primaryInterests: user.primaryInterests,
          activityLevel: user.activityLevel,
          engagementLevel: user.engagementLevel,
          similarityScore
        };
      });
      
      // 按相似度分数排序并限制结果数量
      return scoredUsers
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);
    } catch (error) {
      logger.error(`查找用户 ${userId} 的相似用户失败: ${error.message}`);
      throw new Error(`查找相似用户失败: ${error.message}`);
    }
  }

  /**
   * 获取用户分群
   * @param {Object} criteria - 分群条件
   * @param {number} limit - 结果数量限制
   * @returns {Promise<Array<Object>>} 用户分群结果
   */
  async getUserSegments(criteria, limit = 100) {
    try {
      // 构建查询条件
      const query = {};
      
      // 添加活跃度条件
      if (criteria.activityLevel) {
        query.activityLevel = criteria.activityLevel;
      }
      
      // 添加参与度条件
      if (criteria.engagementLevel) {
        query.engagementLevel = criteria.engagementLevel;
      }
      
      // 添加价值潜力条件
      if (criteria.valuePotentialLevel) {
        query.valuePotentialLevel = criteria.valuePotentialLevel;
      }
      
      // 添加兴趣条件
      if (criteria.interests && criteria.interests.length > 0) {
        query.primaryInterests = { $in: criteria.interests };
      }
      
      // 添加标签条件
      if (criteria.tags) {
        for (const [category, tags] of Object.entries(criteria.tags)) {
          for (const [tag, value] of Object.entries(tags)) {
            query[`tags.${category}.${tag}`] = value;
          }
        }
      }
      
      // 查询符合条件的用户
      const users = await User.find(query)
        .select('_id username tags primaryInterests activityLevel engagementLevel valuePotentialLevel')
        .limit(limit);
      
      // 统计分群信息
      const totalUsers = await User.countDocuments(query);
      
      return {
        criteria,
        totalUsers,
        users: users.map(user => ({
          userId: user._id,
          username: user.username,
          primaryInterests: user.primaryInterests,
          activityLevel: user.activityLevel,
          engagementLevel: user.engagementLevel,
          valuePotentialLevel: user.valuePotentialLevel
        }))
      };
    } catch (error) {
      logger.error(`获取用户分群失败: ${error.message}`);
      throw new Error(`获取用户分群失败: ${error.message}`);
    }
  }

  /**
   * 销毁管理器
   */
  destroy() {
    // 清除定期更新定时器
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    logger.info('用户画像系统已销毁');
  }
}

// 创建用户画像管理器实例
const userProfileManager = new UserProfileManager();

// 导出模块
module.exports = {
  userProfileManager,
  PROFILE_CONFIG
};
