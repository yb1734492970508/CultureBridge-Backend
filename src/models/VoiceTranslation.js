const mongoose = require('mongoose');

const VoiceTranslationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  chatRoom: {
    type: mongoose.Schema.ObjectId,
    ref: 'ChatRoom'
  },
  originalAudio: {
    url: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    size: Number,
    format: String // 'wav', 'mp3', 'webm'
  },
  transcription: {
    text: {
      type: String,
      required: true
    },
    language: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  translations: [{
    language: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    audioUrl: String, // 合成的语音URL
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  }],
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingTime: Number, // 处理时间（毫秒）
  errorMessage: String,
  // CBT代币消费记录
  tokenCost: {
    amount: Number,
    transactionHash: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

// 索引
VoiceTranslationSchema.index({ user: 1, createdAt: -1 });
VoiceTranslationSchema.index({ chatRoom: 1, createdAt: -1 });
VoiceTranslationSchema.index({ processingStatus: 1 });

module.exports = mongoose.model('VoiceTranslation', VoiceTranslationSchema);

