const mongoose = require('mongoose');

const VoiceTranslationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  chatRoom: {
    type: mongoose.Schema.ObjectId,
    ref: 'ChatRoom',
    required: false
  },
  originalText: {
    type: String,
    required: [true, '请提供原始文本'],
    maxlength: [5000, '原始文本不能超过5000个字符']
  },
  originalLanguage: {
    type: String,
    required: [true, '请提供原始语言'],
    enum: ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'ar', 'it', 'nl', 'pl', 'tr', 'hi', 'auto']
  },
  originalAudioUrl: {
    type: String,
    required: false
  },
  translations: [{
    language: {
      type: String,
      required: true,
      enum: ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'ar', 'it', 'nl', 'pl', 'tr', 'hi']
    },
    text: {
      type: String,
      required: true,
      maxlength: [5000, '翻译文本不能超过5000个字符']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    audioUrl: {
      type: String,
      required: false
    },
    provider: {
      type: String,
      enum: ['libre', 'mymemory', 'azure', 'google', 'deepl'],
      default: 'libre'
    }
  }],
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  processingTime: {
    type: Number, // 处理时间（毫秒）
    default: 0
  },
  metadata: {
    audioFormat: {
      type: String,
      enum: ['wav', 'mp3', 'ogg', 'webm', 'flac'],
      default: 'wav'
    },
    sampleRate: {
      type: Number,
      default: 16000
    },
    duration: {
      type: Number, // 音频时长（秒）
      default: 0
    },
    fileSize: {
      type: Number, // 文件大小（字节）
      default: 0
    },
    speechProvider: {
      type: String,
      enum: ['whisper', 'azure', 'google', 'local'],
      default: 'whisper'
    },
    translationProvider: {
      type: String,
      enum: ['libre', 'mymemory', 'azure', 'google', 'deepl'],
      default: 'libre'
    }
  },
  // 质量评分
  qualityScore: {
    transcriptionQuality: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    translationQuality: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    overallQuality: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    userRating: {
      type: Number,
      min: 1,
      max: 5
    },
    userFeedback: {
      type: String,
      maxlength: [500, '反馈不能超过500个字符']
    }
  },
  // 使用统计
  usage: {
    playCount: {
      type: Number,
      default: 0
    },
    shareCount: {
      type: Number,
      default: 0
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    }
  },
  // 错误信息
  errors: [{
    stage: {
      type: String,
      enum: ['transcription', 'translation', 'synthesis', 'processing']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'partial'],
    default: 'processing'
  },
  isPublic: {
    type: Boolean,
    default: false
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

// 索引
VoiceTranslationSchema.index({ user: 1, createdAt: -1 });
VoiceTranslationSchema.index({ chatRoom: 1, createdAt: -1 });
VoiceTranslationSchema.index({ originalLanguage: 1 });
VoiceTranslationSchema.index({ 'translations.language': 1 });
VoiceTranslationSchema.index({ status: 1 });
VoiceTranslationSchema.index({ createdAt: -1 });

// 更新时间中间件
VoiceTranslationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 计算总体质量分数
VoiceTranslationSchema.methods.calculateOverallQuality = function() {
  const transcriptionWeight = 0.4;
  const translationWeight = 0.6;
  
  this.qualityScore.overallQuality = Math.round(
    (this.qualityScore.transcriptionQuality * transcriptionWeight + 
     this.qualityScore.translationQuality * translationWeight) * 10
  ) / 10;
};

// 增加播放次数
VoiceTranslationSchema.methods.incrementPlayCount = function() {
  this.usage.playCount += 1;
  this.usage.lastAccessed = new Date();
  return this.save();
};

// 增加分享次数
VoiceTranslationSchema.methods.incrementShareCount = function() {
  this.usage.shareCount += 1;
  return this.save();
};

// 增加下载次数
VoiceTranslationSchema.methods.incrementDownloadCount = function() {
  this.usage.downloadCount += 1;
  this.usage.lastAccessed = new Date();
  return this.save();
};

// 添加错误信息
VoiceTranslationSchema.methods.addError = function(stage, message) {
  this.errors.push({
    stage,
    message,
    timestamp: new Date()
  });
  
  if (this.status === 'processing') {
    this.status = 'failed';
  }
  
  return this.save();
};

// 获取特定语言的翻译
VoiceTranslationSchema.methods.getTranslation = function(language) {
  return this.translations.find(t => t.language === language);
};

// 获取最佳翻译（基于置信度）
VoiceTranslationSchema.methods.getBestTranslation = function() {
  if (this.translations.length === 0) return null;
  
  return this.translations.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );
};

// 检查是否包含特定语言的翻译
VoiceTranslationSchema.methods.hasTranslation = function(language) {
  return this.translations.some(t => t.language === language);
};

// 获取支持的目标语言
VoiceTranslationSchema.methods.getAvailableLanguages = function() {
  return this.translations.map(t => t.language);
};

// 静态方法：获取用户的翻译统计
VoiceTranslationSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalTranslations: { $sum: 1 },
        totalPlayCount: { $sum: '$usage.playCount' },
        totalShareCount: { $sum: '$usage.shareCount' },
        totalDownloadCount: { $sum: '$usage.downloadCount' },
        avgConfidence: { $avg: '$confidence' },
        avgProcessingTime: { $avg: '$processingTime' },
        avgQuality: { $avg: '$qualityScore.overallQuality' },
        languageDistribution: {
          $push: {
            original: '$originalLanguage',
            targets: '$translations.language'
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalTranslations: 0,
    totalPlayCount: 0,
    totalShareCount: 0,
    totalDownloadCount: 0,
    avgConfidence: 0,
    avgProcessingTime: 0,
    avgQuality: 0,
    languageDistribution: []
  };
};

// 静态方法：获取热门翻译
VoiceTranslationSchema.statics.getPopularTranslations = async function(limit = 10) {
  return this.find({ isPublic: true, status: 'completed' })
    .sort({ 'usage.playCount': -1, 'qualityScore.overallQuality': -1 })
    .limit(limit)
    .populate('user', 'username')
    .select('originalText translations confidence qualityScore usage createdAt');
};

// 静态方法：按语言对获取翻译统计
VoiceTranslationSchema.statics.getLanguagePairStats = async function() {
  return this.aggregate([
    { $match: { status: 'completed' } },
    { $unwind: '$translations' },
    {
      $group: {
        _id: {
          from: '$originalLanguage',
          to: '$translations.language'
        },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$translations.confidence' },
        avgQuality: { $avg: '$qualityScore.translationQuality' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('VoiceTranslation', VoiceTranslationSchema);

