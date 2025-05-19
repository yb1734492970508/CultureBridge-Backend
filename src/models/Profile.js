const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, '请提供姓名']
  },
  avatar: {
    type: String
  },
  bio: {
    type: String,
    maxlength: [500, '个人简介不能超过500个字符']
  },
  location: {
    type: String
  },
  languages: [{
    language: {
      type: String,
      required: true
    },
    proficiency: {
      type: String,
      enum: ['初级', '中级', '高级', '母语'],
      required: true
    }
  }],
  interests: [{
    type: String
  }],
  socialMedia: {
    wechat: String,
    weibo: String,
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Profile', ProfileSchema);
