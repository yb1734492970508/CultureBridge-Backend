const express = require("express");
const protect = require("../middleware/auth");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");
const {
    register,
    login,
    logout,
    getMe,
    updateDetails,
    updatePassword,
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
} = require("../controllers/enhancedAuth");

const router = express.Router();

/**
 * @desc    用户注册
 * @route   POST /api/v2/auth/register
 * @access  Public
 */
router.post("/register", registerLimiter, register);

/**
 * @desc    用户登录
 * @route   POST /api/v2/auth/login
 * @access  Public
 */
router.post("/login", loginLimiter, login);

/**
 * @desc    用户登出
 * @route   POST /api/v2/auth/logout
 * @access  Private
 */
router.post("/logout", protect, logout);

/**
 * @desc    获取当前用户信息
 * @route   GET /api/v2/auth/me
 * @access  Private
 */
router.get("/me", protect, getMe);

/**
 * @desc    更新用户详情
 * @route   PUT /api/v2/auth/update-details
 * @access  Private
 */
router.put("/update-details", protect, updateDetails);

/**
 * @desc    更新密码
 * @route   PUT /api/v2/auth/update-password
 * @access  Private
 */
router.put("/update-password", protect, updatePassword);

/**
 * @desc    刷新令牌
 * @route   POST /api/v2/auth/refresh-token
 * @access  Private
 */
router.post("/refresh-token", protect, asyncHandler(async (req, res, next) => {
    const user = req.user;
    
    // 生成新的令牌
    const token = user.getSignedJwtToken();
    
    // Cookie选项
    const options = {
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };
    
    res
        .status(200)
        .cookie("token", token, options)
        .json({
            success: true,
            token,
            message: "令牌刷新成功"
        });
}));

/**
 * @desc    验证令牌
 * @route   GET /api/v2/auth/verify-token
 * @access  Private
 */
router.get("/verify-token", protect, asyncHandler(async (req, res, next) => {
    res.status(200).json({
        success: true,
        data: {
            userId: req.user.id,
            username: req.user.username,
            email: req.user.email,
            isValid: true
        },
        message: "令牌有效"
    });
}));

/**
 * @desc    获取用户权限
 * @route   GET /api/v2/auth/permissions
 * @access  Private
 */
router.get("/permissions", protect, getPermissions);

/**
 * @desc    获取用户活动统计
 * @route   GET /api/v2/auth/activity-stats
 * @access  Private
 */
router.get("/activity-stats", protect, getActivityStats);

/**
 * @desc    更新用户偏好设置
 * @route   PUT /api/v2/auth/preferences
 * @access  Private
 */
router.put("/preferences", protect, updatePreferences);

/**
 * @desc    获取用户偏好设置
 * @route   GET /api/v2/auth/preferences
 * @access  Private
 */
router.get("/preferences", protect, getPreferences);

/**
 * @desc    删除用户账户
 * @route   DELETE /api/v2/auth/delete-account
 * @access  Private
 */
router.delete("/delete-account", protect, deleteAccount);

/**
 * @desc    获取安全日志
 * @route   GET /api/v2/auth/security-log
 * @access  Private
 */
router.get("/security-log", protect, getSecurityLog);

/**
 * @desc    启用两步验证
 * @route   POST /api/v2/auth/enable-2fa
 * @access  Private
 */
router.post("/enable-2fa", protect, enable2FA);

/**
 * @desc    认证服务健康检查
 * @route   GET /api/v2/auth/health
 * @access  Public
 */
router.get("/health", authHealthCheck);

module.exports = router;


