const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    chatRoom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatRoom',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['TEXT', 'VOICE', 'IMAGE', 'FILE', 'SYSTEM', 'TRANSLATION', 'STICKER', 'LOCATION'],
        default: 'TEXT'
    },
    content: {
        text: {
            type: String,
            maxlength: 2000
        },
        originalText: String, // 原始文本（翻译前）
        detectedLanguage: String, // 检测到的语言
        voiceUrl: String, // 语音消息URL
        voiceDuration: Number, // 语音时长（秒）
        imageUrl: String, // 图片URL
        fileUrl: String, // 文件URL
        fileName: String, // 文件名
        fileSize: Number, // 文件大小
        fileType: String, // 文件类型
        location: {
            latitude: Number,
            longitude: Number,
            address: String
        },
        sticker: {
            id: String,
            pack: String,
            url: String
        }
    },
    translations: [{
        language: {
            type: String,
            enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
        },
        text: String,
        confidence: {
            type: Number,
            min: 0,
            max: 1
        }
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatMessage'
    },
    mentions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        startIndex: Number,
        endIndex: Number
    }],
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['SENT', 'DELIVERED', 'READ', 'DELETED', 'EDITED'],
        default: 'SENT'
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    editHistory: [{
        content: String,
        editedAt: {
            type: Date,
            default: Date.now
        }
    }],
    metadata: {
        clientId: String, // 客户端消息ID
        platform: {
            type: String,
            enum: ['WEB', 'MOBILE', 'DESKTOP'],
            default: 'WEB'
        },
        userAgent: String,
        ipAddress: String,
        isForwarded: {
            type: Boolean,
            default: false
        },
        forwardedFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatMessage'
        }
    },
    moderation: {
        isReported: {
            type: Boolean,
            default: false
        },
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
        }],
        isModerated: {
            type: Boolean,
            default: false
        },
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        moderationAction: {
            type: String,
            enum: ['APPROVED', 'HIDDEN', 'DELETED', 'EDITED']
        },
        moderationReason: String
    },
    rewards: {
        cbtEarned: {
            type: String,
            default: '0'
        },
        qualityScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 10
        },
        engagementScore: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// 索引
chatMessageSchema.index({ chatRoom: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, createdAt: -1 });
chatMessageSchema.index({ type: 1 });
chatMessageSchema.index({ status: 1 });
chatMessageSchema.index({ 'mentions.user': 1 });
chatMessageSchema.index({ replyTo: 1 });
chatMessageSchema.index({ createdAt: -1 });

// 文本搜索索引
chatMessageSchema.index({
    'content.text': 'text',
    'content.originalText': 'text'
});

// TTL索引 - 根据聊天室设置自动删除消息
chatMessageSchema.index({ createdAt: 1 }, { 
    expireAfterSeconds: 0, // 将由应用程序逻辑控制
    partialFilterExpression: { 'metadata.autoDelete': true }
});

// 虚拟字段
chatMessageSchema.virtual('reactionCount').get(function() {
    return this.reactions.length;
});

chatMessageSchema.virtual('isEdited').get(function() {
    return this.editHistory.length > 0;
});

chatMessageSchema.virtual('readCount').get(function() {
    return this.readBy.length;
});

// 实例方法
chatMessageSchema.methods.addReaction = function(userId, emoji) {
    const existingReaction = this.reactions.find(r => 
        r.user.toString() === userId.toString() && r.emoji === emoji
    );
    
    if (!existingReaction) {
        this.reactions.push({
            user: userId,
            emoji: emoji,
            createdAt: new Date()
        });
        return true;
    }
    return false;
};

chatMessageSchema.methods.removeReaction = function(userId, emoji) {
    const index = this.reactions.findIndex(r => 
        r.user.toString() === userId.toString() && r.emoji === emoji
    );
    
    if (index > -1) {
        this.reactions.splice(index, 1);
        return true;
    }
    return false;
};

chatMessageSchema.methods.markAsRead = function(userId) {
    const existingRead = this.readBy.find(r => r.user.toString() === userId.toString());
    
    if (!existingRead) {
        this.readBy.push({
            user: userId,
            readAt: new Date()
        });
        return true;
    }
    return false;
};

chatMessageSchema.methods.editContent = function(newContent) {
    // 保存编辑历史
    this.editHistory.push({
        content: this.content.text,
        editedAt: new Date()
    });
    
    // 更新内容
    this.content.text = newContent;
    this.status = 'EDITED';
    
    return true;
};

chatMessageSchema.methods.addTranslation = function(language, translatedText, confidence = 1) {
    const existingTranslation = this.translations.find(t => t.language === language);
    
    if (existingTranslation) {
        existingTranslation.text = translatedText;
        existingTranslation.confidence = confidence;
    } else {
        this.translations.push({
            language: language,
            text: translatedText,
            confidence: confidence
        });
    }
    
    return true;
};

