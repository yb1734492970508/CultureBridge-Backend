/**
 * 权限模型定义
 * 用于支持企业级文化交流解决方案的权限控制系统
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 权限模型
 */
const PermissionSchema = new Schema({
  code: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  module: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['action', 'resource', 'system'],
    default: 'action'
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * 权限模板模型
 */
const PermissionTemplateSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * 权限日志模型
 */
const PermissionLogSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'apply_template', 'grant', 'revoke']
  },
  resource: {
    type: String,
    required: true,
    enum: ['permission', 'permission_template', 'role', 'user']
  },
  resourceId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  details: {
    type: Object,
    default: {}
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 创建索引
PermissionSchema.index({ organizationId: 1, code: 1 }, { unique: true });
PermissionSchema.index({ organizationId: 1, module: 1 });
PermissionTemplateSchema.index({ organizationId: 1, name: 1 });
PermissionLogSchema.index({ organizationId: 1, createdAt: -1 });
PermissionLogSchema.index({ userId: 1, createdAt: -1 });

// 创建模型
const Permission = mongoose.model('Permission', PermissionSchema);
const PermissionTemplate = mongoose.model('PermissionTemplate', PermissionTemplateSchema);
const PermissionLog = mongoose.model('PermissionLog', PermissionLogSchema);

module.exports = {
  Permission,
  PermissionTemplate,
  PermissionLog
};
