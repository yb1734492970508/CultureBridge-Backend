/**
 * 组织架构管理服务
 * 负责企业组织结构的定义、管理和维护，支持多层级部门结构、角色与职位管理、组织关系可视化和批量用户导入与同步
 */

const mongoose = require('mongoose');
const { Organization, Department, Role, UserOrganization } = require('../../models/organization.model');
const { Permission, PermissionTemplate, PermissionLog } = require('../../models/permission.model');
const { User } = require('../../models/user.model');
const blockchainService = require('../../blockchain/token.service');
const logger = require('../../utils/logger');

/**
 * 组织管理服务
 */
class OrganizationManager {
  /**
   * 创建新组织
   * @param {Object} organizationData - 组织数据
   * @returns {Promise<Object>} - 创建的组织
   */
  async createOrganization(organizationData) {
    try {
      // 创建组织记录
      const organization = new Organization({
        name: organizationData.name,
        description: organizationData.description,
        logo: organizationData.logo,
        industry: organizationData.industry,
        size: organizationData.size,
        country: organizationData.country,
        address: organizationData.address,
        contactEmail: organizationData.contactEmail,
        contactPhone: organizationData.contactPhone,
        website: organizationData.website,
        settings: organizationData.settings || {}
      });

      // 保存组织记录
      const savedOrganization = await organization.save();

      // 创建默认部门
      const rootDepartment = new Department({
        organizationId: savedOrganization._id,
        name: '总部',
        description: '组织总部',
        level: 0,
        path: '/'
      });
      await rootDepartment.save();

      // 创建默认角色
      const adminRole = new Role({
        organizationId: savedOrganization._id,
        name: '管理员',
        description: '组织管理员',
        isSystem: true
      });
      const memberRole = new Role({
        organizationId: savedOrganization._id,
        name: '成员',
        description: '组织成员',
        isSystem: true
      });
      await adminRole.save();
      await memberRole.save();

      // 如果提供了区块链集成，则在区块链上注册组织
      if (organizationData.enableBlockchain) {
        try {
          const blockchainAddress = await blockchainService.registerOrganizationOnChain(
            savedOrganization._id.toString(),
            organizationData.name
          );
          
          // 更新组织记录，添加区块链地址
          savedOrganization.blockchainAddress = blockchainAddress;
          await savedOrganization.save();
        } catch (error) {
          logger.error(`区块链注册组织失败: ${error.message}`, { 
            organizationId: savedOrganization._id 
          });
          // 继续处理，不中断流程
        }
      }

      return savedOrganization;
    } catch (error) {
      logger.error(`创建组织失败: ${error.message}`);
      throw new Error(`创建组织失败: ${error.message}`);
    }
  }

