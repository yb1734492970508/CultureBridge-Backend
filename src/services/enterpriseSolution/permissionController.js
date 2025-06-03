/**
 * 权限控制系统
 * 实现基于角色的权限分配、自定义权限模板、权限继承与覆盖机制以及权限审计与日志功能
 */

const mongoose = require('mongoose');
const { Permission, PermissionTemplate, PermissionLog } = require('../../models/permission.model');
const { Organization, Role, UserOrganization } = require('../../models/organization.model');
const { User } = require('../../models/user.model');
const blockchainService = require('../../blockchain/token.service');
const logger = require('../../utils/logger');

/**
 * 权限控制服务
 */
class PermissionController {
  /**
   * 创建权限
   * @param {Object} permissionData - 权限数据
   * @returns {Promise<Object>} - 创建的权限
   */
  async createPermission(permissionData) {
    try {
      // 检查权限代码是否已存在
      const existingPermission = await Permission.findOne({
        code: permissionData.code,
        organizationId: permissionData.organizationId
      });

      if (existingPermission) {
        throw new Error('权限代码已存在');
      }

      // 创建权限记录
      const permission = new Permission({
        code: permissionData.code,
        name: permissionData.name,
        description: permissionData.description,
        module: permissionData.module,
        type: permissionData.type,
        isSystem: permissionData.isSystem || false,
        organizationId: permissionData.organizationId
      });

      // 保存权限记录
      const savedPermission = await permission.save();

      // 记录权限创建日志
      await this.logPermissionAction({
        organizationId: permissionData.organizationId,
        userId: permissionData.userId,
        action: 'create',
        resource: 'permission',
        resourceId: savedPermission._id,
        details: {
          code: permissionData.code,
          name: permissionData.name
        }
      });

      return savedPermission;
    } catch (error) {
      logger.error(`创建权限失败: ${error.message}`);
      throw new Error(`创建权限失败: ${error.message}`);
    }
  }

  /**
   * 获取权限详情
   * @param {string} permissionId - 权限ID
   * @returns {Promise<Object>} - 权限详情
   */
  async getPermission(permissionId) {
    try {
      const permission = await Permission.findById(permissionId);
      if (!permission) {
        throw new Error('权限不存在');
      }
      return permission;
    } catch (error) {
      logger.error(`获取权限详情失败: ${error.message}`, { permissionId });
      throw new Error(`获取权限详情失败: ${error.message}`);
    }
  }

