/**
 * 企业模型定义
 * 用于支持企业级文化交流解决方案的组织管理功能
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 企业模式定义
 */
const EnterpriseSchema = new Schema({
  // 企业基本信息
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  // 企业标识
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // 企业类型
  type: {
    type: String,
    enum: ['corporation', 'government', 'education', 'non_profit', 'cultural_institution', 'media', 'startup', 'other'],
    default: 'corporation'
  },
  // 企业规模
  size: {
    type: String,
    enum: ['micro', 'small', 'medium', 'large', 'enterprise'],
    default: 'medium'
  },
  // 企业所在地
  location: {
    country: {
      type: String,
      required: true
    },
    region: {
      type: String
    },
    city: {
      type: String,
      required: true
    },
    address: {
      type: String
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  // 企业联系信息
  contact: {
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String
    },
    website: {
      type: String
    },
    socialMedia: {
      linkedin: String,
      twitter: String,
      facebook: String,
      instagram: String
    }
  },
  // 企业文化信息
  culture: {
    // 文化领域
    domains: [{
      type: String,
      enum: ['visual_arts', 'performing_arts', 'literature', 'music', 'film', 'digital_media', 'heritage', 'crafts', 'design', 'fashion', 'architecture', 'culinary', 'gaming', 'other']
    }],
    // 文化标签
    tags: [{
      type: String,
      trim: true
    }],
    // 文化描述
    description: {
      type: String
    },
    // 文化价值观
    values: [{
      name: String,
      description: String
    }],
    // 文化特色
    uniqueFeatures: [{
      type: String
    }]
  },
  // 企业品牌信息
  branding: {
    logo: {
      type: String // URL或路径
    },
    primaryColor: {
      type: String
    },
    secondaryColor: {
      type: String
    },
    slogan: {
      type: String
    }
  },
  // 企业认证信息
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    verificationDocuments: [{
      type: {
        type: String,
        enum: ['business_license', 'tax_certificate', 'organization_certificate', 'other']
      },
      documentId: {
        type: String
      },
      url: {
        type: String
      },
      verifiedAt: {
        type: Date
      }
    }]
  },
  // 企业区块链信息
  blockchain: {
    walletAddress: {
      type: String
    },
    tokenBalance: {
      type: Number,
      default: 0
    },
    stakingAmount: {
      type: Number,
      default: 0
    },
    reputationScore: {
      type: Number,
      default: 0
    },
    governanceWeight: {
      type: Number,
      default: 1
    }
  },
  // 企业统计信息
  statistics: {
    memberCount: {
      type: Number,
      default: 0
    },
    resourceCount: {
      type: Number,
      default: 0
    },
    projectCount: {
      type: Number,
      default: 0
    },
    collaborationCount: {
      type: Number,
      default: 0
    },
    totalResourceViews: {
      type: Number,
      default: 0
    },
    totalResourceDownloads: {
      type: Number,
      default: 0
    },
    activityScore: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date
    }
  },
  // 企业设置
  settings: {
    visibility: {
      type: String,
      enum: ['public', 'private', 'verified_only'],
      default: 'public'
    },
    collaborationPreferences: {
      autoApproveRequests: {
        type: Boolean,
        default: false
      },
      preferredCollaborationTypes: [{
        type: String,
        enum: ['resource_sharing', 'joint_projects', 'events', 'research', 'education', 'other']
      }],
      preferredDomains: [{
        type: String
      }]
    },
    notificationSettings: {
      email: {
        type: Boolean,
        default: true
      },
      platform: {
        type: Boolean,
        default: true
      },
      collaborationRequests: {
        type: Boolean,
        default: true
      },
      resourceUsage: {
        type: Boolean,
        default: true
      },
      projectUpdates: {
        type: Boolean,
        default: true
      }
    },
    language: {
      type: String,
      default: 'zh-CN'
    },
    timezone: {
      type: String,
      default: 'Asia/Shanghai'
    }
  },
  // 企业元数据
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
  }
}, {
  timestamps: true
});

