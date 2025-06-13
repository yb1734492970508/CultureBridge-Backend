const mongoose = require('mongoose');

const TokenTransactionSchema = new mongoose.Schema({
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  blockchainTransactionId: {
    type: Number,
    unique: true,
    sparse: true
  },
  type: {
    type: String,
    enum: ['reward', 'transfer', 'purchase', 'refund', 'penalty'],
    required: true
  },
  from: {
    type: String, // 钱包地址
    required: function() {
      return this.type === 'transfer';
    }
  },
  to: {
    type: String, // 钱包地址
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  purpose: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['cultural_exchange', 'language_learning', 'content_creation', 'community_participation', 'premium_features', 'marketplace', 'general'],
    default: 'general'
  },
  tags: [String],
  // 关联的用户和内容
  relatedUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  relatedContent: {
    contentType: {
      type: String,
      enum: ['post', 'comment', 'resource', 'event', 'chat_message', 'voice_translation']
    },
    contentId: mongoose.Schema.ObjectId
  },
  // 交易状态
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'cancelled'],
    default: 'pending'
  },
  confirmations: {
    type: Number,
    default: 0
  },
  gasUsed: Number,
  gasFee: Number, // BNB
  // 元数据
  metadata: {
    userAgent: String,
    ipAddress: String,
    location: {
      country: String,
      city: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date,
  failedAt: Date
});

// 索引
TokenTransactionSchema.index({ transactionHash: 1 });
TokenTransactionSchema.index({ from: 1, createdAt: -1 });
TokenTransactionSchema.index({ to: 1, createdAt: -1 });
TokenTransactionSchema.index({ type: 1, status: 1 });
TokenTransactionSchema.index({ category: 1, createdAt: -1 });
TokenTransactionSchema.index({ relatedUser: 1, createdAt: -1 });

module.exports = mongoose.model('TokenTransaction', TokenTransactionSchema);