  /**
   * 更新权限信息
   * @param {string} permissionId - 权限ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} - 更新后的权限
   */
  async updatePermission(permissionId, updateData) {
    try {
      const permission = await Permission.findById(permissionId);
      if (!permission) {
        throw new Error('权限不存在');
      }

      // 系统权限只能更新描述
      if (permission.isSystem) {
        if (updateData.description !== undefined) {
          permission.description = updateData.description;
        }
      } else {
        // 非系统权限可以更新所有字段
        const allowedFields = ['name', 'description', 'module', 'type'];
        
        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            permission[field] = updateData[field];
          }
        });
      }

      // 保存更新
      const updatedPermission = await permission.save();

      // 记录权限更新日志
      if (updateData.userId) {
        await this.logPermissionAction({
          organizationId: permission.organizationId,
          userId: updateData.userId,
          action: 'update',
          resource: 'permission',
          resourceId: permissionId,
          details: {
            code: permission.code,
            name: permission.name,
            changes: Object.keys(updateData).filter(key => key !== 'userId')
          }
        });
      }

      return updatedPermission;
    } catch (error) {
      logger.error(`更新权限失败: ${error.message}`, { permissionId });
      throw new Error(`更新权限失败: ${error.message}`);
    }
  }

  /**
   * 删除权限
   * @param {string} permissionId - 权限ID
   * @param {string} userId - 操作用户ID
   * @returns {Promise<boolean>} - 删除结果
   */
  async deletePermission(permissionId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 检查权限是否存在
      const permission = await Permission.findById(permissionId);
      if (!permission) {
        throw new Error('权限不存在');
      }

      // 系统权限不能删除
      if (permission.isSystem) {
        throw new Error('系统权限不能删除');
      }

      // 检查是否有角色使用此权限
      const rolesWithPermission = await Role.find({
        permissions: permissionId
      });

      if (rolesWithPermission.length > 0) {
        throw new Error('无法删除已分配给角色的权限');
      }

      // 检查是否有权限模板使用此权限
      const templatesWithPermission = await PermissionTemplate.find({
        permissions: permissionId
      });

      if (templatesWithPermission.length > 0) {
        throw new Error('无法删除已包含在权限模板中的权限');
      }

      // 删除权限
      await Permission.findByIdAndDelete(permissionId, { session });

      // 记录权限删除日志
      await this.logPermissionAction({
        organizationId: permission.organizationId,
        userId,
        action: 'delete',
        resource: 'permission',
        resourceId: permissionId,
        details: {
          code: permission.code,
          name: permission.name
        }
      }, { session });

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`删除权限失败: ${error.message}`, { permissionId });
      throw new Error(`删除权限失败: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * 获取组织的权限列表
   * @param {string} organizationId - 组织ID
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} - 权限列表
   */
  async getPermissions(organizationId, filters = {}) {
    try {
      // 构建查询条件
      const query = { organizationId };
      
      if (filters.module) {
        query.module = filters.module;
      }
      
      if (filters.type) {
        query.type = filters.type;
      }
      
      if (filters.isSystem !== undefined) {
        query.isSystem = filters.isSystem;
      }

      return await Permission.find(query).sort({ module: 1, code: 1 });
    } catch (error) {
      logger.error(`获取权限列表失败: ${error.message}`, { organizationId });
      throw new Error(`获取权限列表失败: ${error.message}`);
    }
  }

  /**
   * 创建权限模板
   * @param {Object} templateData - 模板数据
   * @returns {Promise<Object>} - 创建的模板
   */
  async createPermissionTemplate(templateData) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(templateData.organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 创建模板记录
      const template = new PermissionTemplate({
        organizationId: templateData.organizationId,
        name: templateData.name,
        description: templateData.description,
        permissions: templateData.permissions || [],
        isDefault: templateData.isDefault || false
      });

      // 如果设置为默认模板，取消其他默认模板
      if (template.isDefault) {
        await PermissionTemplate.updateMany(
          { organizationId: templateData.organizationId, isDefault: true },
          { isDefault: false }
        );
      }

      // 保存模板记录
      const savedTemplate = await template.save();

      // 记录模板创建日志
      if (templateData.userId) {
        await this.logPermissionAction({
          organizationId: templateData.organizationId,
          userId: templateData.userId,
          action: 'create',
          resource: 'permission_template',
          resourceId: savedTemplate._id,
          details: {
            name: templateData.name,
            permissionCount: templateData.permissions ? templateData.permissions.length : 0
          }
        });
      }

      return savedTemplate;
    } catch (error) {
      logger.error(`创建权限模板失败: ${error.message}`);
      throw new Error(`创建权限模板失败: ${error.message}`);
    }
  }

  /**
   * 获取权限模板详情
   * @param {string} templateId - 模板ID
   * @returns {Promise<Object>} - 模板详情
   */
  async getPermissionTemplate(templateId) {
    try {
      const template = await PermissionTemplate.findById(templateId);
      if (!template) {
        throw new Error('权限模板不存在');
      }
      return template;
    } catch (error) {
      logger.error(`获取权限模板详情失败: ${error.message}`, { templateId });
      throw new Error(`获取权限模板详情失败: ${error.message}`);
    }
  }

  /**
   * 更新权限模板
   * @param {string} templateId - 模板ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} - 更新后的模板
   */
  async updatePermissionTemplate(templateId, updateData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const template = await PermissionTemplate.findById(templateId).session(session);
      if (!template) {
        throw new Error('权限模板不存在');
      }

      // 更新模板字段
      const allowedFields = ['name', 'description', 'permissions', 'isDefault'];
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          template[field] = updateData[field];
        }
      });

      // 如果设置为默认模板，取消其他默认模板
      if (updateData.isDefault === true) {
        await PermissionTemplate.updateMany(
          { 
            organizationId: template.organizationId, 
            isDefault: true,
            _id: { $ne: templateId }
          },
          { isDefault: false }
        ).session(session);
      }

      // 保存更新
      const updatedTemplate = await template.save({ session });

      // 记录模板更新日志
      if (updateData.userId) {
        await this.logPermissionAction({
          organizationId: template.organizationId,
          userId: updateData.userId,
          action: 'update',
          resource: 'permission_template',
          resourceId: templateId,
          details: {
            name: template.name,
            changes: Object.keys(updateData).filter(key => key !== 'userId')
          }
        }, { session });
      }

      await session.commitTransaction();
      return updatedTemplate;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`更新权限模板失败: ${error.message}`, { templateId });
      throw new Error(`更新权限模板失败: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * 删除权限模板
   * @param {string} templateId - 模板ID
   * @param {string} userId - 操作用户ID
   * @returns {Promise<boolean>} - 删除结果
   */
  async deletePermissionTemplate(templateId, userId) {
    try {
      // 检查模板是否存在
      const template = await PermissionTemplate.findById(templateId);
      if (!template) {
        throw new Error('权限模板不存在');
      }

      // 删除模板
      await PermissionTemplate.findByIdAndDelete(templateId);

      // 记录模板删除日志
      await this.logPermissionAction({
        organizationId: template.organizationId,
        userId,
        action: 'delete',
        resource: 'permission_template',
        resourceId: templateId,
        details: {
          name: template.name
        }
      });

      return true;
    } catch (error) {
      logger.error(`删除权限模板失败: ${error.message}`, { templateId });
      throw new Error(`删除权限模板失败: ${error.message}`);
    }
  }

  /**
   * 获取组织的权限模板列表
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Array>} - 模板列表
   */
  async getPermissionTemplates(organizationId) {
    try {
      return await PermissionTemplate.find({ organizationId }).sort({ isDefault: -1, name: 1 });
    } catch (error) {
      logger.error(`获取权限模板列表失败: ${error.message}`, { organizationId });
      throw new Error(`获取权限模板列表失败: ${error.message}`);
    }
  }

  /**
   * 应用权限模板到角色
   * @param {string} templateId - 模板ID
   * @param {string} roleId - 角色ID
   * @param {string} userId - 操作用户ID
   * @returns {Promise<Object>} - 更新后的角色
   */
  async applyTemplateToRole(templateId, roleId, userId) {
    try {
      // 检查模板是否存在
      const template = await PermissionTemplate.findById(templateId);
      if (!template) {
        throw new Error('权限模板不存在');
      }

      // 检查角色是否存在
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('角色不存在');
      }

      // 检查组织是否匹配
      if (template.organizationId.toString() !== role.organizationId.toString()) {
        throw new Error('权限模板与角色不属于同一组织');
      }

      // 更新角色权限
      role.permissions = template.permissions;
      const updatedRole = await role.save();

      // 记录应用模板日志
      await this.logPermissionAction({
        organizationId: role.organizationId,
        userId,
        action: 'apply_template',
        resource: 'role',
        resourceId: roleId,
        details: {
          templateId,
          templateName: template.name,
          roleName: role.name
        }
      });

      return updatedRole;
    } catch (error) {
      logger.error(`应用权限模板到角色失败: ${error.message}`, { templateId, roleId });
      throw new Error(`应用权限模板到角色失败: ${error.message}`);
    }
  }

  /**
   * 检查用户是否有指定权限
   * @param {string} userId - 用户ID
   * @param {string} organizationId - 组织ID
   * @param {string} permissionCode - 权限代码
   * @returns {Promise<boolean>} - 是否有权限
   */
  async checkUserPermission(userId, organizationId, permissionCode) {
    try {
      // 查找用户组织关系
      const userOrg = await UserOrganization.findOne({
        userId,
        organizationId,
        status: 'active'
      });

      if (!userOrg) {
        return false;
      }

      // 如果是管理员，直接返回true
      if (userOrg.isAdmin) {
        return true;
      }

      // 查找权限
      const permission = await Permission.findOne({
        organizationId,
        code: permissionCode
      });

      if (!permission) {
        return false;
      }

      // 查找用户角色
      const roles = await Role.find({
        _id: { $in: userOrg.roleIds }
      });

      // 检查角色是否包含该权限
      for (const role of roles) {
        if (role.permissions.includes(permission._id.toString())) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error(`检查用户权限失败: ${error.message}`, { userId, organizationId, permissionCode });
      throw new Error(`检查用户权限失败: ${error.message}`);
    }
  }

  /**
   * 获取用户在组织中的所有权限
   * @param {string} userId - 用户ID
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Array>} - 权限列表
   */
  async getUserPermissions(userId, organizationId) {
    try {
      // 查找用户组织关系
      const userOrg = await UserOrganization.findOne({
        userId,
        organizationId,
        status: 'active'
      });

      if (!userOrg) {
        return [];
      }

      // 如果是管理员，返回所有权限
      if (userOrg.isAdmin) {
        return await Permission.find({ organizationId });
      }

      // 查找用户角色
      const roles = await Role.find({
        _id: { $in: userOrg.roleIds }
      });

      // 收集所有权限ID
      const permissionIds = new Set();
      roles.forEach(role => {
        role.permissions.forEach(permId => {
          permissionIds.add(permId.toString());
        });
      });

      // 查找权限详情
      return await Permission.find({
        _id: { $in: Array.from(permissionIds) }
      });
    } catch (error) {
      logger.error(`获取用户权限失败: ${error.message}`, { userId, organizationId });
      throw new Error(`获取用户权限失败: ${error.message}`);
    }
  }

  /**
   * 记录权限操作日志
   * @param {Object} logData - 日志数据
   * @param {Object} options - 选项
   * @returns {Promise<Object>} - 创建的日志
   */
  async logPermissionAction(logData, options = {}) {
    try {
      // 创建日志记录
      const log = new PermissionLog({
        organizationId: logData.organizationId,
        userId: logData.userId,
        action: logData.action,
        resource: logData.resource,
        resourceId: logData.resourceId,
        details: logData.details,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent
      });

      // 保存日志记录
      if (options.session) {
        return await log.save({ session: options.session });
      } else {
        return await log.save();
      }
    } catch (error) {
      logger.error(`记录权限操作日志失败: ${error.message}`);
      // 不抛出异常，避免影响主要业务流程
      return null;
    }
  }

  /**
   * 获取权限操作日志
   * @param {string} organizationId - 组织ID
   * @param {Object} filters - 过滤条件
   * @param {Object} pagination - 分页参数
   * @returns {Promise<Object>} - 日志列表和分页信息
   */
  async getPermissionLogs(organizationId, filters = {}, pagination = {}) {
    try {
      // 构建查询条件
      const query = { organizationId };
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.action) {
        query.action = filters.action;
      }
      
      if (filters.resource) {
        query.resource = filters.resource;
      }
      
      if (filters.resourceId) {
        query.resourceId = filters.resourceId;
      }
      
      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      } else if (filters.startDate) {
        query.createdAt = { $gte: new Date(filters.startDate) };
      } else if (filters.endDate) {
        query.createdAt = { $lte: new Date(filters.endDate) };
      }

      // 设置分页参数
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const skip = (page - 1) * limit;

      // 查询日志
      const logs = await PermissionLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // 查询总数
      const total = await PermissionLog.countDocuments(query);

      // 查询用户信息
      const userIds = [...new Set(logs.map(log => log.userId))];
      const users = await User.find({ _id: { $in: userIds } });
      const userMap = {};
      users.forEach(user => {
        userMap[user._id.toString()] = {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName
        };
      });

      // 构建结果
      const results = logs.map(log => ({
        id: log._id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: log.details,
        user: userMap[log.userId.toString()] || { id: log.userId },
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt
      }));

      return {
        logs: results,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`获取权限操作日志失败: ${error.message}`, { organizationId });
      throw new Error(`获取权限操作日志失败: ${error.message}`);
    }
  }

  /**
   * 在区块链上记录关键权限操作
   * @param {Object} operationData - 操作数据
   * @returns {Promise<string>} - 交易哈希
   */
  async recordPermissionOperationOnChain(operationData) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(operationData.organizationId);
      if (!organization || !organization.blockchainAddress) {
        throw new Error('组织不存在或未启用区块链');
      }

      // 构建链上记录数据
      const recordData = {
        organizationId: operationData.organizationId,
        userId: operationData.userId,
        action: operationData.action,
        resource: operationData.resource,
        resourceId: operationData.resourceId,
        timestamp: new Date().getTime(),
        hash: this.generateOperationHash(operationData)
      };

      // 调用区块链服务记录操作
      const txHash = await blockchainService.recordPermissionOperation(
        recordData,
        organization.blockchainAddress
      );

      return txHash;
    } catch (error) {
      logger.error(`区块链记录权限操作失败: ${error.message}`);
      // 不抛出异常，避免影响主要业务流程
      return null;
    }
  }

  /**
   * 生成操作哈希
   * @param {Object} operationData - 操作数据
   * @returns {string} - 操作哈希
   */
  generateOperationHash(operationData) {
    const crypto = require('crypto');
    const data = JSON.stringify({
      organizationId: operationData.organizationId,
      userId: operationData.userId,
      action: operationData.action,
      resource: operationData.resource,
      resourceId: operationData.resourceId,
      timestamp: new Date().getTime()
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

module.exports = new PermissionController();
