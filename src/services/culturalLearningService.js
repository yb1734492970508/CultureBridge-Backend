const CulturalExchange = require('../models/CulturalExchange');
const LanguageLearningSession = require('../models/LanguageLearningSession');
const UserLearningProgress = require('../models/UserLearningProgress');
const CBTTokenService = require('./cbtTokenService');

class CulturalLearningService {
    constructor() {
        this.cbtTokenService = new CBTTokenService();
        
        // 学习内容模板
        this.learningTemplates = {
            VOCABULARY: {
                title: '词汇学习',
                description: '学习常用词汇和短语',
                exercises: [
                    {
                        type: 'MULTIPLE_CHOICE',
                        points: 1
                    },
                    {
                        type: 'FILL_BLANK',
                        points: 2
                    },
                    {
                        type: 'TRANSLATION',
                        points: 3
                    }
                ]
            },
            GRAMMAR: {
                title: '语法学习',
                description: '掌握语法规则和用法',
                exercises: [
                    {
                        type: 'MULTIPLE_CHOICE',
                        points: 2
                    },
                    {
                        type: 'FILL_BLANK',
                        points: 3
                    }
                ]
            },
            CONVERSATION: {
                title: '对话练习',
                description: '实际对话场景练习',
                exercises: [
                    {
                        type: 'CONVERSATION',
                        points: 5
                    },
                    {
                        type: 'PRONUNCIATION',
                        points: 3
                    }
                ]
            },
            CULTURAL_CONTEXT: {
                title: '文化背景',
                description: '了解语言背后的文化内涵',
                exercises: [
                    {
                        type: 'MULTIPLE_CHOICE',
                        points: 2
                    }
                ]
            }
        };
        
        // 成就系统配置
        this.achievementConfig = {
            FIRST_LESSON: {
                description: '完成第一节课程',
                cbtReward: '5',
                condition: (progress) => progress.overallStats.totalLessonsCompleted >= 1
            },
            WEEK_STREAK: {
                description: '连续学习7天',
                cbtReward: '10',
                condition: (progress) => progress.currentStreak >= 7
            },
            MONTH_STREAK: {
                description: '连续学习30天',
                cbtReward: '50',
                condition: (progress) => progress.currentStreak >= 30
            },
            PERFECT_SCORE: {
                description: '获得满分成绩',
                cbtReward: '15',
                condition: (session) => session.progress.score.percentage === 100
            },
            VOCABULARY_MASTER: {
                description: '学会500个词汇',
                cbtReward: '25',
                condition: (progress, language) => {
                    const lang = progress.languages.find(l => l.language === language);
                    return lang && lang.skills.vocabulary.wordsLearned >= 500;
                }
            },
            CULTURAL_EXPLORER: {
                description: '参与10次文化交流',
                cbtReward: '30',
                condition: (exchangeCount) => exchangeCount >= 10
            }
        };
        
        console.log('✅ 文化学习服务已初始化');
    }
    
