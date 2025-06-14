const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const CBTTokenService = require('../services/cbtTokenService');
const { protect } = require('../middleware/auth');

// 初始化CBT代币服务
const cbtTokenService = new CBTTokenService();

/**
 * @desc    创建聊天室
 * @route   POST /api/v2/chat/rooms
 * @access  Private
 */
router.post('/rooms', protect, async (req, res) => {
    try {
        const {
            name,
            description,
            type = 'PUBLIC',
            category = 'GENERAL',
            settings = {},
            languages = [],
            tags = []
        } = req.body;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: '聊天室名称不能为空'
            });
        }
        
        // 检查聊天室名称是否已存在
        const existingRoom = await ChatRoom.findOne({ 
            name: name.trim(),
            status: { $ne: 'ARCHIVED' }
        });
        
        if (existingRoom) {
            return res.status(400).json({
                success: false,
                error: '聊天室名称已存在'
            });
        }
        
        // 创建聊天室
        const chatRoom = new ChatRoom({
            name: name.trim(),
            description: description?.trim(),
            type,
            category,
            creator: req.user.id,
            settings: {
                maxParticipants: 100,
                isPrivate: false,
                requireApproval: false,
                allowVoiceMessages: true,
                allowFileSharing: true,
                autoTranslation: {
                    enabled: true,
                    targetLanguages: ['zh-CN', 'en-US']
                },
                messageRetention: 30,
                ...settings
            },
            languages,
            tags
        });
        
        // 创建者自动成为参与者和管理员
        chatRoom.addParticipant(req.user.id, 'ADMIN');
        chatRoom.addModerator(req.user.id, {
            canMute: true,
            canKick: true,
            canDeleteMessages: true,
            canManageUsers: true
        });
        
        await chatRoom.save();
        
        // 填充创建者信息
        await chatRoom.populate('creator', 'username avatar');
        
        res.status(201).json({
            success: true,
            message: '聊天室创建成功',
            data: chatRoom
        });
        
    } catch (error) {
        console.error('创建聊天室失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取聊天室列表
 * @route   GET /api/v2/chat/rooms
 * @access  Private
 */
router.get('/rooms', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            category,
            language,
            search,
            status = 'ACTIVE',
            sortBy = 'lastActivity'
        } = req.query;
        
        // 构建查询条件
        const query = { status };
        
        if (type) query.type = type;
        if (category) query.category = category;
        if (language) query['languages.primary'] = language;
        
        // 文本搜索
        if (search) {
            query.$text = { $search: search };
        }
        
        // 排序选项
        let sortOptions = {};
        switch (sortBy) {
            case 'lastActivity':
                sortOptions = { 'statistics.lastActivityAt': -1 };
                break;
            case 'participants':
                sortOptions = { 'statistics.totalParticipants': -1 };
                break;
            case 'messages':
                sortOptions = { 'statistics.totalMessages': -1 };
                break;
            case 'created':
                sortOptions = { createdAt: -1 };
                break;
            default:
                sortOptions = { 'statistics.lastActivityAt': -1 };
        }
        
        // 如果有文本搜索，按相关性排序
        if (search) {
            sortOptions = { score: { $meta: 'textScore' } };
        }
        
        const chatRooms = await ChatRoom.find(query)
            .populate('creator', 'username avatar')
            .populate('participants.user', 'username avatar')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await ChatRoom.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                chatRooms,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('获取聊天室列表失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取聊天室详情
 * @route   GET /api/v2/chat/rooms/:id
 * @access  Private
 */
router.get('/rooms/:id', protect, async (req, res) => {
    try {
        const chatRoom = await ChatRoom.findById(req.params.id)
            .populate('creator', 'username avatar')
            .populate('participants.user', 'username avatar')
            .populate('moderators.user', 'username avatar');
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        // 检查访问权限
        if (chatRoom.settings.isPrivate) {
            const isParticipant = chatRoom.participants.some(p => 
                p.user._id.toString() === req.user.id
            );
            
            if (!isParticipant) {
                return res.status(403).json({
                    success: false,
                    error: '无权限访问私有聊天室'
                });
            }
        }
        
        res.json({
            success: true,
            data: chatRoom
        });
        
    } catch (error) {
        console.error('获取聊天室详情失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    加入聊天室
 * @route   POST /api/v2/chat/rooms/:id/join
 * @access  Private
 */
router.post('/rooms/:id/join', protect, async (req, res) => {
    try {
        const chatRoom = await ChatRoom.findById(req.params.id);
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        if (chatRoom.status !== 'ACTIVE') {
            return res.status(400).json({
                success: false,
                error: '聊天室已关闭'
            });
        }
        
        // 检查是否已是参与者
        const isParticipant = chatRoom.participants.some(p => 
            p.user.toString() === req.user.id
        );
        
        if (isParticipant) {
            return res.status(400).json({
                success: false,
                error: '已经是聊天室成员'
            });
        }
        
        // 检查人数限制
        if (chatRoom.participants.length >= chatRoom.settings.maxParticipants) {
            return res.status(400).json({
                success: false,
                error: '聊天室人数已满'
            });
        }
        
        // 检查私有聊天室权限
        if (chatRoom.settings.isPrivate && chatRoom.settings.requireApproval) {
            // 这里应该创建加入申请，暂时直接拒绝
            return res.status(403).json({
                success: false,
                error: '需要管理员批准才能加入'
            });
        }
        
        // 添加参与者
        chatRoom.addParticipant(req.user.id);
        await chatRoom.save();
        
        res.json({
            success: true,
            message: '成功加入聊天室'
        });
        
    } catch (error) {
        console.error('加入聊天室失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    离开聊天室
 * @route   POST /api/v2/chat/rooms/:id/leave
 * @access  Private
 */
router.post('/rooms/:id/leave', protect, async (req, res) => {
    try {
        const chatRoom = await ChatRoom.findById(req.params.id);
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        // 检查是否是创建者
        if (chatRoom.creator.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                error: '创建者不能离开聊天室，请转让所有权或删除聊天室'
            });
        }
        
        // 移除参与者
        const removed = chatRoom.removeParticipant(req.user.id);
        
        if (!removed) {
            return res.status(400).json({
                success: false,
                error: '您不是聊天室成员'
            });
        }
        
        // 如果是管理员，也要移除管理员身份
        chatRoom.removeModerator(req.user.id);
        
        await chatRoom.save();
        
        res.json({
            success: true,
            message: '成功离开聊天室'
        });
        
    } catch (error) {
        console.error('离开聊天室失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取聊天消息
 * @route   GET /api/v2/chat/rooms/:id/messages
 * @access  Private
 */
router.get('/rooms/:id/messages', protect, async (req, res) => {
    try {
        const { page = 1, limit = 50, before } = req.query;
        const roomId = req.params.id;
        
        // 检查用户是否是聊天室成员
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        const isParticipant = chatRoom.participants.some(p => 
            p.user.toString() === req.user.id
        );
        
        if (!isParticipant && chatRoom.settings.isPrivate) {
            return res.status(403).json({
                success: false,
                error: '无权限访问聊天记录'
            });
        }
        
        // 获取消息
        const messages = await ChatMessage.getRecentMessages(roomId, limit, before);
        
        res.json({
            success: true,
            data: {
                messages: messages.reverse(), // 按时间正序返回
                hasMore: messages.length === limit
            }
        });
        
    } catch (error) {
        console.error('获取聊天消息失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    搜索聊天消息
 * @route   GET /api/v2/chat/rooms/:id/messages/search
 * @access  Private
 */
router.get('/rooms/:id/messages/search', protect, async (req, res) => {
    try {
        const { q: searchText, limit = 20 } = req.query;
        const roomId = req.params.id;
        
        if (!searchText || searchText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: '搜索关键词不能为空'
            });
        }
        
        // 检查权限
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        const isParticipant = chatRoom.participants.some(p => 
            p.user.toString() === req.user.id
        );
        
        if (!isParticipant && chatRoom.settings.isPrivate) {
            return res.status(403).json({
                success: false,
                error: '无权限搜索聊天记录'
            });
        }
        
        // 搜索消息
        const messages = await ChatMessage.searchMessages(roomId, searchText.trim(), limit);
        
        res.json({
            success: true,
            data: {
                messages,
                searchText: searchText.trim(),
                total: messages.length
            }
        });
        
    } catch (error) {
        console.error('搜索聊天消息失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    更新聊天室设置
 * @route   PUT /api/v2/chat/rooms/:id
 * @access  Private
 */
router.put('/rooms/:id', protect, async (req, res) => {
    try {
        const chatRoom = await ChatRoom.findById(req.params.id);
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        // 检查权限（创建者或管理员）
        const isCreator = chatRoom.creator.toString() === req.user.id;
        const isModerator = chatRoom.moderators.some(m => 
            m.user.toString() === req.user.id && m.permissions.canManageUsers
        );
        
        if (!isCreator && !isModerator) {
            return res.status(403).json({
                success: false,
                error: '无权限修改聊天室设置'
            });
        }
        
        // 更新允许的字段
        const allowedUpdates = ['name', 'description', 'settings', 'languages', 'tags', 'avatar', 'banner'];
        const updates = {};
        
        for (const field of allowedUpdates) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }
        
        // 特殊处理：只有创建者可以修改某些敏感设置
        if (!isCreator) {
            delete updates.settings?.isPrivate;
            delete updates.settings?.requireApproval;
        }
        
        Object.assign(chatRoom, updates);
        await chatRoom.save();
        
        res.json({
            success: true,
            message: '聊天室设置更新成功',
            data: chatRoom
        });
        
    } catch (error) {
        console.error('更新聊天室设置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    删除聊天室
 * @route   DELETE /api/v2/chat/rooms/:id
 * @access  Private
 */
router.delete('/rooms/:id', protect, async (req, res) => {
    try {
        const chatRoom = await ChatRoom.findById(req.params.id);
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        // 只有创建者可以删除聊天室
        if (chatRoom.creator.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '只有创建者可以删除聊天室'
            });
        }
        
        // 软删除：标记为已归档
        chatRoom.status = 'ARCHIVED';
        await chatRoom.save();
        
        res.json({
            success: true,
            message: '聊天室已删除'
        });
        
    } catch (error) {
        console.error('删除聊天室失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    管理聊天室成员
 * @route   POST /api/v2/chat/rooms/:id/members/:userId/:action
 * @access  Private
 */
router.post('/rooms/:id/members/:userId/:action', protect, async (req, res) => {
    try {
        const { id: roomId, userId, action } = req.params;
        const { duration, reason } = req.body;
        
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                error: '聊天室不存在'
            });
        }
        
        // 检查权限
        const isCreator = chatRoom.creator.toString() === req.user.id;
        const moderator = chatRoom.moderators.find(m => m.user.toString() === req.user.id);
        
        if (!isCreator && !moderator) {
            return res.status(403).json({
                success: false,
                error: '无权限管理成员'
            });
        }
        
        let success = false;
        let message = '';
        
        switch (action) {
            case 'mute':
                if (isCreator || moderator.permissions.canMute) {
                    success = chatRoom.muteParticipant(userId, duration || 3600000);
                    message = success ? '用户已被禁言' : '禁言失败';
                } else {
                    return res.status(403).json({
                        success: false,
                        error: '无权限禁言用户'
                    });
                }
                break;
                
            case 'unmute':
                if (isCreator || moderator.permissions.canMute) {
                    success = chatRoom.unmuteParticipant(userId);
                    message = success ? '用户已解除禁言' : '解除禁言失败';
                } else {
                    return res.status(403).json({
                        success: false,
                        error: '无权限解除禁言'
                    });
                }
                break;
                
            case 'kick':
                if (isCreator || moderator.permissions.canKick) {
                    success = chatRoom.removeParticipant(userId);
                    message = success ? '用户已被踢出' : '踢出失败';
                } else {
                    return res.status(403).json({
                        success: false,
                        error: '无权限踢出用户'
                    });
                }
                break;
                
            case 'ban':
                if (isCreator || moderator.permissions.canKick) {
                    success = chatRoom.banParticipant(userId);
                    message = success ? '用户已被封禁' : '封禁失败';
                } else {
                    return res.status(403).json({
                        success: false,
                        error: '无权限封禁用户'
                    });
                }
                break;
                
            case 'promote':
                if (isCreator) {
                    success = chatRoom.addModerator(userId);
                    message = success ? '用户已提升为管理员' : '提升失败';
                } else {
                    return res.status(403).json({
                        success: false,
                        error: '只有创建者可以提升管理员'
                    });
                }
                break;
                
            case 'demote':
                if (isCreator) {
                    success = chatRoom.removeModerator(userId);
                    message = success ? '用户已取消管理员身份' : '取消失败';
                } else {
                    return res.status(403).json({
                        success: false,
                        error: '只有创建者可以取消管理员'
                    });
                }
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    error: '无效的操作'
                });
        }
        
        if (success) {
            await chatRoom.save();
        }
        
        res.json({
            success: success,
            message: message
        });
        
    } catch (error) {
        console.error('管理聊天室成员失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取用户参与的聊天室
 * @route   GET /api/v2/chat/my-rooms
 * @access  Private
 */
router.get('/my-rooms', protect, async (req, res) => {
    try {
        const chatRooms = await ChatRoom.find({
            'participants.user': req.user.id,
            status: { $ne: 'ARCHIVED' }
        })
        .populate('creator', 'username avatar')
        .sort({ 'statistics.lastActivityAt': -1 });
        
        res.json({
            success: true,
            data: chatRooms
        });
        
    } catch (error) {
        console.error('获取用户聊天室失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取聊天统计
 * @route   GET /api/v2/chat/stats
 * @access  Private
 */
router.get('/stats', protect, async (req, res) => {
    try {
        // 获取用户参与的聊天室统计
        const userRooms = await ChatRoom.find({
            'participants.user': req.user.id,
            status: 'ACTIVE'
        });
        
        // 获取用户发送的消息统计
        const messageStats = await ChatMessage.aggregate([
            {
                $match: {
                    sender: req.user._id,
                    status: { $ne: 'DELETED' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalMessages: { $sum: 1 },
                    totalRewards: { $sum: { $toDouble: '$rewards.cbtEarned' } },
                    averageQuality: { $avg: '$rewards.qualityScore' }
                }
            }
        ]);
        
        const stats = {
            totalRooms: userRooms.length,
            activeRooms: userRooms.filter(room => room.isActive).length,
            totalMessages: messageStats[0]?.totalMessages || 0,
            totalRewards: messageStats[0]?.totalRewards || 0,
            averageQuality: messageStats[0]?.averageQuality || 0
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('获取聊天统计失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

module.exports = router;

