const mongoose = require('mongoose');

const dailyRewardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD格式
        required: true
    },
    rewards: {
        REGISTRATION: { type: Number, default: 0 },
        DAILY_LOGIN: { type: Number, default: 0 },
        POST_CONTENT: { type: Number, default: 0 },
        VOICE_TRANSLATION: { type: Number, default: 0 },
        CHAT_PARTICIPATION: { type: Number, default: 0 },
        CULTURAL_EXCHANGE: { type: Number, default: 0 },
        LANGUAGE_LEARNING: { type: Number, default: 0 }
    },
    totalRewardsToday: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// 复合索引确保每个用户每天只有一条记录
dailyRewardSchema.index({ userId: 1, date: 1 }, { unique: true });

// 自动过期索引，30天后删除记录
dailyRewardSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('DailyReward', dailyRewardSchema);

