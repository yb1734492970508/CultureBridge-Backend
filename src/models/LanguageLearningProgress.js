const mongoose = require('mongoose');

const LanguageLearningProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  language: {
    type: String,
    required: true
  },
  currentLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'native'],
    default: 'beginner'
  },
  skillLevels: {
    listening: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    speaking: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    reading: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    writing: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  achievements: [{
    type: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    },
    tokenReward: {
      amount: Number,
      transactionHash: String
    }
  }],
  studyStreak: {
    current: {
      type: Number,
      default: 0
    },
    longest: {
      type: Number,
      default: 0
    },
    lastStudyDate: Date
  },
  totalStudyTime: {
    type: Number,
    default: 0 // 分钟
  },
  vocabularyLearned: {
    type: Number,
    default: 0
  },
  conversationsCompleted: {
    type: Number,
    default: 0
  },
  // 学习活动记录
  activities: [{
    type: {
      type: String,
      enum: ['vocabulary', 'conversation', 'listening', 'reading', 'writing', 'pronunciation'],
      required: true
    },
    duration: Number, // 分钟
    score: Number, // 0-100
    details: mongoose.Schema.Types.Mixed,
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
LanguageLearningProgressSchema.index({ user: 1, language: 1 }, { unique: true });
LanguageLearningProgressSchema.index({ user: 1 });
LanguageLearningProgressSchema.index({ language: 1 });

// 更新时间中间件
LanguageLearningProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LanguageLearningProgress', LanguageLearningProgressSchema);

