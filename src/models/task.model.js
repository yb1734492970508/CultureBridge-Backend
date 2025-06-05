/**
 * 任务模型定义
 * 用于支持跨企业文化交流平台的项目协作功能
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 任务模式定义
 */
const TaskSchema = new Schema({
  // 所属项目
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  // 任务标题
  title: {
    type: String,
    required: true,
    trim: true
  },
  // 任务描述
  description: {
    type: String,
    required: true
  },
  // 任务类型
  type: {
    type: String,
    enum: ['feature', 'bug', 'documentation', 'research', 'design', 'other'],
    default: 'feature'
  },
  // 任务优先级
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // 任务状态
  status: {
    type: String,
    enum: ['backlog', 'todo', 'in_progress', 'review', 'done', 'archived'],
    default: 'todo'
  },
  // 任务标签
  tags: [{
    type: String,
    trim: true
  }],
  // 创建者信息
  createdBy: {
    userId: {
      type: String,
      required: true
    },
    enterpriseId: {
      type: String,
      required: true,
      ref: 'Enterprise'
    },
    name: {
      type: String,
      required: true
    }
  },
  // 负责人信息
  assignees: [{
    userId: {
      type: String,
      required: true
    },
    enterpriseId: {
      type: String,
      required: true,
      ref: 'Enterprise'
    },
    name: {
      type: String,
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 任务时间信息
  dueDate: {
    type: Date
  },
  estimatedHours: {
    type: Number
  },
  actualHours: {
    type: Number
  },
  // 任务进度
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // 子任务
  subtasks: [{
    title: {
      type: String,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    }
  }],
  // 任务附件
  attachments: [{
    name: {
      type: String,
      required: true
    },
    fileType: {
      type: String
    },
    url: {
      type: String,
      required: true
    },
    size: {
      type: Number
    },
    uploadedBy: {
      type: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 任务关联资源
  relatedResources: [{
    resourceId: {
      type: String,
      ref: 'Resource'
    },
    relationshipType: {
      type: String,
      enum: ['reference', 'dependency', 'output', 'other'],
      default: 'reference'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 任务历史记录
  history: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'status_changed', 'assigned', 'unassigned', 'commented', 'attachment_added', 'subtask_added', 'subtask_completed'],
      required: true
    },
    userId: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    enterpriseId: {
      type: String,
      required: true
    },
    details: {
      type: Schema.Types.Mixed
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // 任务元数据
  metadata: {
    blockchainRecordId: String,
    ipfsMetadataHash: String
  },
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 索引
TaskSchema.index({ projectId: 1 });
TaskSchema.index({ title: 'text', description: 'text' });
TaskSchema.index({ status: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ 'createdBy.userId': 1 });
TaskSchema.index({ 'assignees.userId': 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ createdAt: -1 });

// 虚拟字段：是否逾期
TaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  if (this.status === 'done' || this.status === 'archived') return false;
  return new Date() > this.dueDate;
});

// 虚拟字段：子任务完成百分比
TaskSchema.virtual('subtaskCompletionPercentage').get(function() {
  if (!this.subtasks || this.subtasks.length === 0) return 0;
  const completedCount = this.subtasks.filter(subtask => subtask.completed).length;
  return Math.round((completedCount / this.subtasks.length) * 100);
});

// 预处理中间件
TaskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // 如果状态变为done，设置完成时间
  if (this.status === 'done' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // 如果状态不是done，清除完成时间
  if (this.status !== 'done' && this.completedAt) {
    this.completedAt = undefined;
  }
  
  next();
});

// 静态方法
TaskSchema.statics.findByProject = function(projectId) {
  return this.find({ projectId });
};

TaskSchema.statics.findByAssignee = function(userId) {
  return this.find({ 'assignees.userId': userId });
};

TaskSchema.statics.findOverdueTasks = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $nin: ['done', 'archived'] }
  });
};

// 实例方法
TaskSchema.methods.addSubtask = function(subtaskData) {
  this.subtasks.push(subtaskData);
  return this.save();
};

TaskSchema.methods.completeSubtask = function(subtaskId) {
  const subtask = this.subtasks.id(subtaskId);
  if (subtask) {
    subtask.completed = true;
    subtask.completedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Subtask not found'));
};

TaskSchema.methods.addHistoryEntry = function(action, userId, userName, enterpriseId, details) {
  this.history.push({
    action,
    userId,
    userName,
    enterpriseId,
    details,
    timestamp: new Date()
  });
  return this.save();
};

// 创建并导出模型
const Task = mongoose.model('Task', TaskSchema);
module.exports = Task;
