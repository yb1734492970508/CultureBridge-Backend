const mongoose = require('mongoose');

const liveStreamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '直播标题不能为空'],
    trim: true,
    maxlength: [100, '直播标题不能超过100个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '直播描述不能超过500个字符']
  },
  category: {
    type: String,
    required: [true, '直播分类不能为空'],
    enum: ['文化交流', '语言学习', '艺术表演', '教育讲座', '生活分享', '其他']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'live', 'ended'],
    default: 'waiting'
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  streamKey: {
    type: String,
    required: true,
    unique: true
  },
  rtmpUrl: {
    type: String,
    required: true
  },
  hlsUrl: {
    type: String,
    required: true
  },
  viewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  viewerCount: {
    type: Number,
    default: 0
  },
  maxViewers: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // 直播时长（秒）
    default: 0
  },
  thumbnail: {
    type: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  language: {
    type: String,
    default: 'zh-CN'
  },
  quality: {
    type: String,
    enum: ['720p', '1080p', '4K'],
    default: '720p'
  },
  chatEnabled: {
    type: Boolean,
    default: true
  },
  recordingEnabled: {
    type: Boolean,
    default: false
  },
  recordingUrl: {
    type: String
  },
  likes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bannedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    allowComments: {
      type: Boolean,
      default: true
    },
    allowGifts: {
      type: Boolean,
      default: true
    },
    moderationMode: {
      type: String,
      enum: ['none', 'auto', 'manual'],
      default: 'auto'
    }
  }
}, {
  timestamps: true
});

// 索引
liveStreamSchema.index({ status: 1, category: 1 });
liveStreamSchema.index({ host: 1 });
liveStreamSchema.index({ startTime: -1 });
liveStreamSchema.index({ streamKey: 1 }, { unique: true });

// 虚拟字段：计算直播时长
liveStreamSchema.virtual('calculatedDuration').get(function() {
  if (this.startTime && this.endTime) {
    return Math.floor((this.endTime - this.startTime) / 1000);
  }
  return 0;
});

// 中间件：保存前更新直播时长
liveStreamSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  
  // 更新最大观看人数
  if (this.viewerCount > this.maxViewers) {
    this.maxViewers = this.viewerCount;
  }
  
  next();
});

// 静态方法：获取热门直播
liveStreamSchema.statics.getPopularStreams = function(limit = 10) {
  return this.find({ status: 'live' })
    .sort({ viewerCount: -1, startTime: -1 })
    .limit(limit)
    .populate('host', 'username avatar');
};

// 静态方法：获取推荐直播
liveStreamSchema.statics.getRecommendedStreams = function(userId, limit = 10) {
  // 这里可以根据用户的兴趣和历史记录推荐直播
  return this.find({ 
    status: 'live',
    host: { $ne: userId }
  })
    .sort({ viewerCount: -1, startTime: -1 })
    .limit(limit)
    .populate('host', 'username avatar');
};

// 实例方法：添加评论
liveStreamSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content: content,
    timestamp: new Date()
  });
  return this.save();
};

// 实例方法：点赞
liveStreamSchema.methods.addLike = function() {
  this.likes += 1;
  return this.save();
};

// 实例方法：分享
liveStreamSchema.methods.addShare = function() {
  this.shares += 1;
  return this.save();
};

module.exports = mongoose.model('LiveStream', liveStreamSchema);

