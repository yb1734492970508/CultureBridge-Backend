/**
 * 企业管理控制台服务
 * 提供企业数据仪表盘、用户活跃度监控、资源使用统计和系统配置管理功能
 */

const mongoose = require('mongoose');
const { Organization, Department, Role, UserOrganization } = require('../../models/organization.model');
const { User } = require('../../models/user.model');
const { CultureActivity } = require('../../models/activity.model');
const { CultureAsset } = require('../../models/asset.model');
const { PermissionLog } = require('../../models/permission.model');
const blockchainService = require('../../blockchain/token.service');
const logger = require('../../utils/logger');

/**
 * 企业管理控制台服务
 */
class EnterpriseConsole {
  /**
   * 获取组织仪表盘数据
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 仪表盘数据
   */
  async getDashboardData(organizationId) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 获取用户统计
      const userCount = await UserOrganization.countDocuments({
        organizationId,
        status: 'active'
      });

      const newUsersLastMonth = await UserOrganization.countDocuments({
        organizationId,
        status: 'active',
        joinedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      // 获取部门统计
      const departmentCount = await Department.countDocuments({ organizationId });

      // 获取文化活动统计
      const activityCount = await CultureActivity.countDocuments({
        organizationId
      });

      const activeActivities = await CultureActivity.countDocuments({
        organizationId,
        status: 'active'
      });

      // 获取文化资产统计
      const assetCount = await CultureAsset.countDocuments({
        organizationId
      });

      // 获取最近操作日志
      const recentLogs = await PermissionLog.find({ organizationId })
        .sort({ createdAt: -1 })
        .limit(10);

      // 获取用户活跃度数据
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      const userActivityData = await this.getUserActivityData(organizationId, lastMonth, now);

      // 构建仪表盘数据
      return {
        organization: {
          id: organization._id,
          name: organization.name,
          logo: organization.logo,
          industry: organization.industry,
          size: organization.size
        },
        statistics: {
          users: {
            total: userCount,
            newLastMonth: newUsersLastMonth,
            growthRate: userCount > 0 ? (newUsersLastMonth / userCount * 100).toFixed(2) : 0
          },
          departments: {
            total: departmentCount
          },
          activities: {
            total: activityCount,
            active: activeActivities
          },
          assets: {
            total: assetCount
          }
        },
        userActivity: userActivityData,
        recentLogs: recentLogs.map(log => ({
          id: log._id,
          action: log.action,
          resource: log.resource,
          userId: log.userId,
          createdAt: log.createdAt
        }))
      };
    } catch (error) {
      logger.error(`获取组织仪表盘数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取组织仪表盘数据失败: ${error.message}`);
    }
  }

  /**
   * 获取组织分析数据
   * @param {string} organizationId - 组织ID
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} - 分析数据
   */
  async getAnalyticsData(organizationId, filters = {}) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 设置时间范围
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
      const startDate = filters.startDate 
        ? new Date(filters.startDate) 
        : new Date(endDate.getFullYear(), endDate.getMonth() - 3, endDate.getDate());

      // 获取用户增长数据
      const userGrowthData = await this.getUserGrowthData(organizationId, startDate, endDate);

      // 获取活动参与数据
      const activityParticipationData = await this.getActivityParticipationData(organizationId, startDate, endDate);

      // 获取资产创建数据
      const assetCreationData = await this.getAssetCreationData(organizationId, startDate, endDate);

      // 获取部门活跃度数据
      const departmentActivityData = await this.getDepartmentActivityData(organizationId, startDate, endDate);

