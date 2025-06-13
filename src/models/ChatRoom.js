const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请提供聊天室名称'],
    trim: true,
    maxlength: [100, '聊天室名称不能超过100个字符']
  },
  description: {
    type: String,
    maxlength: [500, '描述不能超过500个字符']
  },
  type: {
    type: String,
    enum: ['public', 'private', 'language_exchange'],
    default: 'public'
  },
  languages: [String], // 聊天室支持的语言
  creator: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member'
    }
  }],
  maxMembers: {
    type: Number,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    allowTranslation: {
      type: Boolean,
      default: true
    },
    allowVoiceMessages: {
      type: Boolean,
      default: true
    },
    moderationEnabled: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
ChatRoomSchema.index({ type: 1, languages: 1 });
ChatRoomSchema.index({ creator: 1 });
ChatRoomSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);

