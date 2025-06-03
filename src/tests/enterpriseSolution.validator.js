/**
 * 企业级文化交流解决方案模型测试
 * 用于验证企业级文化交流解决方案的功能实现
 */

const mongoose = require('mongoose');
const organizationManager = require('../services/enterpriseSolution/organizationManager');
const permissionController = require('../services/enterpriseSolution/permissionController');
const enterpriseConsole = require('../services/enterpriseSolution/enterpriseConsole');
const logger = require('../utils/logger');

/**
 * 企业级解决方案功能验证
 */
class EnterpriseSolutionValidator {
  /**
   * 验证组织架构管理功能
   * @returns {Promise<Object>} - 验证结果
   */
  async validateOrganizationManager() {
    try {
      logger.info('开始验证组织架构管理功能');
      
      const results = {
        success: true,
        tests: [],
        errors: []
      };

      // 测试创建组织
      try {
        logger.info('测试创建组织');
        const organizationData = {
          name: 'Test Organization',
          description: 'Test organization for validation',
          industry: 'Technology',
          size: 'Medium',
          country: 'China',
          contactEmail: 'test@example.com'
        };
        
        const organization = await organizationManager.createOrganization(organizationData);
        
        if (!organization || !organization._id) {
          throw new Error('创建组织失败');
        }
        
        results.tests.push({
          name: '创建组织',
          passed: true,
          organizationId: organization._id
        });
        
        // 测试创建部门
        try {
          logger.info('测试创建部门');
          const departmentData = {
            name: 'Test Department',
            description: 'Test department for validation'
          };
          
          const department = await organizationManager.createDepartment(organization._id, departmentData);
          
          if (!department || !department._id) {
            throw new Error('创建部门失败');
          }
          
          results.tests.push({
            name: '创建部门',
            passed: true,
            departmentId: department._id
          });
          
          // 测试创建角色
          try {
            logger.info('测试创建角色');
            const roleData = {
              name: 'Test Role',
              description: 'Test role for validation',
              isSystem: false
            };
            
            const role = await organizationManager.createRole(organization._id, roleData);
            
            if (!role || !role._id) {
              throw new Error('创建角色失败');
            }
            
            results.tests.push({
              name: '创建角色',
              passed: true,
              roleId: role._id
            });
            
            // 测试批量导入用户
            try {
              logger.info('测试批量导入用户');
              const users = [
                {
                  email: 'user1@example.com',
                  username: 'user1',
                  fullName: 'Test User 1',
                  password: 'password123'
                },
                {
                  email: 'user2@example.com',
                  username: 'user2',
                  fullName: 'Test User 2',
                  password: 'password123'
                }
              ];
              
              const importResult = await organizationManager.importUsers(organization._id, users);
              
              if (!importResult || importResult.success < 1) {
                throw new Error('批量导入用户失败');
              }
              
              results.tests.push({
                name: '批量导入用户',
                passed: true,
                importResult
              });
              
              // 测试获取组织用户列表
              try {
                logger.info('测试获取组织用户列表');
                const userList = await organizationManager.getOrganizationUsers(organization._id);
                
                if (!userList || userList.length < 1) {
                  throw new Error('获取组织用户列表失败');
                }
                
                results.tests.push({
                  name: '获取组织用户列表',
                  passed: true,
                  userCount: userList.length
                });
              } catch (error) {
                results.success = false;
                results.tests.push({
                  name: '获取组织用户列表',
                  passed: false,
                  error: error.message
                });
                results.errors.push(error.message);
              }
            } catch (error) {
              results.success = false;
              results.tests.push({
                name: '批量导入用户',
                passed: false,
                error: error.message
              });
              results.errors.push(error.message);
            }
          } catch (error) {
            results.success = false;
            results.tests.push({
              name: '创建角色',
              passed: false,
              error: error.message
            });
            results.errors.push(error.message);
          }
        } catch (error) {
          results.success = false;
          results.tests.push({
            name: '创建部门',
            passed: false,
            error: error.message
          });
          results.errors.push(error.message);
        }
      } catch (error) {
        results.success = false;
        results.tests.push({
          name: '创建组织',
          passed: false,
          error: error.message
        });
        results.errors.push(error.message);
      }

      logger.info('组织架构管理功能验证完成', { success: results.success });
      return results;
    } catch (error) {
      logger.error(`组织架构管理功能验证失败: ${error.message}`);
      return {
        success: false,
        tests: [],
        errors: [error.message]
      };
    }
  }

