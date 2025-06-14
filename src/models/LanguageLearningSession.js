const mongoose = require('mongoose');

const languageLearningSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionType: {
        type: String,
        enum: ['VOCABULARY', 'GRAMMAR', 'CONVERSATION', 'PRONUNCIATION', 'LISTENING', 'READING', 'WRITING', 'CULTURAL_CONTEXT'],
        required: true
    },
    targetLanguage: {
        type: String,
        required: true,
        enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
    },
    nativeLanguage: {
        type: String,
        required: true,
        enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
    },
    level: {
        type: String,
        enum: ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'PROFICIENT'],
        required: true
    },
    content: {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String
        },
        materials: [{
            type: {
                type: String,
                enum: ['TEXT', 'AUDIO', 'VIDEO', 'IMAGE', 'INTERACTIVE']
            },
            content: String,
            url: String,
            metadata: mongoose.Schema.Types.Mixed
        }],
        exercises: [{
            type: {
                type: String,
                enum: ['MULTIPLE_CHOICE', 'FILL_BLANK', 'TRANSLATION', 'PRONUNCIATION', 'LISTENING_COMPREHENSION', 'CONVERSATION']
            },
            question: String,
            options: [String],
            correctAnswer: String,
            explanation: String,
            points: {
                type: Number,
                default: 1
            }
        }]
    },
    progress: {
        startTime: {
            type: Date,
            default: Date.now
        },
        endTime: {
            type: Date
        },
        duration: {
            type: Number // 秒
        },
        completedExercises: [{
            exerciseIndex: Number,
            userAnswer: String,
            isCorrect: Boolean,
            timeSpent: Number,
            attempts: Number
        }],
        score: {
            total: {
                type: Number,
                default: 0
            },
            correct: {
                type: Number,
                default: 0
            },
            percentage: {
                type: Number,
                default: 0
            }
        },
        status: {
            type: String,
            enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
            default: 'IN_PROGRESS'
        }
    },
    feedback: {
        strengths: [String],
        weaknesses: [String],
        recommendations: [String],
        nextLevelSuggestion: String
    },
    rewards: {
        cbtEarned: {
            type: String,
            default: '0'
        },
        experiencePoints: {
            type: Number,
            default: 0
        },
        achievements: [String]
    },
    culturalContext: {
        region: String,
        customs: [String],
        etiquette: [String],
        commonPhrases: [{
            phrase: String,
            meaning: String,
            usage: String
        }]
    }
}, {
    timestamps: true
});

// 索引
languageLearningSessionSchema.index({ userId: 1, createdAt: -1 });
languageLearningSessionSchema.index({ targetLanguage: 1, level: 1 });
languageLearningSessionSchema.index({ sessionType: 1 });
languageLearningSessionSchema.index({ 'progress.status': 1 });

// 虚拟字段
languageLearningSessionSchema.virtual('isCompleted').get(function() {
    return this.progress.status === 'COMPLETED';
});

languageLearningSessionSchema.virtual('accuracyRate').get(function() {
    if (this.progress.completedExercises.length === 0) return 0;
    const correct = this.progress.completedExercises.filter(ex => ex.isCorrect).length;
    return (correct / this.progress.completedExercises.length) * 100;
});

// 实例方法
languageLearningSessionSchema.methods.completeExercise = function(exerciseIndex, userAnswer, timeSpent) {
    const exercise = this.content.exercises[exerciseIndex];
    if (!exercise) return false;
    
    const isCorrect = userAnswer === exercise.correctAnswer;
    
    // 查找是否已经回答过这个练习
    let completedExercise = this.progress.completedExercises.find(ex => ex.exerciseIndex === exerciseIndex);
    
    if (completedExercise) {
        completedExercise.attempts += 1;
        if (isCorrect && !completedExercise.isCorrect) {
            completedExercise.isCorrect = true;
            completedExercise.userAnswer = userAnswer;
        }
    } else {
        this.progress.completedExercises.push({
            exerciseIndex,
            userAnswer,
            isCorrect,
            timeSpent,
            attempts: 1
        });
    }
    
    // 更新分数
    this.updateScore();
    
    return isCorrect;
};

languageLearningSessionSchema.methods.updateScore = function() {
    const totalExercises = this.content.exercises.length;
    const correctAnswers = this.progress.completedExercises.filter(ex => ex.isCorrect).length;
    
    this.progress.score.total = totalExercises;
    this.progress.score.correct = correctAnswers;
    this.progress.score.percentage = totalExercises > 0 ? (correctAnswers / totalExercises) * 100 : 0;
};

languageLearningSessionSchema.methods.completeSession = function() {
    this.progress.endTime = new Date();
    this.progress.duration = Math.floor((this.progress.endTime - this.progress.startTime) / 1000);
    this.progress.status = 'COMPLETED';
    
    // 计算奖励
    this.calculateRewards();
};

languageLearningSessionSchema.methods.calculateRewards = function() {
    const baseReward = 2; // 基础CBT奖励
    const bonusMultiplier = this.progress.score.percentage / 100;
    const timeBonus = this.progress.duration < 300 ? 0.5 : 0; // 5分钟内完成额外奖励
    
    const totalReward = baseReward * (1 + bonusMultiplier) + timeBonus;
    this.rewards.cbtEarned = totalReward.toFixed(2);
    
    // 经验值计算
    this.rewards.experiencePoints = Math.floor(this.progress.score.percentage * 10);
    
    // 成就检查
    if (this.progress.score.percentage === 100) {
        this.rewards.achievements.push('PERFECT_SCORE');
    }
    if (this.progress.duration < 300) {
        this.rewards.achievements.push('SPEED_LEARNER');
    }
};

module.exports = mongoose.model('LanguageLearningSession', languageLearningSessionSchema);

