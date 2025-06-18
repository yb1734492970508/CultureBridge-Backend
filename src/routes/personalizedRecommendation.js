const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Content = require('../models/Content');
const Group = require('../models/Group');
const Event = require('../models/Event');

// 个性化推荐服务
class PersonalizedRecommendationService {
    constructor() {
        this.userProfiles = new Map(); // 用户画像缓存
        this.contentFeatures = new Map(); // 内容特征缓存
    }

    // 构建用户画像
    async buildUserProfile(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('用户不存在');

        // 获取用户行为数据
        const userInteractions = await this.getUserInteractions(userId);
        const userContent = await this.getUserContent(userId);
        
        const profile = {
            userId,
            demographics: {
                country: user.country,
                nativeLanguage: user.nativeLanguage,
                learningLanguages: user.learningLanguages || [],
                interests: user.interests || []
            },
            behavior: {
                contentPreferences: this.analyzeContentPreferences(userInteractions),
                socialActivity: this.analyzeSocialActivity(userInteractions),
                learningProgress: this.analyzeLearningProgress(userContent),
                activeHours: this.analyzeActiveHours(userInteractions)
            },
            preferences: {
                contentTypes: this.getPreferredContentTypes(userInteractions),
                difficultyLevel: this.getPreferredDifficulty(userContent),
                socialLevel: this.getPreferredSocialLevel(userInteractions)
            },
            lastUpdated: new Date()
        };

        this.userProfiles.set(userId, profile);
        return profile;
    }

    // 获取用户交互数据
    async getUserInteractions(userId) {
        // 模拟用户交互数据，实际应用中从数据库获取
        return {
            likes: [], // 点赞的内容
            comments: [], // 评论的内容
            shares: [], // 分享的内容
            views: [], // 浏览的内容
            searches: [], // 搜索记录
            groupJoins: [], // 加入的群组
            eventParticipations: [] // 参与的活动
        };
    }

    // 获取用户创作内容
    async getUserContent(userId) {
        return await Content.find({ author: userId }).sort({ createdAt: -1 }).limit(50);
    }

    // 分析内容偏好
    analyzeContentPreferences(interactions) {
        const preferences = {
            topics: {},
            languages: {},
            formats: {}
        };

        // 分析用户喜欢的话题
        interactions.likes?.forEach(item => {
            if (item.tags) {
                item.tags.forEach(tag => {
                    preferences.topics[tag] = (preferences.topics[tag] || 0) + 3;
                });
            }
        });

        // 分析用户评论的内容
        interactions.comments?.forEach(item => {
            if (item.tags) {
                item.tags.forEach(tag => {
                    preferences.topics[tag] = (preferences.topics[tag] || 0) + 2;
                });
            }
        });

        // 分析用户浏览的内容
        interactions.views?.forEach(item => {
            if (item.tags) {
                item.tags.forEach(tag => {
                    preferences.topics[tag] = (preferences.topics[tag] || 0) + 1;
                });
            }
        });

        return preferences;
    }

    // 分析社交活动
    analyzeSocialActivity(interactions) {
        return {
            commentFrequency: interactions.comments?.length || 0,
            shareFrequency: interactions.shares?.length || 0,
            groupActivity: interactions.groupJoins?.length || 0,
            eventActivity: interactions.eventParticipations?.length || 0
        };
    }

    // 分析学习进度
    analyzeLearningProgress(userContent) {
        const progress = {
            totalPosts: userContent.length,
            languageUsage: {},
            topicCoverage: {},
            qualityTrend: []
        };

        userContent.forEach(content => {
            // 分析语言使用
            if (content.language) {
                progress.languageUsage[content.language] = 
                    (progress.languageUsage[content.language] || 0) + 1;
            }

            // 分析话题覆盖
            if (content.tags) {
                content.tags.forEach(tag => {
                    progress.topicCoverage[tag] = 
                        (progress.topicCoverage[tag] || 0) + 1;
                });
            }
        });

        return progress;
    }

    // 分析活跃时间
    analyzeActiveHours(interactions) {
        const hours = new Array(24).fill(0);
        
        // 分析各种交互的时间分布
        [...(interactions.likes || []), ...(interactions.comments || []), ...(interactions.views || [])]
            .forEach(item => {
                if (item.timestamp) {
                    const hour = new Date(item.timestamp).getHours();
                    hours[hour]++;
                }
            });

        return hours;
    }

