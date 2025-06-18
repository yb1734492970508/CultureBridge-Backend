const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

// 登录限制器
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 最多5次尝试
    message: {
        success: false,
        error: "登录尝试次数过多，请15分钟后再试"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 注册限制器
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 3, // 最多3次注册
    message: {
        success: false,
        error: "注册尝试次数过多，请1小时后再试"
    }
});

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res, extraData = {}, rememberMe = false) => {
    const token = user.getSignedJwtToken();

    const options = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };

    if (rememberMe) {
        options.expires = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000 // 记住我30天
        );
    }

    res.status(statusCode).cookie("token", token, options).json({
        success: true,
        token,
        ...extraData
    });
};

/**
 * @desc    用户注册
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res, next) => {
    const { 
        username, 
        email, 
        password, 
        nativeLanguages, 
        learningLanguages
    } = req.body;

    // 验证输入
    if (!username || !email || !password) {
        return next(new ErrorResponse("请提供用户名、邮箱和密码", 400));
    }

    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existingUser) {
        if (existingUser.email === email) {
            return next(new ErrorResponse("该邮箱已被注册", 400));
        }
        if (existingUser.username === username) {
            return next(new ErrorResponse("该用户名已被使用", 400));
        }
    }

    // 创建用户数据
    const userData = {
        username,
        email,
        password,
        nativeLanguages: nativeLanguages || [],
        learningLanguages: learningLanguages || []
    };

    // 创建用户
    const user = await User.create(userData);

    // 生成响应（不包含敏感信息）
    const userResponse = await User.findById(user._id);
    
    sendTokenResponse(userResponse, 201, res, {
        message: "注册成功"
    });
});

/**
 * @desc    用户登录
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
    const { email, password, rememberMe = false } = req.body;

    // 验证邮箱和密码
    if (!email || !password) {
        return next(new ErrorResponse("请提供邮箱和密码", 400));
    }

    // 检查用户（包含密码字段）
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        return next(new ErrorResponse("邮箱或密码错误", 401));
    }

    // 检查密码
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(new ErrorResponse("邮箱或密码错误", 401));
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    // 生成响应
    const userResponse = await User.findById(user._id);
    
    sendTokenResponse(userResponse, 200, res, {
        message: "登录成功",
        isFirstLogin: user.loginCount === 1
    }, rememberMe);
});

/**
 * @desc    钱包登录 (已移除区块链功能，此路由不再使用)
 * @route   POST /api/v1/auth/wallet-login
 * @access  Public
 */
const walletLogin = asyncHandler(async (req, res, next) => {
    return next(new ErrorResponse("钱包登录功能已移除", 404));
});

/**
 * @desc    用户登出
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res, next) => {
    // 清除cookie
    res.cookie("token", "none", {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    });

    res.status(200).json({
        success: true,
        message: "登出成功"
    });
});

/**
 * @desc    获取当前用户信息
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id)
        .populate("profile", "avatar bio location");

    res.status(200).json({
        success: true,
        data: {
            user
        }
    });
});

/**
 * @desc    更新用户详情
 * @route   PUT /api/v1/auth/update-details
 * @access  Private
 */
const updateDetails = asyncHandler(async (req, res, next) => {
    const allowedFields = [
        "username", 
        "email", 
        "nativeLanguages", 
        "learningLanguages",
        "languageProficiency"
    ];
    
    const fieldsToUpdate = {};
    
    // 只允许更新指定字段
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            fieldsToUpdate[field] = req.body[field];
        }
    });

    // 检查用户名和邮箱唯一性
    if (fieldsToUpdate.username || fieldsToUpdate.email) {
        const query = { _id: { $ne: req.user.id } };
        if (fieldsToUpdate.username) query.username = fieldsToUpdate.username;
        if (fieldsToUpdate.email) query.email = fieldsToUpdate.email;
        
        const existingUser = await User.findOne(query);
        if (existingUser) {
            return next(new ErrorResponse("用户名或邮箱已被使用", 400));
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user.id, 
        fieldsToUpdate, 
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        data: user,
        message: "用户信息更新成功"
    });
});