  /**
   * 验证权限控制功能
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 验证结果
   */
  async validatePermissionController(organizationId) {
    try {
      logger.info('开始验证权限控制功能');
      
      const results = {
        success: true,
        tests: [],
        errors: []
      };

      // 测试创建权限
      try {
        logger.info('测试创建权限');
        const permissionData = {
          code: 'TEST_PERMISSION',
          name: 'Test Permission',
          description: 'Test permission for validation',
          module: 'test',
          type: 'action',
          isSystem: false,
          organizationId,
          userId: new mongoose.Types.ObjectId()
        };
        
        const permission = await permissionController.createPermission(permissionData);
        
        if (!permission || !permission._id) {
          throw new Error('创建权限失败');
        }
        
        results.tests.push({
          name: '创建权限',
          passed: true,
          permissionId: permission._id
        });
        
        // 测试创建权限模板
        try {
          logger.info('测试创建权限模板');
          const templateData = {
            organizationId,
            name: 'Test Template',
            description: 'Test template for validation',
            permissions: [permission._id],
            isDefault: false,
            userId: new mongoose.Types.ObjectId()
          };
          
          const template = await permissionController.createPermissionTemplate(templateData);
          
          if (!template || !template._id) {
            throw new Error('创建权限模板失败');
          }
          
          results.tests.push({
            name: '创建权限模板',
            passed: true,
            templateId: template._id
          });
          
          // 测试获取权限列表
          try {
            logger.info('测试获取权限列表');
            const permissionList = await permissionController.getPermissions(organizationId);
            
            if (!permissionList || permissionList.length < 1) {
              throw new Error('获取权限列表失败');
            }
            
            results.tests.push({
              name: '获取权限列表',
              passed: true,
              permissionCount: permissionList.length
            });
            
            // 测试获取权限模板列表
            try {
              logger.info('测试获取权限模板列表');
              const templateList = await permissionController.getPermissionTemplates(organizationId);
              
              if (!templateList || templateList.length < 1) {
                throw new Error('获取权限模板列表失败');
              }
              
              results.tests.push({
                name: '获取权限模板列表',
                passed: true,
                templateCount: templateList.length
              });
              
              // 测试获取权限操作日志
              try {
                logger.info('测试获取权限操作日志');
                const logs = await permissionController.getPermissionLogs(organizationId);
                
                if (!logs) {
                  throw new Error('获取权限操作日志失败');
                }
                
                results.tests.push({
                  name: '获取权限操作日志',
                  passed: true,
                  logCount: logs.logs ? logs.logs.length : 0
                });
              } catch (error) {
                results.success = false;
                results.tests.push({
                  name: '获取权限操作日志',
                  passed: false,
                  error: error.message
                });
                results.errors.push(error.message);
              }
            } catch (error) {
              results.success = false;
              results.tests.push({
                name: '获取权限模板列表',
                passed: false,
                error: error.message
              });
              results.errors.push(error.message);
            }
          } catch (error) {
            results.success = false;
            results.tests.push({
              name: '获取权限列表',
              passed: false,
              error: error.message
            });
            results.errors.push(error.message);
          }
        } catch (error) {
          results.success = false;
          results.tests.push({
            name: '创建权限模板',
            passed: false,
            error: error.message
          });
          results.errors.push(error.message);
        }
      } catch (error) {
        results.success = false;
        results.tests.push({
          name: '创建权限',
          passed: false,
          error: error.message
        });
        results.errors.push(error.message);
      }

      logger.info('权限控制功能验证完成', { success: results.success });
      return results;
    } catch (error) {
      logger.error(`权限控制功能验证失败: ${error.message}`);
      return {
        success: false,
        tests: [],
        errors: [error.message]
      };
    }
  }

