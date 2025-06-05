/**
 * 资源访问请求模型定义
 * 用于支持企业级文化交流解决方案的资源共享功能
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 资源访问请求模式定义
 */
const ResourceAccessRequestSchema = new Schema({
  // 请求标识
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 资源ID
  resourceId: {
    type: String,
    required: true,
    index: true
  },
  // 请求企业
  requestingEnterpriseId: {
    type: String,
    required: true,
    ref: 'Enterprise'
  },
  // 资源所有者企业
  ownerEnterpriseId: {
    type: String,
    required: true,
    ref: 'Enterprise'
  },
  // 请求目的
  purpose: {
    type: String,
    required: true
  },
  // 请求访问时长
  duration: {
    type: String
  },
  // 请求状态
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  // 处理评论
  comment: {
    type: String
  },
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 索引
ResourceAccessRequestSchema.index({ requestingEnterpriseId: 1 });
ResourceAccessRequestSchema.index({ ownerEnterpriseId: 1 });
ResourceAccessRequestSchema.index({ status: 1 });
ResourceAccessRequestSchema.index({ createdAt: -1 });

// 静态方法
ResourceAccessRequestSchema.statics.findByRequestingEnterprise = function(enterpriseId) {
  return this.find({ requestingEnterpriseId: enterpriseId });
};

ResourceAccessRequestSchema.statics.findByOwnerEnterprise = function(enterpriseId) {
  return this.find({ ownerEnterpriseId: enterpriseId });
};

ResourceAccessRequestSchema.statics.findPendingRequests = function(enterpriseId) {
  return this.find({
    ownerEnterpriseId: enterpriseId,
    status: 'pending'
  });
};

// 创建并导出模型
const ResourceAccessRequest = mongoose.model('ResourceAccessRequest', ResourceAccessRequestSchema);
module.exports = ResourceAccessRequest;