    // 获取偏好的内容类型
    getPreferredContentTypes(interactions) {
        const types = {
            article: 0,
            video: 0,
            audio: 0,
            image: 0,
            discussion: 0
        };

        interactions.views?.forEach(item => {
            if (item.type && types.hasOwnProperty(item.type)) {
                types[item.type]++;
            }
        });

        return Object.entries(types)
            .sort(([,a], [,b]) => b - a)
            .map(([type]) => type);
    }

    // 获取偏好的难度级别
    getPreferredDifficulty(userContent) {
        const difficulties = userContent.map(content => content.difficulty || 'medium');
        const counts = difficulties.reduce((acc, diff) => {
            acc[diff] = (acc[diff] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .map(([diff]) => diff)[0] || 'medium';
    }

    // 获取偏好的社交级别
    getPreferredSocialLevel(interactions) {
        const socialScore = 
            (interactions.comments?.length || 0) * 3 +
            (interactions.shares?.length || 0) * 2 +
            (interactions.groupJoins?.length || 0) * 5 +
            (interactions.eventParticipations?.length || 0) * 4;

        if (socialScore > 50) return 'high';
        if (socialScore > 20) return 'medium';
        return 'low';
    }

    // 内容推荐
    async getContentRecommendations(userId, limit = 20) {
        const userProfile = await this.buildUserProfile(userId);
        
        // 获取候选内容
        const candidateContent = await this.getCandidateContent(userId);
        
        // 计算推荐分数
        const scoredContent = candidateContent.map(content => ({
            ...content.toObject(),
            recommendationScore: this.calculateContentScore(content, userProfile),
            reason: this.generateRecommendationReason(content, userProfile)
        }));

        // 排序并返回
        return scoredContent
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, limit);
    }

    // 获取候选内容
    async getCandidateContent(userId) {
        const user = await User.findById(userId);
        
        // 获取用户未看过的内容
        return await Content.find({
            author: { $ne: userId }, // 不是用户自己创作的
            isPublished: true,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 最近30天的内容
        })
        .populate('author', 'username avatar country')
        .sort({ createdAt: -1 })
        .limit(200); // 获取候选内容池
    }

    // 计算内容推荐分数
    calculateContentScore(content, userProfile) {
        let score = 50; // 基础分

        // 话题匹配度
        if (content.tags && userProfile.behavior.contentPreferences.topics) {
            content.tags.forEach(tag => {
                const topicScore = userProfile.behavior.contentPreferences.topics[tag] || 0;
                score += topicScore * 2;
            });
        }

        // 语言匹配度
        if (userProfile.demographics.learningLanguages.includes(content.language)) {
            score += 20;
        }
        if (userProfile.demographics.nativeLanguage === content.language) {
            score += 10;
        }

        // 内容类型匹配度
        const preferredTypes = userProfile.preferences.contentTypes;
        const typeIndex = preferredTypes.indexOf(content.type);
        if (typeIndex !== -1) {
            score += (preferredTypes.length - typeIndex) * 5;
        }

        // 难度匹配度
        if (content.difficulty === userProfile.preferences.difficultyLevel) {
            score += 15;
        }

        // 作者地域匹配度
        if (content.author && content.author.country !== userProfile.demographics.country) {
            score += 10; // 鼓励跨文化交流
        }

        // 内容新鲜度
        const daysSinceCreated = (new Date() - content.createdAt) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < 1) score += 10;
        else if (daysSinceCreated < 7) score += 5;

        // 内容质量分数
        if (content.qualityScore) {
            score += content.qualityScore * 0.3;
        }

        return Math.max(0, score);
    }

    // 生成推荐理由
    generateRecommendationReason(content, userProfile) {
        const reasons = [];

        // 检查话题匹配
        if (content.tags && userProfile.behavior.contentPreferences.topics) {
            const matchedTopics = content.tags.filter(tag => 
                userProfile.behavior.contentPreferences.topics[tag] > 0
            );
            if (matchedTopics.length > 0) {
                reasons.push(`因为您对${matchedTopics[0]}感兴趣`);
            }
        }

        // 检查语言匹配
        if (userProfile.demographics.learningLanguages.includes(content.language)) {
            reasons.push(`因为您正在学习${content.language}`);
        }

        // 检查作者地域
        if (content.author && content.author.country !== userProfile.demographics.country) {
            reasons.push(`来自${content.author.country}的文化分享`);
        }

        // 检查内容新鲜度
        const daysSinceCreated = (new Date() - content.createdAt) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < 1) {
            reasons.push('最新发布');
        }

        return reasons.length > 0 ? reasons[0] : '为您推荐';
    }

