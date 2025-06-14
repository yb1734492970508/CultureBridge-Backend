const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },
    type: {
        type: String,
        enum: ['PUBLIC', 'PRIVATE', 'LANGUAGE_EXCHANGE', 'CULTURAL_DISCUSSION', 'STUDY_GROUP', 'VOICE_PRACTICE'],
        default: 'PUBLIC'
    },
    category: {
        type: String,
        enum: ['GENERAL', 'LANGUAGE_LEARNING', 'CULTURAL_EXCHANGE', 'BUSINESS', 'ENTERTAINMENT', 'EDUCATION', 'TRAVEL'],
        default: 'GENERAL'
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    moderators: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        permissions: {
            canMute: {
                type: Boolean,
                default: true
            },
            canKick: {
                type: Boolean,
                default: true
            },
            canDeleteMessages: {
                type: Boolean,
                default: true
            },
            canManageUsers: {
                type: Boolean,
                default: false
            }
        },
        assignedAt: {
            type: Date,
            default: Date.now
        }
    }],
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        lastSeen: {
            type: Date,
            default: Date.now
        },
        role: {
            type: String,
            enum: ['MEMBER', 'VIP', 'MODERATOR', 'ADMIN'],
            default: 'MEMBER'
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'MUTED', 'BANNED'],
            default: 'ACTIVE'
        },
        messageCount: {
            type: Number,
            default: 0
        },
        contributionScore: {
            type: Number,
            default: 0
        }
    }],
    settings: {
        maxParticipants: {
            type: Number,
            default: 100
        },
        isPrivate: {
            type: Boolean,
            default: false
        },
        requireApproval: {
            type: Boolean,
            default: false
        },
        allowVoiceMessages: {
            type: Boolean,
            default: true
        },
        allowFileSharing: {
            type: Boolean,
            default: true
        },
        autoTranslation: {
            enabled: {
                type: Boolean,
                default: true
            },
            targetLanguages: [{
                type: String,
                enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
            }]
        },
        messageRetention: {
            type: Number,
            default: 30 // 天数
        }
    },
    languages: [{
        primary: {
            type: String,
            enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
        },
        secondary: [{
            type: String,
            enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
        }]
    }],
    statistics: {
        totalMessages: {
            type: Number,
            default: 0
        },
        totalParticipants: {
            type: Number,
            default: 0
        },
        activeUsers: {
            type: Number,
            default: 0
        },
        averageMessageLength: {
            type: Number,
            default: 0
        },
        peakConcurrentUsers: {
            type: Number,
            default: 0
        },
        lastActivityAt: {
            type: Date,
            default: Date.now
        }
    },
    rewards: {
        participationReward: {
            type: String,
            default: '0.5' // CBT per message
        },
        qualityBonusReward: {
            type: String,
            default: '1' // CBT for quality messages
        },
        dailyActiveReward: {
            type: String,
            default: '2' // CBT for daily participation
        },
        rewardPool: {
            type: String,
            default: '0'
        }
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'SUSPENDED'],
        default: 'ACTIVE'
    },
    tags: [String],
    avatar: {
        type: String,
        default: ''
    },
    banner: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// 索引
chatRoomSchema.index({ creator: 1 });
chatRoomSchema.index({ type: 1, status: 1 });
chatRoomSchema.index({ category: 1 });
chatRoomSchema.index({ 'participants.user': 1 });
chatRoomSchema.index({ 'languages.primary': 1 });
chatRoomSchema.index({ tags: 1 });
chatRoomSchema.index({ createdAt: -1 });
chatRoomSchema.index({ 'statistics.lastActivityAt': -1 });

// 文本搜索索引
chatRoomSchema.index({
    name: 'text',
    description: 'text',
    tags: 'text'
});

// 虚拟字段
chatRoomSchema.virtual('participantCount').get(function() {
    return this.participants.length;
});

chatRoomSchema.virtual('activeParticipantCount').get(function() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.participants.filter(p => p.lastSeen > oneHourAgo).length;
});

chatRoomSchema.virtual('isActive').get(function() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.statistics.lastActivityAt > oneDayAgo;
});

// 实例方法
chatRoomSchema.methods.addParticipant = function(userId, role = 'MEMBER') {
    const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
    
    if (!existingParticipant) {
        this.participants.push({
            user: userId,
            role: role,
            joinedAt: new Date(),
            lastSeen: new Date()
        });
        
        this.statistics.totalParticipants += 1;
        this.updateActiveUsers();
        return true;
    }
    return false;
};

