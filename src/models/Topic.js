const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '请提供话题标题'],
    trim: true,
    maxlength: [100, '标题不能超过100个字符']
  },
  description: {
    type: String,
    required: [true, '请提供话题描述'],
    maxlength: [1000, '描述不能超过1000个字符']
  },
  category: {
    type: String,
    required: [true, '请选择话题分类'],
    enum: ['文化交流', '语言学习', '风俗习惯', '艺术欣赏', '美食探索', '旅行体验', '其他']
  },
  tags: [{
    type: String
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Topic', TopicSchema);
