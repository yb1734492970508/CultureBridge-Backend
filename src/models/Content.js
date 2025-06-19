const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['article', 'video', 'audio', 'image', 'lesson', 'exercise', 'quiz', 'story', 'recipe', 'tutorial']
  },
  category: {
    type: String,
    required: true,
    enum: ['language', 'culture', 'history', 'food', 'travel', 'art', 'music', 'literature', 'tradition', 'festival']
  },
  language: {
    type: String,
    required: true
  },
  targetLanguage: {
    type: String,
    default: null
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'native'],
    default: 'beginner'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  media: {
    images: [{
      url: String,
      caption: String,
      alt: String
    }],
    videos: [{
      url: String,
      title: String,
      duration: Number
    }],
    audios: [{
      url: String,
      title: String,
      duration: Number
    }],
    documents: [{
      url: String,
      title: String,
      type: String
    }]
  },
  metadata: {
    readTime: {
      type: Number, // 阅读时间（分钟）
      default: 0
    },
    difficulty: {
      type: Number, // 1-10 难度评分
      min: 1,
      max: 10,
      default: 5
    },
    popularity: {
      type: Number,
      default: 0
    },
    engagement: {
      views: {
        type: Number,
        default: 0
      },
      likes: {
        type: Number,
        default: 0
      },
      shares: {
        type: Number,
        default: 0
      },
      comments: {
        type: Number,
        default: 0
      },
      bookmarks: {
        type: Number,
        default: 0
      }
    }
  },
  interactions: {
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    bookmarks: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    shares: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      platform: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'premium', 'members_only'],
    default: 'public'
  },
  featured: {
    type: Boolean,
    default: false
  },
  trending: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段
contentSchema.virtual('likeCount').get(function() {
  return this.interactions.likes ? this.interactions.likes.length : 0;
});

contentSchema.virtual('bookmarkCount').get(function() {
  return this.interactions.bookmarks ? this.interactions.bookmarks.length : 0;
});

contentSchema.virtual('shareCount').get(function() {
  return this.interactions.shares ? this.interactions.shares.length : 0;
});

contentSchema.virtual('engagementScore').get(function() {
  const views = this.metadata.engagement.views || 0;
  const likes = this.likeCount || 0;
  const shares = this.shareCount || 0;
  const comments = this.metadata.engagement.comments || 0;
  const bookmarks = this.bookmarkCount || 0;
  
  // 计算参与度分数
  return (likes * 2 + shares * 3 + comments * 2 + bookmarks * 1.5) / Math.max(views, 1) * 100;
});

// 索引
contentSchema.index({ title: 'text', description: 'text', content: 'text', tags: 'text' });
contentSchema.index({ type: 1, category: 1 });
contentSchema.index({ language: 1, level: 1 });
contentSchema.index({ author: 1 });
contentSchema.index({ status: 1, visibility: 1 });
contentSchema.index({ featured: 1, trending: 1 });
contentSchema.index({ publishedAt: -1 });
contentSchema.index({ 'metadata.engagement.views': -1 });
contentSchema.index({ 'metadata.popularity': -1 });

// 中间件
contentSchema.pre('save', function(next) {
  if (this.isModified('content') && this.content) {
    // 估算阅读时间（假设每分钟200字）
    const wordCount = this.content.split(/\s+/).length;
    this.metadata.readTime = Math.ceil(wordCount / 200);
  }
  
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  this.lastModified = new Date();
  next();
});

// 实例方法
contentSchema.methods.addLike = function(userId) {
  const existingLike = this.interactions.likes.find(like => 
    like.user.toString() === userId.toString()
  );
  
  if (existingLike) {
    return false; // 已经点赞
  }
  
  this.interactions.likes.push({ user: userId });
  this.metadata.engagement.likes = this.interactions.likes.length;
  return true;
};

contentSchema.methods.removeLike = function(userId) {
  const likeIndex = this.interactions.likes.findIndex(like => 
    like.user.toString() === userId.toString()
  );
  
  if (likeIndex === -1) {
    return false; // 没有点赞
  }
  
  this.interactions.likes.splice(likeIndex, 1);
  this.metadata.engagement.likes = this.interactions.likes.length;
  return true;
};

contentSchema.methods.addBookmark = function(userId) {
  const existingBookmark = this.interactions.bookmarks.find(bookmark => 
    bookmark.user.toString() === userId.toString()
  );
  
  if (existingBookmark) {
    return false; // 已经收藏
  }
  
  this.interactions.bookmarks.push({ user: userId });
  this.metadata.engagement.bookmarks = this.interactions.bookmarks.length;
  return true;
};

contentSchema.methods.removeBookmark = function(userId) {
  const bookmarkIndex = this.interactions.bookmarks.findIndex(bookmark => 
    bookmark.user.toString() === userId.toString()
  );
  
  if (bookmarkIndex === -1) {
    return false; // 没有收藏
  }
  
  this.interactions.bookmarks.splice(bookmarkIndex, 1);
  this.metadata.engagement.bookmarks = this.interactions.bookmarks.length;
  return true;
};

contentSchema.methods.addShare = function(userId, platform) {
  this.interactions.shares.push({ 
    user: userId, 
    platform: platform || 'unknown' 
  });
  this.metadata.engagement.shares = this.interactions.shares.length;
  return true;
};

contentSchema.methods.incrementView = function() {
  this.metadata.engagement.views += 1;
  return this.save();
};

contentSchema.methods.isLikedBy = function(userId) {
  return this.interactions.likes.some(like => 
    like.user.toString() === userId.toString()
  );
};

contentSchema.methods.isBookmarkedBy = function(userId) {
  return this.interactions.bookmarks.some(bookmark => 
    bookmark.user.toString() === userId.toString()
  );
};

// 静态方法
contentSchema.statics.findByCategory = function(category, options = {}) {
  const query = { 
    category, 
    status: 'published',
    visibility: { $in: ['public', 'members_only'] }
  };
  
  return this.find(query)
    .populate('author', 'username avatar')
    .sort({ publishedAt: -1 })
    .limit(options.limit || 20);
};

contentSchema.statics.findByLanguage = function(language, options = {}) {
  const query = { 
    language, 
    status: 'published',
    visibility: { $in: ['public', 'members_only'] }
  };
  
  return this.find(query)
    .populate('author', 'username avatar')
    .sort({ 'metadata.engagement.views': -1 })
    .limit(options.limit || 20);
};

contentSchema.statics.findTrending = function(options = {}) {
  const query = { 
    status: 'published',
    visibility: { $in: ['public', 'members_only'] },
    publishedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 最近7天
  };
  
  return this.find(query)
    .populate('author', 'username avatar')
    .sort({ 'metadata.engagement.views': -1, 'metadata.engagement.likes': -1 })
    .limit(options.limit || 10);
};

contentSchema.statics.findFeatured = function(options = {}) {
  const query = { 
    featured: true,
    status: 'published',
    visibility: { $in: ['public', 'members_only'] }
  };
  
  return this.find(query)
    .populate('author', 'username avatar')
    .sort({ publishedAt: -1 })
    .limit(options.limit || 5);
};

contentSchema.statics.searchContent = function(searchTerm, options = {}) {
  const query = {
    $text: { $search: searchTerm },
    status: 'published',
    visibility: { $in: ['public', 'members_only'] }
  };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.language) {
    query.language = options.language;
  }
  
  if (options.level) {
    query.level = options.level;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .populate('author', 'username avatar')
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

module.exports = mongoose.model('Content', contentSchema);

