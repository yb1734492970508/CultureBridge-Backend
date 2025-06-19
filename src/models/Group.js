const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['language', 'culture', 'hobby', 'professional', 'travel', 'food', 'art', 'music', 'sports', 'technology']
  },
  language: {
    type: String,
    required: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'native'],
    default: 'beginner'
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
  isPrivate: {
    type: Boolean,
    default: false
  },
  maxMembers: {
    type: Number,
    default: 100,
    max: 1000
  },
  tags: [{
    type: String,
    trim: true
  }],
  avatar: {
    type: String,
    default: ''
  },
  banner: {
    type: String,
    default: ''
  },
  rules: [{
    title: String,
    description: String
  }],
  settings: {
    allowInvites: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    allowVoiceChat: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalMessages: {
      type: Number,
      default: 0
    },
    activeMembers: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段
groupSchema.virtual('memberCount').get(function() {
  return this.members ? this.members.length : 0;
});

// 索引
groupSchema.index({ name: 'text', description: 'text', tags: 'text' });
groupSchema.index({ category: 1, language: 1 });
groupSchema.index({ creator: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ isActive: 1, isPrivate: 1 });

// 中间件
groupSchema.pre('save', function(next) {
  if (this.isModified('members')) {
    this.stats.activeMembers = this.members.filter(member => 
      member.role !== 'banned'
    ).length;
  }
  next();
});

// 实例方法
groupSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    return false; // 用户已经是成员
  }
  
  if (this.members.length >= this.maxMembers) {
    throw new Error('Group has reached maximum member limit');
  }
  
  this.members.push({
    user: userId,
    role: role,
    joinedAt: new Date()
  });
  
  return true;
};

groupSchema.methods.removeMember = function(userId) {
  const memberIndex = this.members.findIndex(member => 
    member.user.toString() === userId.toString()
  );
  
  if (memberIndex === -1) {
    return false; // 用户不是成员
  }
  
  this.members.splice(memberIndex, 1);
  return true;
};

groupSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (!member) {
    return false; // 用户不是成员
  }
  
  member.role = newRole;
  return true;
};

groupSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.user.toString() === userId.toString()
  );
};

groupSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  return member ? member.role : null;
};

// 静态方法
groupSchema.statics.findByCategory = function(category, options = {}) {
  const query = { category, isActive: true };
  
  if (!options.includePrivate) {
    query.isPrivate = false;
  }
  
  return this.find(query)
    .populate('creator', 'username avatar')
    .populate('members.user', 'username avatar')
    .sort({ 'stats.lastActivity': -1 });
};

groupSchema.statics.findByLanguage = function(language, options = {}) {
  const query = { language, isActive: true };
  
  if (!options.includePrivate) {
    query.isPrivate = false;
  }
  
  return this.find(query)
    .populate('creator', 'username avatar')
    .populate('members.user', 'username avatar')
    .sort({ memberCount: -1 });
};

groupSchema.statics.searchGroups = function(searchTerm, options = {}) {
  const query = {
    $text: { $search: searchTerm },
    isActive: true
  };
  
  if (!options.includePrivate) {
    query.isPrivate = false;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .populate('creator', 'username avatar')
    .populate('members.user', 'username avatar')
    .sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Group', groupSchema);

