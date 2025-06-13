const express = require('express');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const EnhancedAuthController = require('../controllers/enhancedAuth');

const router = express.Router();

// 导入增强版认证控制器的方法
const {
    register,
    login,
    walletLogin,
    logout,
    getMe,
    updateDetails,
    updatePassword,
    createWallet,
    bindWallet,
    loginLimiter,
    registerLimiter
} = EnhancedAuthController;

/**
 * @desc    用户注册
 * @route   POST /api/v2/auth/register
 * @access  Public
 */
router.post('/register', registerLimiter, register);

/**
 * @desc    用户登录
 * @route   POST /api/v2/auth/login
 * @access  Public
 */
router.post('/login', loginLimiter, login);

/**
 * @desc    钱包登录
 * @route   POST /api/v2/auth/wallet-login
 * @access  Public
 */
router.post('/wallet-login', walletLogin);

/**
 * @desc    用户登出
 * @route   POST /api/v2/auth/logout
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @desc    获取当前用户信息
 * @route   GET /api/v2/auth/me
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @desc    更新用户详情
 * @route   PUT /api/v2/auth/update-details
 * @access  Private
 */
router.put('/update-details', protect, updateDetails);

/**
 * @desc    更新密码
 * @route   PUT /api/v2/auth/update-password
 * @access  Private
 */
router.put('/update-password', protect, updatePassword);

/**
 * @desc    创建钱包
 * @route   POST /api/v2/auth/create-wallet
 * @access  Private
 */
router.post('/create-wallet', protect, createWallet);

/**
 * @desc    绑定现有钱包
 * @route   POST /api/v2/auth/bind-wallet
 * @access  Private
 */
router.post('/bind-wallet', protect, bindWallet);

/**
 * @desc    刷新令牌
 * @route   POST /api/v2/auth/refresh-token
 * @access  Private
 */
router.post('/refresh-token', protect, asyncHandler(async (req, res, next) => {
    const user = req.user;
    
    // 生成新的令牌
    const token = user.getSignedJwtToken();
    
    // Cookie选项
    const options = {
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    };
    
    res
        .status(200)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            message: '令牌刷新成功'
        });
}));

/**
 * @desc    验证令牌
 * @route   GET /api/v2/auth/verify-token
 * @access  Private
 */
router.get('/verify-token', protect, asyncHandler(async (req, res, next) => {
    res.status(200).json({
        success: true,
        data: {
            userId: req.user.id,
            username: req.user.username,
            email: req.user.email,
            isValid: true
        },
        message: '令牌有效'
    });
}));

/**
 * @desc    获取用户权限
 * @route   GET /api/v2/auth/permissions
 * @access  Private
 */
router.get('/permissions', protect, asyncHandler(async (req, res, next) => {
    const user = req.user;
    
    const permissions = {
        canCreatePost: true,
        canComment: true,
        canUploadFile: true,
        canUseVoiceTranslation: true,
        canTransferTokens: !!user.walletAddress,
        canCreateChatRoom: true,
        canJoinEvents: true,
        isAdmin: user.role === 'admin',
        isModerator: ['admin', 'moderator'].includes(user.role),
        isPremium: user.isPremium || false
    };
    
    res.status(200).json({
        success: true,
        data: permissions
    });
}));

/**
 * @desc    获取用户活动统计
 * @route   GET /api/v2/auth/activity-stats
 * @access  Private
 */
router.get('/activity-stats', protect, asyncHandler(async (req, res, next) => {
    const User = require('../models/User');
    const Post = require('../models/Post');
    const Comment = require('../models/Comment');
    const ChatMessage = require('../models/ChatMessage');
    const VoiceTranslation = require('../models/VoiceTranslation');
    
    try {
        const userId = req.user.id;
        
        // 获取用户活动统计
        const [
            postsCount,
            commentsCount,
            messagesCount,
            translationsCount,
            user
        ] = await Promise.all([
            Post.countDocuments({ user: userId }),
            Comment.countDocuments({ user: userId }),
            ChatMessage.countDocuments({ sender: userId }),
            VoiceTranslation.countDocuments({ user: userId }),
            User.findById(userId).select('createdAt lastLoginAt loginCount translationCount')
        ]);
        
        // 计算活跃天数
        const daysSinceJoined = Math.floor(
            (new Date() - user.createdAt) / (1000 * 60 * 60 * 24)
        );
        
        const stats = {
            profile: {
                joinedDaysAgo: daysSinceJoined,
                lastLoginAt: user.lastLoginAt,
                totalLogins: user.loginCount || 0
            },
            content: {
                postsCreated: postsCount,
                commentsPosted: commentsCount,
                messagesSent: messagesCount,
                voiceTranslations: translationsCount
            },
            engagement: {
                averagePostsPerDay: daysSinceJoined > 0 ? (postsCount / daysSinceJoined).toFixed(2) : 0,
                averageCommentsPerDay: daysSinceJoined > 0 ? (commentsCount / daysSinceJoined).toFixed(2) : 0
            }
        };
        
        res.status(200).json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('获取用户活动统计失败:', error);
        return next(new ErrorResponse('获取用户活动统计失败', 500));
    }
}));