/**
 * @desc    更新密码
 * @route   PUT /api/v1/auth/update-password
 * @access  Private
 */
const updatePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return next(new ErrorResponse("请提供当前密码和新密码", 400));
    }

    const user = await User.findById(req.user.id).select("+password");

    // 检查当前密码
    if (!(await user.matchPassword(currentPassword))) {
        return next(new ErrorResponse("当前密码不正确", 401));
    }

    // 检查新密码强度
    if (newPassword.length < 8) {
        return next(new ErrorResponse("新密码至少需要8个字符", 400));
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, {
        message: "密码更新成功"
    });
});

/**
 * @desc    创建钱包 (已移除区块链功能，此路由不再使用)
 * @route   POST /api/v1/auth/create-wallet
 * @access  Private
 */
const createWallet = asyncHandler(async (req, res, next) => {
    return next(new ErrorResponse("创建钱包功能已移除", 404));
});

/**
 * @desc    绑定现有钱包 (已移除区块链功能，此路由不再使用)
 * @route   POST /api/v1/auth/bind-wallet
 * @access  Private
 */
const bindWallet = asyncHandler(async (req, res, next) => {
    return next(new ErrorResponse("绑定钱包功能已移除", 404));
});

/**
 * 发放注册奖励 (已移除区块链功能，此方法不再使用)
 */
async function distributeRegistrationReward(user) {
    console.log("注册奖励功能已移除");
}

/**
 * 发放每日登录奖励 (已移除区块链功能，此方法不再使用)
 */
async function distributeDailyLoginReward(user) {
    console.log("每日登录奖励功能已移除");
}

/**
 * 发放钱包创建奖励 (已移除区块链功能，此方法不再使用)
 */
async function distributeWalletCreationReward(user) {
    console.log("钱包创建奖励功能已移除");
}

/**
 * 验证钱包签名 (已移除区块链功能，此方法不再使用)
 */
async function verifyWalletSignature(walletAddress, signature, message) {
    console.log("钱包签名验证功能已移除");
    return false;
}

/**
 * 加密私钥 (已移除区块链功能，此方法不再使用)
 */
function encryptPrivateKey(privateKey) {
    console.log("私钥加密功能已移除");
    return privateKey;
}

/**
 * 解密私钥 (已移除区块链功能，此方法不再使用)
 */
function decryptPrivateKey(encryptedPrivateKey) {
    console.log("私钥解密功能已移除");
    return encryptedPrivateKey;
}

/**
 * @desc    获取用户权限
 * @route   GET /api/v2/auth/permissions
 * @access  Private
 */
const getPermissions = asyncHandler(async (req, res, next) => {
    const user = req.user;
    
    const permissions = {
        canCreatePost: true,
        canComment: true,
        canUploadFile: true,
        canUseVoiceTranslation: true,
        canTransferTokens: false, // 区块链功能已移除
        canCreateChatRoom: true,
        canJoinEvents: true,
        isAdmin: user.role === "admin",
        isModerator: ["admin", "moderator"].includes(user.role),
        isPremium: user.isPremium || false
    };
    
    res.status(200).json({
        success: true,
        data: permissions
    });
});

/**
 * @desc    获取用户活动统计
 * @route   GET /api/v2/auth/activity-stats
 * @access  Private
 */
const getActivityStats = asyncHandler(async (req, res, next) => {
    const User = require("../models/User");
    const Post = require("../models/Post");
    const Comment = require("../models/Comment");
    const ChatMessage = require("../models/ChatMessage");
    const VoiceTranslation = require("../models/VoiceTranslation");
    
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
            User.findById(userId).select("createdAt lastLoginAt loginCount translationCount")
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
        console.error("获取用户活动统计失败:", error);
        return next(new ErrorResponse("获取用户活动统计失败", 500));
    }
});

/**
 * @desc    更新用户偏好设置
 * @route   PUT /api/v2/auth/preferences
 * @access  Private
 */
const updatePreferences = asyncHandler(async (req, res, next) => {
    const {
        language,
        theme,
        notifications,
        privacy,
        accessibility
    } = req.body;
    
    try {
        const User = require("../models/User");
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
            message: "偏好设置更新成功"
        });
        
    } catch (error) {
        console.error("更新偏好设置失败:", error);
        return next(new ErrorResponse("更新偏好设置失败", 500));
    }
});

