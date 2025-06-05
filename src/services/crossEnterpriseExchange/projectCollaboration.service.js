/**
 * 跨企业文化项目协作服务
 * 实现跨企业文化项目的协作功能
 */

const mongoose = require('mongoose');

/**
 * 项目协作服务类
 */
class ProjectCollaborationService {
  /**
   * 创建项目
   * @param {Object} projectData 项目数据
   * @param {Object} creator 创建者信息
   * @returns {Promise<Object>} 创建结果
   */
  async createProject(projectData, creator) {
    try {
      // 验证创建者信息
      if (!creator || !creator.userId || !creator.enterpriseId) {
        throw new Error('创建者信息不完整');
      }
      
      // 验证项目数据
      this._validateProjectData(projectData);
      
      // 生成项目ID
      const projectId = `project-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // 准备项目数据
      const project = {
        projectId,
        title: projectData.title,
        description: projectData.description,
        type: projectData.type,
        status: 'planning', // 确保使用有效的枚举值
        timeline: {
          startDate: projectData.timeline?.startDate || new Date(),
          endDate: projectData.timeline?.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 默认90天后结束
          milestones: projectData.timeline?.milestones || []
        },
        ownerEnterpriseId: creator.enterpriseId,
        participatingEnterprises: [
          {
            enterpriseId: creator.enterpriseId,
            joinDate: new Date(),
            role: 'collaborator'
          }
        ],
        resources: projectData.resources || [],
        tags: projectData.tags || [],
        statistics: {
          taskCount: 0,
          completedTaskCount: 0,
          memberCount: 1, // 创建者算一个成员
          resourceCount: projectData.resources ? projectData.resources.length : 0,
          lastActivityAt: new Date()
        },
        metadata: {
          createdBy: creator.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      // 创建项目
      const createdProject = await mongoose.model('Project').create(project);
      
      // 记录项目创建事件
      await this._createProjectEvent(projectId, 'create', {
        userId: creator.userId,
        enterpriseId: creator.enterpriseId
      });
      
      // 更新企业统计信息
      await this._updateEnterpriseStatistics(creator.enterpriseId, 'projectCreated');
      
      return {
        success: true,
        projectId,
        message: '项目创建成功'
      };
    } catch (error) {
      console.error('创建项目失败:', error);
      return {
        success: false,
        error: error.message || '创建项目时发生未知错误'
      };
    }
  }

  /**
   * 添加项目成员
   * @param {String} projectId 项目ID
   * @param {Object} memberData 成员数据
   * @param {String} operatorId 操作者ID
   * @returns {Promise<Object>} 添加结果
   */
  async addProjectMember(projectId, memberData, operatorId) {
    try {
      // 验证项目存在
      const project = await mongoose.model('Project').findOne({ projectId });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      // 验证操作权限
      const isOwner = project.ownerEnterpriseId === memberData.enterpriseId;
      const isParticipant = project.participatingEnterprises.some(
        p => p.enterpriseId === memberData.enterpriseId
      );
      
      if (!isOwner && !isParticipant) {
        // 如果企业不是项目参与方，先添加企业
        project.participatingEnterprises.push({
          enterpriseId: memberData.enterpriseId,
          joinDate: new Date(),
          role: 'collaborator'
        });
      }
      
      // 准备成员数据
      const member = {
        projectId,
        userId: memberData.userId,
        enterpriseId: memberData.enterpriseId,
        name: memberData.name,
        role: memberData.role || 'member',
        joinDate: new Date(),
        status: 'active'
      };
      
      // 创建成员
      await mongoose.model('ProjectMember').create(member);
      
      // 更新项目统计信息
      project.statistics.memberCount += 1;
      project.statistics.lastActivityAt = new Date();
      await project.save();
      
      // 记录成员添加事件
      await this._createProjectEvent(projectId, 'member_add', {
        userId: operatorId,
        targetUserId: memberData.userId
      });
      
      return {
        success: true,
        message: '项目成员添加成功'
      };
    } catch (error) {
      console.error('添加项目成员失败:', error);
      return {
        success: false,
        error: error.message || '添加项目成员时发生未知错误'
      };
    }
  }

  /**
   * 创建任务
   * @param {String} projectId 项目ID
   * @param {Object} taskData 任务数据
   * @param {Object} creator 创建者信息
   * @returns {Promise<Object>} 创建结果
   */
  async createTask(projectId, taskData, creator) {
    try {
      // 验证项目存在
      const project = await mongoose.model('Project').findOne({ projectId });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      // 验证创建者是否为项目成员
      const isMember = await mongoose.model('ProjectMember').exists({
        projectId,
        userId: creator.userId
      });
      
      if (!isMember) {
        throw new Error('只有项目成员才能创建任务');
      }
      
      // 生成任务ID
      const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // 准备任务数据
      const task = {
        taskId,
        projectId,
        title: taskData.title,
        description: taskData.description,
        type: taskData.type || 'general',
        priority: taskData.priority || 'medium',
        status: 'pending',
        progress: 0,
        tags: taskData.tags || [],
        assignees: taskData.assignees || [],
        timeline: {
          createdAt: new Date(),
          dueDate: taskData.dueDate || null
        },
        metadata: {
          createdBy: creator.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      // 创建任务
      await mongoose.model('Task').create(task);
      
      // 更新项目统计信息
      project.statistics.taskCount += 1;
      project.statistics.lastActivityAt = new Date();
      await project.save();
      
      // 记录任务创建事件
      await this._createTaskEvent(taskId, 'create', {
        userId: creator.userId,
        enterpriseId: creator.enterpriseId
      });
      
      return {
        success: true,
        taskId,
        message: '任务创建成功'
      };
    } catch (error) {
      console.error('创建任务失败:', error);
      return {
        success: false,
        error: error.message || '创建任务时发生未知错误'
      };
    }
  }

  /**
   * 更新任务状态
   * @param {String} taskId 任务ID
   * @param {Object} updateData 更新数据
   * @param {Object} operator 操作者信息
   * @returns {Promise<Object>} 更新结果
   */
  async updateTaskStatus(taskId, updateData, operator) {
    try {
      // 验证任务存在
      const task = await mongoose.model('Task').findOne({ taskId });
      
      if (!task) {
        throw new Error('任务不存在');
      }
      
      // 验证操作者是否为项目成员
      const isMember = await mongoose.model('ProjectMember').exists({
        projectId: task.projectId,
        userId: operator.userId
      });
      
      if (!isMember) {
        throw new Error('只有项目成员才能更新任务状态');
      }
      
      // 准备更新数据
      const update = {
        status: updateData.status,
        progress: updateData.progress,
        'metadata.updatedAt': new Date()
      };
      
      // 更新任务
      await mongoose.model('Task').updateOne(
        { taskId },
        { $set: update }
      );
      
      // 如果任务完成，更新项目统计信息
      if (updateData.status === 'completed' && task.status !== 'completed') {
        const project = await mongoose.model('Project').findOne({ projectId: task.projectId });
        
        if (project) {
          project.statistics.completedTaskCount += 1;
          project.statistics.lastActivityAt = new Date();
          await project.save();
        }
      }
      
      // 记录任务状态更新事件
      await this._createTaskEvent(taskId, 'status_update', {
        userId: operator.userId,
        enterpriseId: operator.enterpriseId
      }, {
        oldStatus: task.status,
        newStatus: updateData.status,
        comment: updateData.comment
      });
      
      return {
        success: true,
        message: '任务状态更新成功'
      };
    } catch (error) {
      console.error('更新任务状态失败:', error);
      return {
        success: false,
        error: error.message || '更新任务状态时发生未知错误'
      };
    }
  }

  /**
   * 添加项目资源
   * @param {String} projectId 项目ID
   * @param {Object} resourceData 资源数据
   * @param {Object} operator 操作者信息
   * @returns {Promise<Object>} 添加结果
   */
  async addProjectResource(projectId, resourceData, operator) {
    try {
      // 验证项目存在
      const project = await mongoose.model('Project').findOne({ projectId });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      // 验证操作者是否为项目成员
      const isMember = await mongoose.model('ProjectMember').exists({
        projectId,
        userId: operator.userId
      });
      
      if (!isMember) {
        throw new Error('只有项目成员才能添加资源');
      }
      
      // 验证资源存在
      const resource = await mongoose.model('Resource').findOne({ resourceId: resourceData.resourceId });
      
      if (!resource) {
        throw new Error('资源不存在');
      }
      
      // 验证资源是否已添加
      const resourceExists = project.resources.some(r => r.resourceId === resourceData.resourceId);
      
      if (resourceExists) {
        throw new Error('资源已添加到项目');
      }
      
      // 添加资源
      project.resources.push({
        resourceId: resourceData.resourceId,
        addedAt: new Date(),
        addedBy: operator.userId,
        usage: resourceData.usage || 'reference'
      });
      
      // 更新项目统计信息
      project.statistics.resourceCount += 1;
      project.statistics.lastActivityAt = new Date();
      
      await project.save();
      
      // 记录资源添加事件
      await this._createProjectEvent(projectId, 'resource_add', {
        userId: operator.userId,
        enterpriseId: operator.enterpriseId
      }, {
        resourceId: resourceData.resourceId,
        resourceTitle: resource.title
      });
      
      return {
        success: true,
        message: '项目资源添加成功'
      };
    } catch (error) {
      console.error('添加项目资源失败:', error);
      return {
        success: false,
        error: error.message || '添加项目资源时发生未知错误'
      };
    }
  }

  /**
   * 获取项目详情
   * @param {String} projectId 项目ID
   * @param {String} userId 用户ID
   * @returns {Promise<Object>} 项目详情
   */
  async getProjectDetails(projectId, userId) {
    try {
      // 验证项目存在
      const project = await mongoose.model('Project').findOne({ projectId });
      
      if (!project) {
        throw new Error('项目不存在');
      }
      
      // 验证用户是否有权限查看项目
      const isMember = await mongoose.model('ProjectMember').exists({
        projectId,
        userId
      });
      
      if (!isMember) {
        throw new Error('无权查看项目详情');
      }
      
      // 获取项目成员
      const members = await mongoose.model('ProjectMember').find({ projectId });
      
      // 获取项目任务
      const tasks = await mongoose.model('Task').find({ projectId });
      
      // 获取项目资源
      const resourceIds = project.resources.map(r => r.resourceId);
      const resources = await mongoose.model('Resource').find({
        resourceId: { $in: resourceIds }
      });
      
      // 构建项目详情
      const projectDetails = {
        projectId: project.projectId,
        title: project.title,
        description: project.description,
        type: project.type,
        status: project.status,
        timeline: project.timeline,
        ownerEnterpriseId: project.ownerEnterpriseId,
        participatingEnterprises: project.participatingEnterprises,
        tags: project.tags,
        statistics: project.statistics,
        members: members.map(member => ({
          userId: member.userId,
          enterpriseId: member.enterpriseId,
          name: member.name,
          role: member.role,
          joinDate: member.joinDate
        })),
        tasks: tasks.map(task => ({
          taskId: task.taskId,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          status: task.status,
          progress: task.progress,
          assignees: task.assignees,
          timeline: task.timeline
        })),
        resources: resources.map(resource => ({
          resourceId: resource.resourceId,
          title: resource.title,
          description: resource.description,
          type: resource.type,
          thumbnailUri: resource.thumbnailUri,
          addedAt: project.resources.find(r => r.resourceId === resource.resourceId).addedAt,
          addedBy: project.resources.find(r => r.resourceId === resource.resourceId).addedBy,
          usage: project.resources.find(r => r.resourceId === resource.resourceId).usage
        })),
        metadata: project.metadata
      };
      
      return {
        success: true,
        project: projectDetails
      };
    } catch (error) {
      console.error('获取项目详情失败:', error);
      return {
        success: false,
        error: error.message || '获取项目详情时发生未知错误'
      };
    }
  }

  // 以下是私有辅助方法

  /**
   * 验证项目数据
   * @private
   * @param {Object} projectData 项目数据
   */
  _validateProjectData(projectData) {
    if (!projectData.title) {
      throw new Error('项目标题不能为空');
    }
    
    if (!projectData.description) {
      throw new Error('项目描述不能为空');
    }
    
    if (!projectData.type) {
      throw new Error('项目类型不能为空');
    }
    
    // 验证项目类型
    const validTypes = ['cultural_exchange', 'collaborative_creation', 'research', 'exhibition', 'education', 'preservation', 'other'];
    if (!validTypes.includes(projectData.type)) {
      throw new Error(`项目类型无效，有效类型: ${validTypes.join(', ')}`);
    }
  }

  /**
   * 创建项目事件
   * @private
   * @param {String} projectId 项目ID
   * @param {String} eventType 事件类型
   * @param {Object} actor 操作者
   * @param {Object} details 事件详情
   * @returns {Promise<void>}
   */
  async _createProjectEvent(projectId, eventType, actor, details = {}) {
    try {
      const event = {
        projectId,
        eventType,
        actor,
        details,
        timestamp: new Date()
      };
      
      console.log(`项目事件: ${eventType}, 项目ID: ${projectId}, 操作者: ${actor.userId}`);
      
      // 在实际实现中，这里会创建事件记录
      // await mongoose.model('ProjectEvent').create(event);
    } catch (error) {
      console.error('创建项目事件失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 创建任务事件
   * @private
   * @param {String} taskId 任务ID
   * @param {String} eventType 事件类型
   * @param {Object} actor 操作者
   * @param {Object} details 事件详情
   * @returns {Promise<void>}
   */
  async _createTaskEvent(taskId, eventType, actor, details = {}) {
    try {
      const event = {
        taskId,
        eventType,
        actor,
        details,
        timestamp: new Date()
      };
      
      console.log(`任务事件: ${eventType}, 任务ID: ${taskId}, 操作者: ${actor.userId}`);
      
      // 在实际实现中，这里会创建事件记录
      // await mongoose.model('TaskEvent').create(event);
    } catch (error) {
      console.error('创建任务事件失败:', error);
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
      console.log(`更新企业统计: ${enterpriseId}, 操作: ${action}`);
      
      // 在实际实现中，这里会更新企业统计信息
      // await mongoose.model('Enterprise').updateOne(
      //   { code: enterpriseId },
      //   { $inc: { 'statistics.projectCount': 1 } }
      // );
    } catch (error) {
      console.error('更新企业统计信息失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }
}

module.exports = ProjectCollaborationService;
