const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  chatRoom: {
    type: mongoose.Schema.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, '请提供消息内容'],
    maxlength: [2000, '消息内容不能超过2000个字符']
  },
  originalLanguage: {
    type: String,
    required: true
  },
  translations: [{
    language: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  }],
  messageType: {
    type: String,
    enum: ['text', 'voice', 'image', 'file', 'system'],
    default: 'text'
  },
  voiceData: {
    audioUrl: String,
    duration: Number, // 秒
    transcription: String,
    originalAudioUrl: String // 原始语音文件
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimeType: String
  }],
  replyTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'ChatMessage'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    emoji: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  // CBT代币奖励相关
  tokenReward: {
    amount: Number,
    reason: String,
    transactionHash: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
ChatMessageSchema.index({ chatRoom: 1, createdAt: -1 });
ChatMessageSchema.index({ sender: 1 });
ChatMessageSchema.index({ replyTo: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);

