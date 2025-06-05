/**
 * 资源事件模型定义
 * 用于记录和追踪企业级文化交流平台中的资源相关事件
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 资源事件模式定义
 */
const ResourceEventSchema = new Schema({
  // 资源ID
  resourceId: {
    type: String,
    required: true,
    index: true
  },
  // 事件类型
  eventType: {
    type: String,
    required: true,
    enum: [
      'publish',           // 发布资源
      'view',              // 查看资源
      'download',          // 下载资源
      'share',             // 分享资源
      'like',              // 点赞资源
      'comment',           // 评论资源
      'update',            // 更新资源
      'access_requested',  // 请求访问资源
      'access_granted',    // 授予访问权限
      'access_rejected',   // 拒绝访问请求
      'delist',            // 下架资源
      'restore',           // 恢复资源
      'tag',               // 添加标签
      'rate',              // 评分
      'search',            // 搜索资源
      'add_to_collection', // 添加到收藏
      'remove_from_collection', // 从收藏中移除
      'add_to_project',    // 添加到项目
      'remove_from_project', // 从项目中移除
      'report',            // 举报资源
      'monetization',      // 货币化事件
      'other'              // 其他事件
    ],
    index: true
  },
  // 事件发起者
  actor: {
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
      type: String
    },
    role: {
      type: String
    }
  },
  // 事件目标（如果适用）
  target: {
    userId: {
      type: String
    },
    enterpriseId: {
      type: String,
      ref: 'Enterprise'
    },
    name: {
      type: String
    }
  },
  // 事件上下文
  context: {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project'
    },
    collectionId: {
      type: String
    },
    referrer: {
      type: String
    },
    platform: {
      type: String,
      enum: ['web', 'mobile', 'api', 'other'],
      default: 'web'
    },
    deviceInfo: {
      type: String
    },
    ipAddress: {
      type: String
    },
    location: {
      country: String,
      region: String,
      city: String
    }
  },
  // 事件详情
  details: {
    type: Schema.Types.Mixed
  },
  // 事件元数据
  metadata: {
    blockchainTransactionId: String,
    blockchainBlockNumber: Number,
    ipfsEventHash: String
  },
  // 时间戳
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// 索引
ResourceEventSchema.index({ resourceId: 1, eventType: 1 });
ResourceEventSchema.index({ 'actor.enterpriseId': 1 });
ResourceEventSchema.index({ 'target.enterpriseId': 1 });
ResourceEventSchema.index({ timestamp: -1 });
ResourceEventSchema.index({ 'context.projectId': 1 });

// 静态方法
ResourceEventSchema.statics.findByResource = function(resourceId) {
  return this.find({ resourceId }).sort({ timestamp: -1 });
};

ResourceEventSchema.statics.findByEnterprise = function(enterpriseId) {
  return this.find({ 
    $or: [
      { 'actor.enterpriseId': enterpriseId },
      { 'target.enterpriseId': enterpriseId }
    ]
  }).sort({ timestamp: -1 });
};

ResourceEventSchema.statics.findByEventType = function(eventType) {
  return this.find({ eventType }).sort({ timestamp: -1 });
};

ResourceEventSchema.statics.countByResourceAndType = function(resourceId, eventType) {
  return this.countDocuments({ resourceId, eventType });
};

ResourceEventSchema.statics.getResourceViewStats = function(resourceId, startDate, endDate) {
  const query = { 
    resourceId, 
    eventType: 'view' 
  };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = startDate;
    }
    if (endDate) {
      query.timestamp.$lte = endDate;
    }
  }
  
  return this.aggregate([
    { $match: query },
    { $group: {
      _id: {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" }
      },
      count: { $sum: 1 }
    }},
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    { $project: {
      _id: 0,
      date: {
        $dateFromParts: {
          year: "$_id.year",
          month: "$_id.month",
          day: "$_id.day"
        }
      },
      count: 1
    }}
  ]);
};

ResourceEventSchema.statics.getPopularResources = function(limit = 10, startDate, endDate) {
  const query = { 
    eventType: 'view' 
  };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = startDate;
    }
    if (endDate) {
      query.timestamp.$lte = endDate;
    }
  }
  
  return this.aggregate([
    { $match: query },
    { $group: {
      _id: "$resourceId",
      viewCount: { $sum: 1 }
    }},
    { $sort: { viewCount: -1 } },
    { $limit: limit }
  ]);
};

// 创建并导出模型
const ResourceEvent = mongoose.model('ResourceEvent', ResourceEventSchema);
module.exports = ResourceEvent;