      // 构建分析数据
      return {
        timeRange: {
          startDate,
          endDate
        },
        userGrowth: userGrowthData,
        activityParticipation: activityParticipationData,
        assetCreation: assetCreationData,
        departmentActivity: departmentActivityData
      };
    } catch (error) {
      logger.error(`获取组织分析数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取组织分析数据失败: ${error.message}`);
    }
  }

  /**
   * 获取用户活跃度数据
   * @param {string} organizationId - 组织ID
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} - 用户活跃度数据
   */
  async getUserActivityData(organizationId, startDate, endDate) {
    try {
      // 模拟用户活跃度数据
      // 实际实现中，这里应该从用户行为日志或事件记录中获取数据
      const dailyActiveUsers = [];
      const weeklyActiveUsers = [];
      const monthlyActiveUsers = [];

      // 生成日期序列
      const dateRange = this.generateDateRange(startDate, endDate);
      
      // 获取组织用户总数
      const totalUsers = await UserOrganization.countDocuments({
        organizationId,
        status: 'active'
      });

      // 模拟每日活跃用户数据
      dateRange.forEach(date => {
        // 这里使用随机数模拟，实际应从数据库查询
        const dailyActive = Math.floor(totalUsers * (0.1 + Math.random() * 0.3));
        const weeklyActive = Math.floor(totalUsers * (0.3 + Math.random() * 0.4));
        const monthlyActive = Math.floor(totalUsers * (0.6 + Math.random() * 0.3));

        dailyActiveUsers.push({
          date: date.toISOString().split('T')[0],
          count: dailyActive
        });

        // 只在每周的第一天添加周活跃数据
        if (date.getDay() === 1 || dateRange.indexOf(date) === 0) {
          weeklyActiveUsers.push({
            date: date.toISOString().split('T')[0],
            count: weeklyActive
          });
        }

        // 只在每月的第一天添加月活跃数据
        if (date.getDate() === 1 || dateRange.indexOf(date) === 0) {
          monthlyActiveUsers.push({
            date: date.toISOString().split('T')[0],
            count: monthlyActive
          });
        }
      });

      return {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        totalUsers
      };
    } catch (error) {
      logger.error(`获取用户活跃度数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取用户活跃度数据失败: ${error.message}`);
    }
  }

  /**
   * 获取用户增长数据
   * @param {string} organizationId - 组织ID
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} - 用户增长数据
   */
  async getUserGrowthData(organizationId, startDate, endDate) {
    try {
      // 获取时间范围内每天的新用户数量
      const pipeline = [
        {
          $match: {
            organizationId: mongoose.Types.ObjectId(organizationId),
            joinedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$joinedAt' } },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      const dailyNewUsers = await UserOrganization.aggregate(pipeline);

      // 生成日期序列，确保没有数据的日期也有记录
      const dateRange = this.generateDateRange(startDate, endDate);
      const formattedDailyNewUsers = dateRange.map(date => {
        const dateString = date.toISOString().split('T')[0];
        const found = dailyNewUsers.find(item => item._id === dateString);
        return {
          date: dateString,
          count: found ? found.count : 0
        };
      });

      // 计算累计用户数
      let cumulativeUsers = await UserOrganization.countDocuments({
        organizationId,
        joinedAt: { $lt: startDate }
      });

      const cumulativeUserGrowth = formattedDailyNewUsers.map(item => {
        cumulativeUsers += item.count;
        return {
          date: item.date,
          count: cumulativeUsers
        };
      });

      return {
        dailyNewUsers: formattedDailyNewUsers,
        cumulativeUserGrowth
      };
    } catch (error) {
      logger.error(`获取用户增长数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取用户增长数据失败: ${error.message}`);
    }
  }

  /**
   * 获取活动参与数据
   * @param {string} organizationId - 组织ID
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} - 活动参与数据
   */
  async getActivityParticipationData(organizationId, startDate, endDate) {
    try {
      // 模拟活动参与数据
      // 实际实现中，这里应该从活动参与记录中获取数据
      
      // 获取组织活动总数
      const totalActivities = await CultureActivity.countDocuments({
        organizationId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      // 模拟活动类型分布
      const activityTypes = ['workshop', 'exhibition', 'performance', 'lecture', 'other'];
      const activityTypeDistribution = activityTypes.map(type => ({
        type,
        count: Math.floor(Math.random() * totalActivities * 0.5) + 1
      }));

      // 模拟参与人数分布
      const participationDistribution = [
        { range: '1-10', count: Math.floor(Math.random() * totalActivities * 0.3) + 1 },
        { range: '11-50', count: Math.floor(Math.random() * totalActivities * 0.4) + 1 },
        { range: '51-100', count: Math.floor(Math.random() * totalActivities * 0.2) + 1 },
        { range: '101+', count: Math.floor(Math.random() * totalActivities * 0.1) + 1 }
      ];

      // 模拟每月活动数量
      const monthlyActivityCounts = [];
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        monthlyActivityCounts.push({
          date: `${year}-${String(month + 1).padStart(2, '0')}`,
          count: Math.floor(Math.random() * 20) + 5
        });
        
        currentDate = new Date(year, month + 1, 1);
      }

      return {
        totalActivities,
        activityTypeDistribution,
        participationDistribution,
        monthlyActivityCounts
      };
    } catch (error) {
      logger.error(`获取活动参与数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取活动参与数据失败: ${error.message}`);
    }
  }

  /**
   * 获取资产创建数据
   * @param {string} organizationId - 组织ID
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} - 资产创建数据
   */
  async getAssetCreationData(organizationId, startDate, endDate) {
    try {
      // 模拟资产创建数据
      // 实际实现中，这里应该从资产记录中获取数据
      
      // 获取组织资产总数
      const totalAssets = await CultureAsset.countDocuments({
        organizationId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      // 模拟资产类型分布
      const assetTypes = ['image', 'video', 'audio', 'document', 'other'];
      const assetTypeDistribution = assetTypes.map(type => ({
        type,
        count: Math.floor(Math.random() * totalAssets * 0.5) + 1
      }));

      // 模拟每月资产创建数量
      const monthlyAssetCounts = [];
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        monthlyAssetCounts.push({
          date: `${year}-${String(month + 1).padStart(2, '0')}`,
          count: Math.floor(Math.random() * 30) + 10
        });
        
        currentDate = new Date(year, month + 1, 1);
      }

      // 模拟资产创建者分布
      const creatorDistribution = [];
      const departments = await Department.find({ organizationId });
      
      departments.forEach(dept => {
        creatorDistribution.push({
          departmentId: dept._id,
          departmentName: dept.name,
          count: Math.floor(Math.random() * totalAssets * 0.3) + 1
        });
      });

      return {
        totalAssets,
        assetTypeDistribution,
        monthlyAssetCounts,
        creatorDistribution
      };
    } catch (error) {
      logger.error(`获取资产创建数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取资产创建数据失败: ${error.message}`);
    }
  }

  /**
   * 获取部门活跃度数据
   * @param {string} organizationId - 组织ID
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Array>} - 部门活跃度数据
   */
  async getDepartmentActivityData(organizationId, startDate, endDate) {
    try {
      // 获取组织的所有部门
      const departments = await Department.find({ organizationId });
      
      // 模拟部门活跃度数据
      // 实际实现中，这里应该从用户行为日志或事件记录中获取数据
      const departmentActivityData = [];
      
      for (const dept of departments) {
        // 获取部门用户数
        const userCount = await UserOrganization.countDocuments({
          organizationId,
          departmentId: dept._id,
          status: 'active'
        });
        
        // 模拟活跃用户数
        const activeUserCount = Math.floor(userCount * (0.5 + Math.random() * 0.5));
        
        // 模拟活动参与数
        const activityParticipationCount = Math.floor(activeUserCount * (1 + Math.random() * 3));
        
        // 模拟资产创建数
        const assetCreationCount = Math.floor(activeUserCount * (0.5 + Math.random() * 2));
        
        // 计算活跃度得分 (0-100)
        const activityScore = userCount > 0 
          ? Math.min(100, Math.floor((activeUserCount / userCount * 40) + 
                                    (activityParticipationCount / (userCount * 2) * 30) + 
                                    (assetCreationCount / userCount * 30)))
          : 0;
        
        departmentActivityData.push({
          departmentId: dept._id,
          departmentName: dept.name,
          userCount,
          activeUserCount,
          activityParticipationCount,
          assetCreationCount,
          activityScore
        });
      }
      
      // 按活跃度得分排序
      return departmentActivityData.sort((a, b) => b.activityScore - a.activityScore);
    } catch (error) {
      logger.error(`获取部门活跃度数据失败: ${error.message}`, { organizationId });
      throw new Error(`获取部门活跃度数据失败: ${error.message}`);
    }
  }

  /**
   * 获取资源使用统计
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 资源使用统计
   */
  async getResourceUsageStats(organizationId) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 获取存储使用情况
      const storageUsage = await this.getStorageUsage(organizationId);

      // 获取API调用统计
      const apiUsage = await this.getApiUsage(organizationId);

      // 获取区块链资源使用情况
      const blockchainUsage = await this.getBlockchainUsage(organizationId);

      // 构建资源使用统计
      return {
        storage: storageUsage,
        api: apiUsage,
        blockchain: blockchainUsage,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error(`获取资源使用统计失败: ${error.message}`, { organizationId });
      throw new Error(`获取资源使用统计失败: ${error.message}`);
    }
  }

  /**
   * 获取存储使用情况
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 存储使用情况
   */
  async getStorageUsage(organizationId) {
    try {
      // 模拟存储使用情况
      // 实际实现中，这里应该从文件存储系统或数据库中获取数据
      
      // 模拟总存储空间和已使用空间
      const totalStorage = 1024 * 1024 * 1024; // 1TB
      const usedStorage = Math.floor(totalStorage * (0.1 + Math.random() * 0.5));
      
      // 模拟各类型资源占用空间
      const storageByType = [
        { type: 'image', size: Math.floor(usedStorage * 0.4) },
        { type: 'video', size: Math.floor(usedStorage * 0.3) },
        { type: 'audio', size: Math.floor(usedStorage * 0.1) },
        { type: 'document', size: Math.floor(usedStorage * 0.1) },
        { type: 'other', size: Math.floor(usedStorage * 0.1) }
      ];
      
      // 模拟存储使用趋势
      const now = new Date();
      const storageUsageTrend = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 30);
        const historicalUsage = Math.floor(usedStorage * (0.7 + (i / 6) * 0.3));
        
        storageUsageTrend.push({
          date: date.toISOString().split('T')[0],
          size: historicalUsage
        });
      }
      
      return {
        total: totalStorage,
        used: usedStorage,
        available: totalStorage - usedStorage,
        usagePercentage: (usedStorage / totalStorage * 100).toFixed(2),
        byType: storageByType,
        trend: storageUsageTrend
      };
    } catch (error) {
      logger.error(`获取存储使用情况失败: ${error.message}`, { organizationId });
      throw new Error(`获取存储使用情况失败: ${error.message}`);
    }
  }

  /**
   * 获取API调用统计
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - API调用统计
   */
  async getApiUsage(organizationId) {
    try {
      // 模拟API调用统计
      // 实际实现中，这里应该从API网关或日志系统中获取数据
      
      // 模拟API调用总数和限额
      const apiCallLimit = 1000000;
      const apiCallCount = Math.floor(apiCallLimit * (0.1 + Math.random() * 0.6));
      
      // 模拟各端点调用次数
      const endpointUsage = [
        { endpoint: '/api/assets', count: Math.floor(apiCallCount * 0.3) },
        { endpoint: '/api/activities', count: Math.floor(apiCallCount * 0.2) },
        { endpoint: '/api/users', count: Math.floor(apiCallCount * 0.15) },
        { endpoint: '/api/departments', count: Math.floor(apiCallCount * 0.1) },
        { endpoint: '/api/permissions', count: Math.floor(apiCallCount * 0.1) },
        { endpoint: '/api/blockchain', count: Math.floor(apiCallCount * 0.05) },
        { endpoint: '/api/other', count: Math.floor(apiCallCount * 0.1) }
      ];
      
      // 模拟API调用趋势
      const now = new Date();
      const apiCallTrend = [];
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dailyCount = Math.floor((apiCallCount / 30) * (0.5 + Math.random()));
        
        apiCallTrend.push({
          date: date.toISOString().split('T')[0],
          count: dailyCount
        });
      }
      
      return {
        total: apiCallCount,
        limit: apiCallLimit,
        usagePercentage: (apiCallCount / apiCallLimit * 100).toFixed(2),
        byEndpoint: endpointUsage,
        trend: apiCallTrend
      };
    } catch (error) {
      logger.error(`获取API调用统计失败: ${error.message}`, { organizationId });
      throw new Error(`获取API调用统计失败: ${error.message}`);
    }
  }

  /**
   * 获取区块链资源使用情况
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 区块链资源使用情况
   */
  async getBlockchainUsage(organizationId) {
    try {
      // 检查组织是否启用区块链
      const organization = await Organization.findById(organizationId);
      if (!organization || !organization.blockchainAddress) {
        return {
          enabled: false,
          message: '组织未启用区块链'
        };
      }

      // 模拟区块链资源使用情况
      // 实际实现中，这里应该从区块链服务中获取数据
      
      // 模拟交易总数和限额
      const transactionLimit = 10000;
      const transactionCount = Math.floor(transactionLimit * (0.1 + Math.random() * 0.4));
      
      // 模拟各类型交易次数
      const transactionByType = [
        { type: 'asset', count: Math.floor(transactionCount * 0.4) },
        { type: 'permission', count: Math.floor(transactionCount * 0.3) },
        { type: 'activity', count: Math.floor(transactionCount * 0.2) },
        { type: 'other', count: Math.floor(transactionCount * 0.1) }
      ];
      
      // 模拟交易趋势
      const now = new Date();
      const transactionTrend = [];
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dailyCount = Math.floor((transactionCount / 30) * (0.5 + Math.random()));
        
        transactionTrend.push({
          date: date.toISOString().split('T')[0],
          count: dailyCount
        });
      }
      
      // 模拟存储使用情况
      const storageLimit = 1024 * 1024 * 10; // 10MB
      const storageUsed = Math.floor(storageLimit * (0.1 + Math.random() * 0.3));
      
      return {
        enabled: true,
        address: organization.blockchainAddress,
        transactions: {
          total: transactionCount,
          limit: transactionLimit,
          usagePercentage: (transactionCount / transactionLimit * 100).toFixed(2),
          byType: transactionByType,
          trend: transactionTrend
        },
        storage: {
          total: storageLimit,
          used: storageUsed,
          available: storageLimit - storageUsed,
          usagePercentage: (storageUsed / storageLimit * 100).toFixed(2)
        }
      };
    } catch (error) {
      logger.error(`获取区块链资源使用情况失败: ${error.message}`, { organizationId });
      throw new Error(`获取区块链资源使用情况失败: ${error.message}`);
    }
  }

  /**
   * 更新组织设置
   * @param {string} organizationId - 组织ID
   * @param {Object} settings - 设置数据
   * @returns {Promise<Object>} - 更新后的组织
   */
  async updateOrganizationSettings(organizationId, settings) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 更新组织设置
      organization.settings = {
        ...organization.settings,
        ...settings
      };

      // 保存更新
      return await organization.save();
    } catch (error) {
      logger.error(`更新组织设置失败: ${error.message}`, { organizationId });
      throw new Error(`更新组织设置失败: ${error.message}`);
    }
  }

  /**
   * 生成日期范围
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Array<Date>} - 日期范围
   */
  generateDateRange(startDate, endDate) {
    const dateRange = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dateRange;
  }
}

module.exports = new EnterpriseConsole();
