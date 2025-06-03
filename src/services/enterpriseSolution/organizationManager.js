/**
 * 企业组织架构管理模块
 * 
 * 该模块实现了企业组织架构的创建、管理和查询功能，包括：
 * - 多层级部门结构管理
 * - 角色与职位管理
 * - 组织关系可视化支持
 * - 批量用户导入与同步
 * 
 * @module services/enterpriseSolution/organizationManager
 */

const mongoose = require("mongoose");
const Organization = require("../../models/organization.model");
const Department = require("../../models/department.model");
const Role = require("../../models/role.model");
const Position = require("../../models/position.model");
const User = require("../../models/user.model");
const logger = require("../../utils/logger");

// 企业组织架构管理配置
const ORGANIZATION_MANAGER_CONFIG = {
  maxDepth: 10, // 最大部门层级深度
  defaultRoles: ["Admin", "Manager", "Employee"], // 默认角色
  defaultPositions: ["CEO", "Director", "Team Lead", "Member"], // 默认职位
  maxUsersPerDepartment: 1000, // 单个部门最大用户数
  maxRolesPerOrg: 100, // 单个组织最大角色数
  maxPositionsPerOrg: 200, // 单个组织最大职位数
};

/**
 * 企业组织架构管理器
 * 管理企业组织架构相关功能
 */
class OrganizationManager {
  constructor() {
    logger.info("企业组织架构管理器已初始化");
  }

  /**
   * 创建新的企业组织
   * @param {Object} orgData - 企业组织数据
   * @param {string} creatorId - 创建者ID
   * @returns {Promise<Object>} 创建结果
   */
  async createOrganization(orgData, creatorId) {
    try {
      // 验证组织数据
      this.validateOrganizationData(orgData);

      // 检查是否存在同名组织
      const existingOrg = await Organization.findOne({ name: orgData.name });
      if (existingOrg) {
        throw new Error(`已存在同名企业组织: ${orgData.name}`);
      }

      // 获取创建者
      const creator = await User.findById(creatorId);
      if (!creator) {
        throw new Error(`创建者不存在: ${creatorId}`);
      }

      // 创建企业组织记录
      const organization = new Organization({
        name: orgData.name,
        description: orgData.description || "",
        industry: orgData.industry || "",
        size: orgData.size || "",
        website: orgData.website || "",
        address: orgData.address || {},
        createdBy: creatorId,
        admins: [creatorId], // 默认创建者为管理员
        status: "active",
      });

      // 保存企业组织记录
      await organization.save();

      // 创建根部门
      const rootDepartment = await this.createDepartment(
        {
          name: organization.name, // 根部门名称与组织同名
          description: "Root department",
          organizationId: organization._id,
          isRoot: true,
        },
        creatorId
      );

      // 更新组织的根部门ID
      organization.rootDepartment = rootDepartment.departmentId;
      await organization.save();

      // 创建默认角色
      await this.createDefaultRoles(organization._id, creatorId);

      // 创建默认职位
      await this.createDefaultPositions(organization._id, creatorId);

      logger.info(`企业组织创建成功: ${organization._id}`);
      return {
        success: true,
        organizationId: organization._id,
        organization,
        rootDepartmentId: rootDepartment.departmentId,
      };
    } catch (error) {
      logger.error(`创建企业组织失败: ${error.message}`);
      throw new Error(`创建企业组织失败: ${error.message}`);
    }
  }

  /**
   * 验证企业组织数据
   * @param {Object} orgData - 企业组织数据
   */
  validateOrganizationData(orgData) {
    if (!orgData.name) {
      throw new Error("企业组织名称不能为空");
    }
    // 可添加更多验证规则，如行业、规模等
  }

