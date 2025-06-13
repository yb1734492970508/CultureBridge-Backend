const mongoose = require('mongoose');

const CulturalExchangeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '请提供交流活动标题'],
    trim: true,
    maxlength: [100, '标题不能超过100个字符']
  },
  description: {
    type: String,
    required: [true, '请提供活动描述'],
    maxlength: [1000, '描述不能超过1000个字符']
  },
  organizer: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    contribution: {
      type: String,
      maxlength: [500, '贡献描述不能超过500个字符']
    }
  }],
  category: {
    type: String,
    required: true,
    enum: ['language_exchange', 'cultural_sharing', 'cooking', 'music', 'art', 'literature', 'history', 'traditions', 'festivals', 'other']
  },
  languages: [{
    type: String,
    required: true
  }],
  maxParticipants: {
    type: Number,
    default: 20,
    min: [2, '至少需要2个参与者'],
    max: [100, '最多100个参与者']
  },
  startTime: {
    type: Date,
    required: [true, '请提供开始时间']
  },
  endTime: {
    type: Date,
    required: [true, '请提供结束时间']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  location: {
    type: {
      type: String,
      enum: ['online', 'offline', 'hybrid'],
      default: 'online'
    },
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    platform: String // 在线平台名称
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  // CBT代币奖励设置
  tokenRewards: {
    organizerReward: {
      type: Number,
      default: 10
    },
    participantReward: {
      type: Number,
      default: 5
    },
    completionBonus: {
      type: Number,
      default: 3
    }
  },
  // 评价和反馈
  ratings: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [500, '评论不能超过500个字符']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  // 学习成果
  learningOutcomes: [{
    participant: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    skillsLearned: [String],
    culturalInsights: String,
    languageProgress: {
      before: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced']
      },
      after: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced']
      }
    }
  }],
  // 媒体资源
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document']
    },
    url: String,
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  isPublic: {
    type: Boolean,
    default: true
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

// 更新时间中间件
CulturalExchangeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 计算平均评分
CulturalExchangeSchema.methods.calculateAverageRating = function() {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
  } else {
    const sum = this.ratings.reduce((acc, rating) => acc + rating.rating, 0);
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
  }
};

// 检查用户是否已参与
CulturalExchangeSchema.methods.isUserParticipant = function(userId) {
  return this.participants.some(participant => 
    participant.user.toString() === userId.toString()
  );
};

// 获取可用名额
CulturalExchangeSchema.methods.getAvailableSlots = function() {
  return this.maxParticipants - this.participants.length;
};

module.exports = mongoose.model('CulturalExchange', CulturalExchangeSchema);

