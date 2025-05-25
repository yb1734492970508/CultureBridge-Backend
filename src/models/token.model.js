const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TokenTransactionSchema = new Schema({
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  from: {
    type: String,
    required: true,
    index: true
  },
  to: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: String,
    required: true
  },
  tokenType: {
    type: String,
    enum: ['CBT', 'REPUTATION', 'REWARD'],
    default: 'CBT'
  },
  transactionType: {
    type: String,
    enum: ['TRANSFER', 'MINT', 'BURN', 'STAKE', 'UNSTAKE', 'REWARD', 'GOVERNANCE'],
    required: true
  },
  blockNumber: {
    type: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  },
  reason: {
    type: String
  },
  metadata: {
    type: Object
  }
});

// 添加索引以提高查询性能
TokenTransactionSchema.index({ timestamp: -1 });
TokenTransactionSchema.index({ tokenType: 1, transactionType: 1 });
TokenTransactionSchema.index({ blockNumber: 1 });

// 添加虚拟字段计算交易年龄
TokenTransactionSchema.virtual('age').get(function() {
  return Date.now() - this.timestamp;
});

// 添加静态方法获取用户交易历史
TokenTransactionSchema.statics.getUserTransactions = function(address) {
  return this.find({ 
    $or: [{ from: address }, { to: address }] 
  }).sort({ timestamp: -1 });
};

// 添加静态方法获取特定类型的交易
TokenTransactionSchema.statics.getTransactionsByType = function(type) {
  return this.find({ transactionType: type }).sort({ timestamp: -1 });
};

module.exports = mongoose.model('TokenTransaction', TokenTransactionSchema);