chatRoomSchema.methods.removeParticipant = function(userId) {
    const index = this.participants.findIndex(p => p.user.toString() === userId.toString());
    if (index > -1) {
        this.participants.splice(index, 1);
        this.statistics.totalParticipants -= 1;
        this.updateActiveUsers();
        return true;
    }
    return false;
};

chatRoomSchema.methods.updateParticipantActivity = function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (participant) {
        participant.lastSeen = new Date();
        participant.messageCount += 1;
        this.statistics.lastActivityAt = new Date();
        this.updateActiveUsers();
        return true;
    }
    return false;
};

chatRoomSchema.methods.updateActiveUsers = function() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.statistics.activeUsers = this.participants.filter(p => p.lastSeen > oneHourAgo).length;
    
    if (this.statistics.activeUsers > this.statistics.peakConcurrentUsers) {
        this.statistics.peakConcurrentUsers = this.statistics.activeUsers;
    }
};

chatRoomSchema.methods.addModerator = function(userId, permissions = {}) {
    const existingModerator = this.moderators.find(m => m.user.toString() === userId.toString());
    
    if (!existingModerator) {
        const defaultPermissions = {
            canMute: true,
            canKick: true,
            canDeleteMessages: true,
            canManageUsers: false
        };
        
        this.moderators.push({
            user: userId,
            permissions: { ...defaultPermissions, ...permissions },
            assignedAt: new Date()
        });
        
        // 更新参与者角色
        const participant = this.participants.find(p => p.user.toString() === userId.toString());
        if (participant) {
            participant.role = 'MODERATOR';
        }
        
        return true;
    }
    return false;
};

chatRoomSchema.methods.removeModerator = function(userId) {
    const index = this.moderators.findIndex(m => m.user.toString() === userId.toString());
    if (index > -1) {
        this.moderators.splice(index, 1);
        
        // 更新参与者角色
        const participant = this.participants.find(p => p.user.toString() === userId.toString());
        if (participant && participant.role === 'MODERATOR') {
            participant.role = 'MEMBER';
        }
        
        return true;
    }
    return false;
};

chatRoomSchema.methods.muteParticipant = function(userId, duration = 3600000) { // 默认1小时
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (participant) {
        participant.status = 'MUTED';
        participant.muteUntil = new Date(Date.now() + duration);
        return true;
    }
    return false;
};

chatRoomSchema.methods.unmuteParticipant = function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (participant && participant.status === 'MUTED') {
        participant.status = 'ACTIVE';
        participant.muteUntil = undefined;
        return true;
    }
    return false;
};

chatRoomSchema.methods.banParticipant = function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (participant) {
        participant.status = 'BANNED';
        return true;
    }
    return false;
};

chatRoomSchema.methods.canUserPost = function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    
    if (!participant) {
        return false; // 不是参与者
    }
    
    if (participant.status === 'BANNED') {
        return false; // 被禁言
    }
    
    if (participant.status === 'MUTED') {
        // 检查禁言是否过期
        if (participant.muteUntil && participant.muteUntil > new Date()) {
            return false; // 仍在禁言期
        } else {
            // 禁言已过期，自动解除
            participant.status = 'ACTIVE';
            participant.muteUntil = undefined;
        }
    }
    
    return true;
};

chatRoomSchema.methods.updateMessageStats = function(messageLength) {
    this.statistics.totalMessages += 1;
    
    // 更新平均消息长度
    const totalLength = this.statistics.averageMessageLength * (this.statistics.totalMessages - 1) + messageLength;
    this.statistics.averageMessageLength = Math.round(totalLength / this.statistics.totalMessages);
    
    this.statistics.lastActivityAt = new Date();
};

chatRoomSchema.methods.calculateRewardDistribution = function() {
    const activeParticipants = this.participants.filter(p => {
        const daysSinceLastSeen = (Date.now() - p.lastSeen) / (1000 * 60 * 60 * 24);
        return daysSinceLastSeen <= 1 && p.messageCount > 0; // 24小时内活跃且发过消息
    });
    
    if (activeParticipants.length === 0) {
        return [];
    }
    
    const totalPool = parseFloat(this.rewards.rewardPool || '0');
    if (totalPool === 0) {
        return [];
    }
    
    // 根据贡献度分配奖励
    const totalContribution = activeParticipants.reduce((sum, p) => sum + p.contributionScore, 0);
    
    return activeParticipants.map(participant => {
        const contribution = participant.contributionScore || 1;
        const rewardRatio = totalContribution > 0 ? contribution / totalContribution : 1 / activeParticipants.length;
        const amount = (totalPool * rewardRatio).toFixed(2);
        
        return {
            userId: participant.user,
            amount: amount,
            reason: 'Chat room participation reward'
        };
    });
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);