  /**
   * 创建部门
   * @param {Object} deptData - 部门数据
   * @param {string} creatorId - 创建者ID
   * @returns {Promise<Object>} 创建结果
   */
  async createDepartment(deptData, creatorId) {
    try {
      // 验证部门数据
      this.validateDepartmentData(deptData);

      // 获取所属组织
      const organization = await Organization.findById(deptData.organizationId);
      if (!organization) {
        throw new Error(`所属组织不存在: ${deptData.organizationId}`);
      }

      // 检查权限（只有组织管理员或上级部门管理员可创建）
      await this.checkAdminPermission(organization, creatorId);

      // 检查父部门是否存在（如果不是根部门）
      let parentDepartment = null;
      if (deptData.parentId && !deptData.isRoot) {
        parentDepartment = await Department.findById(deptData.parentId);
        if (!parentDepartment) {
          throw new Error(`父部门不存在: ${deptData.parentId}`);
        }
        // 检查部门层级深度
        const depth = await this.getDepartmentDepth(parentDepartment);
        if (depth >= ORGANIZATION_MANAGER_CONFIG.maxDepth) {
          throw new Error("部门层级深度超过限制");
        }
      }

      // 检查同级部门名称是否重复
      const existingDept = await Department.findOne({
        organizationId: deptData.organizationId,
        parentId: deptData.parentId || null,
        name: deptData.name,
      });
      if (existingDept) {
        throw new Error(`同级部门下已存在同名部门: ${deptData.name}`);
      }

      // 创建部门记录
      const department = new Department({
        name: deptData.name,
        description: deptData.description || "",
        organizationId: deptData.organizationId,
        parentId: deptData.parentId || null,
        manager: deptData.manager || null,
        members: deptData.members || [],
        createdBy: creatorId,
        status: "active",
      });

      // 保存部门记录
      await department.save();

      logger.info(`部门创建成功: ${department._id}`);
      return {
        success: true,
        departmentId: department._id,
        department,
      };
    } catch (error) {
      logger.error(`创建部门失败: ${error.message}`);
      throw new Error(`创建部门失败: ${error.message}`);
    }
  }

  /**
   * 验证部门数据
   * @param {Object} deptData - 部门数据
   */
  validateDepartmentData(deptData) {
    if (!deptData.name) {
      throw new Error("部门名称不能为空");
    }
    if (!deptData.organizationId) {
      throw new Error("必须指定所属组织ID");
    }
    // 根部门不能有父部门ID
    if (deptData.isRoot && deptData.parentId) {
        throw new Error("根部门不能有父部门");
    }
    // 非根部门必须有父部门ID，除非它是第一级部门
    // if (!deptData.isRoot && !deptData.parentId) {
    //     // 允许创建第一级部门，其parentId为null
    // }
  }

  /**
   * 获取部门层级深度
   * @param {Object} department - 部门对象
   * @returns {Promise<number>} 深度
   */
  async getDepartmentDepth(department) {
    let depth = 1;
    let current = department;
    while (current.parentId) {
      current = await Department.findById(current.parentId);
      if (!current) break; // 防止死循环
      depth++;
      if (depth > ORGANIZATION_MANAGER_CONFIG.maxDepth + 5) { // 增加安全检查
          logger.warn(`部门层级深度计算可能存在循环引用: ${department._id}`);
          break;
      }
    }
    return depth;
  }

  /**
   * 创建角色
   * @param {Object} roleData - 角色数据
   * @param {string} creatorId - 创建者ID
   * @returns {Promise<Object>} 创建结果
   */
  async createRole(roleData, creatorId) {
    try {
      // 验证角色数据
      this.validateRoleData(roleData);

      // 获取所属组织
      const organization = await Organization.findById(roleData.organizationId);
      if (!organization) {
        throw new Error(`所属组织不存在: ${roleData.organizationId}`);
      }

      // 检查权限
      await this.checkAdminPermission(organization, creatorId);

      // 检查角色数量限制
      const roleCount = await Role.countDocuments({ organizationId: roleData.organizationId });
      if (roleCount >= ORGANIZATION_MANAGER_CONFIG.maxRolesPerOrg) {
        throw new Error("组织角色数量已达上限");
      }

      // 检查同名角色是否存在
      const existingRole = await Role.findOne({
        organizationId: roleData.organizationId,
        name: roleData.name,
      });
      if (existingRole) {
        throw new Error(`组织内已存在同名角色: ${roleData.name}`);
      }

      // 创建角色记录
      const role = new Role({
        name: roleData.name,
        description: roleData.description || "",
        organizationId: roleData.organizationId,
        permissions: roleData.permissions || [],
        createdBy: creatorId,
        isDefault: false, // 自定义创建的角色不是默认角色
      });

      // 保存角色记录
      await role.save();

      logger.info(`角色创建成功: ${role._id}`);
      return {
        success: true,
        roleId: role._id,
        role,
      };
    } catch (error) {
      logger.error(`创建角色失败: ${error.message}`);
      throw new Error(`创建角色失败: ${error.message}`);
    }
  }

