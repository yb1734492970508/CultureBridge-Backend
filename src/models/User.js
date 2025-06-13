const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '请提供用户名'],
    unique: true,
    trim: true,
    maxlength: [50, '用户名不能超过50个字符']
  },
  email: {
    type: String,
    required: [true, '请提供邮箱'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      '请提供有效的邮箱'
    ]
  },
  password: {
    type: String,
    required: [true, '请提供密码'],
    minlength: [6, '密码至少6个字符'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // 区块链相关字段
  walletAddress: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{40}$/, '请提供有效的钱包地址']
  },
  privateKey: {
    type: String,
    select: false // 私钥不会在查询中返回
  },
  // CBT代币奖励历史
  tokenRewards: [{
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    transactionHash: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // CBT代币转账历史
  tokenTransfers: [{
    from: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    purpose: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'general'
    },
    tags: [String],
    transactionHash: {
      type: String,
      required: true
    },
    blockchainTransactionId: {
      type: Number
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // 语言学习相关
  nativeLanguages: [String],
  learningLanguages: [String],
  languageProficiency: [{
    language: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'native']
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 加密密码
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// 签发JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// 验证密码
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
