const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '请提供资源标题'],
    trim: true,
    maxlength: [200, '标题不能超过200个字符']
  },
  description: {
    type: String,
    required: [true, '请提供资源描述'],
    maxlength: [2000, '描述不能超过2000个字符']
  },
  type: {
    type: String,
    required: [true, '请选择资源类型'],
    enum: ['文章', '视频', '音频', '文档', '图片', '链接', '其他']
  },
  category: {
    type: String,
    required: [true, '请选择资源分类'],
    enum: ['语言学习', '文化知识', '历史传统', '艺术欣赏', '生活习惯', '其他']
  },
  language: {
    type: String,
    required: [true, '请选择资源语言']
  },
  level: {
    type: String,
    enum: ['初级', '中级', '高级', '不限'],
    default: '不限'
  },
  file: {
    type: String
  },
  link: {
    type: String
  },
  tags: [{
    type: String
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resource', ResourceSchema);
