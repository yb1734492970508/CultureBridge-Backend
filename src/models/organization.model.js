/**
 * 企业级文化交流解决方案模型定义
 * 用于支持企业级文化交流解决方案的数据模型
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 组织模型
 */
const OrganizationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  logo: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  size: {
    type: String,
    enum: ['Small', 'Medium', 'Large', 'Enterprise'],
    default: 'Medium'
  },
  country: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  blockchainAddress: {
    type: String,
    trim: true
  },
  settings: {
    type: Object,
    default: {}
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
 * 部门模型
 */
const DepartmentSchema = new Schema({
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
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  path: {
    type: String,
    required: true
  },
  managerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
 * 角色模型
 */
const RoleSchema = new Schema({
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
  isSystem: {
    type: Boolean,
    default: false
  },
  permissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission'
  }],
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
 * 用户组织关系模型
 */
const UserOrganizationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department'
  },
  roleIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Role'
  }],
  position: {
    type: String,
    trim: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'blocked'],
    default: 'active'
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

// 创建索引
OrganizationSchema.index({ name: 1 });
DepartmentSchema.index({ organizationId: 1, name: 1 });
DepartmentSchema.index({ path: 1 });
RoleSchema.index({ organizationId: 1, name: 1 });
UserOrganizationSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
UserOrganizationSchema.index({ organizationId: 1, departmentId: 1 });

// 创建模型
const Organization = mongoose.model('Organization', OrganizationSchema);
const Department = mongoose.model('Department', DepartmentSchema);
const Role = mongoose.model('Role', RoleSchema);
const UserOrganization = mongoose.model('UserOrganization', UserOrganizationSchema);

module.exports = {
  Organization,
  Department,
  Role,
  UserOrganization
};
