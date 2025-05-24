const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// NFT资产模型
const nftAssetSchema = new Schema({
  // 基本信息
  tokenId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  assetType: {
    type: String,
    enum: ['ARTWORK', 'CERTIFICATE', 'COLLECTIBLE', 'SOUVENIR', 'HERITAGE'],
    required: true
  },
  
  // 所有权信息
  creator: {
    type: String, // 创建者钱包地址
    required: true
  },
  owner: {
    type: String, // 当前所有者钱包地址
    required: true
  },
  
  // 时间信息
  createdAt: {
    type: Date,
    default: Date.now
  },
  mintedAt: {
    type: Date,
    required: true
  },
  
  // 区块链信息
  contractAddress: {
    type: String,
    required: true
  },
  mintTxHash: {
    type: String,
    required: true
  },
  tokenURI: {
    type: String,
    required: true
  },
  
  // 资产属性
  culturalTags: [{
    type: String,
    trim: true
  }],
  rarity: {
    type: Number,
    default: 0
  },
  
  // 验证信息
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING'
  },
  verifier: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  
  // 活动关联
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    default: null
  },
  
  // 媒体内容
  mediaType: {
    type: String,
    enum: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER'],
    default: 'IMAGE'
  },
  mediaUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  
  // 交易历史
  transferHistory: [{
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true
    },
    txHash: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      default: 0
    }
  }],
  
  // 市场信息
  isListed: {
    type: Boolean,
    default: false
  },
  listingPrice: {
    type: Number,
    default: 0
  },
  listingCurrency: {
    type: String,
    default: 'MATIC'
  },
  
  // 状态信息
  isDestroyed: {
    type: Boolean,
    default: false
  },
  destroyedAt: {
    type: Date,
    default: null
  },
  destroyTxHash: {
    type: String,
    default: null
  },
  
  // 元数据同步
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引
nftAssetSchema.index({ tokenId: 1 });
nftAssetSchema.index({ creator: 1 });
nftAssetSchema.index({ owner: 1 });
nftAssetSchema.index({ activityId: 1 });
nftAssetSchema.index({ culturalTags: 1 });
nftAssetSchema.index({ assetType: 1 });
nftAssetSchema.index({ verificationStatus: 1 });
nftAssetSchema.index({ isListed: 1, listingPrice: 1 });

// 虚拟字段：资产年龄（天数）
nftAssetSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// 方法：添加转让记录
nftAssetSchema.methods.addTransfer = function(from, to, txHash, price = 0) {
  this.transferHistory.push({
    from,
    to,
    timestamp: new Date(),
    txHash,
    price
  });
  this.owner = to;
  return this.save();
};

// 方法：销毁资产
nftAssetSchema.methods.destroy = function(txHash) {
  this.isDestroyed = true;
  this.destroyedAt = new Date();
  this.destroyTxHash = txHash;
  return this.save();
};

// 方法：上架到市场
nftAssetSchema.methods.listOnMarket = function(price, currency = 'MATIC') {
  this.isListed = true;
  this.listingPrice = price;
  this.listingCurrency = currency;
  return this.save();
};

// 方法：从市场下架
nftAssetSchema.methods.delistFromMarket = function() {
  this.isListed = false;
  return this.save();
};

// 静态方法：按文化标签查找
nftAssetSchema.statics.findByTag = function(tag) {
  return this.find({ culturalTags: tag, isDestroyed: false });
};

// 静态方法：按活动查找
nftAssetSchema.statics.findByActivity = function(activityId) {
  return this.find({ activityId, isDestroyed: false });
};

// 静态方法：按创建者查找
nftAssetSchema.statics.findByCreator = function(creator) {
  return this.find({ creator, isDestroyed: false });
};

// 静态方法：按所有者查找
nftAssetSchema.statics.findByOwner = function(owner) {
  return this.find({ owner, isDestroyed: false });
};

// 静态方法：查找市场上的资产
nftAssetSchema.statics.findMarketListings = function(options = {}) {
  const query = { isListed: true, isDestroyed: false };
  
  if (options.assetType) {
    query.assetType = options.assetType;
  }
  
  if (options.minPrice !== undefined) {
    query.listingPrice = { $gte: options.minPrice };
  }
  
  if (options.maxPrice !== undefined) {
    query.listingPrice = query.listingPrice || {};
    query.listingPrice.$lte = options.maxPrice;
  }
  
  if (options.tags && options.tags.length > 0) {
    query.culturalTags = { $in: options.tags };
  }
  
  const sortOptions = {};
  if (options.sortBy === 'price') {
    sortOptions.listingPrice = options.sortOrder === 'desc' ? -1 : 1;
  } else if (options.sortBy === 'date') {
    sortOptions.createdAt = options.sortOrder === 'desc' ? -1 : 1;
  } else {
    sortOptions.createdAt = -1; // 默认按创建时间降序
  }
  
  return this.find(query).sort(sortOptions);
};

const NFTAsset = mongoose.model('NFTAsset', nftAssetSchema);

module.exports = NFTAsset;
