/**
 * 用户行为追踪系统
 * 
 * 该模块实现了用户行为追踪系统的核心功能，包括:
 * - 页面访问与停留时间分析
 * - 功能使用频率统计
 * - 用户兴趣点识别
 * - 转化漏斗分析
 * 
 * @module services/userAcquisition/userTracker
 */

const mongoose = require('mongoose');
const UserEvent = require('../../models/userEvent.model');
const User = require('../../models/user.model');
const logger = require('../../utils/logger');
const { performance } = require('perf_hooks');
const config = require('../../config');

// 用户行为追踪配置
const TRACKER_CONFIG = {
  // 事件类型
  eventTypes: {
    PAGE_VIEW: 'page_view',
    FEATURE_USE: 'feature_use',
    CONTENT_INTERACTION: 'content_interaction',
    SOCIAL_ACTION: 'social_action',
    TRANSACTION: 'transaction',
    ONBOARDING: 'onboarding',
    CONVERSION: 'conversion'
  },
  
  // 兴趣类别
  interestCategories: [
    'traditional_art', 'modern_art', 'literature', 'music', 
    'dance', 'theater', 'film', 'photography', 'cuisine', 
    'fashion', 'architecture', 'history', 'philosophy', 
    'language', 'festivals', 'crafts', 'digital_art', 'nft'
  ],
  
  // 转化漏斗阶段
  funnelStages: {
    VISITOR: 'visitor',
    REGISTERED: 'registered',
    ENGAGED: 'engaged',
    CONTRIBUTOR: 'contributor',
    ADVOCATE: 'advocate'
  },
  
  // 会话超时时间（毫秒）
  sessionTimeout: 30 * 60 * 1000, // 30分钟
  
  // 批量处理阈值
  batchSize: 100,
  
  // 数据保留期限（天）
  dataRetentionDays: 365
};

/**
 * 用户行为追踪管理器
 * 管理用户行为追踪相关功能
 */
class UserTracker {
  constructor() {
    // 初始化事件缓冲区
    this.eventBuffer = [];
    
    // 初始化会话映射
    this.sessionMap = new Map();
    
    // 设置批量处理定时器
    this.batchProcessInterval = setInterval(() => {
      this.processBatchEvents();
    }, 60000); // 每分钟处理一次
    
    logger.info('用户行为追踪系统已初始化');
  }

  /**
   * 追踪用户事件
   * @param {Object} eventData - 事件数据
   * @returns {Promise<Object>} 事件追踪结果
   */
  async trackEvent(eventData) {
    try {
      // 验证事件数据
      this.validateEventData(eventData);
      
      // 添加时间戳
      const timestamp = eventData.timestamp || new Date();
      const enrichedEvent = {
        ...eventData,
        timestamp
      };
      
      // 处理会话信息
      if (eventData.userId) {
        enrichedEvent.sessionId = this.getOrCreateSession(eventData.userId, timestamp);
      }
      
      // 添加到缓冲区
      this.eventBuffer.push(enrichedEvent);
      
      // 如果缓冲区达到阈值，立即处理
      if (this.eventBuffer.length >= TRACKER_CONFIG.batchSize) {
        this.processBatchEvents();
      }
      
      return {
        success: true,
        eventId: enrichedEvent._id || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        timestamp
      };
    } catch (error) {
      logger.error(`追踪用户事件失败: ${error.message}`);
      throw new Error(`追踪用户事件失败: ${error.message}`);
    }
  }

  /**
   * 验证事件数据
   * @param {Object} eventData - 事件数据
   */
  validateEventData(eventData) {
    // 检查必要字段
    if (!eventData.eventType) {
      throw new Error('事件类型不能为空');
    }
    
    // 检查事件类型是否有效
    if (!Object.values(TRACKER_CONFIG.eventTypes).includes(eventData.eventType)) {
      throw new Error(`无效的事件类型: ${eventData.eventType}`);
    }
    
    // 检查用户标识
    if (!eventData.userId && !eventData.anonymousId) {
      throw new Error('必须提供用户ID或匿名ID');
    }
    
    // 检查事件属性
    if (!eventData.properties || typeof eventData.properties !== 'object') {
      throw new Error('事件属性必须是一个对象');
    }
  }

