const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Content = require('../models/Content');
const Group = require('../models/Group');

// 专业用户服务
class ProfessionalUserService {
    constructor() {
        this.accountHierarchy = new Map(); // 账号层级关系
        this.analyticsCache = new Map(); // 分析数据缓存
    }

    // 创建专业账号
    async createProfessionalAccount(userId, accountData) {
        const user = await User.findById(userId);
        if (!user) throw new Error('用户不存在');

        // 升级为专业账号
        const professionalData = {
            isProfessional: true,
            professionalType: accountData.type, // 'individual', 'organization', 'educator'
            businessInfo: {
                name: accountData.businessName,
                description: accountData.description,
                website: accountData.website,
                contactEmail: accountData.contactEmail,
                industry: accountData.industry,
                size: accountData.size
            },
            subscription: {
                plan: accountData.plan || 'basic', // 'basic', 'premium', 'enterprise'
                startDate: new Date(),
                features: this.getPlanFeatures(accountData.plan || 'basic')
            },
            settings: {
                allowTeamManagement: true,
                enableAdvancedAnalytics: true,
                allowBulkOperations: true,
                customBranding: accountData.plan === 'enterprise'
            },
            createdAt: new Date()
        };

        await User.findByIdAndUpdate(userId, { $set: professionalData });
        return professionalData;
    }

    // 获取套餐功能
    getPlanFeatures(plan) {
        const features = {
            basic: {
                maxSubAccounts: 3,
                maxMonthlyPosts: 100,
                analyticsRetention: 30, // 天
                supportLevel: 'email',
                customReports: false,
                apiAccess: false
            },
            premium: {
                maxSubAccounts: 10,
                maxMonthlyPosts: 500,
                analyticsRetention: 90,
                supportLevel: 'priority',
                customReports: true,
                apiAccess: true
            },
            enterprise: {
                maxSubAccounts: 50,
                maxMonthlyPosts: -1, // 无限制
                analyticsRetention: 365,
                supportLevel: 'dedicated',
                customReports: true,
                apiAccess: true,
                customBranding: true,
                whiteLabel: true
            }
        };

        return features[plan] || features.basic;
    }

    // 添加子账号
    async addSubAccount(parentUserId, subAccountData) {
        const parentUser = await User.findById(parentUserId);
        if (!parentUser || !parentUser.isProfessional) {
            throw new Error('只有专业账号才能添加子账号');
        }

        const currentSubAccounts = await this.getSubAccounts(parentUserId);
        const maxSubAccounts = parentUser.subscription.features.maxSubAccounts;
        
        if (currentSubAccounts.length >= maxSubAccounts) {
            throw new Error(`已达到子账号上限 (${maxSubAccounts})`);
        }

        // 创建子账号
        const subAccount = new User({
            username: subAccountData.username,
            email: subAccountData.email,
            password: subAccountData.password, // 应该加密
            parentAccount: parentUserId,
            accountType: 'sub',
            permissions: subAccountData.permissions || ['content_create', 'content_edit'],
            profile: {
                displayName: subAccountData.displayName,
                role: subAccountData.role,
                department: subAccountData.department
            },
            createdAt: new Date()
        });

        await subAccount.save();
        
        // 更新层级关系
        if (!this.accountHierarchy.has(parentUserId)) {
            this.accountHierarchy.set(parentUserId, []);
        }
        this.accountHierarchy.get(parentUserId).push(subAccount._id);

        return subAccount;
    }

    // 获取子账号列表
    async getSubAccounts(parentUserId) {
        return await User.find({ 
            parentAccount: parentUserId,
            accountType: 'sub'
        }).select('-password');
    }

    // 管理子账号权限
    async updateSubAccountPermissions(parentUserId, subAccountId, permissions) {
        const parentUser = await User.findById(parentUserId);
        if (!parentUser || !parentUser.isProfessional) {
            throw new Error('无权限操作');
        }

        const subAccount = await User.findOne({
            _id: subAccountId,
            parentAccount: parentUserId
        });

        if (!subAccount) {
            throw new Error('子账号不存在');
        }

        await User.findByIdAndUpdate(subAccountId, {
            $set: { permissions }
        });

        return { success: true, message: '权限更新成功' };
    }