  /**
   * 验证角色数据
   * @param {Object} roleData - 角色数据
   */
  validateRoleData(roleData) {
    if (!roleData.name) {
      throw new Error("角色名称不能为空");
    }
    if (!roleData.organizationId) {
      throw new Error("必须指定所属组织ID");
    }
    if (roleData.permissions && !Array.isArray(roleData.permissions)) {
      throw new Error("权限必须是数组格式");
    }
  }

  /**
   * 创建职位
   * @param {Object} positionData - 职位数据
   * @param {string} creatorId - 创建者ID
   * @returns {Promise<Object>} 创建结果
   */
  async createPosition(positionData, creatorId) {
    try {
      // 验证职位数据
      this.validatePositionData(positionData);

      // 获取所属组织
      const organization = await Organization.findById(positionData.organizationId);
      if (!organization) {
        throw new Error(`所属组织不存在: ${positionData.organizationId}`);
      }

      // 检查权限
      await this.checkAdminPermission(organization, creatorId);

      // 检查职位数量限制
      const positionCount = await Position.countDocuments({ organizationId: positionData.organizationId });
      if (positionCount >= ORGANIZATION_MANAGER_CONFIG.maxPositionsPerOrg) {
        throw new Error("组织职位数量已达上限");
      }

      // 检查同名职位是否存在
      const existingPosition = await Position.findOne({
        organizationId: positionData.organizationId,
        title: positionData.title,
      });
      if (existingPosition) {
        throw new Error(`组织内已存在同名职位: ${positionData.title}`);
      }

      // 创建职位记录
      const position = new Position({
        title: positionData.title,
        description: positionData.description || "",
        organizationId: positionData.organizationId,
        departmentId: positionData.departmentId || null,
        responsibilities: positionData.responsibilities || [],
        requiredSkills: positionData.requiredSkills || [],
        createdBy: creatorId,
        isDefault: false,
      });

      // 保存职位记录
      await position.save();

      logger.info(`职位创建成功: ${position._id}`);
      return {
        success: true,
        positionId: position._id,
        position,
      };
    } catch (error) {
      logger.error(`创建职位失败: ${error.message}`);
      throw new Error(`创建职位失败: ${error.message}`);
    }
  }

  /**
   * 验证职位数据
   * @param {Object} positionData - 职位数据
   */
  validatePositionData(positionData) {
    if (!positionData.title) {
      throw new Error("职位名称不能为空");
    }
    if (!positionData.organizationId) {
      throw new Error("必须指定所属组织ID");
    }
    // 可选：检查departmentId是否存在
  }

  /**
   * 创建默认角色
   * @param {string} organizationId - 组织ID
   * @param {string} creatorId - 创建者ID
   */
  async createDefaultRoles(organizationId, creatorId) {
    const defaultRoles = ORGANIZATION_MANAGER_CONFIG.defaultRoles;
    for (const roleName of defaultRoles) {
      try {
        await this.createRole(
          {
            name: roleName,
            description: `Default ${roleName} role`,
            organizationId,
            permissions: this.getDefaultPermissionsForRole(roleName), // 获取角色的默认权限
            isDefault: true,
          },
          creatorId
        );
      } catch (error) {
        // 如果角色已存在或其他错误，记录日志但继续
        logger.warn(`创建默认角色 ${roleName} 失败: ${error.message}`);
      }
    }
  }

  /**
   * 创建默认职位
   * @param {string} organizationId - 组织ID
   * @param {string} creatorId - 创建者ID
   */
  async createDefaultPositions(organizationId, creatorId) {
    const defaultPositions = ORGANIZATION_MANAGER_CONFIG.defaultPositions;
    for (const positionTitle of defaultPositions) {
      try {
        await this.createPosition(
          {
            title: positionTitle,
            description: `Default ${positionTitle} position`,
            organizationId,
            isDefault: true,
          },
          creatorId
        );
      } catch (error) {
        logger.warn(`创建默认职位 ${positionTitle} 失败: ${error.message}`);
      }
    }
  }

  /**
   * 获取角色的默认权限（示例）
   * @param {string} roleName - 角色名称
   * @returns {Array<string>} 权限列表
   */
  getDefaultPermissionsForRole(roleName) {
    // 这里应根据实际权限系统定义返回权限列表
    switch (roleName) {
      case "Admin":
        return ["manage_organization", "manage_users", "manage_departments", "manage_roles", "manage_positions", "view_all_content"];
      case "Manager":
        return ["manage_department_members", "view_department_content", "assign_tasks"];
      case "Employee":
        return ["view_content", "create_content", "collaborate"];
      default:
        return [];
    }
  }

