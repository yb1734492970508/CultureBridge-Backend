const express = require('express');
const { protect } = require('../middleware/auth');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

const router = express.Router();

/**
 * @desc    创建聊天室
 * @route   POST /api/v1/chat/rooms
 * @access  Private
 */
router.post('/rooms', protect, asyncHandler(async (req, res, next) => {
    const { name, description, type = 'public', language = 'zh', culturalTheme, maxMembers = 100 } = req.body;
    
    if (!name) {
        return next(new ErrorResponse('聊天室名称不能为空', 400));
    }
    
    const chatRoom = await ChatRoom.create({
        name,
        description,
        type,
        language,
        culturalTheme,
        maxMembers,
        creator: req.user.id,
        members: [{
            user: req.user.id,
            role: 'admin',
            joinedAt: new Date()
        }]
    });
    
    await chatRoom.populate('creator', 'username email');
    
    res.status(201).json({
        success: true,
        data: chatRoom
    });
}));

/**
 * @desc    获取聊天室列表
 * @route   GET /api/v1/chat/rooms
 * @access  Private
 */
router.get('/rooms', protect, asyncHandler(async (req, res, next) => {
    const { 
        page = 1, 
        limit = 20, 
        type, 
        language, 
        culturalTheme,
        search 
    } = req.query;
    
    const query = {};
    
    // 只显示公开房间或用户参与的房间
    query.$or = [
        { type: 'public' },
        { 'members.user': req.user.id }
    ];
    
    if (type) query.type = type;
    if (language) query.language = language;
    if (culturalTheme) query.culturalTheme = new RegExp(culturalTheme, 'i');
    if (search) {
        query.$and = [
            query.$or ? { $or: query.$or } : {},
            {
                $or: [
                    { name: new RegExp(search, 'i') },
                    { description: new RegExp(search, 'i') }
                ]
            }
        ];
        delete query.$or;
    }
    
    const skip = (page - 1) * limit;
    
    const [rooms, total] = await Promise.all([
        ChatRoom.find(query)
            .sort({ lastActivity: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('creator', 'username')
            .populate('members.user', 'username')
            .lean(),
        ChatRoom.countDocuments(query)
    ]);
    
    // 添加成员数量和用户是否已加入的信息
    const roomsWithInfo = rooms.map(room => ({
        ...room,
        memberCount: room.members.length,
        isJoined: room.members.some(member => member.user._id.toString() === req.user.id),
        onlineMembers: 0 // 这里可以从Socket服务获取在线成员数
    }));
    
    res.status(200).json({
        success: true,
        count: roomsWithInfo.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: roomsWithInfo
    });
}));

/**
 * @desc    获取单个聊天室详情
 * @route   GET /api/v1/chat/rooms/:id
 * @access  Private
 */
router.get('/rooms/:id', protect, asyncHandler(async (req, res, next) => {
    const room = await ChatRoom.findById(req.params.id)
        .populate('creator', 'username email')
        .populate('members.user', 'username email avatar');
    
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查用户是否有权限查看
    const isMember = room.members.some(member => member.user._id.toString() === req.user.id);
    if (room.type === 'private' && !isMember) {
        return next(new ErrorResponse('权限不足', 403));
    }
    
    res.status(200).json({
        success: true,
        data: {
            ...room.toObject(),
            memberCount: room.members.length,
            isJoined: isMember
        }
    });
}));

/**
 * @desc    加入聊天室
 * @route   POST /api/v1/chat/rooms/:id/join
 * @access  Private
 */
router.post('/rooms/:id/join', protect, asyncHandler(async (req, res, next) => {
    const room = await ChatRoom.findById(req.params.id);
    
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查是否已经是成员
    const isMember = room.members.some(member => member.user.toString() === req.user.id);
    if (isMember) {
        return next(new ErrorResponse('您已经是该聊天室的成员', 400));
    }
    
    // 检查房间是否已满
    if (room.members.length >= room.maxMembers) {
        return next(new ErrorResponse('聊天室已满', 400));
    }
    
    // 检查私有房间权限
    if (room.type === 'private') {
        return next(new ErrorResponse('无法加入私有聊天室', 403));
    }
    
    // 添加成员
    room.members.push({
        user: req.user.id,
        role: 'member',
        joinedAt: new Date()
    });
    
    await room.save();
    
    res.status(200).json({
        success: true,
        message: '成功加入聊天室'
    });
}));

/**
 * @desc    离开聊天室
 * @route   POST /api/v1/chat/rooms/:id/leave
 * @access  Private
 */
router.post('/rooms/:id/leave', protect, asyncHandler(async (req, res, next) => {
    const room = await ChatRoom.findById(req.params.id);
    
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查是否是成员
    const memberIndex = room.members.findIndex(member => member.user.toString() === req.user.id);
    if (memberIndex === -1) {
        return next(new ErrorResponse('您不是该聊天室的成员', 400));
    }
    
    // 检查是否是创建者
    if (room.creator.toString() === req.user.id) {
        return next(new ErrorResponse('创建者不能离开聊天室，请转让管理权或删除聊天室', 400));
    }
    
    // 移除成员
    room.members.splice(memberIndex, 1);
    await room.save();
    
    res.status(200).json({
        success: true,
        message: '成功离开聊天室'
    });
}));

/**
 * @desc    获取聊天消息
 * @route   GET /api/v1/chat/rooms/:id/messages
 * @access  Private
 */
router.get('/rooms/:id/messages', protect, asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 50, before, after } = req.query;
    
    const room = await ChatRoom.findById(req.params.id);
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查权限
    const isMember = room.members.some(member => member.user.toString() === req.user.id);
    if (room.type === 'private' && !isMember) {
        return next(new ErrorResponse('权限不足', 403));
    }
    
    const query = { chatRoom: req.params.id };
    
    // 时间范围查询
    if (before) {
        query.timestamp = { ...query.timestamp, $lt: new Date(before) };
    }
    if (after) {
        query.timestamp = { ...query.timestamp, $gt: new Date(after) };
    }
    
    const skip = (page - 1) * limit;
    
    const [messages, total] = await Promise.all([
        ChatMessage.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('sender', 'username avatar')
            .populate('replyTo', 'content sender')
            .lean(),
        ChatMessage.countDocuments(query)
    ]);
    
    // 反转消息顺序，使最新的在最后
    messages.reverse();
    
    res.status(200).json({
        success: true,
        count: messages.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: messages
    });
}));

