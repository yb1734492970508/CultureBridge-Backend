const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请提供社区名称'],
    trim: true,
    maxlength: [100, '名称不能超过100个字符'],
    unique: true
  },
  description: {
    type: String,
    required: [true, '请提供社区描述'],
    maxlength: [2000, '描述不能超过2000个字符']
  },
  avatar: {
    type: String
  },
  banner: {
    type: String
  },
  category: {
    type: String,
    required: [true, '请选择社区分类'],
    enum: ['文化交流', '语言学习', '艺术爱好', '美食探索', '旅行体验', '生活习惯', '其他']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['成员', '管理员', '创建者'],
      default: '成员'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Community', CommunitySchema);
