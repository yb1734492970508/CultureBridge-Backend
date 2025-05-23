const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 文化活动模型
const ActivitySchema = new Schema({
  // 基本信息
  name: {
    type: String,
    required: [true, '活动名称是必填项'],
    trim: true
  },
  description: {
    type: String,
    required: [true, '活动描述是必填项']
  },
  activityType: {
    type: String,
    required: [true, '活动类型是必填项'],
    enum: ['展览', '表演', '讲座', '工作坊', '交流会', '其他']
  },
  startTime: {
    type: Date,
    required: [true, '开始时间是必填项']
  },
  endTime: {
    type: Date,
    required: [true, '结束时间是必填项']
  },
  location: {
    type: String,
    required: [true, '活动地点是必填项']
  },
  capacity: {
    type: Number,
    default: 0
  },
  fee: {
    type: Number,
    default: 0
  },
  
  // 组织者信息
  organizer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '组织者是必填项']
  },
  organizerWallet: {
    type: String,
    trim: true
  },
  
  // 状态信息
  status: {
    type: String,
    enum: ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'PLANNED'
  },
  
  // 区块链相关
  blockchainActivityId: {
    type: Number
  },
  contentHash: {
    type: String
  },
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING'
  },
  verifier: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verifierWallet: {
    type: String,
    trim: true
  },
  verificationComments: {
    type: String
  },
  blockchainSyncedAt: {
    type: Date
  },
  transactionHash: {
    type: String
  },
  
  // 文化标签
  culturalTags: [{
    type: String,
    trim: true
  }],
  
  // 参与者信息
  participants: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    wallet: {
      type: String,
      trim: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    attended: {
      type: Boolean,
      default: false
    },
    feedback: {
      type: String
    }
  }],
  participantCount: {
    type: Number,
    default: 0
  },
  
  // 时间戳
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
ActivitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 生成内容哈希的方法
ActivitySchema.methods.generateContentHash = function() {
  const content = `${this.name}|${this.description}|${this.activityType}|${this.startTime}|${this.endTime}|${this.location}`;
  return require('crypto').createHash('sha256').update(content).digest('hex');
};

// 检查活动是否可以参与
ActivitySchema.methods.canJoin = function() {
  const now = new Date();
  return (
    (this.status === 'PLANNED' || this.status === 'ONGOING') &&
    this.startTime > now &&
    (this.capacity === 0 || this.participantCount < this.capacity)
  );
};

// 添加参与者
ActivitySchema.methods.addParticipant = function(user, wallet) {
  // 检查用户是否已经参与
  const existingParticipant = this.participants.find(p => 
    p.user.toString() === user._id.toString()
  );
  
  if (existingParticipant) {
    return false;
  }
  
  // 添加新参与者
  this.participants.push({
    user: user._id,
    wallet: wallet || user.walletAddress,
    joinedAt: new Date()
  });
  
  // 更新参与人数
  this.participantCount = this.participants.length;
  
  return true;
};

// 记录参与者出席
ActivitySchema.methods.recordAttendance = function(userId) {
  const participant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  );
  
  if (!participant) {
    return false;
  }
  
  participant.attended = true;
  return true;
};

// 提交参与反馈
ActivitySchema.methods.submitFeedback = function(userId, feedback) {
  const participant = this.participants.find(p => 
    p.user.toString() === userId.toString()
  );
  
  if (!participant) {
    return false;
  }
  
  participant.feedback = feedback;
  return true;
};

module.exports = mongoose.model('Activity', ActivitySchema);
