const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  // 基本信息
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true // 目标语言
  },
  sourceLanguage: {
    type: String,
    default: 'zh-CN' // 源语言
  },
  
  // 课程内容
  thumbnail: String,
  category: {
    type: String,
    enum: ['language', 'culture', 'business', 'travel', 'academic'],
    required: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  
  // 课程结构
  lessons: [{
    id: String,
    title: String,
    description: String,
    type: {
      type: String,
      enum: ['video', 'audio', 'text', 'interactive', 'quiz']
    },
    content: mongoose.Schema.Types.Mixed,
    duration: Number, // 分钟
    order: Number,
    isRequired: {
      type: Boolean,
      default: true
    },
    points: {
      type: Number,
      default: 10
    }
  }],
  
  // 统计信息
  stats: {
    totalLessons: {
      type: Number,
      default: 0
    },
    estimatedDuration: {
      type: Number,
      default: 0 // 分钟
    },
    enrolledCount: {
      type: Number,
      default: 0
    },
    completedCount: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  
  // 奖励设置
  rewards: {
    completionPoints: {
      type: Number,
      default: 100
    },
    perfectScoreBonus: {
      type: Number,
      default: 50
    },
    achievements: [String] // 完成课程可获得的成就
  },
  
  // 课程设置
  settings: {
    isPublished: {
      type: Boolean,
      default: false
    },
    isFree: {
      type: Boolean,
      default: true
    },
    price: {
      type: Number,
      default: 0
    },
    maxEnrollments: Number,
    enrollmentDeadline: Date,
    startDate: Date,
    endDate: Date
  },
  
  // 创建者信息
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 标签和搜索
  tags: [String],
  keywords: [String],
  
  // 系统字段
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'draft'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段
courseSchema.virtual('completionRate').get(function() {
  if (this.stats.enrolledCount === 0) return 0;
  return (this.stats.completedCount / this.stats.enrolledCount * 100).toFixed(2);
});

// 索引
courseSchema.index({ language: 1, level: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ 'stats.averageRating': -1 });
courseSchema.index({ 'stats.enrolledCount': -1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ status: 1 });

// 文本搜索索引
courseSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
  keywords: 'text'
});

// 实例方法
courseSchema.methods.addLesson = function(lessonData) {
  const lesson = {
    id: new mongoose.Types.ObjectId().toString(),
    ...lessonData,
    order: this.lessons.length + 1
  };
  
  this.lessons.push(lesson);
  this.stats.totalLessons = this.lessons.length;
  this.stats.estimatedDuration = this.lessons.reduce((total, l) => total + (l.duration || 0), 0);
  
  return this.save();
};

courseSchema.methods.updateRating = function(newRating) {
  const totalScore = this.stats.averageRating * this.stats.totalRatings + newRating;
  this.stats.totalRatings += 1;
  this.stats.averageRating = totalScore / this.stats.totalRatings;
  
  return this.save();
};

courseSchema.methods.enroll = function() {
  this.stats.enrolledCount += 1;
  return this.save();
};

courseSchema.methods.complete = function() {
  this.stats.completedCount += 1;
  return this.save();
};

// 静态方法
courseSchema.statics.findByLanguage = function(language, level = null) {
  const query = { language, status: 'published' };
  if (level) query.level = level;
  return this.find(query);
};

courseSchema.statics.findPopular = function(limit = 10) {
  return this.find({ status: 'published' })
    .sort({ 'stats.enrolledCount': -1 })
    .limit(limit);
};

courseSchema.statics.findTopRated = function(limit = 10) {
  return this.find({ 
    status: 'published',
    'stats.totalRatings': { $gte: 5 }
  })
    .sort({ 'stats.averageRating': -1 })
    .limit(limit);
};

courseSchema.statics.searchCourses = function(query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    status: 'published',
    ...filters
  };
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

// 中间件
courseSchema.pre('save', function(next) {
  if (this.isModified('lessons')) {
    this.stats.totalLessons = this.lessons.length;
    this.stats.estimatedDuration = this.lessons.reduce((total, lesson) => {
      return total + (lesson.duration || 0);
    }, 0);
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema);

