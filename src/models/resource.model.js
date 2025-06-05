/**
 * 资源模型定义
 * 用于支持企业级文化交流解决方案的资源管理功能
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 资源模式定义
 */
const ResourceSchema = new Schema({
  // 资源标识
  resourceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 资源基本信息
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  // 资源类型
  type: {
    type: String,
    required: true,
    enum: [
      'image_collection',    // 图像集合
      'video_collection',    // 视频集合
      'audio_collection',    // 音频集合
      'text_collection',     // 文本集合
      'digital_collection',  // 数字藏品
      'knowledge_base',      // 知识库
      'design_assets',       // 设计资源
      'performance_recording', // 表演记录
      'interactive_content', // 交互内容
      'educational_material', // 教育材料
      'other'                // 其他
    ]
  },
  // 资源内容
  contentUri: {
    type: String,
    required: true
  },
  thumbnailUri: {
    type: String
  },
  // 资源标签
  tags: [{
    type: String,
    trim: true
  }],
  // 资源所属企业
  enterpriseId: {
    type: String,
    required: true,
    ref: 'Enterprise'
  },
  // 资源状态
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'deleted'],
    default: 'draft'
  },
  // 资源定价
  pricing: {
    price: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'CNY'
    },
    model: {
      type: String,
      enum: ['free', 'one_time', 'subscription', 'usage_based', 'negotiable'],
      default: 'free'
    },
    discountEligible: {
      type: Boolean,
      default: false
    },
    customPricing: {
      type: Schema.Types.Mixed
    }
  },
  // 资源权限
  permissions: {
    visibility: {
      type: String,
      enum: ['private', 'public', 'restricted'],
      default: 'private'
    },
    accessPolicy: {
      type: String,
      enum: ['manual_approval', 'auto_approve', 'whitelist_only'],
      default: 'manual_approval'
    },
    allowedEnterprises: [{
      type: String,
      ref: 'Enterprise'
    }],
    restrictedActions: [{
      type: String,
      enum: ['download', 'share', 'edit', 'print', 'export']
    }],
    expirySettings: {
      hasExpiry: {
        type: Boolean,
        default: false
      },
      expiryDate: {
        type: Date
      },
      expiryAction: {
        type: String,
        enum: ['archive', 'delete', 'notify_only'],
        default: 'archive'
      }
    }
  },
  // 资源版本
  versions: [{
    versionNumber: {
      type: Number
    },
    contentUri: {
      type: String
    },
    changeLog: {
      type: String
    },
    createdBy: {
      type: String
    },
    createdAt: {
      type: Date
    }
  }],
  // 资源统计
  statistics: {
    viewCount: {
      type: Number,
      default: 0
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    shareCount: {
      type: Number,
      default: 0
    },
    likeCount: {
      type: Number,
      default: 0
    },
    commentCount: {
      type: Number,
      default: 0
    },
    ratingSum: {
      type: Number,
      default: 0
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    lastViewedAt: {
      type: Date
    }
  },
  // 资源元数据
  metadata: {
    fileSize: {
      type: Number
    },
    fileFormat: {
      type: String
    },
    duration: {
      type: Number
    },
    dimensions: {
      width: Number,
      height: Number
    },
    location: {
      latitude: Number,
      longitude: Number,
      placeName: String
    },
    language: {
      type: String
    },
    creationDate: {
      type: Date
    },
    authors: [{
      name: String,
      role: String
    }],
    copyright: {
      holder: String,
      year: Number,
      license: String
    },
    blockchainRecordId: String,
    ipfsMetadataHash: String,
    customMetadata: {
      type: Schema.Types.Mixed
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
ResourceSchema.index({ title: 'text', description: 'text', tags: 'text' });
ResourceSchema.index({ type: 1 });
ResourceSchema.index({ enterpriseId: 1 });
ResourceSchema.index({ status: 1 });
ResourceSchema.index({ 'permissions.visibility': 1 });
ResourceSchema.index({ 'metadata.createdAt': -1 });

// 虚拟字段：平均评分
ResourceSchema.virtual('averageRating').get(function() {
  if (this.statistics.ratingCount === 0) return 0;
  return this.statistics.ratingSum / this.statistics.ratingCount;
});

// 预处理中间件
ResourceSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

// 静态方法
ResourceSchema.statics.findByEnterprise = function(enterpriseId) {
  return this.find({ enterpriseId, status: { $ne: 'deleted' } });
};

ResourceSchema.statics.findPublic = function() {
  return this.find({
    status: 'active',
    'permissions.visibility': 'public'
  });
};

ResourceSchema.statics.findByTags = function(tags) {
  return this.find({
    tags: { $in: tags },
    status: 'active'
  });
};

ResourceSchema.statics.findTopRated = function(limit = 10) {
  return this.aggregate([
    { $match: { status: 'active', 'statistics.ratingCount': { $gt: 0 } } },
    { $addFields: {
      averageRating: { $divide: ['$statistics.ratingSum', '$statistics.ratingCount'] }
    }},
    { $sort: { averageRating: -1, 'statistics.viewCount': -1 } },
    { $limit: limit }
  ]);
};

// 实例方法
ResourceSchema.methods.incrementViewCount = function() {
  this.statistics.viewCount += 1;
  this.statistics.lastViewedAt = new Date();
  return this.save();
};

ResourceSchema.methods.addRating = function(rating) {
  this.statistics.ratingSum += rating;
  this.statistics.ratingCount += 1;
  return this.save();
};

ResourceSchema.methods.isAccessibleBy = function(enterpriseId) {
  // 资源所有者始终有访问权限
  if (this.enterpriseId === enterpriseId) return true;
  
  // 公开资源对所有企业可见
  if (this.permissions.visibility === 'public') return true;
  
  // 检查是否在允许访问的企业列表中
  return this.permissions.allowedEnterprises.includes(enterpriseId);
};

ResourceSchema.methods.addVersion = function(versionData) {
  const nextVersionNumber = this.versions.length > 0 
    ? Math.max(...this.versions.map(v => v.versionNumber)) + 1 
    : 1;
  
  this.versions.push({
    versionNumber: nextVersionNumber,
    contentUri: versionData.contentUri,
    changeLog: versionData.changeLog,
    createdBy: versionData.createdBy,
    createdAt: new Date()
  });
  
  // 更新当前内容为最新版本
  this.contentUri = versionData.contentUri;
  
  return this.save();
};

// 创建并导出模型
const Resource = mongoose.model('Resource', ResourceSchema);
module.exports = Resource;