/**
 * @desc    更新用户偏好设置
 * @route   PUT /api/v2/auth/preferences
 * @access  Private
 */
router.put('/preferences', protect, asyncHandler(async (req, res, next) => {
    const {
        language,
        theme,
        notifications,
        privacy,
        accessibility
    } = req.body;
    
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        // 更新偏好设置
        if (language) user.preferences.language = language;
        if (theme) user.preferences.theme = theme;
        if (notifications) user.preferences.notifications = { ...user.preferences.notifications, ...notifications };
        if (privacy) user.preferences.privacy = { ...user.preferences.privacy, ...privacy };
        if (accessibility) user.preferences.accessibility = { ...user.preferences.accessibility, ...accessibility };
        
        await user.save();
        
        res.status(200).json({
            success: true,
            data: user.preferences,
            message: '偏好设置更新成功'
        });
        
    } catch (error) {
        console.error('更新偏好设置失败:', error);
        return next(new ErrorResponse('更新偏好设置失败', 500));
    }
}));

/**
 * @desc    获取用户偏好设置
 * @route   GET /api/v2/auth/preferences
 * @access  Private
 */
router.get('/preferences', protect, asyncHandler(async (req, res, next) => {
    const user = req.user;
    
    // 默认偏好设置
    const defaultPreferences = {
        language: 'zh-CN',
        theme: 'light',
        notifications: {
            email: true,
            push: true,
            chat: true,
            rewards: true
        },
        privacy: {
            showProfile: true,
            showActivity: true,
            allowDirectMessages: true
        },
        accessibility: {
            fontSize: 'medium',
            highContrast: false,
            screenReader: false
        }
    };
    
    const preferences = { ...defaultPreferences, ...user.preferences };
    
    res.status(200).json({
        success: true,
        data: preferences
    });
}));

/**
 * @desc    删除用户账户
 * @route   DELETE /api/v2/auth/delete-account
 * @access  Private
 */
router.delete('/delete-account', protect, asyncHandler(async (req, res, next) => {
    const { password, confirmation } = req.body;
    
    if (!password || confirmation !== 'DELETE_MY_ACCOUNT') {
        return next(new ErrorResponse('请提供密码和确认文本', 400));
    }
    
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id).select('+password');
        
        // 验证密码
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return next(new ErrorResponse('密码不正确', 401));
        }
        
        // 软删除用户（保留数据但标记为已删除）
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.email = `deleted_${user._id}@deleted.local`;
        user.username = `deleted_${user._id}`;
        await user.save();
        
        // 清除cookie
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });
        
        res.status(200).json({
            success: true,
            message: '账户已删除'
        });
        
    } catch (error) {
        console.error('删除账户失败:', error);
        return next(new ErrorResponse('删除账户失败', 500));
    }
}));

/**
 * @desc    获取安全日志
 * @route   GET /api/v2/auth/security-log
 * @access  Private
 */
router.get('/security-log', protect, asyncHandler(async (req, res, next) => {
    try {
        // 这里可以实现安全日志功能
        // 暂时返回模拟数据
        const securityLog = [
            {
                action: 'login',
                timestamp: new Date(),
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                success: true
            }
        ];
        
        res.status(200).json({
            success: true,
            data: securityLog,
            message: '安全日志功能开发中'
        });
        
    } catch (error) {
        console.error('获取安全日志失败:', error);
        return next(new ErrorResponse('获取安全日志失败', 500));
    }
}));

/**
 * @desc    启用两步验证
 * @route   POST /api/v2/auth/enable-2fa
 * @access  Private
 */
router.post('/enable-2fa', protect, asyncHandler(async (req, res, next) => {
    try {
        // 这里可以实现两步验证功能
        // 暂时返回占位符响应
        res.status(200).json({
            success: true,
            data: {
                qrCode: 'data:image/png;base64,placeholder',
                secret: 'placeholder_secret'
            },
            message: '两步验证功能开发中'
        });
        
    } catch (error) {
        console.error('启用两步验证失败:', error);
        return next(new ErrorResponse('启用两步验证失败', 500));
    }
}));

/**
 * @desc    认证服务健康检查
 * @route   GET /api/v2/auth/health
 * @access  Public
 */
router.get('/health', asyncHandler(async (req, res, next) => {
    try {
        const User = require('../models/User');
        
        // 检查数据库连接
        const userCount = await User.countDocuments();
        
        const healthStatus = {
            database: true,
            userCount,
            features: {
                registration: true,
                login: true,
                walletLogin: true,
                tokenRefresh: true,
                passwordUpdate: true,
                walletCreation: true
            },
            timestamp: new Date().toISOString()
        };
        
        res.status(200).json({
            success: true,
            data: healthStatus
        });
        
    } catch (error) {
        console.error('认证服务健康检查失败:', error);
        return next(new ErrorResponse('认证服务健康检查失败', 500));
    }
}));

module.exports = router;

