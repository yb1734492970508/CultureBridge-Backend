const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '请提供用户名'],
    unique: true,
    trim: true,
    maxlength: [50, '用户名不能超过50个字符'],
    index: true // 添加索引
  },
  email: {
    type: String,
    required: [true, '请提供邮箱'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      '请提供有效的邮箱'
    ],
    index: true // 添加索引
  },
  password: {
    type: String,
    required: [true, '请提供密码'],
    minlength: [6, '密码至少6个字符'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
    index: true // 添加索引用于角色查询
  },
  
  // 个人信息
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxlength: [30, '名字不能超过30个字符']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [30, '姓氏不能超过30个字符']
    },
    avatar: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      maxlength: [500, '个人简介不能超过500个字符']
    },
    country: {
      type: String,
      index: true // 添加索引用于地理位置查询
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // 区块链相关字段
  walletAddress: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{40}$/, '请提供有效的钱包地址'],
    index: true // 添加索引
  },
  privateKey: {
    type: String,
    select: false // 私钥不会在查询中返回
  },
  
  // CBT代币余额和统计
  tokenBalance: {
    type: Number,
    default: 0,
    min: 0,
    index: true // 添加索引用于余额查询
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },

  // CBT代币奖励历史
  tokenRewards: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true,
      enum: ['registration', 'daily_login', 'voice_translation', 'chat_message', 'content_creation', 'referral', 'achievement']
    },
    transactionHash: {
      type: String,
      required: true,
      index: true // 添加索引
    },
    blockNumber: {
      type: Number
    },
    gasUsed: {
      type: Number
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true // 添加时间索引
    }
  }],

  // CBT代币转账历史
  tokenTransfers: [{
    from: {
      type: String,
      required: true,
      index: true // 添加索引
    },
    to: {
      type: String,
      required: true,
      index: true // 添加索引
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
      default: 'general',
      enum: ['general', 'tip', 'payment', 'reward', 'refund']
    },
    tags: [String],
    transactionHash: {
      type: String,
      required: true,
      index: true // 添加索引
    },
    blockNumber: {
      type: Number
    },
    gasUsed: {
      type: Number
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
      index: true // 添加状态索引
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true // 添加时间索引
    }
  }],

  // 语言学习相关
  nativeLanguages: [{
    type: String,
    index: true // 添加索引用于语言匹配
  }],
  learningLanguages: [{
    type: String,
    index: true // 添加索引用于语言匹配
  }],
  languageProficiency: [{
    language: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'native'],
      required: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],

  // 用户活动统计
  stats: {
    translationsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    messagesCount: {
      type: Number,
      default: 0,
      min: 0
    },
    postsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    loginStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLoginDate: {
      type: Date,
      index: true // 添加索引用于活跃用户查询
    },
    totalOnlineTime: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // 用户偏好设置
  preferences: {
    language: {
      type: String,
      default: 'zh-CN'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      showProfile: {
        type: Boolean,
        default: true
      },
      showActivity: {
        type: Boolean,
        default: true
      },
      allowMessages: {
        type: Boolean,
        default: true
      }
    }
  },

  // 账户状态
  isActive: {
    type: Boolean,
    default: true,
    index: true // 添加索引
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true // 添加索引
  },
  isBanned: {
    type: Boolean,
    default: false,
    index: true // 添加索引
  },
  banReason: {
    type: String
  },
  banExpiresAt: {
    type: Date
  },

  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now,
    index: true // 添加索引
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true // 添加索引用于活跃用户查询
  }
}, {
  timestamps: true, // 自动管理createdAt和updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 复合索引
UserSchema.index({ email: 1, isActive: 1 }); // 邮箱和活跃状态
UserSchema.index({ walletAddress: 1, isActive: 1 }); // 钱包地址和活跃状态
UserSchema.index({ 'stats.lastLoginDate': -1, isActive: 1 }); // 最后登录时间和活跃状态
UserSchema.index({ nativeLanguages: 1, learningLanguages: 1 }); // 语言匹配
UserSchema.index({ tokenBalance: -1, isActive: 1 }); // 代币余额排序
UserSchema.index({ createdAt: -1 }); // 注册时间排序
UserSchema.index({ 'tokenRewards.timestamp': -1 }); // 奖励时间排序
UserSchema.index({ 'tokenTransfers.timestamp': -1 }); // 转账时间排序

// 文本搜索索引
UserSchema.index({
  username: 'text',
  'profile.firstName': 'text',
  'profile.lastName': 'text',
  'profile.bio': 'text'
});

// 虚拟字段
UserSchema.virtual('fullName').get(function() {
  if (this.profile && this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

UserSchema.virtual('totalTransactions').get(function() {
  return this.tokenRewards.length + this.tokenTransfers.length;
});

UserSchema.virtual('netBalance').get(function() {
  return this.totalEarned - this.totalSpent;
});

// 中间件
UserSchema.pre('save', async function(next) {
  // 更新updatedAt字段
  this.updatedAt = new Date();
  
  // 加密密码
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(12); // 增加salt轮数
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.pre('save', function(next) {
  // 更新代币余额
  if (this.isModified('tokenRewards') || this.isModified('tokenTransfers')) {
    this.totalEarned = this.tokenRewards.reduce((sum, reward) => sum + reward.amount, 0);
    this.totalSpent = this.tokenTransfers
      .filter(transfer => transfer.from === this.walletAddress)
      .reduce((sum, transfer) => sum + transfer.amount, 0);
    this.tokenBalance = this.totalEarned - this.totalSpent;
  }
  next();
});

// 实例方法
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      role: this.role,
      walletAddress: this.walletAddress
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  this.stats.lastLoginDate = new Date();
  return this.save();
};

UserSchema.methods.addTokenReward = function(amount, reason, transactionHash, blockNumber = null) {
  this.tokenRewards.push({
    amount,
    reason,
    transactionHash,
    blockNumber,
    timestamp: new Date()
  });
  this.totalEarned += amount;
  this.tokenBalance += amount;
  return this.save();
};

UserSchema.methods.addTokenTransfer = function(from, to, amount, purpose, transactionHash, blockNumber = null) {
  this.tokenTransfers.push({
    from,
    to,
    amount,
    purpose,
    transactionHash,
    blockNumber,
    timestamp: new Date()
  });
  
  if (from === this.walletAddress) {
    this.totalSpent += amount;
    this.tokenBalance -= amount;
  }
  
  return this.save();
};

// 静态方法
UserSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isBanned: false });
};

UserSchema.statics.findByLanguage = function(language) {
  return this.find({
    $or: [
      { nativeLanguages: language },
      { learningLanguages: language }
    ],
    isActive: true
  });
};

UserSchema.statics.findTopEarners = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ tokenBalance: -1 })
    .limit(limit)
    .select('username profile.firstName profile.lastName tokenBalance totalEarned');
};

UserSchema.statics.getActiveUsersCount = function() {
  return this.countDocuments({ 
    isActive: true, 
    isBanned: false,
    lastActiveAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30天内活跃
  });
};

module.exports = mongoose.model('User', UserSchema);