    // 获取内容分析数据
    async getContentAnalytics(userId, timeRange = '30d') {
        const cacheKey = `analytics_${userId}_${timeRange}`;
        
        if (this.analyticsCache.has(cacheKey)) {
            const cached = this.analyticsCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
                return cached.data;
            }
        }

        const endDate = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            default:
                startDate.setDate(endDate.getDate() - 30);
        }

        // 获取用户及其子账号的内容
        const subAccounts = await this.getSubAccounts(userId);
        const allAccountIds = [userId, ...subAccounts.map(acc => acc._id)];

        const contents = await Content.find({
            author: { $in: allAccountIds },
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const analytics = this.calculateContentAnalytics(contents, startDate, endDate);
        
        // 缓存结果
        this.analyticsCache.set(cacheKey, {
            data: analytics,
            timestamp: Date.now()
        });

        return analytics;
    }

    // 计算内容分析数据
    calculateContentAnalytics(contents, startDate, endDate) {
        const analytics = {
            overview: {
                totalPosts: contents.length,
                totalViews: contents.reduce((sum, c) => sum + (c.viewCount || 0), 0),
                totalLikes: contents.reduce((sum, c) => sum + (c.likeCount || 0), 0),
                totalComments: contents.reduce((sum, c) => sum + (c.commentCount || 0), 0),
                totalShares: contents.reduce((sum, c) => sum + (c.shareCount || 0), 0),
                avgEngagementRate: 0
            },
            trends: {
                daily: this.calculateDailyTrends(contents, startDate, endDate),
                weekly: this.calculateWeeklyTrends(contents, startDate, endDate)
            },
            topContent: this.getTopContent(contents),
            audienceInsights: this.calculateAudienceInsights(contents),
            performanceMetrics: this.calculatePerformanceMetrics(contents)
        };

        // 计算平均互动率
        const totalEngagements = analytics.overview.totalLikes + 
                                analytics.overview.totalComments + 
                                analytics.overview.totalShares;
        analytics.overview.avgEngagementRate = analytics.overview.totalViews > 0 
            ? (totalEngagements / analytics.overview.totalViews * 100).toFixed(2)
            : 0;

        return analytics;
    }

    // 计算每日趋势
    calculateDailyTrends(contents, startDate, endDate) {
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const trends = [];

        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayContents = contents.filter(content => {
                const contentDate = new Date(content.createdAt);
                return contentDate.toDateString() === date.toDateString();
            });

            trends.push({
                date: date.toISOString().split('T')[0],
                posts: dayContents.length,
                views: dayContents.reduce((sum, c) => sum + (c.viewCount || 0), 0),
                likes: dayContents.reduce((sum, c) => sum + (c.likeCount || 0), 0),
                comments: dayContents.reduce((sum, c) => sum + (c.commentCount || 0), 0)
            });
        }

        return trends;
    }

    // 计算周趋势
    calculateWeeklyTrends(contents, startDate, endDate) {
        const weeks = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 7));
        const trends = [];

        for (let i = 0; i < weeks; i++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() + i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const weekContents = contents.filter(content => {
                const contentDate = new Date(content.createdAt);
                return contentDate >= weekStart && contentDate <= weekEnd;
            });

            trends.push({
                week: `${weekStart.toISOString().split('T')[0]} - ${weekEnd.toISOString().split('T')[0]}`,
                posts: weekContents.length,
                views: weekContents.reduce((sum, c) => sum + (c.viewCount || 0), 0),
                likes: weekContents.reduce((sum, c) => sum + (c.likeCount || 0), 0),
                comments: weekContents.reduce((sum, c) => sum + (c.commentCount || 0), 0)
            });
        }

        return trends;
    }

    // 获取热门内容
    getTopContent(contents) {
        return contents
            .sort((a, b) => {
                const scoreA = (a.viewCount || 0) + (a.likeCount || 0) * 2 + (a.commentCount || 0) * 3;
                const scoreB = (b.viewCount || 0) + (b.likeCount || 0) * 2 + (b.commentCount || 0) * 3;
                return scoreB - scoreA;
            })
            .slice(0, 10)
            .map(content => ({
                id: content._id,
                title: content.title,
                views: content.viewCount || 0,
                likes: content.likeCount || 0,
                comments: content.commentCount || 0,
                shares: content.shareCount || 0,
                createdAt: content.createdAt
            }));
    }

    // 计算受众洞察
    calculateAudienceInsights(contents) {
        // 模拟受众数据分析
        return {
            demographics: {
                ageGroups: {
                    '18-24': 25,
                    '25-34': 35,
                    '35-44': 25,
                    '45-54': 10,
                    '55+': 5
                },
                genders: {
                    male: 45,
                    female: 52,
                    other: 3
                },
                locations: {
                    'China': 40,
                    'United States': 20,
                    'Japan': 15,
                    'South Korea': 10,
                    'Others': 15
                }
            },
            interests: {
                'Language Learning': 35,
                'Cultural Exchange': 30,
                'Travel': 25,
                'Food': 20,
                'Art': 15
            },
            engagement: {
                mostActiveHours: [9, 12, 15, 18, 21],
                mostActiveDays: ['Monday', 'Wednesday', 'Friday'],
                avgSessionDuration: '8.5 minutes'
            }
        };
    }

    // 计算性能指标
    calculatePerformanceMetrics(contents) {
        if (contents.length === 0) {
            return {
                avgViewsPerPost: 0,
                avgLikesPerPost: 0,
                avgCommentsPerPost: 0,
                avgSharesPerPost: 0,
                engagementRate: 0,
                growthRate: 0
            };
        }

        const totalViews = contents.reduce((sum, c) => sum + (c.viewCount || 0), 0);
        const totalLikes = contents.reduce((sum, c) => sum + (c.likeCount || 0), 0);
        const totalComments = contents.reduce((sum, c) => sum + (c.commentCount || 0), 0);
        const totalShares = contents.reduce((sum, c) => sum + (c.shareCount || 0), 0);

        return {
            avgViewsPerPost: Math.round(totalViews / contents.length),
            avgLikesPerPost: Math.round(totalLikes / contents.length),
            avgCommentsPerPost: Math.round(totalComments / contents.length),
            avgSharesPerPost: Math.round(totalShares / contents.length),
            engagementRate: totalViews > 0 ? 
                ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2) : 0,
            growthRate: this.calculateGrowthRate(contents)
        };
    }

    // 计算增长率
    calculateGrowthRate(contents) {
        if (contents.length < 2) return 0;

        const sortedContents = contents.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const firstHalf = sortedContents.slice(0, Math.floor(sortedContents.length / 2));
        const secondHalf = sortedContents.slice(Math.floor(sortedContents.length / 2));

        const firstHalfAvgViews = firstHalf.reduce((sum, c) => sum + (c.viewCount || 0), 0) / firstHalf.length;
        const secondHalfAvgViews = secondHalf.reduce((sum, c) => sum + (c.viewCount || 0), 0) / secondHalf.length;

        if (firstHalfAvgViews === 0) return 0;
        return ((secondHalfAvgViews - firstHalfAvgViews) / firstHalfAvgViews * 100).toFixed(2);
    }

    // 生成自定义报告
    async generateCustomReport(userId, reportConfig) {
        const analytics = await this.getContentAnalytics(userId, reportConfig.timeRange);
        
        const report = {
            id: `report_${Date.now()}`,
            title: reportConfig.title || '内容表现报告',
            generatedAt: new Date(),
            timeRange: reportConfig.timeRange,
            sections: []
        };

        // 根据配置添加报告部分
        if (reportConfig.includeOverview) {
            report.sections.push({
                type: 'overview',
                title: '概览',
                data: analytics.overview
            });
        }

        if (reportConfig.includeTrends) {
            report.sections.push({
                type: 'trends',
                title: '趋势分析',
                data: analytics.trends
            });
        }

        if (reportConfig.includeTopContent) {
            report.sections.push({
                type: 'topContent',
                title: '热门内容',
                data: analytics.topContent
            });
        }

        if (reportConfig.includeAudience) {
            report.sections.push({
                type: 'audience',
                title: '受众洞察',
                data: analytics.audienceInsights
            });
        }

        return report;
    }
}

