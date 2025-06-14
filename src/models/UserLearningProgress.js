const mongoose = require('mongoose');

const userLearningProgressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    languages: [{
        language: {
            type: String,
            required: true,
            enum: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'pt-BR', 'ru-RU', 'ar-XA', 'hi-IN', 'th-TH', 'vi-VN']
        },
        currentLevel: {
            type: String,
            enum: ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'PROFICIENT'],
            default: 'BEGINNER'
        },
        targetLevel: {
            type: String,
            enum: ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'PROFICIENT'],
            default: 'INTERMEDIATE'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        lastStudyDate: {
            type: Date,
            default: Date.now
        },
        totalStudyTime: {
            type: Number, // 总学习时间（分钟）
            default: 0
        },
        streakDays: {
            type: Number, // 连续学习天数
            default: 0
        },
        longestStreak: {
            type: Number,
            default: 0
        },
        skills: {
            vocabulary: {
                level: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                wordsLearned: {
                    type: Number,
                    default: 0
                },
                accuracy: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                }
            },
            grammar: {
                level: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                rulesLearned: {
                    type: Number,
                    default: 0
                },
                accuracy: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                }
            },
            listening: {
                level: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                hoursListened: {
                    type: Number,
                    default: 0
                },
                accuracy: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                }
            },
            speaking: {
                level: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                pronunciationScore: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                conversationHours: {
                    type: Number,
                    default: 0
                }
            },
            reading: {
                level: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                articlesRead: {
                    type: Number,
                    default: 0
                },
                comprehensionScore: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                }
            },
            writing: {
                level: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                },
                essaysWritten: {
                    type: Number,
                    default: 0
                },
                grammarAccuracy: {
                    type: Number,
                    default: 0,
                    min: 0,
                    max: 100
                }
            }
        },
        achievements: [{
            type: {
                type: String,
                enum: ['FIRST_LESSON', 'WEEK_STREAK', 'MONTH_STREAK', 'PERFECT_SCORE', 'VOCABULARY_MASTER', 'GRAMMAR_EXPERT', 'CONVERSATION_STARTER', 'CULTURAL_EXPLORER', 'SPEED_LEARNER', 'DEDICATED_STUDENT']
            },
            earnedAt: {
                type: Date,
                default: Date.now
            },
            description: String,
            cbtReward: {
                type: String,
                default: '0'
            }
        }],
        weeklyGoals: {
            studyMinutes: {
                target: {
                    type: Number,
                    default: 300 // 5小时/周
                },
                achieved: {
                    type: Number,
                    default: 0
                }
            },
            lessonsCompleted: {
                target: {
                    type: Number,
                    default: 5
                },
                achieved: {
                    type: Number,
                    default: 0
                }
            },
            vocabularyWords: {
                target: {
                    type: Number,
                    default: 50
                },
                achieved: {
                    type: Number,
                    default: 0
                }
            },
            conversationMinutes: {
                target: {
                    type: Number,
                    default: 60
                },
                achieved: {
                    type: Number,
                    default: 0
                }
            }
        },
        preferences: {
            studyReminders: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                time: {
                    type: String,
                    default: '19:00'
                },
                frequency: {
                    type: String,
                    enum: ['DAILY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'],
                    default: 'DAILY'
                }
            },
            difficultyPreference: {
                type: String,
                enum: ['EASY', 'MODERATE', 'CHALLENGING'],
                default: 'MODERATE'
            },
            learningStyle: {
                type: String,
                enum: ['VISUAL', 'AUDITORY', 'KINESTHETIC', 'MIXED'],
                default: 'MIXED'
            }
        }
    }],
    overallStats: {
        totalCBTEarned: {
            type: String,
            default: '0'
        },
        totalLessonsCompleted: {
            type: Number,
            default: 0
        },
        totalStudyTime: {
            type: Number,
            default: 0
        },
        averageSessionDuration: {
            type: Number,
            default: 0
        },
        favoriteLanguage: String,
        rank: {
            type: String,
            enum: ['NOVICE', 'APPRENTICE', 'SCHOLAR', 'EXPERT', 'MASTER', 'GRANDMASTER'],
            default: 'NOVICE'
        },
        experiencePoints: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// 索引
userLearningProgressSchema.index({ userId: 1 });
userLearningProgressSchema.index({ 'languages.language': 1 });
userLearningProgressSchema.index({ 'overallStats.rank': 1 });
userLearningProgressSchema.index({ 'overallStats.experiencePoints': -1 });

// 虚拟字段
userLearningProgressSchema.virtual('activeLanguages').get(function() {
    return this.languages.filter(lang => {
        const daysSinceLastStudy = (Date.now() - lang.lastStudyDate) / (1000 * 60 * 60 * 24);
        return daysSinceLastStudy <= 30; // 30天内学习过的语言
    });
});

userLearningProgressSchema.virtual('currentStreak').get(function() {
    // 计算当前连续学习天数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    for (const lang of this.languages) {
        if (lang.streakDays > streak) {
            streak = lang.streakDays;
        }
    }
    return streak;
});

