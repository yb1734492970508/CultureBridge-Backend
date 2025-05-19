const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '请提供活动标题'],
    trim: true,
    maxlength: [200, '标题不能超过200个字符']
  },
  description: {
    type: String,
    required: [true, '请提供活动描述'],
    maxlength: [2000, '描述不能超过2000个字符']
  },
  location: {
    type: String,
    required: [true, '请提供活动地点']
  },
  startDate: {
    type: Date,
    required: [true, '请提供活动开始时间']
  },
  endDate: {
    type: Date,
    required: [true, '请提供活动结束时间']
  },
  category: {
    type: String,
    required: [true, '请选择活动分类'],
    enum: ['文化交流', '语言学习', '艺术表演', '美食品鉴', '旅行探索', '节日庆典', '其他']
  },
  image: {
    type: String
  },
  capacity: {
    type: Number,
    default: 0
  },
  fee: {
    type: Number,
    default: 0
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['已报名', '已确认', '已取消'],
      default: '已报名'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Event', EventSchema);