  /**
   * 将用户添加到部门
   * @param {string} departmentId - 部门ID
   * @param {string} userId - 用户ID
   * @param {string} adderId - 添加操作者ID
   * @returns {Promise<Object>} 添加结果
   */
  async addUserToDepartment(departmentId, userId, adderId) {
    try {
      const department = await Department.findById(departmentId);
      if (!department) {
        throw new Error(`部门不存在: ${departmentId}`);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      // 检查权限（部门经理或组织管理员）
      await this.checkDepartmentManagerPermission(department, adderId);

      // 检查部门成员数量限制
      if (department.members.length >= ORGANIZATION_MANAGER_CONFIG.maxUsersPerDepartment) {
        throw new Error("部门成员数量已达上限");
      }

      // 检查用户是否已在该部门
      if (department.members.includes(userId)) {
        throw new Error(`用户 ${userId} 已在该部门 ${departmentId}`);
      }

      // 添加用户到部门成员列表
      department.members.push(userId);
      await department.save();

      // 可选：更新用户的部门信息
      // user.department = departmentId;
      // await user.save();

      logger.info(`用户 ${userId} 已添加到部门 ${departmentId}`);
      return { success: true, departmentId, userId };
    } catch (error) {
      logger.error(`将用户添加到部门失败: ${error.message}`);
      throw new Error(`将用户添加到部门失败: ${error.message}`);
    }
  }

  /**
   * 从部门移除用户
   * @param {string} departmentId - 部门ID
   * @param {string} userId - 用户ID
   * @param {string} removerId - 移除操作者ID
   * @returns {Promise<Object>} 移除结果
   */
  async removeUserFromDepartment(departmentId, userId, removerId) {
    try {
      const department = await Department.findById(departmentId);
      if (!department) {
        throw new Error(`部门不存在: ${departmentId}`);
      }

      // 检查权限（部门经理或组织管理员）
      await this.checkDepartmentManagerPermission(department, removerId);

      // 检查用户是否在该部门
      const userIndex = department.members.indexOf(userId);
      if (userIndex === -1) {
        throw new Error(`用户 ${userId} 不在该部门 ${departmentId}`);
      }

      // 从成员列表中移除用户
      department.members.splice(userIndex, 1);
      await department.save();

      // 可选：清除用户的部门信息
      // const user = await User.findById(userId);
      // if (user && user.department === departmentId) {
      //   user.department = null;
      //   await user.save();
      // }

      logger.info(`用户 ${userId} 已从部门 ${departmentId} 移除`);
      return { success: true, departmentId, userId };
    } catch (error) {
      logger.error(`从部门移除用户失败: ${error.message}`);
      throw new Error(`从部门移除用户失败: ${error.message}`);
    }
  }

  /**
   * 分配角色给用户
   * @param {string} organizationId - 组织ID
   * @param {string} userId - 用户ID
   * @param {string} roleId - 角色ID
   * @param {string} assignerId - 分配者ID
   * @returns {Promise<Object>} 分配结果
   */
  async assignRoleToUser(organizationId, userId, roleId, assignerId) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error(`组织不存在: ${organizationId}`);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      const role = await Role.findById(roleId);
      if (!role || role.organizationId.toString() !== organizationId) {
        throw new Error(`角色不存在或不属于该组织: ${roleId}`);
      }

      // 检查权限（组织管理员）
      await this.checkAdminPermission(organization, assignerId);

      // 检查用户是否已有该角色
      if (user.roles && user.roles.includes(roleId)) {
        throw new Error(`用户 ${userId} 已拥有角色 ${roleId}`);
      }

      // 添加角色到用户的角色列表
      if (!user.roles) {
        user.roles = [];
      }
      user.roles.push(roleId);
      await user.save();

      logger.info(`角色 ${roleId} 已分配给用户 ${userId}`);
      return { success: true, userId, roleId };
    } catch (error) {
      logger.error(`分配角色给用户失败: ${error.message}`);
      throw new Error(`分配角色给用户失败: ${error.message}`);
    }
  }

  /**
   * 撤销用户角色
   * @param {string} organizationId - 组织ID
   * @param {string} userId - 用户ID
   * @param {string} roleId - 角色ID
   * @param {string} revokerId - 撤销者ID
   * @returns {Promise<Object>} 撤销结果
   */
  async revokeRoleFromUser(organizationId, userId, roleId, revokerId) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error(`组织不存在: ${organizationId}`);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      // 检查权限（组织管理员）
      await this.checkAdminPermission(organization, revokerId);

      // 检查用户是否拥有该角色
      const roleIndex = user.roles ? user.roles.indexOf(roleId) : -1;
      if (roleIndex === -1) {
        throw new Error(`用户 ${userId} 没有角色 ${roleId}`);
      }

      // 从用户角色列表中移除角色
      user.roles.splice(roleIndex, 1);
      await user.save();

      logger.info(`用户 ${userId} 的角色 ${roleId} 已被撤销`);
      return { success: true, userId, roleId };
    } catch (error) {
      logger.error(`撤销用户角色失败: ${error.message}`);
      throw new Error(`撤销用户角色失败: ${error.message}`);
    }
  }

  /**
   * 分配职位给用户
   * @param {string} organizationId - 组织ID
   * @param {string} userId - 用户ID
   * @param {string} positionId - 职位ID
   * @param {string} assignerId - 分配者ID
   * @returns {Promise<Object>} 分配结果
   */
  async assignPositionToUser(organizationId, userId, positionId, assignerId) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error(`组织不存在: ${organizationId}`);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      const position = await Position.findById(positionId);
      if (!position || position.organizationId.toString() !== organizationId) {
        throw new Error(`职位不存在或不属于该组织: ${positionId}`);
      }

      // 检查权限（组织管理员或部门经理）
      // 这里简化为组织管理员权限
      await this.checkAdminPermission(organization, assignerId);

      // 更新用户的职位信息
      user.position = positionId;
      await user.save();

      logger.info(`职位 ${positionId} 已分配给用户 ${userId}`);
      return { success: true, userId, positionId };
    } catch (error) {
      logger.error(`分配职位给用户失败: ${error.message}`);
      throw new Error(`分配职位给用户失败: ${error.message}`);
    }
  }

  /**
   * 获取组织架构树
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} 组织架构树
   */
  async getOrganizationTree(organizationId) {
    try {
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error(`组织不存在: ${organizationId}`);
      }

      // 获取所有部门
      const departments = await Department.find({ organizationId }).lean(); // 使用 lean() 提高性能
      if (!departments || departments.length === 0) {
        return { id: organization._id, name: organization.name, children: [] };
      }

      // 构建部门映射表
      const departmentMap = departments.reduce((map, dept) => {
        map[dept._id.toString()] = { ...dept, children: [] };
        return map;
      }, {});

      // 构建树结构
      let root = null;
      departments.forEach(dept => {
        const deptNode = departmentMap[dept._id.toString()];
        if (dept.parentId) {
          const parentNode = departmentMap[dept.parentId.toString()];
          if (parentNode) {
            parentNode.children.push(deptNode);
          } else {
            // 如果父节点未找到（数据不一致），将其视为顶级节点
            if (!root) root = { id: organization._id, name: organization.name, children: [] };
            root.children.push(deptNode);
            logger.warn(`部门 ${dept._id} 的父部门 ${dept.parentId} 未找到`);
          }
        } else {
          // 根部门或顶级部门
          if (!root) root = { id: organization._id, name: organization.name, children: [] };
          root.children.push(deptNode);
        }
      });

      // 如果没有找到根部门，创建一个虚拟根节点
      if (!root) {
          root = { id: organization._id, name: organization.name, children: Object.values(departmentMap).filter(d => !d.parentId) };
      }

      // 可选：填充部门成员信息
      // await this.populateDepartmentMembers(root);

      return root;
    } catch (error) {
      logger.error(`获取组织架构树失败: ${error.message}`);
      throw new Error(`获取组织架构树失败: ${error.message}`);
    }
  }

  // --- 权限检查辅助函数 ---

  /**
   * 检查用户是否为组织管理员
   * @param {Object} organization - 组织对象
   * @param {string} userId - 用户ID
   */
  async checkAdminPermission(organization, userId) {
    if (!organization.admins || !organization.admins.map(id => id.toString()).includes(userId.toString())) {
      // 进一步检查用户是否具有全局管理员角色
      const user = await User.findById(userId);
      if (!user || !user.roles || !user.roles.includes("admin")) { // 假设全局管理员角色名为 'admin'
          throw new Error(`用户 ${userId} 没有足够的管理员权限`);
      }
    }
  }

  /**
   * 检查用户是否为部门经理或组织管理员
   * @param {Object} department - 部门对象
   * @param {string} userId - 用户ID
   */
  async checkDepartmentManagerPermission(department, userId) {
    let hasPermission = false;
    // 检查是否为部门经理
    if (department.manager && department.manager.toString() === userId.toString()) {
      hasPermission = true;
    }
    // 检查是否为组织管理员
    if (!hasPermission) {
      const organization = await Organization.findById(department.organizationId);
      if (organization && organization.admins && organization.admins.map(id => id.toString()).includes(userId.toString())) {
        hasPermission = true;
      }
    }
    // 检查是否为全局管理员
    if (!hasPermission) {
        const user = await User.findById(userId);
        if (user && user.roles && user.roles.includes("admin")) {
            hasPermission = true;
        }
    }

    if (!hasPermission) {
      throw new Error(`用户 ${userId} 没有足够的部门管理权限`);
    }
  }

  // --- 其他辅助函数 ---

  /**
   * 批量导入用户到组织/部门
   * @param {string} organizationId - 组织ID
   * @param {Array<Object>} usersData - 用户数据列表
   * @param {string} importerId - 导入者ID
   * @returns {Promise<Object>} 导入结果
   */
  async bulkImportUsers(organizationId, usersData, importerId) {
    // 实现批量用户创建、分配部门、角色、职位的逻辑
    // 需要处理错误、验证数据、权限检查等
    logger.info(`开始批量导入用户到组织 ${organizationId}`);
    const results = { total: usersData.length, successful: 0, failed: 0, errors: [] };

    try {
        const organization = await Organization.findById(organizationId);
        if (!organization) throw new Error(`组织不存在: ${organizationId}`);
        await this.checkAdminPermission(organization, importerId);

        for (const userData of usersData) {
            try {
                // 1. 查找或创建用户
                let user = await User.findOne({ email: userData.email });
                if (!user) {
                    // 创建新用户逻辑，需要密码处理等
                    // user = new User({...userData, organizationId});
                    // await user.save();
                    throw new Error(`用户 ${userData.email} 不存在，请先创建用户`); // 简化处理，假设用户已存在
                }

                // 2. 分配部门
                if (userData.departmentName) {
                    const department = await Department.findOne({ organizationId, name: userData.departmentName });
                    if (department) {
                        await this.addUserToDepartment(department._id, user._id, importerId);
                    } else {
                        throw new Error(`部门 ${userData.departmentName} 不存在`);
                    }
                }

                // 3. 分配角色
                if (userData.roleName) {
                    const role = await Role.findOne({ organizationId, name: userData.roleName });
                    if (role) {
                        await this.assignRoleToUser(organizationId, user._id, role._id, importerId);
                    } else {
                        throw new Error(`角色 ${userData.roleName} 不存在`);
                    }
                }

                // 4. 分配职位
                if (userData.positionTitle) {
                    const position = await Position.findOne({ organizationId, title: userData.positionTitle });
                    if (position) {
                        await this.assignPositionToUser(organizationId, user._id, position._id, importerId);
                    } else {
                        throw new Error(`职位 ${userData.positionTitle} 不存在`);
                    }
                }
                results.successful++;
            } catch (userError) {
                results.failed++;
                results.errors.push({ email: userData.email, error: userError.message });
            }
        }
    } catch (error) {
        logger.error(`批量导入用户失败: ${error.message}`);
        throw error; // 抛出外层错误
    }
    logger.info(`批量导入用户完成: 成功 ${results.successful}, 失败 ${results.failed}`);
    return results;
  }

  /**
   * 获取组织关系可视化数据
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} 可视化数据
   */
  async getOrganizationVisualizationData(organizationId) {
    // 实现获取用于前端可视化的组织架构数据（如节点和边）
    // 可以复用 getOrganizationTree 的逻辑，并转换为特定格式
    const tree = await this.getOrganizationTree(organizationId);
    // 转换 tree 为 D3.js 或其他库所需的格式
    const nodes = [];
    const links = [];
    function traverse(node, parentId) {
        const nodeId = node._id ? node._id.toString() : node.id.toString(); // 处理根节点和部门节点ID不一致问题
        nodes.push({ id: nodeId, name: node.name, type: node._id ? 'department' : 'organization' }); // 区分组织和部门节点
        if (parentId) {
            links.push({ source: parentId, target: nodeId });
        }
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => traverse(child, nodeId));
        }
    }
    traverse(tree, null);
    return { nodes, links };
  }
}

// 创建企业组织架构管理器实例
const organizationManager = new OrganizationManager();

// 导出模块
module.exports = {
  organizationManager,
  ORGANIZATION_MANAGER_CONFIG,
};
