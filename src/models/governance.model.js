const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GovernanceProposalSchema = new Schema({
  proposalId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  proposalType: {
    type: String,
    enum: ['PARAMETER_CHANGE', 'FEATURE_REQUEST', 'FUND_ALLOCATION', 'COMMUNITY_INITIATIVE', 'OTHER'],
    required: true
  },
  proposer: {
    type: String,
    required: true
  },
  targets: [{
    type: String
  }],
  values: [{
    type: String
  }],
  calldatas: [{
    type: String
  }],
  startBlock: {
    type: Number
  },
  endBlock: {
    type: Number
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'SUCCEEDED', 'DEFEATED', 'QUEUED', 'EXECUTED', 'EXPIRED', 'CANCELED'],
    default: 'PENDING'
  },
  forVotes: {
    type: Number,
    default: 0
  },
  againstVotes: {
    type: Number,
    default: 0
  },
  abstainVotes: {
    type: Number,
    default: 0
  },
  quorum: {
    type: Number,
    default: 0
  },
  executionTime: {
    type: Date
  },
  transactionHash: {
    type: String
  },
  ipfsHash: {
    type: String
  },
  metadata: {
    type: Object
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

// 添加索引以提高查询性能
GovernanceProposalSchema.index({ proposer: 1 });
GovernanceProposalSchema.index({ status: 1 });
GovernanceProposalSchema.index({ proposalType: 1 });
GovernanceProposalSchema.index({ createdAt: -1 });

// 添加预处理钩子，更新updatedAt字段
GovernanceProposalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 添加虚拟字段计算投票总数
GovernanceProposalSchema.virtual('totalVotes').get(function() {
  return this.forVotes + this.againstVotes + this.abstainVotes;
});

// 添加虚拟字段计算支持率
GovernanceProposalSchema.virtual('supportRate').get(function() {
  if (this.totalVotes === 0) return 0;
  return (this.forVotes / this.totalVotes) * 100;
});

// 添加虚拟字段计算是否达到法定人数
GovernanceProposalSchema.virtual('quorumReached').get(function() {
  return this.totalVotes >= this.quorum;
});

// 添加方法检查提案是否通过
GovernanceProposalSchema.methods.isPassed = function() {
  return this.status === 'SUCCEEDED' || this.status === 'QUEUED' || this.status === 'EXECUTED';
};

// 添加静态方法获取活跃提案
GovernanceProposalSchema.statics.getActiveProposals = function() {
  return this.find({ status: 'ACTIVE' }).sort({ endTime: 1 });
};

// 添加静态方法获取用户提案
GovernanceProposalSchema.statics.getUserProposals = function(address) {
  return this.find({ proposer: address }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('GovernanceProposal', GovernanceProposalSchema);
