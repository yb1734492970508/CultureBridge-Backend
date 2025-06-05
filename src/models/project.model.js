/**
 * 项目模型定义
 * 用于支持跨企业文化交流平台的项目协作功能
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 项目模式定义
 */
const ProjectSchema = new Schema({
  // 项目标识
  projectId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 项目基本信息
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  // 项目类型
  type: {
    type: String,
    required: true,
    enum: [
      'cultural_exchange',    // 文化交流
      'collaborative_creation', // 协作创作
      'research',            // 研究项目
      'exhibition',          // 展览项目
      'education',           // 教育项目
      'preservation',        // 文化保护
      'other'                // 其他
    ]
  },
  // 项目状态
  status: {
    type: String,
    enum: ['planning', 'active', 'paused', 'completed', 'cancelled'],
    default: 'planning'
  },
  // 项目时间
  timeline: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    milestones: [{
      title: String,
      description: String,
      dueDate: Date,
      completed: {
        type: Boolean,
        default: false
      }
    }]
  },
  // 项目所属企业
  ownerEnterpriseId: {
    type: String,
    required: true,
    ref: 'Enterprise'
  },
  // 参与企业
  participatingEnterprises: [{
    enterpriseId: {
      type: String,
      ref: 'Enterprise'
    },
    joinDate: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['collaborator', 'sponsor', 'advisor', 'observer'],
      default: 'collaborator'
    }
  }],
  // 项目资源
  resources: [{
    resourceId: {
      type: String,
      ref: 'Resource'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: String
    },
    usage: {
      type: String,
      enum: ['reference', 'input', 'output', 'documentation'],
      default: 'reference'
    }
  }],
  // 项目标签
  tags: [{
    type: String,
    trim: true
  }],
  // 项目统计
  statistics: {
    taskCount: {
      type: Number,
      default: 0
    },
    completedTaskCount: {
      type: Number,
      default: 0
    },
    memberCount: {
      type: Number,
      default: 0
    },
    resourceCount: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date
    }
  },
  // 项目元数据
  metadata: {
    createdBy: {
      type: String,
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
  }
}, {
  timestamps: true
});

// 索引
ProjectSchema.index({ title: 'text', description: 'text', tags: 'text' });
ProjectSchema.index({ type: 1 });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ ownerEnterpriseId: 1 });
ProjectSchema.index({ 'participatingEnterprises.enterpriseId': 1 });
ProjectSchema.index({ 'metadata.createdAt': -1 });

// 虚拟字段：完成率
ProjectSchema.virtual('completionRate').get(function() {
  if (this.statistics.taskCount === 0) return 0;
  return (this.statistics.completedTaskCount / this.statistics.taskCount) * 100;
});

// 预处理中间件
ProjectSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

// 静态方法
ProjectSchema.statics.findByEnterprise = function(enterpriseId) {
  return this.find({
    $or: [
      { ownerEnterpriseId: enterpriseId },
      { 'participatingEnterprises.enterpriseId': enterpriseId }
    ]
  });
};

ProjectSchema.statics.findActiveProjects = function() {
  return this.find({ status: 'active' });
};

ProjectSchema.statics.findByTags = function(tags) {
  return this.find({
    tags: { $in: tags }
  });
};

// 实例方法
ProjectSchema.methods.addMember = function(memberId, role) {
  // 在实际实现中，这里会调用ProjectMember模型创建成员记录
  this.statistics.memberCount += 1;
  this.statistics.lastActivityAt = new Date();
  return this.save();
};

ProjectSchema.methods.addResource = function(resourceData) {
  this.resources.push({
    resourceId: resourceData.resourceId,
    addedAt: new Date(),
    addedBy: resourceData.addedBy,
    usage: resourceData.usage || 'reference'
  });
  
  this.statistics.resourceCount += 1;
  this.statistics.lastActivityAt = new Date();
  
  return this.save();
};

ProjectSchema.methods.updateTaskStatistics = function(completed) {
  if (completed) {
    this.statistics.completedTaskCount += 1;
  }
  this.statistics.lastActivityAt = new Date();
  
  return this.save();
};

// 创建并导出模型
const Project = mongoose.model('Project', ProjectSchema);
module.exports = Project;
