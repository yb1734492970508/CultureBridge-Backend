/**
 * 模型注册器
 * 用于确保所有数据模型在应用启动时正确注册到Mongoose
 */

// 导入所有模型
const Project = require('./project.model');
const ProjectMember = require('./projectMember.model');
const Task = require('./task.model');
const Enterprise = require('./enterprise.model');
const ResourceEvent = require('./resourceEvent.model');
const Resource = require('./resource.model');
const ResourceAccessRequest = require('./resourceAccessRequest.model');

/**
 * 注册所有模型
 * 确保所有模型在应用启动时正确注册到Mongoose
 */
function registerAllModels() {
  // 模型已通过require自动注册
  console.log('所有数据模型已成功注册');
  
  // 返回已注册的模型列表，方便调试
  return {
    Project,
    ProjectMember,
    Task,
    Enterprise,
    ResourceEvent,
    Resource,
    ResourceAccessRequest
  };
}

module.exports = {
  registerAllModels
};
