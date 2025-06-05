/**
 * 项目成员模型定义
 * 用于支持跨企业文化交流平台的项目协作功能
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 项目成员模式定义
 */
const ProjectMemberSchema = new Schema({
  // 项目ID
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  // 成员所属企业
  enterpriseId: {
    type: String,
    required: true,
    ref: 'Enterprise'
  },
  // 成员用户ID
  userId: {
    type: String,
    required: true
  },
  // 成员姓名
  name: {
    type: String,
    required: true
  },
  // 成员头像
  avatar: {
    type: String
  },
  // 成员角色
  role: {
    type: String,
    enum: ['owner', 'admin', 'member', 'guest'],
    default: 'member',
    required: true
  },
  // 成员权限
  permissions: {
    canEditProject: {
      type: Boolean,
      default: false
    },
    canManageMembers: {
      type: Boolean,
      default: false
    },
    canCreateTasks: {
      type: Boolean,
      default: true
    },
    canAssignTasks: {
      type: Boolean,
      default: false
    },
    canShareResources: {
      type: Boolean,
      default: true
    },
    canExportData: {
      type: Boolean,
      default: false
    }
  },
  // 成员状态
  status: {
    type: String,
    enum: ['invited', 'active', 'inactive', 'removed'],
    default: 'active'
  },
  // 邀请信息
  invitation: {
    invitedBy: {
      type: String
    },
    invitedAt: {
      type: Date
    },
    acceptedAt: {
      type: Date
    },
    message: {
      type: String
    }
  },
  // 成员统计信息
  statistics: {
    tasksCreated: {
      type: Number,
      default: 0
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    resourcesShared: {
      type: Number,
      default: 0
    },
    commentsPosted: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date
    }
  },
  // 时间戳
  joinedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectMemberSchema.index({ projectId: 1, role: 1 });
ProjectMemberSchema.index({ enterpriseId: 1 });
ProjectMemberSchema.index({ status: 1 });

// 预处理中间件
ProjectMemberSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 静态方法
ProjectMemberSchema.statics.findByProject = function(projectId) {
  return this.find({ projectId, status: 'active' });
};

ProjectMemberSchema.statics.findByEnterprise = function(enterpriseId) {
  return this.find({ enterpriseId, status: 'active' });
};

ProjectMemberSchema.statics.findByUser = function(userId) {
  return this.find({ userId, status: 'active' });
};

// 实例方法
ProjectMemberSchema.methods.updateRole = function(newRole) {
  this.role = newRole;
  
  // 根据角色更新权限
  switch(newRole) {
    case 'owner':
    case 'admin':
      this.permissions = {
        canEditProject: true,
        canManageMembers: true,
        canCreateTasks: true,
        canAssignTasks: true,
        canShareResources: true,
        canExportData: true
      };
      break;
    case 'member':
      this.permissions = {
        canEditProject: false,
        canManageMembers: false,
        canCreateTasks: true,
        canAssignTasks: true,
        canShareResources: true,
        canExportData: false
      };
      break;
    case 'guest':
      this.permissions = {
        canEditProject: false,
        canManageMembers: false,
        canCreateTasks: false,
        canAssignTasks: false,
        canShareResources: false,
        canExportData: false
      };
      break;
  }
  
  return this.save();
};

ProjectMemberSchema.methods.updateStatistics = function() {
  // 实现更新统计信息的逻辑
};

// 创建并导出模型
const ProjectMember = mongoose.model('ProjectMember', ProjectMemberSchema);
module.exports = ProjectMember;