/**
 * @desc    获取用户偏好设置
 * @route   GET /api/v2/auth/preferences
 * @access  Private
 */
const getPreferences = asyncHandler(async (req, res, next) => {
    const user = req.user;
    
    // 默认偏好设置
    const defaultPreferences = {
        language: "zh-CN",
        theme: "light",
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
            fontSize: "medium",
            highContrast: false,
            screenReader: false
        }
    };
    
    const preferences = { ...defaultPreferences, ...user.preferences };
    
    res.status(200).json({
        success: true,
        data: preferences
    });
});

/**
 * @desc    删除用户账户
 * @route   DELETE /api/v2/auth/delete-account
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res, next) => {
    const { password, confirmation } = req.body;
    
    if (!password || confirmation !== "DELETE_MY_ACCOUNT") {
        return next(new ErrorResponse("请提供密码和确认文本", 400));
    }
    
    try {
        const User = require("../models/User");
        const user = await User.findById(req.user.id).select("+password");
        
        // 验证密码
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return next(new ErrorResponse("密码不正确", 401));
        }
        
        // 软删除用户（保留数据但标记为已删除）
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.email = `deleted_${user._id}@deleted.local`;
        user.username = `deleted_${user._id}`;
        await user.save();
        
        // 清除cookie
        res.cookie("token", "none", {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });
        
        res.status(200).json({
            success: true,
            message: "账户已删除"
        });
        
    } catch (error) {
        console.error("删除账户失败:", error);
        return next(new ErrorResponse("删除账户失败", 500));
    }
});

/**
 * @desc    获取安全日志
 * @route   GET /api/v2/auth/security-log
 * @access  Private
 */
const getSecurityLog = asyncHandler(async (req, res, next) => {
    try {
        // 这里可以实现安全日志功能
        // 暂时返回模拟数据
        const securityLog = [
            {
                action: "login",
                timestamp: new Date(),
                ip: req.ip,
                userAgent: req.get("User-Agent"),
                success: true
            }
        ];
        
        res.status(200).json({
            success: true,
            data: securityLog,
            message: "安全日志功能开发中"
        });
        
    } catch (error) {
        console.error("获取安全日志失败:", error);
        return next(new ErrorResponse("获取安全日志失败", 500));
    }
});

/**
 * @desc    启用两步验证
 * @route   POST /api/v2/auth/enable-2fa
 * @access  Private
 */
const enable2FA = asyncHandler(async (req, res, next) => {
    try {
        // 这里可以实现两步验证功能
        // 暂时返回占位符响应
        res.status(200).json({
            success: true,
            data: {
                qrCode: "data:image/png;base64,placeholder",
                secret: "placeholder_secret"
            },
            message: "两步验证功能开发中"
        });
        
    } catch (error) {
        console.error("启用两步验证失败:", error);
        return next(new ErrorResponse("启用两步验证失败", 500));
    }
});

/**
 * @desc    认证服务健康检查
 * @route   GET /api/v2/auth/health
 * @access  Public
 */
const authHealthCheck = asyncHandler(async (req, res, next) => {
    try {
        const User = require("../models/User");
        
        // 检查数据库连接
        const userCount = await User.countDocuments();
        
        const healthStatus = {
            database: true,
            userCount,
            features: {
                registration: true,
                login: true,
                walletLogin: false, // 区块链功能已移除
                tokenRefresh: true,
                passwordUpdate: true,
                walletCreation: false // 区块链功能已移除
            },
            timestamp: new Date().toISOString()
        };
        
        res.status(200).json({
            success: true,
            data: healthStatus
        });
        
    } catch (error) {
        console.error("认证服务健康检查失败:", error);
        return next(new ErrorResponse("认证服务健康检查失败", 500));
    }
});

module.exports = {
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
    registerLimiter,
    getPermissions,
    getActivityStats,
    updatePreferences,
    getPreferences,
    deleteAccount,
    getSecurityLog,
    enable2FA,
    authHealthCheck
};


