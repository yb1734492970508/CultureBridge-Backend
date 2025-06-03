/**
 * 企业级文化交流解决方案验证脚本
 * 用于测试企业级文化交流解决方案的功能实现
 */

const mongoose = require('mongoose');
const validator = require('../tests/enterpriseSolution.validator');
const logger = require('../utils/logger');

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/culturebridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  logger.info('MongoDB连接成功');
  runValidation();
}).catch(err => {
  logger.error(`MongoDB连接失败: ${err.message}`);
  process.exit(1);
});

/**
 * 运行验证
 */
async function runValidation() {
  try {
    logger.info('开始验证企业级文化交流解决方案');
    
    // 运行所有验证
    const results = await validator.validateAll();
    
    // 输出验证结果
    logger.info('验证结果:', { success: results.success });
    
    if (results.success) {
      logger.info('所有功能验证通过');
    } else {
      logger.error('功能验证失败:', { errors: results.errors });
      
      // 输出详细错误信息
      if (results.organizationManager && !results.organizationManager.success) {
        logger.error('组织架构管理功能验证失败:', { 
          errors: results.organizationManager.errors 
        });
      }
      
      if (results.permissionController && !results.permissionController.success) {
        logger.error('权限控制功能验证失败:', { 
          errors: results.permissionController.errors 
        });
      }
      
      if (results.enterpriseConsole && !results.enterpriseConsole.success) {
        logger.error('企业管理控制台功能验证失败:', { 
          errors: results.enterpriseConsole.errors 
        });
      }
    }
    
    // 关闭数据库连接
    await mongoose.connection.close();
    logger.info('MongoDB连接已关闭');
    
    // 返回验证结果
    process.exit(results.success ? 0 : 1);
  } catch (error) {
    logger.error(`验证过程中发生错误: ${error.message}`);
    await mongoose.connection.close();
    process.exit(1);
  }
}