    // 社交推荐
    async getSocialRecommendations(userId, limit = 10) {
        const userProfile = await this.buildUserProfile(userId);
        
        const recommendations = {
            users: await this.getUserRecommendations(userId, userProfile, Math.ceil(limit / 3)),
            groups: await this.getGroupRecommendations(userId, userProfile, Math.ceil(limit / 3)),
            events: await this.getEventRecommendations(userId, userProfile, Math.ceil(limit / 3))
        };

        return recommendations;
    }

    // 用户推荐
    async getUserRecommendations(userId, userProfile, limit) {
        const candidateUsers = await User.find({
            _id: { $ne: userId },
            isActive: true
        }).limit(100);

        const scoredUsers = candidateUsers.map(user => ({
            ...user.toObject(),
            recommendationScore: this.calculateUserScore(user, userProfile),
            reason: this.generateUserRecommendationReason(user, userProfile)
        }));

        return scoredUsers
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, limit);
    }

    // 计算用户推荐分数
    calculateUserScore(user, userProfile) {
        let score = 30; // 基础分

        // 共同兴趣
        const commonInterests = (user.interests || []).filter(interest =>
            userProfile.demographics.interests.includes(interest)
        );
        score += commonInterests.length * 10;

        // 语言匹配
        if (user.nativeLanguage && userProfile.demographics.learningLanguages.includes(user.nativeLanguage)) {
            score += 25; // 可以进行语言交换
        }
        if (user.learningLanguages && user.learningLanguages.includes(userProfile.demographics.nativeLanguage)) {
            score += 25; // 可以进行语言交换
        }

        // 地域差异（鼓励跨文化交流）
        if (user.country && user.country !== userProfile.demographics.country) {
            score += 15;
        }

        return score;
    }

    // 生成用户推荐理由
    generateUserRecommendationReason(user, userProfile) {
        // 检查语言交换机会
        if (user.nativeLanguage && userProfile.demographics.learningLanguages.includes(user.nativeLanguage)) {
            return `可以帮助您学习${user.nativeLanguage}`;
        }

        // 检查共同兴趣
        const commonInterests = (user.interests || []).filter(interest =>
            userProfile.demographics.interests.includes(interest)
        );
        if (commonInterests.length > 0) {
            return `你们都对${commonInterests[0]}感兴趣`;
        }

        // 检查地域
        if (user.country && user.country !== userProfile.demographics.country) {
            return `来自${user.country}的朋友`;
        }

        return '推荐给您认识';
    }

    // 群组推荐
    async getGroupRecommendations(userId, userProfile, limit) {
        const candidateGroups = await Group.find({
            members: { $ne: userId },
            isActive: true
        }).populate('creator', 'username').limit(50);

        const scoredGroups = candidateGroups.map(group => ({
            ...group.toObject(),
            recommendationScore: this.calculateGroupScore(group, userProfile),
            reason: this.generateGroupRecommendationReason(group, userProfile)
        }));

        return scoredGroups
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, limit);
    }

    // 计算群组推荐分数
    calculateGroupScore(group, userProfile) {
        let score = 40; // 基础分

        // 话题匹配
        if (group.tags) {
            const matchedTags = group.tags.filter(tag =>
                userProfile.demographics.interests.includes(tag)
            );
            score += matchedTags.length * 15;
        }

        // 语言匹配
        if (group.language && userProfile.demographics.learningLanguages.includes(group.language)) {
            score += 20;
        }

        // 群组活跃度
        if (group.memberCount > 10) score += 10;
        if (group.memberCount > 50) score += 5;

        return score;
    }

    // 生成群组推荐理由
    generateGroupRecommendationReason(group, userProfile) {
        // 检查话题匹配
        if (group.tags) {
            const matchedTags = group.tags.filter(tag =>
                userProfile.demographics.interests.includes(tag)
            );
            if (matchedTags.length > 0) {
                return `${matchedTags[0]}爱好者聚集地`;
            }
        }

        // 检查语言匹配
        if (group.language && userProfile.demographics.learningLanguages.includes(group.language)) {
            return `${group.language}学习交流群`;
        }

        return '可能感兴趣的群组';
    }

    // 活动推荐
    async getEventRecommendations(userId, userProfile, limit) {
        const now = new Date();
        const candidateEvents = await Event.find({
            participants: { $ne: userId },
            startTime: { $gt: now },
            status: 'upcoming'
        }).populate('organizer', 'username').limit(50);

        const scoredEvents = candidateEvents.map(event => ({
            ...event.toObject(),
            recommendationScore: this.calculateEventScore(event, userProfile),
            reason: this.generateEventRecommendationReason(event, userProfile)
        }));

        return scoredEvents
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, limit);
    }

    // 计算活动推荐分数
    calculateEventScore(event, userProfile) {
        let score = 35; // 基础分

        // 话题匹配
        if (event.tags) {
            const matchedTags = event.tags.filter(tag =>
                userProfile.demographics.interests.includes(tag)
            );
            score += matchedTags.length * 12;
        }

        // 语言匹配
        if (event.language && userProfile.demographics.learningLanguages.includes(event.language)) {
            score += 18;
        }

        // 时间匹配（根据用户活跃时间）
        const eventHour = new Date(event.startTime).getHours();
        const userActiveHours = userProfile.behavior.activeHours;
        if (userActiveHours[eventHour] > 0) {
            score += 10;
        }

        return score;
    }

    // 生成活动推荐理由
    generateEventRecommendationReason(event, userProfile) {
        // 检查话题匹配
        if (event.tags) {
            const matchedTags = event.tags.filter(tag =>
                userProfile.demographics.interests.includes(tag)
            );
            if (matchedTags.length > 0) {
                return `${matchedTags[0]}主题活动`;
            }
        }

        // 检查语言匹配
        if (event.language && userProfile.demographics.learningLanguages.includes(event.language)) {
            return `${event.language}语言交流活动`;
        }

        return '可能感兴趣的活动';
    }
}

