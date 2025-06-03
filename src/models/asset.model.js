/**
 * 文化资产模型定义
 * 用于支持企业级文化交流解决方案的资产管理
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 文化资产模型
 */
const CultureAssetSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assetType: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'other'],
    required: true
  },
  fileUrl: {
    type: String,
    trim: true
  },
  thumbnailUrl: {
    type: String,
    trim: true
  },
  ipfsHash: {
    type: String,
    trim: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  tags: [{
    type: String,
    trim: true
  }],
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department'
  },
  creatorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  visibility: {
    type: String,
    enum: ['public', 'organization', 'department', 'private'],
    default: 'organization'
  },
  blockchainInfo: {
    registered: {
      type: Boolean,
      default: false
    },
    transactionHash: {
      type: String,
      trim: true
    },
    tokenId: {
      type: String,
      trim: true
    },
    registrationDate: {
      type: Date
    }
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
CultureAssetSchema.index({ organizationId: 1, createdAt: -1 });
CultureAssetSchema.index({ departmentId: 1, createdAt: -1 });
CultureAssetSchema.index({ creatorId: 1, createdAt: -1 });
CultureAssetSchema.index({ tags: 1 });
CultureAssetSchema.index({ assetType: 1 });
CultureAssetSchema.index({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
}, {
  weights: {
    title: 10,
    tags: 5,
    description: 1
  }
});

// 创建模型
const CultureAsset = mongoose.model('CultureAsset', CultureAssetSchema);

module.exports = {
  CultureAsset
};
