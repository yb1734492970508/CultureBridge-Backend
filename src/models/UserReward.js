const mongoose = require('mongoose');

// 用户奖励数据模型
const userRewardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  
  // 积分系统
  points: {
    learning: {
      type: Number,
      default: 0,
      min: 0,
    },
    engagement: {
      type: Number,
      default: 0,
      min: 0,
    },
    contribution: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  
  // 等级系统
  level: {
    current: {
      type: Number,
      default: 1,
      min: 1,
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextLevelExp: {
      type: Number,
      default: 100,
      min: 1,
    },
  },
  
  // 成就系统
  achievements: [{
    achievementId: {
      type: String,
      required: true,
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
    pointsEarned: {
      type: Number,
      default: 0,
    },
  }],
  
  // 签到系统
  checkInData: {
    streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastCheckIn: {
      type: Date,
      default: null,
    },
    totalCheckIns: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  
  // 购买记录
  purchases: [{
    rewardId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      enum: ['learningPoints', 'engagementPoints', 'contributionPoints', 'totalPoints'],
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // 积分历史记录
  pointsHistory: [{
    type: {
      type: String,
      required: true,
      enum: ['learningPoints', 'engagementPoints', 'contributionPoints'],
    },
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // 统计数据
  stats: {
    totalPointsEarned: {
      type: Number,
      default: 0,
    },
    totalPointsSpent: {
      type: Number,
      default: 0,
    },
    totalAchievements: {
      type: Number,
      default: 0,
    },
    maxStreak: {
      type: Number,
      default: 0,
    },
  },
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// 虚拟字段：总积分
userRewardSchema.virtual('totalPoints').get(function() {
  return this.points.learning + this.points.engagement + this.points.contribution;
});

// 虚拟字段：等级进度百分比
userRewardSchema.virtual('levelProgress').get(function() {
  return Math.floor((this.level.experience / this.level.nextLevelExp) * 100);
});

// 索引
userRewardSchema.index({ userId: 1 });
userRewardSchema.index({ 'points.total': -1 });
userRewardSchema.index({ 'level.current': -1 });
userRewardSchema.index({ 'checkIn.streak': -1 });

// 中间件：更新总积分
userRewardSchema.pre('save', function(next) {
  this.points.total = this.points.learning + this.points.engagement + this.points.contribution;
  next();
});

// 实例方法：添加积分
userRewardSchema.methods.addPoints = function(type, amount, reason) {
  if (!['learningPoints', 'engagementPoints', 'contributionPoints'].includes(type)) {
    throw new Error('Invalid point type');
  }
  
  const pointType = type.replace('Points', '');
  this.points[pointType] += amount;
  this.level.experience += amount;
  this.stats.totalPointsEarned += amount;
  
  // 检查升级
  while (this.level.experience >= this.level.nextLevelExp) {
    this.level.experience -= this.level.nextLevelExp;
    this.level.current += 1;
    this.level.nextLevelExp = Math.floor(this.level.nextLevelExp * 1.5);
  }
  
  // 添加历史记录
  this.pointsHistory.unshift({
    type: pointType + 'Points',
    amount,
    reason,
    timestamp: new Date(),
  });
  
  // 保留最近50条记录
  if (this.pointsHistory.length > 50) {
    this.pointsHistory = this.pointsHistory.slice(0, 50);
  }
  
  return this;
};

// 实例方法：消费积分
userRewardSchema.methods.spendPoints = function(type, amount) {
  if (!['learningPoints', 'engagementPoints', 'contributionPoints', 'totalPoints'].includes(type)) {
    throw new Error('Invalid point type');
  }
  
  let availablePoints;
  if (type === 'totalPoints') {
    availablePoints = this.points.total;
  } else {
    const pointType = type.replace('Points', '');
    availablePoints = this.points[pointType];
  }
  
  if (availablePoints < amount) {
    throw new Error('Insufficient points');
  }
  
  if (type === 'totalPoints') {
    // 按比例从各类积分中扣除
    const learningRatio = this.points.learning / this.points.total;
    const engagementRatio = this.points.engagement / this.points.total;
    const contributionRatio = this.points.contribution / this.points.total;
    
    this.points.learning -= Math.floor(amount * learningRatio);
    this.points.engagement -= Math.floor(amount * engagementRatio);
    this.points.contribution -= Math.floor(amount * contributionRatio);
  } else {
    const pointType = type.replace('Points', '');
    this.points[pointType] -= amount;
  }
  
  this.stats.totalPointsSpent += amount;
  
  return this;
};

// 实例方法：签到
userRewardSchema.methods.checkIn = function() {
  const today = new Date().toDateString();
  const lastCheckIn = this.checkInData.lastCheckIn ? this.checkInData.lastCheckIn.toDateString() : null;
  
  if (lastCheckIn === today) {
    throw new Error('Already checked in today');
  }
  
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
  
  if (lastCheckIn === yesterday) {
    this.checkInData.streak += 1;
  } else {
    this.checkInData.streak = 1;
  }
  
  this.checkInData.lastCheckIn = new Date();
  this.checkInData.totalCheckIns += 1;
  
  // 更新最大连续签到记录
  if (this.checkInData.streak > this.stats.maxStreak) {
    this.stats.maxStreak = this.checkInData.streak;
  }
  
  // 签到奖励
  const baseReward = 5;
  const streakBonus = Math.min(this.checkInData.streak - 1, 10); // 最多10点连续奖励
  const totalReward = baseReward + streakBonus;
  
  this.addPoints('learningPoints', totalReward, `每日签到 (连续${this.checkInData.streak}天)`);
  
  return {
    streak: this.checkInData.streak,
    reward: totalReward,
  };
};

// 实例方法：解锁成就
userRewardSchema.methods.unlockAchievement = function(achievementId, pointsEarned = 0) {
  const existingAchievement = this.achievements.find(a => a.achievementId === achievementId);
  
  if (existingAchievement) {
    throw new Error('Achievement already unlocked');
  }
  
  this.achievements.push({
    achievementId,
    unlockedAt: new Date(),
    pointsEarned,
  });
  
  this.stats.totalAchievements += 1;
  
  if (pointsEarned > 0) {
    this.addPoints('contributionPoints', pointsEarned, `解锁成就: ${achievementId}`);
  }
  
  return this;
};

// 实例方法：购买奖励
userRewardSchema.methods.purchaseReward = function(rewardId, name, cost, currency) {
  this.spendPoints(currency, cost);
  
  this.purchases.push({
    rewardId,
    name,
    cost,
    currency,
    purchasedAt: new Date(),
  });
  
  return this;
};

// 静态方法：获取排行榜
userRewardSchema.statics.getLeaderboard = function(type = 'total', limit = 10) {
  const sortField = type === 'level' ? 'level.current' : `points.${type}`;
  
  return this.find()
    .populate('userId', 'username avatar')
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('userId points level achievements stats');
};

// 静态方法：获取统计数据
userRewardSchema.statics.getGlobalStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalPointsEarned: { $sum: '$stats.totalPointsEarned' },
        totalPointsSpent: { $sum: '$stats.totalPointsSpent' },
        totalAchievements: { $sum: '$stats.totalAchievements' },
        averageLevel: { $avg: '$level.current' },
        maxLevel: { $max: '$level.current' },
        maxStreak: { $max: '$stats.maxStreak' },
      },
    },
  ]);
};

module.exports = mongoose.model('UserReward', userRewardSchema);