  /**
   * 获取组织详情
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 组织详情
   */
  async getOrganization(organizationId) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }
      return organization;
    } catch (error) {
      logger.error(`获取组织详情失败: ${error.message}`, { organizationId });
      throw new Error(`获取组织详情失败: ${error.message}`);
    }
  }

  /**
   * 更新组织信息
   * @param {string} organizationId - 组织ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} - 更新后的组织
   */
  async updateOrganization(organizationId, updateData) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 更新组织字段
      const allowedFields = [
        'name', 'description', 'logo', 'industry', 'size', 
        'country', 'address', 'contactEmail', 'contactPhone', 
        'website', 'settings'
      ];
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          organization[field] = updateData[field];
        }
      });

      // 保存更新
      const updatedOrganization = await organization.save();

      // 如果组织名称更改且有区块链地址，则更新链上信息
      if (updateData.name && organization.blockchainAddress) {
        try {
          await blockchainService.updateOrganizationOnChain(
            organizationId,
            updateData.name,
            organization.blockchainAddress
          );
        } catch (error) {
          logger.error(`区块链更新组织失败: ${error.message}`, { 
            organizationId 
          });
          // 继续处理，不中断流程
        }
      }

      return updatedOrganization;
    } catch (error) {
      logger.error(`更新组织失败: ${error.message}`, { organizationId });
      throw new Error(`更新组织失败: ${error.message}`);
    }
  }

  /**
   * 删除组织
   * @param {string} organizationId - 组织ID
   * @returns {Promise<boolean>} - 删除结果
   */
  async deleteOrganization(organizationId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 删除组织相关的所有数据
      await Department.deleteMany({ organizationId }, { session });
      await Role.deleteMany({ organizationId }, { session });
      await UserOrganization.deleteMany({ organizationId }, { session });
      await Permission.deleteMany({ organizationId }, { session });
      await PermissionTemplate.deleteMany({ organizationId }, { session });
      await PermissionLog.deleteMany({ organizationId }, { session });
      
      // 删除组织本身
      await Organization.findByIdAndDelete(organizationId, { session });

      // 如果有区块链地址，则在区块链上标记组织为已删除
      if (organization.blockchainAddress) {
        try {
          await blockchainService.deactivateOrganizationOnChain(
            organizationId,
            organization.blockchainAddress
          );
        } catch (error) {
          logger.error(`区块链删除组织失败: ${error.message}`, { 
            organizationId 
          });
          // 继续处理，不中断流程
        }
      }

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`删除组织失败: ${error.message}`, { organizationId });
      throw new Error(`删除组织失败: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * 创建部门
   * @param {string} organizationId - 组织ID
   * @param {Object} departmentData - 部门数据
   * @returns {Promise<Object>} - 创建的部门
   */
  async createDepartment(organizationId, departmentData) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 如果指定了父部门，检查父部门是否存在
      let parentPath = '/';
      let level = 0;
      
      if (departmentData.parentId) {
        const parentDepartment = await Department.findOne({
          _id: departmentData.parentId,
          organizationId
        });
        
        if (!parentDepartment) {
          throw new Error('父部门不存在');
        }
        
        parentPath = parentDepartment.path;
        level = parentDepartment.level + 1;
      }

      // 创建部门路径
      const departmentId = new mongoose.Types.ObjectId();
      const path = `${parentPath}${departmentId}/`;

      // 创建部门记录
      const department = new Department({
        _id: departmentId,
        organizationId,
        name: departmentData.name,
        description: departmentData.description,
        parentId: departmentData.parentId,
        level,
        path,
        managerId: departmentData.managerId
      });

      // 保存部门记录
      return await department.save();
    } catch (error) {
      logger.error(`创建部门失败: ${error.message}`, { organizationId });
      throw new Error(`创建部门失败: ${error.message}`);
    }
  }

  /**
   * 获取部门详情
   * @param {string} departmentId - 部门ID
   * @returns {Promise<Object>} - 部门详情
   */
  async getDepartment(departmentId) {
    try {
      const department = await Department.findById(departmentId);
      if (!department) {
        throw new Error('部门不存在');
      }
      return department;
    } catch (error) {
      logger.error(`获取部门详情失败: ${error.message}`, { departmentId });
      throw new Error(`获取部门详情失败: ${error.message}`);
    }
  }

  /**
   * 更新部门信息
   * @param {string} departmentId - 部门ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} - 更新后的部门
   */
  async updateDepartment(departmentId, updateData) {
    try {
      const department = await Department.findById(departmentId);
      if (!department) {
        throw new Error('部门不存在');
      }

      // 更新部门字段
      const allowedFields = ['name', 'description', 'managerId'];
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          department[field] = updateData[field];
        }
      });

      // 保存更新
      return await department.save();
    } catch (error) {
      logger.error(`更新部门失败: ${error.message}`, { departmentId });
      throw new Error(`更新部门失败: ${error.message}`);
    }
  }

  /**
   * 删除部门
   * @param {string} departmentId - 部门ID
   * @returns {Promise<boolean>} - 删除结果
   */
  async deleteDepartment(departmentId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 检查部门是否存在
      const department = await Department.findById(departmentId);
      if (!department) {
        throw new Error('部门不存在');
      }

      // 检查是否有子部门
      const childDepartments = await Department.find({
        path: { $regex: `${department.path}` },
        _id: { $ne: departmentId }
      });

      if (childDepartments.length > 0) {
        throw new Error('无法删除含有子部门的部门');
      }

      // 检查是否有用户关联到此部门
      const userCount = await UserOrganization.countDocuments({
        departmentId
      });

      if (userCount > 0) {
        throw new Error('无法删除含有用户的部门');
      }

      // 删除部门
      await Department.findByIdAndDelete(departmentId, { session });

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`删除部门失败: ${error.message}`, { departmentId });
      throw new Error(`删除部门失败: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * 获取组织的部门列表
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Array>} - 部门列表
   */
  async getDepartments(organizationId) {
    try {
      return await Department.find({ organizationId }).sort({ level: 1, name: 1 });
    } catch (error) {
      logger.error(`获取部门列表失败: ${error.message}`, { organizationId });
      throw new Error(`获取部门列表失败: ${error.message}`);
    }
  }

  /**
   * 获取部门树结构
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Array>} - 部门树结构
   */
  async getDepartmentTree(organizationId) {
    try {
      const departments = await Department.find({ organizationId }).sort({ level: 1, name: 1 });
      
      // 构建部门树
      const departmentMap = {};
      const rootDepartments = [];

      // 首先将所有部门放入映射
      departments.forEach(dept => {
        departmentMap[dept._id] = {
          ...dept.toObject(),
          children: []
        };
      });

      // 然后构建树结构
      departments.forEach(dept => {
        if (dept.parentId && departmentMap[dept.parentId]) {
          departmentMap[dept.parentId].children.push(departmentMap[dept._id]);
        } else {
          rootDepartments.push(departmentMap[dept._id]);
        }
      });

      return rootDepartments;
    } catch (error) {
      logger.error(`获取部门树失败: ${error.message}`, { organizationId });
      throw new Error(`获取部门树失败: ${error.message}`);
    }
  }

  /**
   * 创建角色
   * @param {string} organizationId - 组织ID
   * @param {Object} roleData - 角色数据
   * @returns {Promise<Object>} - 创建的角色
   */
  async createRole(organizationId, roleData) {
    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 创建角色记录
      const role = new Role({
        organizationId,
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem || false,
        permissions: roleData.permissions || []
      });

      // 保存角色记录
      return await role.save();
    } catch (error) {
      logger.error(`创建角色失败: ${error.message}`, { organizationId });
      throw new Error(`创建角色失败: ${error.message}`);
    }
  }

  /**
   * 获取角色详情
   * @param {string} roleId - 角色ID
   * @returns {Promise<Object>} - 角色详情
   */
  async getRole(roleId) {
    try {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('角色不存在');
      }
      return role;
    } catch (error) {
      logger.error(`获取角色详情失败: ${error.message}`, { roleId });
      throw new Error(`获取角色详情失败: ${error.message}`);
    }
  }

  /**
   * 更新角色信息
   * @param {string} roleId - 角色ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} - 更新后的角色
   */
  async updateRole(roleId, updateData) {
    try {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('角色不存在');
      }

      // 系统角色只能更新描述和权限
      if (role.isSystem) {
        if (updateData.description !== undefined) {
          role.description = updateData.description;
        }
        if (updateData.permissions !== undefined) {
          role.permissions = updateData.permissions;
        }
      } else {
        // 非系统角色可以更新所有字段
        const allowedFields = ['name', 'description', 'permissions'];
        
        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            role[field] = updateData[field];
          }
        });
      }

      // 保存更新
      return await role.save();
    } catch (error) {
      logger.error(`更新角色失败: ${error.message}`, { roleId });
      throw new Error(`更新角色失败: ${error.message}`);
    }
  }

  /**
   * 删除角色
   * @param {string} roleId - 角色ID
   * @returns {Promise<boolean>} - 删除结果
   */
  async deleteRole(roleId) {
    try {
      // 检查角色是否存在
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('角色不存在');
      }

      // 系统角色不能删除
      if (role.isSystem) {
        throw new Error('系统角色不能删除');
      }

      // 检查是否有用户关联到此角色
      const userCount = await UserOrganization.countDocuments({
        roleIds: roleId
      });

      if (userCount > 0) {
        throw new Error('无法删除已分配给用户的角色');
      }

      // 删除角色
      await Role.findByIdAndDelete(roleId);
      return true;
    } catch (error) {
      logger.error(`删除角色失败: ${error.message}`, { roleId });
      throw new Error(`删除角色失败: ${error.message}`);
    }
  }

  /**
   * 获取组织的角色列表
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Array>} - 角色列表
   */
  async getRoles(organizationId) {
    try {
      return await Role.find({ organizationId }).sort({ isSystem: -1, name: 1 });
    } catch (error) {
      logger.error(`获取角色列表失败: ${error.message}`, { organizationId });
      throw new Error(`获取角色列表失败: ${error.message}`);
    }
  }

  /**
   * 批量导入用户到组织
   * @param {string} organizationId - 组织ID
   * @param {Array} users - 用户数据数组
   * @returns {Promise<Object>} - 导入结果
   */
  async importUsers(organizationId, users) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 检查组织是否存在
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('组织不存在');
      }

      // 获取默认成员角色
      const memberRole = await Role.findOne({
        organizationId,
        name: '成员',
        isSystem: true
      });

      if (!memberRole) {
        throw new Error('默认成员角色不存在');
      }

      // 获取默认部门
      const rootDepartment = await Department.findOne({
        organizationId,
        level: 0
      });

      if (!rootDepartment) {
        throw new Error('默认部门不存在');
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // 处理每个用户
      for (const userData of users) {
        try {
          // 检查用户是否已存在
          let user = await User.findOne({ email: userData.email });
          
          // 如果用户不存在，创建新用户
          if (!user) {
            user = new User({
              email: userData.email,
              username: userData.username || userData.email.split('@')[0],
              fullName: userData.fullName || '',
              password: userData.password || Math.random().toString(36).slice(-8),
              isActive: true
            });
            await user.save({ session });
          }

          // 检查用户是否已在组织中
          const existingUserOrg = await UserOrganization.findOne({
            userId: user._id,
            organizationId
          });

          if (existingUserOrg) {
            results.failed++;
            results.errors.push({
              email: userData.email,
              error: '用户已在组织中'
            });
            continue;
          }

          // 创建用户组织关系
          const userOrg = new UserOrganization({
            userId: user._id,
            organizationId,
            departmentId: userData.departmentId || rootDepartment._id,
            roleIds: userData.roleIds || [memberRole._id],
            position: userData.position || '成员',
            isAdmin: userData.isAdmin || false,
            joinedAt: new Date(),
            status: 'active'
          });

          await userOrg.save({ session });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            email: userData.email,
            error: error.message
          });
        }
      }

      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`批量导入用户失败: ${error.message}`, { organizationId });
      throw new Error(`批量导入用户失败: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * 获取组织的用户列表
   * @param {string} organizationId - 组织ID
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} - 用户列表
   */
  async getOrganizationUsers(organizationId, filters = {}) {
    try {
      // 构建查询条件
      const query = { organizationId };
      
      if (filters.departmentId) {
        query.departmentId = filters.departmentId;
      }
      
      if (filters.roleId) {
        query.roleIds = filters.roleId;
      }
      
      if (filters.status) {
        query.status = filters.status;
      }

      // 查询用户组织关系
      const userOrgs = await UserOrganization.find(query);
      
      // 获取用户ID列表
      const userIds = userOrgs.map(userOrg => userOrg.userId);
      
      // 查询用户详情
      const users = await User.find({ _id: { $in: userIds } });
      
      // 构建用户映射
      const userMap = {};
      users.forEach(user => {
        userMap[user._id.toString()] = user;
      });
      
      // 获取部门映射
      const departments = await Department.find({ organizationId });
      const departmentMap = {};
      departments.forEach(dept => {
        departmentMap[dept._id.toString()] = dept;
      });
      
      // 获取角色映射
      const roles = await Role.find({ organizationId });
      const roleMap = {};
      roles.forEach(role => {
        roleMap[role._id.toString()] = role;
      });
      
      // 构建结果
      return userOrgs.map(userOrg => {
        const user = userMap[userOrg.userId.toString()];
        const department = departmentMap[userOrg.departmentId.toString()];
        const userRoles = userOrg.roleIds.map(roleId => roleMap[roleId.toString()]).filter(Boolean);
        
        return {
          userId: user._id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          department: department ? {
            id: department._id,
            name: department.name
          } : null,
          roles: userRoles.map(role => ({
            id: role._id,
            name: role.name
          })),
          position: userOrg.position,
          isAdmin: userOrg.isAdmin,
          joinedAt: userOrg.joinedAt,
          status: userOrg.status
        };
      });
    } catch (error) {
      logger.error(`获取组织用户列表失败: ${error.message}`, { organizationId });
      throw new Error(`获取组织用户列表失败: ${error.message}`);
    }
  }

  /**
   * 更新用户在组织中的信息
   * @param {string} organizationId - 组织ID
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} - 更新后的用户组织关系
   */
  async updateOrganizationUser(organizationId, userId, updateData) {
    try {
      // 查找用户组织关系
      const userOrg = await UserOrganization.findOne({
        organizationId,
        userId
      });

      if (!userOrg) {
        throw new Error('用户不在组织中');
      }

      // 更新字段
      const allowedFields = ['departmentId', 'roleIds', 'position', 'isAdmin', 'status'];
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          userOrg[field] = updateData[field];
        }
      });

      // 保存更新
      return await userOrg.save();
    } catch (error) {
      logger.error(`更新组织用户失败: ${error.message}`, { organizationId, userId });
      throw new Error(`更新组织用户失败: ${error.message}`);
    }
  }

  /**
   * 从组织中移除用户
   * @param {string} organizationId - 组织ID
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} - 移除结果
   */
  async removeUserFromOrganization(organizationId, userId) {
    try {
      // 查找用户组织关系
      const userOrg = await UserOrganization.findOne({
        organizationId,
        userId
      });

      if (!userOrg) {
        throw new Error('用户不在组织中');
      }

      // 删除用户组织关系
      await UserOrganization.findByIdAndDelete(userOrg._id);
      return true;
    } catch (error) {
      logger.error(`从组织移除用户失败: ${error.message}`, { organizationId, userId });
      throw new Error(`从组织移除用户失败: ${error.message}`);
    }
  }
}

module.exports = new OrganizationManager();