chatMessageSchema.methods.getTranslation = function(language) {
    return this.translations.find(t => t.language === language);
};

chatMessageSchema.methods.addMention = function(userId, startIndex, endIndex) {
    const existingMention = this.mentions.find(m => 
        m.user.toString() === userId.toString() && 
        m.startIndex === startIndex && 
        m.endIndex === endIndex
    );
    
    if (!existingMention) {
        this.mentions.push({
            user: userId,
            startIndex: startIndex,
            endIndex: endIndex
        });
        return true;
    }
    return false;
};

chatMessageSchema.methods.reportMessage = function(reporterId, reason, description) {
    this.moderation.reports.push({
        reporter: reporterId,
        reason: reason,
        description: description,
        createdAt: new Date()
    });
    
    this.moderation.reportCount += 1;
    this.moderation.isReported = true;
    
    return true;
};

chatMessageSchema.methods.moderateMessage = function(moderatorId, action, reason) {
    this.moderation.isModerated = true;
    this.moderation.moderatedBy = moderatorId;
    this.moderation.moderationAction = action;
    this.moderation.moderationReason = reason;
    
    if (action === 'DELETED') {
        this.status = 'DELETED';
    } else if (action === 'HIDDEN') {
        this.status = 'DELETED'; // 对用户隐藏
    }
    
    return true;
};

chatMessageSchema.methods.calculateQualityScore = function() {
    let score = 5; // 基础分数
    
    // 根据消息长度调整
    const textLength = this.content.text ? this.content.text.length : 0;
    if (textLength > 100) score += 1;
    if (textLength > 300) score += 1;
    
    // 根据反应数量调整
    const reactionCount = this.reactions.length;
    score += Math.min(reactionCount * 0.5, 2);
    
    // 根据回复数量调整（需要在应用层计算）
    // score += replyCount * 0.3;
    
    // 根据提及数量调整
    score += this.mentions.length * 0.2;
    
    // 如果有翻译，说明是跨语言交流，加分
    if (this.translations.length > 0) {
        score += 1;
    }
    
    // 如果被举报，减分
    if (this.moderation.isReported) {
        score -= this.moderation.reportCount * 0.5;
    }
    
    // 确保分数在0-10范围内
    this.rewards.qualityScore = Math.max(0, Math.min(10, score));
    
    return this.rewards.qualityScore;
};

chatMessageSchema.methods.calculateEngagementScore = function() {
    let score = 0;
    
    // 反应得分
    score += this.reactions.length * 2;
    
    // 阅读得分
    score += this.readBy.length * 0.5;
    
    // 回复得分（需要在应用层计算）
    // score += replyCount * 3;
    
    // 提及得分
    score += this.mentions.length * 1;
    
    this.rewards.engagementScore = score;
    
    return score;
};

chatMessageSchema.methods.calculateReward = function() {
    const qualityScore = this.calculateQualityScore();
    const engagementScore = this.calculateEngagementScore();
    
    // 基础奖励
    let reward = 0.5;
    
    // 质量奖励
    if (qualityScore >= 8) {
        reward += 1;
    } else if (qualityScore >= 6) {
        reward += 0.5;
    }
    
    // 参与度奖励
    if (engagementScore >= 10) {
        reward += 1;
    } else if (engagementScore >= 5) {
        reward += 0.5;
    }
    
    // 跨语言交流奖励
    if (this.translations.length > 0) {
        reward += 0.5;
    }
    
    // 语音消息奖励
    if (this.type === 'VOICE') {
        reward += 0.3;
    }
    
    this.rewards.cbtEarned = reward.toFixed(2);
    
    return parseFloat(this.rewards.cbtEarned);
};

// 静态方法
chatMessageSchema.statics.getRecentMessages = function(chatRoomId, limit = 50, before = null) {
    const query = { chatRoom: chatRoomId, status: { $ne: 'DELETED' } };
    
    if (before) {
        query.createdAt = { $lt: before };
    }
    
    return this.find(query)
        .populate('sender', 'username avatar')
        .populate('replyTo', 'content.text sender')
        .sort({ createdAt: -1 })
        .limit(limit);
};

chatMessageSchema.statics.searchMessages = function(chatRoomId, searchText, limit = 20) {
    return this.find({
        chatRoom: chatRoomId,
        status: { $ne: 'DELETED' },
        $text: { $search: searchText }
    })
    .populate('sender', 'username avatar')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

chatMessageSchema.statics.getMessagesByUser = function(chatRoomId, userId, limit = 20) {
    return this.find({
        chatRoom: chatRoomId,
        sender: userId,
        status: { $ne: 'DELETED' }
    })
    .populate('sender', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

