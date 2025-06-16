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
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'pending'],
    default: 'active'
  },
  
  // 区块链相关字段
  walletAddress: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{40}$/, '请提供有效的钱包地址']
  },
  
  // 用户资料信息
  profile: {
    firstName: {
      type: String,
      maxlength: [50, '名字不能超过50个字符']
    },
    lastName: {
      type: String,
      maxlength: [50, '姓氏不能超过50个字符']
    },
    avatar: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      maxlength: [500, '个人简介不能超过500个字符']
    },
    location: {
      type: String,
      maxlength: [100, '位置不能超过100个字符']
    },
    website: {
      type: String,
      maxlength: [200, '网站链接不能超过200个字符']
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    }
  },
  
  // 语言相关
  languages: {
    native: [{
      code: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      proficiency: {
        type: String,
        enum: ['native', 'fluent', 'intermediate', 'beginner'],
        default: 'native'
      }
    }],
    learning: [{
      code: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      proficiency: {
        type: String,
        enum: ['fluent', 'intermediate', 'beginner'],
        required: true
      },
      startDate: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // CBT代币相关
  tokenStats: {
    totalEarned: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    },
    level: {
      type: String,
      enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'],
      default: 'BRONZE'
    },
    lastRewardTime: {
      type: Date
    },
    dailyRewardClaimed: {
      type: Date
    }
  },
  
  // 活动统计
  activityStats: {
    messagesCount: {
      type: Number,
      default: 0
    },
    translationsCount: {
      type: Number,
      default: 0
    },
    voiceMessagesCount: {
      type: Number,
      default: 0
    },
    contentCreatedCount: {
      type: Number,
      default: 0
    },
    loginStreak: {
      type: Number,
      default: 0
    },
    lastLoginDate: {
      type: Date
    },
    totalLoginDays: {
      type: Number,
      default: 0
    }
  },
  
  // 社交功能
  social: {
    followers: [{
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }],
    following: [{
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }],
    friends: [{
      user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'blocked'],
        default: 'pending'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // 设置和偏好
  settings: {
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
      rewards: {
        type: Boolean,
        default: true
      },
      messages: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public'
      },
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      allowDirectMessages: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // 验证相关
  verification: {
    email: {
      verified: {
        type: Boolean,
        default: false
      },
      token: String,
      expires: Date
    },
    phone: {
      verified: {
        type: Boolean,
        default: false
      },
      number: String,
      token: String,
      expires: Date
    },
    identity: {
      verified: {
        type: Boolean,
        default: false
      },
      documents: [String],
      verifiedAt: Date
    }
  },
  
  // 安全相关
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      select: false
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastPasswordChange: {
      type: Date,
      default: Date.now
    }
  },
  
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段：全名
UserSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// 虚拟字段：账户锁定状态
UserSchema.virtual('isLocked').get(function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// 索引
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ walletAddress: 1 });
UserSchema.index({ 'tokenStats.level': 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastActiveAt: -1 });

// 密码加密中间件
UserSchema.pre('save', async function(next) {
  // 只有密码被修改时才加密
  if (!this.isModified('password')) {
    next();
  }
  
  // 加密密码
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.password = await bcrypt.hash(this.password, salt);
  
  // 更新密码修改时间
  this.security.lastPasswordChange = new Date();
  
  next();
});

// 更新时间戳中间件
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 密码验证方法
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 生成JWT Token
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      username: this.username,
      role: this.role,
      walletAddress: this.walletAddress
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

// 生成密码重置Token
UserSchema.methods.getResetPasswordToken = function() {
  // 生成token
  const resetToken = require('crypto').randomBytes(20).toString('hex');
  
  // 哈希token并设置到字段
  this.security.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // 设置过期时间（10分钟）
  this.security.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// 增加登录尝试次数
UserSchema.methods.incLoginAttempts = function() {
  // 如果之前有锁定且已过期，重置尝试次数
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        'security.lockUntil': 1
      },
      $set: {
        'security.loginAttempts': 1
      }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // 如果达到最大尝试次数且未锁定，则锁定账户
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2小时
  
  if (this.security.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { 'security.lockUntil': Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// 重置登录尝试次数
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    }
  });
};

// 更新活动时间
UserSchema.methods.updateActivity = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

// 更新代币统计
UserSchema.methods.updateTokenStats = function(earned = 0, spent = 0) {
  this.tokenStats.totalEarned += earned;
  this.tokenStats.totalSpent += spent;
  this.tokenStats.currentBalance = this.tokenStats.totalEarned - this.tokenStats.totalSpent;
  
  // 更新用户等级
  const balance = this.tokenStats.currentBalance;
  if (balance >= 10000) {
    this.tokenStats.level = 'DIAMOND';
  } else if (balance >= 2000) {
    this.tokenStats.level = 'PLATINUM';
  } else if (balance >= 500) {
    this.tokenStats.level = 'GOLD';
  } else if (balance >= 100) {
    this.tokenStats.level = 'SILVER';
  } else {
    this.tokenStats.level = 'BRONZE';
  }
  
  return this.save();
};

// 更新活动统计
UserSchema.methods.updateActivityStats = function(type, count = 1) {
  const validTypes = ['messagesCount', 'translationsCount', 'voiceMessagesCount', 'contentCreatedCount'];
  
  if (validTypes.includes(type)) {
    this.activityStats[type] += count;
  }
  
  return this.save();
};

// 检查每日登录奖励
UserSchema.methods.canClaimDailyReward = function() {
  if (!this.tokenStats.dailyRewardClaimed) {
    return true;
  }
  
  const today = new Date();
  const lastClaim = new Date(this.tokenStats.dailyRewardClaimed);
  
  // 检查是否是不同的日期
  return today.toDateString() !== lastClaim.toDateString();
};

// 标记每日奖励已领取
UserSchema.methods.markDailyRewardClaimed = function() {
  this.tokenStats.dailyRewardClaimed = new Date();
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);

