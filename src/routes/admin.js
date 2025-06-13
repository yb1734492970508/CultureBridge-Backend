const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { check, validationResult } = require('express-validator');

// 管理员中间件
const adminAuth = async (req, res, next) => {
    try {
        // 检查用户是否为管理员
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                error: '需要管理员权限'
            });
        }
        next();
    } catch (error) {
        console.error('管理员权限检查失败:', error);
        res.status(500).json({
            success: false,
            error: '权限检查失败'
        });
    }
};

// @route   GET /api/admin/stats
// @desc    获取系统统计信息
// @access  Private/Admin
router.get('/stats', protect, adminAuth, async (req, res) => {
    try {
        const User = require('../models/User');
        const Post = require('../models/Post');
        const ChatMessage = require('../models/ChatMessage');
        const VoiceTranslation = require('../models/VoiceTranslation');

        const stats = {
            users: {
                total: await User.countDocuments(),
                active: await User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
                verified: await User.countDocuments({ isVerified: true })
            },
            content: {
                posts: await Post.countDocuments(),
                messages: await ChatMessage.countDocuments(),
                translations: await VoiceTranslation.countDocuments()
            },
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date()
            }
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('获取系统统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取系统统计失败'
        });
    }
});

// @route   GET /api/admin/users
// @desc    获取用户列表
// @access  Private/Admin
router.get('/users', protect, adminAuth, async (req, res) => {
    try {
        const User = require('../models/User');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments();

        res.json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取用户列表失败'
        });
    }
});

// @route   PUT /api/admin/users/:id/status
// @desc    更新用户状态
// @access  Private/Admin
router.put('/users/:id/status', [
    protect,
    adminAuth,
    check('status', '状态是必需的').notEmpty(),
    check('status', '无效的状态值').isIn(['active', 'suspended', 'banned'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const User = require('../models/User');
        const { status } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { status, updatedAt: Date.now() },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('更新用户状态失败:', error);
        res.status(500).json({
            success: false,
            error: '更新用户状态失败'
        });
    }
});

// @route   GET /api/admin/system/health
// @desc    获取系统健康状态
// @access  Private/Admin
router.get('/system/health', protect, adminAuth, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                database: mongoose.connection.readyState === 1,
                memory: {
                    used: process.memoryUsage().heapUsed,
                    total: process.memoryUsage().heapTotal,
                    percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100).toFixed(2)
                },
                uptime: process.uptime()
            }
        };

        res.json({
            success: true,
            data: health
        });

    } catch (error) {
        console.error('获取系统健康状态失败:', error);
        res.status(500).json({
            success: false,
            error: '获取系统健康状态失败'
        });
    }
});

module.exports = router;

