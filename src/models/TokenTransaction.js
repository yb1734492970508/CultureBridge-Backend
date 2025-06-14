const mongoose = require('mongoose');

const tokenTransactionSchema = new mongoose.Schema({
    transactionHash: {
        type: String,
        required: true,
        unique: true
    },
    blockNumber: {
        type: Number,
        required: true
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    amount: {
        type: String, // 使用字符串存储精确的数值
        required: true
    },
    type: {
        type: String,
        enum: ['REWARD', 'TRANSFER', 'CULTURAL_EXCHANGE', 'MARKETPLACE'],
        required: true
    },
    category: {
        type: String,
        enum: ['GENERAL', 'LEARNING_REWARD', 'CULTURAL_EXCHANGE', 'CONTENT_CREATION', 'COMMUNITY_CONTRIBUTION', 'MARKETPLACE_PURCHASE', 'GOVERNANCE_PARTICIPATION'],
        default: 'GENERAL'
    },
    description: {
        type: String,
        default: ''
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'FAILED'],
        default: 'PENDING'
    },
    gasUsed: {
        type: String
    },
    gasPrice: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// 索引
tokenTransactionSchema.index({ transactionHash: 1 });
tokenTransactionSchema.index({ userId: 1, createdAt: -1 });
tokenTransactionSchema.index({ type: 1, createdAt: -1 });
tokenTransactionSchema.index({ from: 1 });
tokenTransactionSchema.index({ to: 1 });
tokenTransactionSchema.index({ blockNumber: 1 });

module.exports = mongoose.model('TokenTransaction', tokenTransactionSchema);