const recommendationService = new PersonalizedRecommendationService();

// 获取内容推荐
router.get('/content', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const limit = parseInt(req.query.limit) || 20;
        
        const recommendations = await recommendationService.getContentRecommendations(userId, limit);
        
        res.json({
            success: true,
            data: {
                recommendations,
                total: recommendations.length
            }
        });
    } catch (error) {
        console.error('获取内容推荐错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取社交推荐
router.get('/social', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const limit = parseInt(req.query.limit) || 10;
        
        const recommendations = await recommendationService.getSocialRecommendations(userId, limit);
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('获取社交推荐错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 用户反馈接口
router.post('/feedback', [
    body('itemId').notEmpty().withMessage('项目ID不能为空'),
    body('itemType').isIn(['content', 'user', 'group', 'event']).withMessage('项目类型无效'),
    body('action').isIn(['like', 'dislike', 'not_interested', 'hide']).withMessage('操作类型无效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '请求参数错误',
                errors: errors.array()
            });
        }

        const { itemId, itemType, action } = req.body;
        const userId = req.user?.id || 'demo_user_id';
        
        // 记录用户反馈（实际应用中应保存到数据库）
        console.log(`用户 ${userId} 对 ${itemType} ${itemId} 执行了 ${action} 操作`);
        
        // 更新推荐算法（实际应用中应更新用户画像）
        
        res.json({
            success: true,
            message: '反馈已记录，将优化后续推荐'
        });
    } catch (error) {
        console.error('记录用户反馈错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 获取用户画像
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        
        const userProfile = await recommendationService.buildUserProfile(userId);
        
        res.json({
            success: true,
            data: userProfile
        });
    } catch (error) {
        console.error('获取用户画像错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 更新推荐偏好
router.put('/preferences', [
    body('interests').optional().isArray(),
    body('contentTypes').optional().isArray(),
    body('difficultyLevel').optional().isIn(['easy', 'medium', 'hard']),
    body('socialLevel').optional().isIn(['low', 'medium', 'high'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '请求参数错误',
                errors: errors.array()
            });
        }

        const userId = req.user?.id || 'demo_user_id';
        const preferences = req.body;
        
        // 更新用户偏好（实际应用中应保存到数据库）
        await User.findByIdAndUpdate(userId, {
            $set: {
                'preferences.recommendation': preferences,
                'preferences.updatedAt': new Date()
            }
        });
        
        // 清除用户画像缓存，强制重新构建
        recommendationService.userProfiles.delete(userId);
        
        res.json({
            success: true,
            message: '推荐偏好已更新'
        });
    } catch (error) {
        console.error('更新推荐偏好错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

module.exports = router;

