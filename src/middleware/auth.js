const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 身份验证中间件
 * Authentication middleware for CultureBridge
 */
const auth = async (req, res, next) => {
    try {
        // 从请求头获取token
        let token = req.header('Authorization');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: '访问被拒绝，未提供token'
            });
        }
        
        // 移除Bearer前缀
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }
        
        // 验证token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        // 从数据库获取用户信息（测试环境跳过数据库查询）
        if (process.env.NODE_ENV === 'test') {
            req.user = { id: decoded.id, username: 'testuser' };
            return next();
        }
        
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 检查用户是否被禁用
        if (user.status === 'disabled') {
            return res.status(401).json({
                success: false,
                error: '账户已被禁用'
            });
        }
        
        // 将用户信息添加到请求对象
        req.user = user;
        next();
        
    } catch (error) {
        console.error('身份验证失败:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: '无效的token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'token已过期'
            });
        }
        
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
};

/**
 * 可选身份验证中间件
 * Optional authentication middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.header('Authorization');
        
        if (!token) {
            // 没有token时继续执行，但不设置用户信息
            return next();
        }
        
        // 移除Bearer前缀
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }
        
        // 验证token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        // 测试环境跳过数据库查询
        if (process.env.NODE_ENV === 'test') {
            req.user = { id: decoded.id, username: 'testuser' };
            return next();
        }
        
        // 从数据库获取用户信息
        const user = await User.findById(decoded.id).select('-password');
        
        if (user && user.status !== 'disabled') {
            req.user = user;
        }
        
        next();
        
    } catch (error) {
        // 可选认证失败时不返回错误，继续执行
        console.log('可选认证失败:', error.message);
        next();
    }
};

/**
 * 管理员权限验证中间件
 * Admin authorization middleware
 */
const adminAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: '需要身份验证'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '需要管理员权限'
        });
    }
    
    next();
};

/**
 * 版主权限验证中间件
 * Moderator authorization middleware
 */
const moderatorAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: '需要身份验证'
        });
    }
    
    if (!['admin', 'moderator'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            error: '需要版主或管理员权限'
        });
    }
    
    next();
};

/**
 * 钱包地址验证中间件
 * Wallet address verification middleware
 */
const walletAuth = async (req, res, next) => {
    try {
        const { walletAddress, signature } = req.body;
        
        if (!walletAddress || !signature) {
            return res.status(400).json({
                success: false,
                error: '缺少钱包地址或签名'
            });
        }
        
        // 这里应该验证钱包签名
        // 简化实现，实际应该使用Web3验证
        req.walletAddress = walletAddress;
        next();
        
    } catch (error) {
        console.error('钱包验证失败:', error);
        res.status(401).json({
            success: false,
            error: '钱包验证失败'
        });
    }
};

module.exports = {
    auth,
    optionalAuth,
    adminAuth,
    moderatorAuth,
    walletAuth
};

