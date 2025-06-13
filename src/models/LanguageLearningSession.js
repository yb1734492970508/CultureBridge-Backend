const mongoose = require('mongoose');

const LanguageLearningSessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '请提供学习会话标题'],
    trim: true,
    maxlength: [100, '标题不能超过100个字符']
  },
  description: {
    type: String,
    required: [true, '请提供会话描述'],
    maxlength: [1000, '描述不能超过1000个字符']
  },
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    completedLessons: [String],
    currentLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    }
  }],
  targetLanguage: {
    type: String,
    required: [true, '请指定目标语言']
  },
  sourceLanguage: {
    type: String,
    required: [true, '请指定源语言']
  },
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  sessionType: {
    type: String,
    enum: ['one_on_one', 'group', 'self_study'],
    default: 'group'
  },
  maxStudents: {
    type: Number,
    default: 10,
    min: [1, '至少需要1个学生'],
    max: [50, '最多50个学生']
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    sessions: [{
      date: Date,
      startTime: String,
      endTime: String,
      topic: String,
      completed: {
        type: Boolean,
        default: false
      }
    }],
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  curriculum: [{
    lesson: {
      type: String,
      required: true
    },
    objectives: [String],
    materials: [{
      type: {
        type: String,
        enum: ['text', 'audio', 'video', 'exercise', 'quiz']
      },
      title: String,
      url: String,
      description: String
    }],
    duration: {
      type: Number, // 分钟
      default: 60
    },
    order: {
      type: Number,
      required: true
    }
  }],
  // CBT代币奖励系统
  tokenRewards: {
    teacherReward: {
      type: Number,
      default: 15
    },
    studentCompletionReward: {
      type: Number,
      default: 8
    },
    progressMilestoneReward: {
      type: Number,
      default: 5
    },
    perfectAttendanceBonus: {
      type: Number,
      default: 10
    }
  },
  // 评价系统
  ratings: [{
    student: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    teachingQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    materialQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    engagement: {
      type: Number,
      min: 1,
      max: 5
    },
    overallRating: {
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
  // 学习成果跟踪
  learningOutcomes: [{
    student: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    preAssessment: {
      score: Number,
      date: Date
    },
    postAssessment: {
      score: Number,
      date: Date
    },
    skillsImproved: [String],
    weakAreas: [String],
    recommendations: String
  }],
  // 互动功能
  discussions: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      required: true,
      maxlength: [1000, '消息不能超过1000个字符']
    },
    replies: [{
      user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      message: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 作业和练习
  assignments: [{
    title: String,
    description: String,
    dueDate: Date,
    submissions: [{
      student: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      content: String,
      submittedAt: {
        type: Date,
        default: Date.now
      },
      grade: {
        type: Number,
        min: 0,
        max: 100
      },
      feedback: String
    }]
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
    default: 'draft'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    enum: ['CBT', 'USD', 'EUR', 'CNY'],
    default: 'CBT'
  },
  tags: [String],
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
LanguageLearningSessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 计算平均评分
LanguageLearningSessionSchema.methods.calculateAverageRating = function() {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
  } else {
    const sum = this.ratings.reduce((acc, rating) => acc + rating.overallRating, 0);
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
  }
};

// 检查用户是否已注册
LanguageLearningSessionSchema.methods.isUserEnrolled = function(userId) {
  return this.students.some(student => 
    student.user.toString() === userId.toString()
  );
};

// 获取可用名额
LanguageLearningSessionSchema.methods.getAvailableSlots = function() {
  return this.maxStudents - this.students.length;
};

// 计算学生进度
LanguageLearningSessionSchema.methods.calculateStudentProgress = function(userId) {
  const student = this.students.find(s => s.user.toString() === userId.toString());
  if (!student) return 0;
  
  const totalLessons = this.curriculum.length;
  const completedLessons = student.completedLessons.length;
  
  return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
};

module.exports = mongoose.model('LanguageLearningSession', LanguageLearningSessionSchema);