  /**
   * 获取或创建会话ID
   * @param {string} userId - 用户ID
   * @param {Date} timestamp - 时间戳
   * @returns {string} 会话ID
   */
  getOrCreateSession(userId, timestamp) {
    const now = timestamp.getTime();
    const userSession = this.sessionMap.get(userId);
    
    if (userSession && now - userSession.lastActivity < TRACKER_CONFIG.sessionTimeout) {
      // 更新现有会话
      userSession.lastActivity = now;
      return userSession.sessionId;
    } else {
      // 创建新会话
      const sessionId = `${userId}_${now}_${Math.random().toString(36).substring(2, 10)}`;
      this.sessionMap.set(userId, {
        sessionId,
        lastActivity: now
      });
      return sessionId;
    }
  }

  /**
   * 批量处理事件
   */
  async processBatchEvents() {
    if (this.eventBuffer.length === 0) {
      return;
    }
    
    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      
      // 批量保存事件
      await UserEvent.insertMany(events);
      
      // 更新用户兴趣点
      const userEvents = events.filter(event => event.userId);
      if (userEvents.length > 0) {
        await this.updateUserInterests(userEvents);
      }
      
      logger.info(`批量处理了 ${events.length} 个用户事件`);
    } catch (error) {
      logger.error(`批量处理事件失败: ${error.message}`);
      // 将事件放回缓冲区
      this.eventBuffer = [...this.eventBuffer, ...events];
    }
  }

  /**
   * 更新用户兴趣点
   * @param {Array<Object>} events - 用户事件列表
   */
  async updateUserInterests(events) {
    try {
      // 按用户分组事件
      const userEventsMap = new Map();
      
      for (const event of events) {
        if (!userEventsMap.has(event.userId)) {
          userEventsMap.set(event.userId, []);
        }
        userEventsMap.get(event.userId).push(event);
      }
      
      // 为每个用户更新兴趣点
      for (const [userId, userEvents] of userEventsMap.entries()) {
        await this.updateSingleUserInterests(userId, userEvents);
      }
    } catch (error) {
      logger.error(`更新用户兴趣点失败: ${error.message}`);
    }
  }

  /**
   * 更新单个用户的兴趣点
   * @param {string} userId - 用户ID
   * @param {Array<Object>} events - 用户事件列表
   */
  async updateSingleUserInterests(userId, events) {
    try {
      // 获取用户
      const user = await User.findById(userId);
      if (!user) {
        return;
      }
      
      // 初始化兴趣点映射
      const interestsMap = {};
      TRACKER_CONFIG.interestCategories.forEach(category => {
        interestsMap[category] = user.interests?.[category] || 0;
      });
      
      // 根据事件更新兴趣点
      for (const event of events) {
        // 内容交互事件
        if (event.eventType === TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION) {
          const { contentType, contentId, interactionType, categories } = event.properties;
          
          if (categories && Array.isArray(categories)) {
            categories.forEach(category => {
              if (TRACKER_CONFIG.interestCategories.includes(category)) {
                // 根据交互类型赋予不同权重
                let weight = 1;
                switch (interactionType) {
                  case 'view':
                    weight = 1;
                    break;
                  case 'like':
                    weight = 2;
                    break;
                  case 'comment':
                    weight = 3;
                    break;
                  case 'share':
                    weight = 4;
                    break;
                  case 'create':
                    weight = 5;
                    break;
                  default:
                    weight = 1;
                }
                
                interestsMap[category] = (interestsMap[category] || 0) + weight;
              }
            });
          }
        }
        
        // 页面浏览事件
        else if (event.eventType === TRACKER_CONFIG.eventTypes.PAGE_VIEW) {
          const { pageCategory } = event.properties;
          
          if (pageCategory && TRACKER_CONFIG.interestCategories.includes(pageCategory)) {
            interestsMap[pageCategory] = (interestsMap[pageCategory] || 0) + 1;
          }
        }
        
        // 功能使用事件
        else if (event.eventType === TRACKER_CONFIG.eventTypes.FEATURE_USE) {
          const { featureCategory } = event.properties;
          
          if (featureCategory && TRACKER_CONFIG.interestCategories.includes(featureCategory)) {
            interestsMap[featureCategory] = (interestsMap[featureCategory] || 0) + 2;
          }
        }
      }
      
      // 更新用户兴趣点
      user.interests = interestsMap;
      
      // 计算主要兴趣
      const sortedInterests = Object.entries(interestsMap)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, score]) => score > 0)
        .map(([category]) => category);
      
      user.primaryInterests = sortedInterests.slice(0, 5);
      
      // 保存用户
      await user.save();
      
      logger.info(`更新了用户 ${userId} 的兴趣点`);
    } catch (error) {
      logger.error(`更新用户 ${userId} 兴趣点失败: ${error.message}`);
    }
  }

  /**
   * 分析页面访问与停留时间
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 分析结果
   */
  async analyzePageVisits(filters = {}) {
    try {
      const startTime = performance.now();
      
      // 构建查询条件
      const query = {
        eventType: TRACKER_CONFIG.eventTypes.PAGE_VIEW
      };
      
      // 添加时间范围
      if (filters.startDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp.$gte = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp.$lte = new Date(filters.endDate);
      }
      
      // 添加用户过滤
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      // 添加页面过滤
      if (filters.pageUrl) {
        query['properties.pageUrl'] = filters.pageUrl;
      }
      
      if (filters.pageCategory) {
        query['properties.pageCategory'] = filters.pageCategory;
      }
      
      // 聚合查询
      const pageVisits = await UserEvent.aggregate([
        { $match: query },
        { $group: {
          _id: '$properties.pageUrl',
          visits: { $sum: 1 },
          avgDuration: { $avg: '$properties.duration' },
          users: { $addToSet: '$userId' }
        }},
        { $project: {
          pageUrl: '$_id',
          visits: 1,
          avgDuration: 1,
          uniqueUsers: { $size: '$users' },
          _id: 0
        }},
        { $sort: { visits: -1 } }
      ]);
      
      // 计算总访问量和平均停留时间
      const totalVisits = pageVisits.reduce((sum, page) => sum + page.visits, 0);
      const totalDuration = pageVisits.reduce((sum, page) => sum + (page.avgDuration * page.visits), 0);
      const avgDuration = totalVisits > 0 ? totalDuration / totalVisits : 0;
      
      // 计算处理时间
      const processingTime = performance.now() - startTime;
      
      return {
        totalVisits,
        avgDuration,
        pageVisits,
        processingTime: `${processingTime.toFixed(2)}ms`
      };
    } catch (error) {
      logger.error(`分析页面访问失败: ${error.message}`);
      throw new Error(`分析页面访问失败: ${error.message}`);
    }
  }

  /**
   * 分析功能使用频率
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeFeatureUsage(filters = {}) {
    try {
      const startTime = performance.now();
      
      // 构建查询条件
      const query = {
        eventType: TRACKER_CONFIG.eventTypes.FEATURE_USE
      };
      
      // 添加时间范围
      if (filters.startDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp.$gte = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp.$lte = new Date(filters.endDate);
      }
      
      // 添加用户过滤
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      // 添加功能过滤
      if (filters.featureId) {
        query['properties.featureId'] = filters.featureId;
      }
      
      if (filters.featureCategory) {
        query['properties.featureCategory'] = filters.featureCategory;
      }
      
      // 聚合查询
      const featureUsage = await UserEvent.aggregate([
        { $match: query },
        { $group: {
          _id: '$properties.featureId',
          usageCount: { $sum: 1 },
          users: { $addToSet: '$userId' },
          category: { $first: '$properties.featureCategory' }
        }},
        { $project: {
          featureId: '$_id',
          featureName: '$properties.featureName',
          category: 1,
          usageCount: 1,
          uniqueUsers: { $size: '$users' },
          _id: 0
        }},
        { $sort: { usageCount: -1 } }
      ]);
      
      // 按类别分组
      const categoryUsage = await UserEvent.aggregate([
        { $match: query },
        { $group: {
          _id: '$properties.featureCategory',
          usageCount: { $sum: 1 },
          users: { $addToSet: '$userId' }
        }},
        { $project: {
          category: '$_id',
          usageCount: 1,
          uniqueUsers: { $size: '$users' },
          _id: 0
        }},
        { $sort: { usageCount: -1 } }
      ]);
      
      // 计算总使用量
      const totalUsage = featureUsage.reduce((sum, feature) => sum + feature.usageCount, 0);
      
      // 计算处理时间
      const processingTime = performance.now() - startTime;
      
      return {
        totalUsage,
        featureUsage,
        categoryUsage,
        processingTime: `${processingTime.toFixed(2)}ms`
      };
    } catch (error) {
      logger.error(`分析功能使用频率失败: ${error.message}`);
      throw new Error(`分析功能使用频率失败: ${error.message}`);
    }
  }

  /**
   * 识别用户兴趣点
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 用户兴趣点
   */
  async identifyUserInterests(userId) {
    try {
      // 获取用户
      const user = await User.findById(userId).select('interests primaryInterests');
      
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      // 如果用户已有兴趣点，直接返回
      if (user.interests && Object.keys(user.interests).length > 0) {
        // 按兴趣分数排序
        const sortedInterests = Object.entries(user.interests)
          .sort((a, b) => b[1] - a[1])
          .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
          }, {});
        
        return {
          userId,
          interests: sortedInterests,
          primaryInterests: user.primaryInterests || []
        };
      }
      
      // 否则，分析用户事件
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // 最近90天
      
      // 获取用户事件
      const events = await UserEvent.find({
        userId,
        timestamp: { $gte: startDate },
        $or: [
          { eventType: TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION },
          { eventType: TRACKER_CONFIG.eventTypes.PAGE_VIEW },
          { eventType: TRACKER_CONFIG.eventTypes.FEATURE_USE }
        ]
      }).sort({ timestamp: -1 }).limit(1000);
      
      // 更新用户兴趣点
      await this.updateSingleUserInterests(userId, events);
      
      // 重新获取用户
      const updatedUser = await User.findById(userId).select('interests primaryInterests');
      
      // 按兴趣分数排序
      const sortedInterests = Object.entries(updatedUser.interests || {})
        .sort((a, b) => b[1] - a[1])
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});
      
      return {
        userId,
        interests: sortedInterests,
        primaryInterests: updatedUser.primaryInterests || []
      };
    } catch (error) {
      logger.error(`识别用户兴趣点失败: ${error.message}`);
      throw new Error(`识别用户兴趣点失败: ${error.message}`);
    }
  }

  /**
   * 分析转化漏斗
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 漏斗分析结果
   */
  async analyzeFunnel(filters = {}) {
    try {
      const startTime = performance.now();
      
      // 构建基础查询条件
      const baseQuery = {};
      
      // 添加时间范围
      if (filters.startDate) {
        baseQuery.timestamp = baseQuery.timestamp || {};
        baseQuery.timestamp.$gte = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        baseQuery.timestamp = baseQuery.timestamp || {};
        baseQuery.timestamp.$lte = new Date(filters.endDate);
      }
      
      // 定义漏斗阶段
      const funnelStages = [
        {
          name: TRACKER_CONFIG.funnelStages.VISITOR,
          query: {
            ...baseQuery,
            eventType: TRACKER_CONFIG.eventTypes.PAGE_VIEW
          }
        },
        {
          name: TRACKER_CONFIG.funnelStages.REGISTERED,
          query: {
            ...baseQuery,
            eventType: TRACKER_CONFIG.eventTypes.ONBOARDING,
            'properties.action': 'registration_complete'
          }
        },
        {
          name: TRACKER_CONFIG.funnelStages.ENGAGED,
          query: {
            ...baseQuery,
            eventType: TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION,
            'properties.interactionType': { $in: ['like', 'comment', 'share'] }
          }
        },
        {
          name: TRACKER_CONFIG.funnelStages.CONTRIBUTOR,
          query: {
            ...baseQuery,
            eventType: TRACKER_CONFIG.eventTypes.CONTENT_INTERACTION,
            'properties.interactionType': 'create'
          }
        },
        {
          name: TRACKER_CONFIG.funnelStages.ADVOCATE,
          query: {
            ...baseQuery,
            eventType: TRACKER_CONFIG.eventTypes.SOCIAL_ACTION,
            'properties.action': 'referral'
          }
        }
      ];
      
      // 计算每个阶段的用户数
      const funnelResults = [];
      let previousUsers = null;
      
      for (const stage of funnelStages) {
        // 获取该阶段的唯一用户
        const users = await UserEvent.distinct('userId', stage.query);
        
        // 如果是第一个阶段，记录总用户数
        if (!previousUsers) {
          previousUsers = new Set(users);
          funnelResults.push({
            stage: stage.name,
            users: users.length,
            dropoff: 0,
            dropoffRate: 0
          });
        } else {
          // 计算继续到该阶段的用户
          const stageUsers = new Set(users);
          const continuedUsers = new Set([...stageUsers].filter(user => previousUsers.has(user)));
          
          // 计算流失率
          const dropoff = previousUsers.size - continuedUsers.size;
          const dropoffRate = previousUsers.size > 0 ? (dropoff / previousUsers.size) * 100 : 0;
          
          funnelResults.push({
            stage: stage.name,
            users: continuedUsers.size,
            dropoff,
            dropoffRate: dropoffRate.toFixed(2) + '%'
          });
          
          // 更新前一阶段用户集合
          previousUsers = continuedUsers;
        }
      }
      
      // 计算总体转化率
      const overallConversionRate = funnelResults.length > 1 && funnelResults[0].users > 0
        ? (funnelResults[funnelResults.length - 1].users / funnelResults[0].users) * 100
        : 0;
      
      // 计算处理时间
      const processingTime = performance.now() - startTime;
      
      return {
        funnelResults,
        overallConversionRate: overallConversionRate.toFixed(2) + '%',
        processingTime: `${processingTime.toFixed(2)}ms`
      };
    } catch (error) {
      logger.error(`分析转化漏斗失败: ${error.message}`);
      throw new Error(`分析转化漏斗失败: ${error.message}`);
    }
  }

  /**
   * 清理过期数据
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupExpiredData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - TRACKER_CONFIG.dataRetentionDays);
      
      // 删除过期事件
      const result = await UserEvent.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      logger.info(`清理了 ${result.deletedCount} 条过期事件数据`);
      return {
        success: true,
        deletedCount: result.deletedCount,
        cutoffDate
      };
    } catch (error) {
      logger.error(`清理过期数据失败: ${error.message}`);
      throw new Error(`清理过期数据失败: ${error.message}`);
    }
  }

  /**
   * 销毁追踪器
   */
  destroy() {
    // 清除批量处理定时器
    if (this.batchProcessInterval) {
      clearInterval(this.batchProcessInterval);
    }
    
    // 处理剩余事件
    if (this.eventBuffer.length > 0) {
      this.processBatchEvents();
    }
    
    logger.info('用户行为追踪系统已销毁');
  }
}

// 创建用户行为追踪器实例
const userTracker = new UserTracker();

// 导出模块
module.exports = {
  userTracker,
  TRACKER_CONFIG
};