  /**
   * 验证企业管理控制台功能
   * @param {string} organizationId - 组织ID
   * @returns {Promise<Object>} - 验证结果
   */
  async validateEnterpriseConsole(organizationId) {
    try {
      logger.info('开始验证企业管理控制台功能');
      
      const results = {
        success: true,
        tests: [],
        errors: []
      };

      // 测试获取组织仪表盘数据
      try {
        logger.info('测试获取组织仪表盘数据');
        const dashboardData = await enterpriseConsole.getDashboardData(organizationId);
        
        if (!dashboardData || !dashboardData.organization) {
          throw new Error('获取组织仪表盘数据失败');
        }
        
        results.tests.push({
          name: '获取组织仪表盘数据',
          passed: true
        });
        
        // 测试获取组织分析数据
        try {
          logger.info('测试获取组织分析数据');
          const analyticsData = await enterpriseConsole.getAnalyticsData(organizationId);
          
          if (!analyticsData || !analyticsData.timeRange) {
            throw new Error('获取组织分析数据失败');
          }
          
          results.tests.push({
            name: '获取组织分析数据',
            passed: true
          });
          
          // 测试获取用户活跃度数据
          try {
            logger.info('测试获取用户活跃度数据');
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            const endDate = new Date();
            
            const activityData = await enterpriseConsole.getUserActivityData(organizationId, startDate, endDate);
            
            if (!activityData || !activityData.dailyActiveUsers) {
              throw new Error('获取用户活跃度数据失败');
            }
            
            results.tests.push({
              name: '获取用户活跃度数据',
              passed: true
            });
            
            // 测试获取资源使用统计
            try {
              logger.info('测试获取资源使用统计');
              const resourceStats = await enterpriseConsole.getResourceUsageStats(organizationId);
              
              if (!resourceStats || !resourceStats.storage) {
                throw new Error('获取资源使用统计失败');
              }
              
              results.tests.push({
                name: '获取资源使用统计',
                passed: true
              });
              
              // 测试更新组织设置
              try {
                logger.info('测试更新组织设置');
                const settings = {
                  theme: 'dark',
                  language: 'zh-CN',
                  notificationsEnabled: true
                };
                
                const updatedOrg = await enterpriseConsole.updateOrganizationSettings(organizationId, settings);
                
                if (!updatedOrg || !updatedOrg.settings || updatedOrg.settings.theme !== 'dark') {
                  throw new Error('更新组织设置失败');
                }
                
                results.tests.push({
                  name: '更新组织设置',
                  passed: true
                });
              } catch (error) {
                results.success = false;
                results.tests.push({
                  name: '更新组织设置',
                  passed: false,
                  error: error.message
                });
                results.errors.push(error.message);
              }
            } catch (error) {
              results.success = false;
              results.tests.push({
                name: '获取资源使用统计',
                passed: false,
                error: error.message
              });
              results.errors.push(error.message);
            }
          } catch (error) {
            results.success = false;
            results.tests.push({
              name: '获取用户活跃度数据',
              passed: false,
              error: error.message
            });
            results.errors.push(error.message);
          }
        } catch (error) {
          results.success = false;
          results.tests.push({
            name: '获取组织分析数据',
            passed: false,
            error: error.message
          });
          results.errors.push(error.message);
        }
      } catch (error) {
        results.success = false;
        results.tests.push({
          name: '获取组织仪表盘数据',
          passed: false,
          error: error.message
        });
        results.errors.push(error.message);
      }

      logger.info('企业管理控制台功能验证完成', { success: results.success });
      return results;
    } catch (error) {
      logger.error(`企业管理控制台功能验证失败: ${error.message}`);
      return {
        success: false,
        tests: [],
        errors: [error.message]
      };
    }
  }

  /**
   * 验证所有功能
   * @returns {Promise<Object>} - 验证结果
   */
  async validateAll() {
    try {
      logger.info('开始验证企业级文化交流解决方案的所有功能');
      
      const results = {
        success: true,
        organizationManager: null,
        permissionController: null,
        enterpriseConsole: null,
        errors: []
      };

      // 验证组织架构管理功能
      results.organizationManager = await this.validateOrganizationManager();
      if (!results.organizationManager.success) {
        results.success = false;
        results.errors.push('组织架构管理功能验证失败');
      }

      // 如果组织创建成功，继续验证其他功能
      if (results.organizationManager.success && results.organizationManager.tests.length > 0) {
        const organizationTest = results.organizationManager.tests.find(test => test.name === '创建组织');
        if (organizationTest && organizationTest.organizationId) {
          const organizationId = organizationTest.organizationId;

          // 验证权限控制功能
          results.permissionController = await this.validatePermissionController(organizationId);
          if (!results.permissionController.success) {
            results.success = false;
            results.errors.push('权限控制功能验证失败');
          }

          // 验证企业管理控制台功能
          results.enterpriseConsole = await this.validateEnterpriseConsole(organizationId);
          if (!results.enterpriseConsole.success) {
            results.success = false;
            results.errors.push('企业管理控制台功能验证失败');
          }
        }
      }

      logger.info('企业级文化交流解决方案功能验证完成', { success: results.success });
      return results;
    } catch (error) {
      logger.error(`企业级文化交流解决方案功能验证失败: ${error.message}`);
      return {
        success: false,
        organizationManager: null,
        permissionController: null,
        enterpriseConsole: null,
        errors: [error.message]
      };
    }
  }
}

module.exports = new EnterpriseSolutionValidator();
