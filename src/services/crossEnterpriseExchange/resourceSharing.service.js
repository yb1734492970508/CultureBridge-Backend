/**
 * 资源共享服务
 * 实现企业间文化资源的安全共享、交易和权限管理
 */

const mongoose = require('mongoose');

/**
 * 资源共享服务类
 */
class ResourceSharingService {
  /**
   * 发布资源
   * @param {Object} resourceData 资源数据
   * @param {String} enterpriseId 企业ID
   * @returns {Promise<Object>} 发布结果
   */
  async publishResource(resourceData, enterpriseId) {
    try {
      // 验证企业存在
      const enterprise = await mongoose.model('Enterprise').findOne({ code: enterpriseId });
      
      if (!enterprise) {
        throw new Error('企业不存在');
      }
      
      // 验证资源数据
      this._validateResourceData(resourceData);
      
      // 生成资源ID
      const resourceId = `resource-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // 准备资源数据
      const resource = {
        resourceId,
        title: resourceData.title,
        description: resourceData.description,
        type: resourceData.type,
        contentUri: resourceData.contentUri,
        thumbnailUri: resourceData.thumbnailUri,
        tags: resourceData.tags || [],
        enterpriseId,
        status: 'active',
        pricing: resourceData.pricing || {
          price: 0,
          currency: 'CNY',
          model: 'free'
        },
        permissions: resourceData.permissions || {
          visibility: 'private',
          accessPolicy: 'manual_approval',
          allowedEnterprises: []
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      // 创建资源
      await mongoose.model('Resource').create(resource);
      
      // 记录资源发布事件
      await this._createResourceEvent(resourceId, 'publish', {
        userId: 'system',
        enterpriseId
      });
      
      // 更新企业统计信息
      await this._updateEnterpriseStatistics(enterpriseId, 'resourcePublished');
      
      return {
        success: true,
        resourceId,
        message: '资源发布成功'
      };
    } catch (error) {
      console.error('发布资源失败:', error);
      return {
        success: false,
        error: error.message || '发布资源时发生未知错误'
      };
    }
  }

  /**
   * 搜索资源
   * @param {Object} query 查询条件
   * @param {String} enterpriseId 企业ID
   * @returns {Promise<Object>} 搜索结果
   */
  async searchResources(query, enterpriseId) {
    try {
      // 验证企业存在
      const enterprise = await mongoose.model('Enterprise').findOne({ code: enterpriseId });
      
      if (!enterprise) {
        throw new Error('企业不存在');
      }
      
      // 构建查询条件
      const searchQuery = {
        status: 'active',
        $or: [
          { 'permissions.visibility': 'public' },
          { 'permissions.allowedEnterprises': enterpriseId },
          { enterpriseId }
        ]
      };
      
      // 添加关键词搜索
      if (query.keyword) {
        searchQuery.$text = { $search: query.keyword };
      }
      
      // 添加类型过滤
      if (query.types && query.types.length > 0) {
        searchQuery.type = { $in: query.types };
      }
      
      // 添加标签过滤
      if (query.tags && query.tags.length > 0) {
        searchQuery.tags = { $in: query.tags };
      }
      
      // 执行搜索
      const resources = await mongoose.model('Resource').find(searchQuery)
        .sort({ 'metadata.createdAt': -1 })
        .limit(query.limit || 20);
      
      // 记录搜索事件
      await this._createResourceEvent('search', 'search', {
        userId: 'system',
        enterpriseId
      }, {
        query,
        resultCount: resources.length
      });
      
      return {
        success: true,
        resources: resources.map(resource => ({
          resourceId: resource.resourceId,
          title: resource.title,
          description: resource.description,
          type: resource.type,
          thumbnailUri: resource.thumbnailUri,
          tags: resource.tags,
          enterpriseId: resource.enterpriseId,
          pricing: resource.pricing,
          permissions: {
            visibility: resource.permissions.visibility
          }
        })),
        total: resources.length
      };
    } catch (error) {
      console.error('搜索资源失败:', error);
      return {
        success: false,
        error: error.message || '搜索资源时发生未知错误'
      };
    }
  }

  /**
   * 请求资源访问
   * @param {String} resourceId 资源ID
   * @param {String} requestingEnterpriseId 请求企业ID
   * @param {Object} requestData 请求数据
   * @returns {Promise<Object>} 请求结果
   */
  async requestResourceAccess(resourceId, requestingEnterpriseId, requestData) {
    try {
      // 验证资源存在
      const resource = await mongoose.model('Resource').findOne({ resourceId });
      
      if (!resource) {
        throw new Error('资源不存在');
      }
      
      // 验证企业存在
      const requestingEnterprise = await mongoose.model('Enterprise').findOne({ code: requestingEnterpriseId });
      
      if (!requestingEnterprise) {
        throw new Error('请求企业不存在');
      }
      
      // 检查是否已有访问权限
      if (resource.permissions.allowedEnterprises.includes(requestingEnterpriseId)) {
        return {
          success: true,
          message: '已有访问权限',
          accessGranted: true
        };
      }
      
      // 检查资源访问策略
      if (resource.permissions.visibility === 'public') {
        // 公开资源，自动授予访问权限
        await mongoose.model('Resource').updateOne(
          { resourceId },
          { $addToSet: { 'permissions.allowedEnterprises': requestingEnterpriseId } }
        );
        
        // 记录访问授权事件
        await this._createResourceEvent(resourceId, 'access_granted', {
          userId: 'system',
          enterpriseId: resource.enterpriseId
        }, {
          requestingEnterpriseId,
          automatic: true
        });
        
        return {
          success: true,
          message: '访问权限已自动授予',
          accessGranted: true
        };
      }
      
      if (resource.permissions.accessPolicy === 'auto_approve') {
        // 自动批准策略，自动授予访问权限
        await mongoose.model('Resource').updateOne(
          { resourceId },
          { $addToSet: { 'permissions.allowedEnterprises': requestingEnterpriseId } }
        );
        
        // 记录访问授权事件
        await this._createResourceEvent(resourceId, 'access_granted', {
          userId: 'system',
          enterpriseId: resource.enterpriseId
        }, {
          requestingEnterpriseId,
          automatic: true
        });
        
        return {
          success: true,
          message: '访问权限已自动授予',
          accessGranted: true
        };
      }
      
      // 手动批准策略，创建访问请求
      const requestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const accessRequest = {
        requestId,
        resourceId,
        requestingEnterpriseId,
        ownerEnterpriseId: resource.enterpriseId,
        purpose: requestData.purpose,
        duration: requestData.duration,
        status: 'pending',
        createdAt: new Date()
      };
      
      // 创建访问请求
      await mongoose.model('ResourceAccessRequest').create(accessRequest);
      
      // 记录访问请求事件
      await this._createResourceEvent(resourceId, 'access_requested', {
        userId: 'system',
        enterpriseId: requestingEnterpriseId
      }, {
        requestId,
        purpose: requestData.purpose
      });
      
      return {
        success: true,
        requestId,
        message: '访问请求已提交，等待审批'
      };
    } catch (error) {
      console.error('请求资源访问失败:', error);
      return {
        success: false,
        error: error.message || '请求资源访问时发生未知错误'
      };
    }
  }

  /**
   * 处理访问请求
   * @param {String} requestId 请求ID
   * @param {Boolean} approved 是否批准
   * @param {String} enterpriseId 企业ID
   * @param {String} comment 评论
   * @returns {Promise<Object>} 处理结果
   */
  async processAccessRequest(requestId, approved, enterpriseId, comment) {
    try {
      // 验证请求存在
      const request = await mongoose.model('ResourceAccessRequest').findOne({ requestId });
      
      if (!request) {
        throw new Error('访问请求不存在');
      }
      
      // 验证处理权限
      if (request.ownerEnterpriseId !== enterpriseId) {
        throw new Error('无权处理此请求');
      }
      
      // 验证请求状态
      if (request.status !== 'pending') {
        throw new Error('请求已处理');
      }
      
      // 更新请求状态
      await mongoose.model('ResourceAccessRequest').updateOne(
        { requestId },
        {
          $set: {
            status: approved ? 'approved' : 'rejected',
            processedAt: new Date(),
            comment
          }
        }
      );
      
      // 如果批准，更新资源权限
      if (approved) {
        await mongoose.model('Resource').updateOne(
          { resourceId: request.resourceId },
          { $addToSet: { 'permissions.allowedEnterprises': request.requestingEnterpriseId } }
        );
        
        // 记录访问授权事件
        await this._createResourceEvent(request.resourceId, 'access_granted', {
          userId: 'system',
          enterpriseId
        }, {
          requestId,
          requestingEnterpriseId: request.requestingEnterpriseId,
          comment
        });
      } else {
        // 记录访问拒绝事件
        await this._createResourceEvent(request.resourceId, 'access_rejected', {
          userId: 'system',
          enterpriseId
        }, {
          requestId,
          requestingEnterpriseId: request.requestingEnterpriseId,
          comment
        });
      }
      
      return {
        success: true,
        message: approved ? '访问请求已批准' : '访问请求已拒绝'
      };
    } catch (error) {
      console.error('处理访问请求失败:', error);
      return {
        success: false,
        error: error.message || '处理访问请求时发生未知错误'
      };
    }
  }

  // 以下是私有辅助方法

  /**
   * 验证资源数据
   * @private
   * @param {Object} resourceData 资源数据
   */
  _validateResourceData(resourceData) {
    if (!resourceData.title) {
      throw new Error('资源标题不能为空');
    }
    
    if (!resourceData.description) {
      throw new Error('资源描述不能为空');
    }
    
    if (!resourceData.type) {
      throw new Error('资源类型不能为空');
    }
    
    if (!resourceData.contentUri) {
      throw new Error('资源内容URI不能为空');
    }
  }

  /**
   * 创建资源事件
   * @private
   * @param {String} resourceId 资源ID
   * @param {String} eventType 事件类型
   * @param {Object} actor 操作者
   * @param {Object} details 事件详情
   * @returns {Promise<void>}
   */
  async _createResourceEvent(resourceId, eventType, actor, details = {}) {
    try {
      const event = {
        resourceId,
        eventType,
        actor,
        details,
        timestamp: new Date()
      };
      
      await mongoose.model('ResourceEvent').create(event);
    } catch (error) {
      console.error('创建资源事件失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 更新企业统计信息
   * @private
   * @param {String} enterpriseId 企业ID
   * @param {String} action 操作类型
   * @returns {Promise<void>}
   */
  async _updateEnterpriseStatistics(enterpriseId, action) {
    try {
      const update = {
        'statistics.lastActivityAt': new Date()
      };
      
      if (action === 'resourcePublished') {
        update['$inc'] = { 'statistics.resourceCount': 1 };
      }
      
      await mongoose.model('Enterprise').updateOne(
        { code: enterpriseId },
        update
      );
    } catch (error) {
      console.error('更新企业统计信息失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }
}

module.exports = ResourceSharingService;
