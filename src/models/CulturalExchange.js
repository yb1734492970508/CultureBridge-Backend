const mongoose = require('mongoose');

const culturalExchangeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        maxlength: 2000
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['CULTURAL_SHARING', 'LANGUAGE_EXCHANGE', 'TRADITION_DISCUSSION', 'FOOD_CULTURE', 'FESTIVAL_CELEBRATION', 'TRAVEL_EXPERIENCE', 'BUSINESS_CULTURE', 'EDUCATIONAL_EXCHANGE'],
        required: true
    },
    category: {
        type: String,
        enum: ['DISCUSSION', 'Q_AND_A', 'STORYTELLING', 'TUTORIAL', 'DEBATE', 'COLLABORATION'],
        required: true
    },
    targetLanguages: [{
        type: String,
        enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
    }],
    culturalRegions: [{
        type: String,
        enum: ['EAST_ASIA', 'SOUTHEAST_ASIA', 'SOUTH_ASIA', 'MIDDLE_EAST', 'EUROPE', 'NORTH_AMERICA', 'SOUTH_AMERICA', 'AFRICA', 'OCEANIA']
    }],
    content: {
        text: String,
        images: [{
            url: String,
            caption: String,
            description: String
        }],
        videos: [{
            url: String,
            title: String,
            description: String,
            duration: Number
        }],
        audio: [{
            url: String,
            title: String,
            description: String,
            duration: Number
        }],
        attachments: [{
            url: String,
            filename: String,
            fileType: String,
            size: Number
        }]
    },
    participants: [{
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
            enum: ['PARTICIPANT', 'MODERATOR', 'EXPERT'],
            default: 'PARTICIPANT'
        },
        contributionScore: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    }],
    interactions: {
        views: {
            type: Number,
            default: 0
        },
        likes: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        comments: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            content: {
                type: String,
                required: true,
                maxlength: 1000
            },
            language: String,
            translation: {
                originalText: String,
                translatedText: String,
                targetLanguage: String
            },
            replies: [{
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                content: String,
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }],
            likes: [{
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }],
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        shares: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            platform: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    rewards: {
        cbtPool: {
            type: String,
            default: '0'
        },
        distributedRewards: {
            type: String,
            default: '0'
        },
        rewardCriteria: {
            participationReward: {
                type: String,
                default: '1'
            },
            qualityContributionReward: {
                type: String,
                default: '3'
            },
            expertAnswerReward: {
                type: String,
                default: '5'
            }
        }
    },
    status: {
        type: String,
        enum: ['DRAFT', 'ACTIVE', 'FEATURED', 'ARCHIVED', 'CLOSED'],
        default: 'ACTIVE'
    },
    moderation: {
        isModerated: {
            type: Boolean,
            default: false
        },
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        moderationNotes: String,
        reportCount: {
            type: Number,
            default: 0
        },
        reports: [{
            reporter: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            reason: String,
            description: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    schedule: {
        startTime: Date,
        endTime: Date,
        timezone: String,
        isRecurring: {
            type: Boolean,
            default: false
        },
        recurrencePattern: String
    },
    tags: [String],
    difficulty: {
        type: String,
        enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
        default: 'BEGINNER'
    }
}, {
    timestamps: true
});

// 索引
culturalExchangeSchema.index({ creator: 1, createdAt: -1 });
culturalExchangeSchema.index({ type: 1, status: 1 });
culturalExchangeSchema.index({ targetLanguages: 1 });
culturalExchangeSchema.index({ culturalRegions: 1 });
culturalExchangeSchema.index({ tags: 1 });
culturalExchangeSchema.index({ 'interactions.views': -1 });
culturalExchangeSchema.index({ createdAt: -1 });

// 文本搜索索引
culturalExchangeSchema.index({
    title: 'text',
    description: 'text',
    tags: 'text'
});

// 虚拟字段
culturalExchangeSchema.virtual('likesCount').get(function() {
    return this.interactions.likes.length;
});

culturalExchangeSchema.virtual('commentsCount').get(function() {
    return this.interactions.comments.length;
});

culturalExchangeSchema.virtual('participantsCount').get(function() {
    return this.participants.length;
});

culturalExchangeSchema.virtual('engagementScore').get(function() {
    const views = this.interactions.views || 0;
    const likes = this.interactions.likes.length || 0;
    const comments = this.interactions.comments.length || 0;
    const participants = this.participants.length || 0;
    
    return (likes * 2) + (comments * 3) + (participants * 5) + (views * 0.1);
});

// 实例方法
culturalExchangeSchema.methods.addParticipant = function(userId, role = 'PARTICIPANT') {
    const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
    
    if (!existingParticipant) {
        this.participants.push({
            user: userId,
            role: role,
            joinedAt: new Date(),
            lastActivity: new Date()
        });
        return true;
    }
    return false;
};

culturalExchangeSchema.methods.removeParticipant = function(userId) {
    const index = this.participants.findIndex(p => p.user.toString() === userId.toString());
    if (index > -1) {
        this.participants.splice(index, 1);
        return true;
    }
    return false;
};

culturalExchangeSchema.methods.addLike = function(userId) {
    const existingLike = this.interactions.likes.find(l => l.user.toString() === userId.toString());
    
    if (!existingLike) {
        this.interactions.likes.push({
            user: userId,
            createdAt: new Date()
        });
        return true;
    }
    return false;
};

culturalExchangeSchema.methods.removeLike = function(userId) {
    const index = this.interactions.likes.findIndex(l => l.user.toString() === userId.toString());
    if (index > -1) {
        this.interactions.likes.splice(index, 1);
        return true;
    }
    return false;
};

culturalExchangeSchema.methods.addComment = function(userId, content, language = null) {
    const comment = {
        user: userId,
        content: content,
        language: language,
        createdAt: new Date(),
        replies: [],
        likes: []
    };
    
    this.interactions.comments.push(comment);
    return comment;
};

culturalExchangeSchema.methods.incrementViews = function() {
    this.interactions.views += 1;
};

culturalExchangeSchema.methods.updateParticipantActivity = function(userId) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    if (participant) {
        participant.lastActivity = new Date();
        return true;
    }
    return false;
};

culturalExchangeSchema.methods.calculateRewardDistribution = function() {
    const totalPool = parseFloat(this.rewards.cbtPool || '0');
    const activeParticipants = this.participants.filter(p => {
        const daysSinceLastActivity = (Date.now() - p.lastActivity) / (1000 * 60 * 60 * 24);
        return daysSinceLastActivity <= 7; // 活跃参与者：7天内有活动
    });
    
    if (activeParticipants.length === 0 || totalPool === 0) {
        return [];
    }
    
    const rewardPerParticipant = totalPool / activeParticipants.length;
    
    return activeParticipants.map(participant => ({
        userId: participant.user,
        amount: rewardPerParticipant.toFixed(2),
        reason: 'Cultural exchange participation'
    }));
};

module.exports = mongoose.model('CulturalExchange', culturalExchangeSchema);

