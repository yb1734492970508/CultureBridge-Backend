/**
 * 代币交易模型
 * Token Transaction Model
 */

const mongoose = require('mongoose');

const TokenTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['REWARD', 'TRANSFER', 'PURCHASE', 'WITHDRAWAL', 'REFUND'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    activityType: {
        type: String,
        enum: [
            'DAILY_LOGIN', 'PROFILE_COMPLETE', 'FIRST_POST', 'FIRST_COMMENT',
            'CHAT_MESSAGE', 'VOICE_MESSAGE', 'HELPFUL_RESPONSE', 'LIKE_RECEIVED',
            'VOICE_TRANSLATION', 'TEXT_TRANSLATION', 'TRANSLATION_QUALITY_BONUS',
            'CULTURAL_SHARE', 'CULTURAL_INSIGHT', 'CULTURAL_EVENT_PARTICIPATE', 'CULTURAL_EVENT_HOST',
            'LESSON_COMPLETE', 'PRONUNCIATION_PRACTICE', 'VOCABULARY_MASTERY', 'LANGUAGE_MILESTONE',
            'HELPFUL_ANSWER', 'RESOURCE_SHARE', 'COMMUNITY_MODERATION', 'CONTENT_CREATION',
            'WEEKLY_ACTIVE', 'MONTHLY_ACTIVE', 'REFERRAL_SUCCESS', 'EARLY_ADOPTER'
        ]
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        default: 'PENDING'
    },
    blockchain: {
        txHash: String,
        blockNumber: Number,
        gasUsed: Number,
        status: {
            type: String,
            enum: ['PENDING', 'CONFIRMED', 'FAILED']
        },
        error: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    fromUser: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    toUser: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// 索引
TokenTransactionSchema.index({ user: 1, createdAt: -1 });
TokenTransactionSchema.index({ type: 1, status: 1 });
TokenTransactionSchema.index({ activityType: 1 });
TokenTransactionSchema.index({ 'blockchain.txHash': 1 });

module.exports = mongoose.model('TokenTransaction', TokenTransactionSchema);