/**
 * @desc    发送聊天消息
 * @route   POST /api/v1/chat/rooms/:id/messages
 * @access  Private
 */
router.post('/rooms/:id/messages', protect, asyncHandler(async (req, res, next) => {
    const { content, messageType = 'text', language = 'zh', culturalContext, replyTo } = req.body;
    
    if (!content) {
        return next(new ErrorResponse('消息内容不能为空', 400));
    }
    
    const room = await ChatRoom.findById(req.params.id);
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查权限
    const isMember = room.members.some(member => member.user.toString() === req.user.id);
    if (!isMember) {
        return next(new ErrorResponse('您不是该聊天室的成员', 403));
    }
    
    const message = await ChatMessage.create({
        chatRoom: req.params.id,
        sender: req.user.id,
        content,
        messageType,
        language,
        culturalContext,
        replyTo,
        timestamp: new Date()
    });
    
    await message.populate('sender', 'username avatar');
    if (replyTo) {
        await message.populate('replyTo', 'content sender');
    }
    
    // 更新房间最后活动时间
    room.lastActivity = new Date();
    await room.save();
    
    res.status(201).json({
        success: true,
        data: message
    });
}));

/**
 * @desc    删除聊天消息
 * @route   DELETE /api/v1/chat/messages/:id
 * @access  Private
 */
router.delete('/messages/:id', protect, asyncHandler(async (req, res, next) => {
    const message = await ChatMessage.findById(req.params.id);
    
    if (!message) {
        return next(new ErrorResponse('消息不存在', 404));
    }
    
    // 检查权限（只有发送者或管理员可以删除）
    if (message.sender.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse('权限不足', 403));
    }
    
    await message.deleteOne();
    
    res.status(200).json({
        success: true,
        message: '消息已删除'
    });
}));

/**
 * @desc    更新聊天室信息
 * @route   PUT /api/v1/chat/rooms/:id
 * @access  Private
 */
router.put('/rooms/:id', protect, asyncHandler(async (req, res, next) => {
    const { name, description, culturalTheme, maxMembers } = req.body;
    
    const room = await ChatRoom.findById(req.params.id);
    
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查权限（只有创建者或管理员可以修改）
    const member = room.members.find(m => m.user.toString() === req.user.id);
    if (!member || (member.role !== 'admin' && room.creator.toString() !== req.user.id)) {
        return next(new ErrorResponse('权限不足', 403));
    }
    
    if (name) room.name = name;
    if (description) room.description = description;
    if (culturalTheme) room.culturalTheme = culturalTheme;
    if (maxMembers) room.maxMembers = maxMembers;
    
    await room.save();
    
    res.status(200).json({
        success: true,
        data: room
    });
}));

/**
 * @desc    删除聊天室
 * @route   DELETE /api/v1/chat/rooms/:id
 * @access  Private
 */
router.delete('/rooms/:id', protect, asyncHandler(async (req, res, next) => {
    const room = await ChatRoom.findById(req.params.id);
    
    if (!room) {
        return next(new ErrorResponse('聊天室不存在', 404));
    }
    
    // 检查权限（只有创建者可以删除）
    if (room.creator.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse('权限不足', 403));
    }
    
    // 删除所有相关消息
    await ChatMessage.deleteMany({ chatRoom: req.params.id });
    
    // 删除聊天室
    await room.deleteOne();
    
    res.status(200).json({
        success: true,
        message: '聊天室已删除'
    });
}));

/**
 * @desc    获取聊天室统计信息
 * @route   GET /api/v1/chat/stats
 * @access  Private
 */
router.get('/stats', protect, asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    
    const [
        totalRooms,
        joinedRooms,
        totalMessages,
        recentActivity
    ] = await Promise.all([
        ChatRoom.countDocuments({ type: 'public' }),
        ChatRoom.countDocuments({ 'members.user': userId }),
        ChatMessage.countDocuments({ sender: userId }),
        ChatMessage.find({ sender: userId })
            .sort({ timestamp: -1 })
            .limit(10)
            .populate('chatRoom', 'name')
            .select('content timestamp chatRoom')
            .lean()
    ]);
    
    const stats = {
        totalRooms,
        joinedRooms,
        totalMessages,
        recentActivity
    };
    
    res.status(200).json({
        success: true,
        data: stats
    });
}));

module.exports = router;