// 索引
EnterpriseSchema.index({ name: 'text', description: 'text', 'culture.tags': 'text' });
EnterpriseSchema.index({ code: 1 }, { unique: true });
EnterpriseSchema.index({ type: 1 });
EnterpriseSchema.index({ 'location.country': 1 });
EnterpriseSchema.index({ 'culture.domains': 1 });
EnterpriseSchema.index({ 'verification.isVerified': 1 });
EnterpriseSchema.index({ 'blockchain.reputationScore': -1 });
EnterpriseSchema.index({ createdAt: -1 });

// 虚拟字段：企业活跃度评分
EnterpriseSchema.virtual('activityScore').get(function() {
  // 基于各种统计数据计算活跃度评分
  const resourceWeight = 0.3;
  const projectWeight = 0.3;
  const collaborationWeight = 0.4;
  
  const resourceScore = Math.min(this.statistics.resourceCount * 5, 100);
  const projectScore = Math.min(this.statistics.projectCount * 10, 100);
  const collaborationScore = Math.min(this.statistics.collaborationCount * 15, 100);
  
  return (resourceScore * resourceWeight) + 
         (projectScore * projectWeight) + 
         (collaborationScore * collaborationWeight);
});

// 预处理中间件
EnterpriseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 静态方法
EnterpriseSchema.statics.findByDomain = function(domain) {
  return this.find({ 'culture.domains': domain });
};

EnterpriseSchema.statics.findVerified = function() {
  return this.find({ 'verification.isVerified': true });
};

EnterpriseSchema.statics.findTopByReputation = function(limit = 10) {
  return this.find()
    .sort({ 'blockchain.reputationScore': -1 })
    .limit(limit);
};

// 实例方法
EnterpriseSchema.methods.updateStatistics = function() {
  // 实现更新统计信息的逻辑
};

EnterpriseSchema.methods.calculateCulturalCompatibility = function(otherEnterprise) {
  // 实现计算文化兼容性的逻辑
  let compatibilityScore = 0;
  
  // 计算文化领域重叠度
  const domainOverlap = this.culture.domains.filter(domain => 
    otherEnterprise.culture.domains.includes(domain)
  ).length;
  
  const maxDomains = Math.max(this.culture.domains.length, otherEnterprise.culture.domains.length);
  const domainScore = maxDomains > 0 ? (domainOverlap / maxDomains) * 40 : 0;
  
  // 计算文化标签重叠度
  const tagOverlap = this.culture.tags.filter(tag => 
    otherEnterprise.culture.tags.includes(tag)
  ).length;
  
  const maxTags = Math.max(this.culture.tags.length, otherEnterprise.culture.tags.length);
  const tagScore = maxTags > 0 ? (tagOverlap / maxTags) * 30 : 0;
  
  // 计算协作偏好重叠度
  const prefOverlap = this.settings.collaborationPreferences.preferredCollaborationTypes.filter(type => 
    otherEnterprise.settings.collaborationPreferences.preferredCollaborationTypes.includes(type)
  ).length;
  
  const maxPrefs = Math.max(
    this.settings.collaborationPreferences.preferredCollaborationTypes.length, 
    otherEnterprise.settings.collaborationPreferences.preferredCollaborationTypes.length
  );
  const prefScore = maxPrefs > 0 ? (prefOverlap / maxPrefs) * 30 : 0;
  
  compatibilityScore = domainScore + tagScore + prefScore;
  
  return {
    score: compatibilityScore,
    details: {
      domainOverlap,
      tagOverlap,
      prefOverlap,
      domainScore,
      tagScore,
      prefScore
    }
  };
};

// 创建并导出模型
const Enterprise = mongoose.model('Enterprise', EnterpriseSchema);
module.exports = Enterprise;