const professionalService = new ProfessionalUserService();

// 创建专业账号
router.post('/upgrade', [
    body('type').isIn(['individual', 'organization', 'educator']).withMessage('账号类型无效'),
    body('businessName').notEmpty().withMessage('机构名称不能为空'),
    body('description').notEmpty().withMessage('描述不能为空'),
    body('plan').optional().isIn(['basic', 'premium', 'enterprise'])
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
        const professionalData = await professionalService.createProfessionalAccount(userId, req.body);
        
        res.json({
            success: true,
            data: professionalData,
            message: '专业账号创建成功'
        });
    } catch (error) {
        console.error('创建专业账号错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 添加子账号
router.post('/sub-accounts', [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('email').isEmail().withMessage('邮箱格式无效'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
    body('displayName').notEmpty().withMessage('显示名称不能为空'),
    body('permissions').isArray().withMessage('权限必须是数组')
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
        const subAccount = await professionalService.addSubAccount(userId, req.body);
        
        res.status(201).json({
            success: true,
            data: subAccount,
            message: '子账号创建成功'
        });
    } catch (error) {
        console.error('添加子账号错误:', error);
        res.status(400).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取子账号列表
router.get('/sub-accounts', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const subAccounts = await professionalService.getSubAccounts(userId);
        
        res.json({
            success: true,
            data: subAccounts
        });
    } catch (error) {
        console.error('获取子账号列表错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 更新子账号权限
router.put('/sub-accounts/:subAccountId/permissions', [
    body('permissions').isArray().withMessage('权限必须是数组')
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
        const { subAccountId } = req.params;
        const { permissions } = req.body;
        
        const result = await professionalService.updateSubAccountPermissions(userId, subAccountId, permissions);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('更新子账号权限错误:', error);
        res.status(400).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取内容分析数据
router.get('/analytics/content', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const timeRange = req.query.timeRange || '30d';
        
        const analytics = await professionalService.getContentAnalytics(userId, timeRange);
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('获取内容分析错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 生成自定义报告
router.post('/reports/custom', [
    body('title').optional().isString(),
    body('timeRange').optional().isIn(['7d', '30d', '90d']),
    body('includeOverview').optional().isBoolean(),
    body('includeTrends').optional().isBoolean(),
    body('includeTopContent').optional().isBoolean(),
    body('includeAudience').optional().isBoolean()
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
        const reportConfig = {
            timeRange: '30d',
            includeOverview: true,
            includeTrends: true,
            includeTopContent: true,
            includeAudience: true,
            ...req.body
        };
        
        const report = await professionalService.generateCustomReport(userId, reportConfig);
        
        res.json({
            success: true,
            data: report,
            message: '报告生成成功'
        });
    } catch (error) {
        console.error('生成自定义报告错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取套餐信息
router.get('/plans', async (req, res) => {
    try {
        const plans = {
            basic: {
                name: '基础版',
                price: '¥99/月',
                features: professionalService.getPlanFeatures('basic'),
                description: '适合个人创作者和小型团队'
            },
            premium: {
                name: '专业版',
                price: '¥299/月',
                features: professionalService.getPlanFeatures('premium'),
                description: '适合中型机构和专业团队'
            },
            enterprise: {
                name: '企业版',
                price: '¥999/月',
                features: professionalService.getPlanFeatures('enterprise'),
                description: '适合大型企业和教育机构'
            }
        };
        
        res.json({
            success: true,
            data: plans
        });
    } catch (error) {
        console.error('获取套餐信息错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

module.exports = router;