    /**
     * 创建学习会话
     */
    async createLearningSession(userId, sessionType, targetLanguage, nativeLanguage, level, customContent = null) {
        try {
            // 获取或创建用户学习进度
            let userProgress = await UserLearningProgress.findOne({ userId });
            if (!userProgress) {
                userProgress = new UserLearningProgress({ userId });
                await userProgress.save();
            }
            
            // 添加语言到学习进度（如果不存在）
            userProgress.addLanguage(targetLanguage);
            await userProgress.save();
            
            // 生成学习内容
            const content = customContent || this.generateLearningContent(sessionType, targetLanguage, nativeLanguage, level);
            
            // 创建学习会话
            const session = new LanguageLearningSession({
                userId,
                sessionType,
                targetLanguage,
                nativeLanguage,
                level,
                content
            });
            
            await session.save();
            
            return {
                success: true,
                session
            };
            
        } catch (error) {
            console.error('创建学习会话失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 生成学习内容
     */
    generateLearningContent(sessionType, targetLanguage, nativeLanguage, level) {
        const template = this.learningTemplates[sessionType];
        if (!template) {
            throw new Error(`不支持的会话类型: ${sessionType}`);
        }
        
        // 根据语言和级别生成具体内容
        const content = {
            title: template.title,
            description: template.description,
            materials: this.generateMaterials(sessionType, targetLanguage, level),
            exercises: this.generateExercises(sessionType, targetLanguage, nativeLanguage, level)
        };
        
        return content;
    }
    
    /**
     * 生成学习材料
     */
    generateMaterials(sessionType, targetLanguage, level) {
        const materials = [];
        
        // 根据会话类型和语言生成材料
        switch (sessionType) {
            case 'VOCABULARY':
                materials.push({
                    type: 'TEXT',
                    content: this.getVocabularyContent(targetLanguage, level),
                    metadata: { category: 'vocabulary_list' }
                });
                break;
                
            case 'GRAMMAR':
                materials.push({
                    type: 'TEXT',
                    content: this.getGrammarContent(targetLanguage, level),
                    metadata: { category: 'grammar_rules' }
                });
                break;
                
            case 'CONVERSATION':
                materials.push({
                    type: 'AUDIO',
                    content: 'Sample conversation audio',
                    url: `/audio/conversations/${targetLanguage}/${level}/sample.mp3`,
                    metadata: { duration: 120, speakers: 2 }
                });
                break;
                
            case 'CULTURAL_CONTEXT':
                materials.push({
                    type: 'TEXT',
                    content: this.getCulturalContent(targetLanguage, level),
                    metadata: { category: 'cultural_background' }
                });
                break;
        }
        
        return materials;
    }
    
    /**
     * 生成练习题
     */
    generateExercises(sessionType, targetLanguage, nativeLanguage, level) {
        const exercises = [];
        const template = this.learningTemplates[sessionType];
        
        for (let i = 0; i < template.exercises.length; i++) {
            const exerciseTemplate = template.exercises[i];
            const exercise = this.createExercise(exerciseTemplate, targetLanguage, nativeLanguage, level, i);
            exercises.push(exercise);
        }
        
        return exercises;
    }
    
    /**
     * 创建单个练习
     */
    createExercise(template, targetLanguage, nativeLanguage, level, index) {
        const exercise = {
            type: template.type,
            points: template.points
        };
        
        // 根据练习类型生成具体内容
        switch (template.type) {
            case 'MULTIPLE_CHOICE':
                Object.assign(exercise, this.generateMultipleChoice(targetLanguage, nativeLanguage, level, index));
                break;
                
            case 'FILL_BLANK':
                Object.assign(exercise, this.generateFillBlank(targetLanguage, nativeLanguage, level, index));
                break;
                
            case 'TRANSLATION':
                Object.assign(exercise, this.generateTranslation(targetLanguage, nativeLanguage, level, index));
                break;
                
            case 'PRONUNCIATION':
                Object.assign(exercise, this.generatePronunciation(targetLanguage, level, index));
                break;
                
            case 'CONVERSATION':
                Object.assign(exercise, this.generateConversation(targetLanguage, level, index));
                break;
        }
        
        return exercise;
    }
    
    /**
     * 完成学习会话
     */
    async completeSession(sessionId, userId) {
        try {
            const session = await LanguageLearningSession.findById(sessionId);
            if (!session || session.userId.toString() !== userId.toString()) {
                throw new Error('会话不存在或无权限');
            }
            
            if (session.progress.status === 'COMPLETED') {
                throw new Error('会话已完成');
            }
            
            // 完成会话
            session.completeSession();
            await session.save();
            
            // 更新用户学习进度
            await this.updateUserProgress(userId, session);
            
            // 分发CBT奖励
            if (parseFloat(session.rewards.cbtEarned) > 0) {
                await this.cbtTokenService.distributeReward(
                    userId,
                    'LANGUAGE_LEARNING',
                    session.rewards.cbtEarned,
                    `完成${session.content.title}学习`
                );
            }
            
            // 检查成就
            await this.checkAchievements(userId, session);
            
            return {
                success: true,
                session,
                rewards: session.rewards
            };
            
        } catch (error) {
            console.error('完成学习会话失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 更新用户学习进度
     */
    async updateUserProgress(userId, session) {
        try {
            const userProgress = await UserLearningProgress.findOne({ userId });
            if (!userProgress) return;
            
            const sessionData = {
                duration: session.progress.duration / 60, // 转换为分钟
                accuracy: session.progress.score.percentage,
                cbtEarned: session.rewards.cbtEarned,
                skillUpdates: this.calculateSkillUpdates(session)
            };
            
            userProgress.updateLanguageProgress(session.targetLanguage, sessionData);
            
            // 更新周目标
            const weeklyUpdates = {
                studyMinutes: session.progress.duration / 60,
                lessonsCompleted: 1
            };
            
            if (session.sessionType === 'VOCABULARY') {
                weeklyUpdates.vocabularyWords = session.content.exercises.length;
            }
            
            if (session.sessionType === 'CONVERSATION') {
                weeklyUpdates.conversationMinutes = session.progress.duration / 60;
            }
            
            userProgress.updateWeeklyGoals(session.targetLanguage, weeklyUpdates);
            
            await userProgress.save();
            
        } catch (error) {
            console.error('更新用户学习进度失败:', error.message);
        }
    }
    
    /**
     * 计算技能更新
     */
    calculateSkillUpdates(session) {
        const updates = {};
        const accuracy = session.progress.score.percentage;
        
        switch (session.sessionType) {
            case 'VOCABULARY':
                updates.vocabulary = {
                    wordsLearned: session.content.exercises.length,
                    accuracy: accuracy
                };
                break;
                
            case 'GRAMMAR':
                updates.grammar = {
                    rulesLearned: 1,
                    accuracy: accuracy
                };
                break;
                
            case 'CONVERSATION':
                updates.speaking = {
                    conversationHours: session.progress.duration / 3600,
                    pronunciationScore: accuracy
                };
                break;
                
            case 'PRONUNCIATION':
                updates.speaking = {
                    pronunciationScore: accuracy
                };
                break;
                
            case 'LISTENING':
                updates.listening = {
                    hoursListened: session.progress.duration / 3600,
                    accuracy: accuracy
                };
                break;
        }
        
        return updates;
    }
    
    /**
     * 检查成就
     */
    async checkAchievements(userId, session) {
        try {
            const userProgress = await UserLearningProgress.findOne({ userId });
            if (!userProgress) return;
            
            // 检查各种成就条件
            for (const [achievementType, config] of Object.entries(this.achievementConfig)) {
                let shouldAward = false;
                
                switch (achievementType) {
                    case 'FIRST_LESSON':
                        shouldAward = config.condition(userProgress);
                        break;
                        
                    case 'WEEK_STREAK':
                    case 'MONTH_STREAK':
                        shouldAward = config.condition(userProgress);
                        break;
                        
                    case 'PERFECT_SCORE':
                        shouldAward = config.condition(session);
                        break;
                        
                    case 'VOCABULARY_MASTER':
                        shouldAward = config.condition(userProgress, session.targetLanguage);
                        break;
                }
                
                if (shouldAward) {
                    const added = userProgress.addAchievement(achievementType, config.description, config.cbtReward);
                    if (added) {
                        await userProgress.save();
                        
                        // 分发成就奖励
                        if (parseFloat(config.cbtReward) > 0) {
                            await this.cbtTokenService.distributeReward(
                                userId,
                                'LEARNING_REWARD',
                                config.cbtReward,
                                `获得成就: ${config.description}`
                            );
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('检查成就失败:', error.message);
        }
    }
    
    /**
     * 创建文化交流
     */
    async createCulturalExchange(userId, exchangeData) {
        try {
            const exchange = new CulturalExchange({
                ...exchangeData,
                creator: userId
            });
            
            // 创建者自动成为参与者
            exchange.addParticipant(userId, 'MODERATOR');
            
            await exchange.save();
            
            // 分发创建奖励
            await this.cbtTokenService.distributeReward(
                userId,
                'CULTURAL_EXCHANGE',
                null,
                '创建文化交流活动'
            );
            
            return {
                success: true,
                exchange
            };
            
        } catch (error) {
            console.error('创建文化交流失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 参与文化交流
     */
    async joinCulturalExchange(exchangeId, userId) {
        try {
            const exchange = await CulturalExchange.findById(exchangeId);
            if (!exchange) {
                throw new Error('文化交流不存在');
            }
            
            if (exchange.status !== 'ACTIVE') {
                throw new Error('文化交流已关闭');
            }
            
            const added = exchange.addParticipant(userId);
            if (!added) {
                throw new Error('已经是参与者');
            }
            
            await exchange.save();
            
            // 分发参与奖励
            await this.cbtTokenService.distributeReward(
                userId,
                'CULTURAL_EXCHANGE',
                null,
                '参与文化交流活动'
            );
            
            return {
                success: true,
                message: '成功加入文化交流'
            };
            
        } catch (error) {
            console.error('参与文化交流失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取用户学习统计
     */
    async getUserLearningStats(userId) {
        try {
            const userProgress = await UserLearningProgress.findOne({ userId }).populate('userId', 'username email');
            
            if (!userProgress) {
                return {
                    success: false,
                    error: '用户学习进度不存在'
                };
            }
            
            // 获取最近的学习会话
            const recentSessions = await LanguageLearningSession.find({ userId })
                .sort({ createdAt: -1 })
                .limit(10);
            
            // 获取参与的文化交流
            const culturalExchanges = await CulturalExchange.find({
                'participants.user': userId
            }).countDocuments();
            
            return {
                success: true,
                data: {
                    progress: userProgress,
                    recentSessions,
                    culturalExchangeCount: culturalExchanges
                }
            };
            
        } catch (error) {
            console.error('获取用户学习统计失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取推荐学习内容
     */
    async getRecommendedContent(userId, targetLanguage) {
        try {
            const userProgress = await UserLearningProgress.findOne({ userId });
            
            if (!userProgress) {
                // 新用户推荐基础内容
                return {
                    success: true,
                    recommendations: [
                        {
                            type: 'VOCABULARY',
                            level: 'BEGINNER',
                            title: '基础词汇学习',
                            description: '学习最常用的100个词汇'
                        },
                        {
                            type: 'CULTURAL_CONTEXT',
                            level: 'BEGINNER',
                            title: '文化入门',
                            description: '了解基本的文化背景'
                        }
                    ]
                };
            }
            
            const langProgress = userProgress.languages.find(l => l.language === targetLanguage);
            const recommendations = [];
            
            if (langProgress) {
                // 根据用户当前水平推荐内容
                const currentLevel = langProgress.currentLevel;
                const weakestSkill = this.findWeakestSkill(langProgress.skills);
                
                // 推荐针对薄弱技能的练习
                recommendations.push({
                    type: this.getSessionTypeForSkill(weakestSkill),
                    level: currentLevel,
                    title: `${weakestSkill}强化练习`,
                    description: `针对${weakestSkill}技能的专项训练`,
                    priority: 'HIGH'
                });
                
                // 推荐文化交流
                const culturalExchanges = await CulturalExchange.find({
                    targetLanguages: targetLanguage,
                    status: 'ACTIVE'
                }).limit(3);
                
                recommendations.push(...culturalExchanges.map(exchange => ({
                    type: 'CULTURAL_EXCHANGE',
                    id: exchange._id,
                    title: exchange.title,
                    description: exchange.description,
                    priority: 'MEDIUM'
                })));
            }
            
            return {
                success: true,
                recommendations
            };
            
        } catch (error) {
            console.error('获取推荐内容失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 辅助方法
     */
    findWeakestSkill(skills) {
        let weakestSkill = 'vocabulary';
        let lowestLevel = 100;
        
        for (const [skill, data] of Object.entries(skills)) {
            if (data.level < lowestLevel) {
                lowestLevel = data.level;
                weakestSkill = skill;
            }
        }
        
        return weakestSkill;
    }
    
    getSessionTypeForSkill(skill) {
        const mapping = {
            vocabulary: 'VOCABULARY',
            grammar: 'GRAMMAR',
            listening: 'LISTENING',
            speaking: 'CONVERSATION',
            reading: 'READING',
            writing: 'WRITING'
        };
        
        return mapping[skill] || 'VOCABULARY';
    }
    
    // 内容生成方法（示例实现）
    getVocabularyContent(language, level) {
        return `${language} ${level} 级别词汇学习内容`;
    }
    
    getGrammarContent(language, level) {
        return `${language} ${level} 级别语法学习内容`;
    }
    
    getCulturalContent(language, level) {
        return `${language} ${level} 级别文化背景内容`;
    }
    
    generateMultipleChoice(targetLanguage, nativeLanguage, level, index) {
        return {
            question: `选择正确的${targetLanguage}翻译`,
            options: ['选项A', '选项B', '选项C', '选项D'],
            correctAnswer: '选项A',
            explanation: '解释为什么选择A'
        };
    }
    
    generateFillBlank(targetLanguage, nativeLanguage, level, index) {
        return {
            question: `填入正确的${targetLanguage}单词: Hello, ___ are you?`,
            correctAnswer: 'how',
            explanation: '这里应该用疑问词how'
        };
    }
    
    generateTranslation(targetLanguage, nativeLanguage, level, index) {
        return {
            question: `将以下句子翻译成${targetLanguage}: 你好，很高兴见到你`,
            correctAnswer: 'Hello, nice to meet you',
            explanation: '这是标准的问候语翻译'
        };
    }
    
    generatePronunciation(targetLanguage, level, index) {
        return {
            question: `请正确发音以下单词: Hello`,
            correctAnswer: '/həˈloʊ/',
            explanation: '注意重音在第二个音节'
        };
    }
    
    generateConversation(targetLanguage, level, index) {
        return {
            question: `在餐厅点餐时，你会如何用${targetLanguage}说"我想要一杯咖啡"？`,
            correctAnswer: 'I would like a cup of coffee',
            explanation: '这是礼貌的点餐用语'
        };
    }
}

module.exports = CulturalLearningService;