// 实例方法
userLearningProgressSchema.methods.addLanguage = function(language, targetLevel = 'INTERMEDIATE') {
    const existingLanguage = this.languages.find(l => l.language === language);
    
    if (!existingLanguage) {
        this.languages.push({
            language: language,
            targetLevel: targetLevel,
            startDate: new Date(),
            lastStudyDate: new Date()
        });
        return true;
    }
    return false;
};

userLearningProgressSchema.methods.updateLanguageProgress = function(language, sessionData) {
    const langProgress = this.languages.find(l => l.language === language);
    
    if (!langProgress) {
        return false;
    }
    
    // 更新学习时间
    langProgress.totalStudyTime += sessionData.duration || 0;
    langProgress.lastStudyDate = new Date();
    
    // 更新连续学习天数
    this.updateStreak(langProgress);
    
    // 更新技能水平
    if (sessionData.skillUpdates) {
        for (const [skill, update] of Object.entries(sessionData.skillUpdates)) {
            if (langProgress.skills[skill]) {
                Object.assign(langProgress.skills[skill], update);
            }
        }
    }
    
    // 更新整体统计
    this.updateOverallStats(sessionData);
    
    return true;
};

userLearningProgressSchema.methods.updateStreak = function(langProgress) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastStudy = new Date(langProgress.lastStudyDate);
    lastStudy.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
        // 今天已经学习过，保持连续天数
        return;
    } else if (daysDiff === 1) {
        // 昨天学习过，增加连续天数
        langProgress.streakDays += 1;
        if (langProgress.streakDays > langProgress.longestStreak) {
            langProgress.longestStreak = langProgress.streakDays;
        }
    } else {
        // 中断了连续学习，重置为1
        langProgress.streakDays = 1;
    }
};

userLearningProgressSchema.methods.updateOverallStats = function(sessionData) {
    this.overallStats.totalLessonsCompleted += 1;
    this.overallStats.totalStudyTime += sessionData.duration || 0;
    
    // 计算平均会话时长
    if (this.overallStats.totalLessonsCompleted > 0) {
        this.overallStats.averageSessionDuration = Math.floor(
            this.overallStats.totalStudyTime / this.overallStats.totalLessonsCompleted
        );
    }
    
    // 更新经验值
    const experienceGained = this.calculateExperienceGain(sessionData);
    this.overallStats.experiencePoints += experienceGained;
    
    // 更新等级
    this.updateRank();
    
    // 更新CBT收益
    if (sessionData.cbtEarned) {
        const currentEarned = parseFloat(this.overallStats.totalCBTEarned || '0');
        this.overallStats.totalCBTEarned = (currentEarned + parseFloat(sessionData.cbtEarned)).toString();
    }
};

userLearningProgressSchema.methods.calculateExperienceGain = function(sessionData) {
    let experience = 10; // 基础经验值
    
    // 根据准确率加成
    if (sessionData.accuracy) {
        experience += Math.floor(sessionData.accuracy / 10);
    }
    
    // 根据学习时长加成
    if (sessionData.duration) {
        experience += Math.floor(sessionData.duration / 60); // 每分钟1点经验
    }
    
    // 连续学习加成
    const currentStreak = this.currentStreak;
    if (currentStreak >= 7) {
        experience *= 1.5; // 连续7天学习，经验值1.5倍
    } else if (currentStreak >= 3) {
        experience *= 1.2; // 连续3天学习，经验值1.2倍
    }
    
    return Math.floor(experience);
};

userLearningProgressSchema.methods.updateRank = function() {
    const exp = this.overallStats.experiencePoints;
    
    if (exp >= 10000) {
        this.overallStats.rank = 'GRANDMASTER';
    } else if (exp >= 5000) {
        this.overallStats.rank = 'MASTER';
    } else if (exp >= 2000) {
        this.overallStats.rank = 'EXPERT';
    } else if (exp >= 1000) {
        this.overallStats.rank = 'SCHOLAR';
    } else if (exp >= 300) {
        this.overallStats.rank = 'APPRENTICE';
    } else {
        this.overallStats.rank = 'NOVICE';
    }
};

userLearningProgressSchema.methods.addAchievement = function(type, description, cbtReward = '0') {
    const existingAchievement = this.languages.some(lang => 
        lang.achievements.some(ach => ach.type === type)
    );
    
    if (!existingAchievement) {
        // 添加到第一个语言的成就中（或者可以添加到整体成就中）
        if (this.languages.length > 0) {
            this.languages[0].achievements.push({
                type: type,
                description: description,
                cbtReward: cbtReward,
                earnedAt: new Date()
            });
            return true;
        }
    }
    return false;
};

userLearningProgressSchema.methods.updateWeeklyGoals = function(language, updates) {
    const langProgress = this.languages.find(l => l.language === language);
    
    if (langProgress && updates) {
        for (const [goal, value] of Object.entries(updates)) {
            if (langProgress.weeklyGoals[goal]) {
                langProgress.weeklyGoals[goal].achieved += value;
            }
        }
    }
};

userLearningProgressSchema.methods.resetWeeklyGoals = function() {
    for (const lang of this.languages) {
        for (const goal of Object.values(lang.weeklyGoals)) {
            goal.achieved = 0;
        }
    }
};

module.exports = mongoose.model('UserLearningProgress', userLearningProgressSchema);

