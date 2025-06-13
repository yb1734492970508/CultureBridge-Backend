const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const TokenRewardService = require('../services/tokenRewardService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

class ChatController {
    constructor() {
        this.tokenRewardService = new TokenRewardService();
    }
    
    /**
     * @desc    创建聊天室
     * @route   POST /api/v1/chat/rooms
     * @access  Private
     */
    createChatRoom = asyncHandler(async (req, res, next) => {
        const { name, description, type = 'public', languages = ['zh'], maxMembers = 100 } = req.body;
        const userId = req.user.id;
        
        if (!name) {
            return next(new ErrorResponse('请提供聊天室名称', 400));
        }
        
        try {
            const chatRoom = new ChatRoom({
                name,
                description,
                type,
                languages,
                creator: userId,
                maxMembers,
                members: [{
                    user: userId,
                    role: 'admin',
                    joinedAt: new Date()
                }]
            });
            
            await chatRoom.save();
            await chatRoom.populate('creator', 'username');
            
            // 奖励创建聊天室
            try {
                await this.tokenRewardService.awardTokens(userId, 'content.post', {
                    contentType: 'chat_room',
                    contentId: chatRoom._id
                });
            } catch (error) {
                console.warn('奖励代币失败:', error);
            }
            
            res.status(201).json({
                success: true,
                data: chatRoom
            });
            
        } catch (error) {
            console.error('创建聊天室失败:', error);
            return next(new ErrorResponse('创建聊天室失败', 500));
        }
    });
    
    /**
     * @desc    获取聊天室列表
     * @route   GET /api/v1/chat/rooms
     * @access  Public
     */
    getChatRooms = asyncHandler(async (req, res, next) => {
        const { type, language, page = 1, limit = 20 } = req.query;
        
        try {
            const query = { isActive: true };
            
            if (type) {
                query.type = type;
            }
            
            if (language) {
                query.languages = { $in: [language] };
            }
            
            const chatRooms = await ChatRoom.find(query)
                .populate('creator', 'username')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('-members.user'); // 不返回成员详情以提高性能
            
            // 添加成员数量
            const roomsWithStats = chatRooms.map(room => ({
                ...room.toObject(),
                memberCount: room.members.length
            }));
            
            const total = await ChatRoom.countDocuments(query);
            
            res.status(200).json({
                success: true,
                count: roomsWithStats.length,
                total,
                data: roomsWithStats
            });
            
        } catch (error) {
            console.error('获取聊天室列表失败:', error);
            return next(new ErrorResponse('获取聊天室列表失败', 500));
        }
    });
    
    /**
     * @desc    加入聊天室
     * @route   POST /api/v1/chat/rooms/:id/join
     * @access  Private
     */
    joinChatRoom = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        
        try {
            const chatRoom = await ChatRoom.findById(id);
            if (!chatRoom) {
                return next(new ErrorResponse('聊天室不存在', 404));
            }
            
            if (!chatRoom.isActive) {
                return next(new ErrorResponse('聊天室已关闭', 400));
            }
            
            // 检查是否已经是成员
            const isMember = chatRoom.members.some(member => 
                member.user.toString() === userId
            );
            
            if (isMember) {
                return next(new ErrorResponse('您已经是该聊天室的成员', 400));
            }
            
            // 检查人数限制
            if (chatRoom.members.length >= chatRoom.maxMembers) {
                return next(new ErrorResponse('聊天室已满', 400));
            }
            
            // 添加成员
            chatRoom.members.push({
                user: userId,
                role: 'member',
                joinedAt: new Date()
            });
            
            await chatRoom.save();
            
            res.status(200).json({
                success: true,
                message: '成功加入聊天室',
                data: {
                    roomId: chatRoom._id,
                    roomName: chatRoom.name,
                    memberCount: chatRoom.members.length
                }
            });
            
        } catch (error) {
            console.error('加入聊天室失败:', error);
            return next(new ErrorResponse('加入聊天室失败', 500));
        }
    });
    
    /**
     * @desc    离开聊天室
     * @route   POST /api/v1/chat/rooms/:id/leave
     * @access  Private
     */
    leaveChatRoom = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        
        try {
            const chatRoom = await ChatRoom.findById(id);
            if (!chatRoom) {
                return next(new ErrorResponse('聊天室不存在', 404));
            }
            
            // 检查是否是成员
            const memberIndex = chatRoom.members.findIndex(member => 
                member.user.toString() === userId
            );
            
            if (memberIndex === -1) {
                return next(new ErrorResponse('您不是该聊天室的成员', 400));
            }
            
            // 检查是否是创建者
            if (chatRoom.creator.toString() === userId) {
                return next(new ErrorResponse('创建者不能离开聊天室', 400));
            }
            
            // 移除成员
            chatRoom.members.splice(memberIndex, 1);
            await chatRoom.save();
            
            res.status(200).json({
                success: true,
                message: '成功离开聊天室'
            });
            
        } catch (error) {
            console.error('离开聊天室失败:', error);
            return next(new ErrorResponse('离开聊天室失败', 500));
        }
    });
    
    /**
     * @desc    发送消息
     * @route   POST /api/v1/chat/rooms/:id/messages
     * @access  Private
     */
    sendMessage = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { content, messageType = 'text', replyTo, language = 'zh' } = req.body;
        const userId = req.user.id;
        
        if (!content) {
            return next(new ErrorResponse('请提供消息内容', 400));
        }
        
        try {
            // 验证用户是否是聊天室成员
            const chatRoom = await ChatRoom.findById(id);
            if (!chatRoom) {
                return next(new ErrorResponse('聊天室不存在', 404));
            }
            
            const isMember = chatRoom.members.some(member => 
                member.user.toString() === userId
            );
            
            if (!isMember && chatRoom.type === 'private') {
                return next(new ErrorResponse('您不是该聊天室的成员', 403));
            }
            
            // 创建消息
            const message = new ChatMessage({
                chatRoom: id,
                sender: userId,
                content,
                messageType,
                originalLanguage: language,
                replyTo: replyTo || undefined
            });
            
            await message.save();
            await message.populate('sender', 'username');
            
            // 奖励发送消息
            try {
                await this.tokenRewardService.awardTokens(userId, 'content.comment', {
                    contentType: 'chat_message',
                    contentId: message._id
                });
            } catch (error) {
                console.warn('奖励代币失败:', error);
            }
            
            res.status(201).json({
                success: true,
                data: message
            });
            
        } catch (error) {
            console.error('发送消息失败:', error);
            return next(new ErrorResponse('发送消息失败', 500));
        }
    });
    
    /**
     * @desc    获取聊天消息
     * @route   GET /api/v1/chat/rooms/:id/messages
     * @access  Private
     */
    getChatMessages = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { page = 1, limit = 50, before } = req.query;
        const userId = req.user.id;
        
        try {
            // 验证用户权限
            const chatRoom = await ChatRoom.findById(id);
            if (!chatRoom) {
                return next(new ErrorResponse('聊天室不存在', 404));
            }
            
            const isMember = chatRoom.members.some(member => 
                member.user.toString() === userId
            );
            
            if (!isMember && chatRoom.type === 'private') {
                return next(new ErrorResponse('您不是该聊天室的成员', 403));
            }
            
            // 构建查询
            const query = { 
                chatRoom: id,
                isDeleted: false
            };
            
            if (before) {
                query.createdAt = { $lt: new Date(before) };
            }
            
            const messages = await ChatMessage.find(query)
                .populate('sender', 'username')
                .populate('replyTo', 'content sender')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);
            
            // 反转消息顺序（最新的在最后）
            messages.reverse();
            
            res.status(200).json({
                success: true,
                count: messages.length,
                data: messages
            });
            
        } catch (error) {
            console.error('获取聊天消息失败:', error);
            return next(new ErrorResponse('获取聊天消息失败', 500));
        }
    });
    
    /**
     * @desc    删除消息
     * @route   DELETE /api/v1/chat/messages/:id
     * @access  Private
     */
    deleteMessage = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        
        try {
            const message = await ChatMessage.findById(id);
            if (!message) {
                return next(new ErrorResponse('消息不存在', 404));
            }
            
            // 检查权限（只有发送者或管理员可以删除）
            if (message.sender.toString() !== userId) {
                // 检查是否是聊天室管理员
                const chatRoom = await ChatRoom.findById(message.chatRoom);
                const member = chatRoom.members.find(m => m.user.toString() === userId);
                
                if (!member || (member.role !== 'admin' && member.role !== 'moderator')) {
                    return next(new ErrorResponse('无权限删除此消息', 403));
                }
            }
            
            // 软删除
            message.isDeleted = true;
            message.deletedAt = new Date();
            await message.save();
            
            res.status(200).json({
                success: true,
                message: '消息已删除'
            });
            
        } catch (error) {
            console.error('删除消息失败:', error);
            return next(new ErrorResponse('删除消息失败', 500));
        }
    });
    
    /**
     * @desc    添加消息反应
     * @route   POST /api/v1/chat/messages/:id/reactions
     * @access  Private
     */
    addReaction = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user.id;
        
        if (!emoji) {
            return next(new ErrorResponse('请提供表情符号', 400));
        }
        
        try {
            const message = await ChatMessage.findById(id);
            if (!message) {
                return next(new ErrorResponse('消息不存在', 404));
            }
            
            // 检查是否已经有相同的反应
            const existingReaction = message.reactions.find(r => 
                r.user.toString() === userId && r.emoji === emoji
            );
            
            if (existingReaction) {
                return next(new ErrorResponse('您已经添加过此反应', 400));
            }
            
            // 添加反应
            message.reactions.push({
                user: userId,
                emoji,
                timestamp: new Date()
            });
            
            await message.save();
            
            res.status(200).json({
                success: true,
                message: '反应已添加'
            });
            
        } catch (error) {
            console.error('添加反应失败:', error);
            return next(new ErrorResponse('添加反应失败', 500));
        }
    });
    
    /**
     * @desc    移除消息反应
     * @route   DELETE /api/v1/chat/messages/:id/reactions/:emoji
     * @access  Private
     */
    removeReaction = asyncHandler(async (req, res, next) => {
        const { id, emoji } = req.params;
        const userId = req.user.id;
        
        try {
            const message = await ChatMessage.findById(id);
            if (!message) {
                return next(new ErrorResponse('消息不存在', 404));
            }
            
            // 移除反应
            message.reactions = message.reactions.filter(r => 
                !(r.user.toString() === userId && r.emoji === emoji)
            );
            
            await message.save();
            
            res.status(200).json({
                success: true,
                message: '反应已移除'
            });
            
        } catch (error) {
            console.error('移除反应失败:', error);
            return next(new ErrorResponse('移除反应失败', 500));
        }
    });
    
    /**
     * @desc    获取用户的聊天室
     * @route   GET /api/v1/chat/my-rooms
     * @access  Private
     */
    getMyRooms = asyncHandler(async (req, res, next) => {
        const userId = req.user.id;
        
        try {
            const chatRooms = await ChatRoom.find({
                'members.user': userId,
                isActive: true
            })
            .populate('creator', 'username')
            .sort({ updatedAt: -1 });
            
            // 添加用户在每个房间的角色和最后消息
            const roomsWithDetails = await Promise.all(
                chatRooms.map(async (room) => {
                    const member = room.members.find(m => m.user.toString() === userId);
                    
                    // 获取最后一条消息
                    const lastMessage = await ChatMessage.findOne({
                        chatRoom: room._id,
                        isDeleted: false
                    })
                    .populate('sender', 'username')
                    .sort({ createdAt: -1 });
                    
                    return {
                        ...room.toObject(),
                        userRole: member?.role,
                        joinedAt: member?.joinedAt,
                        memberCount: room.members.length,
                        lastMessage: lastMessage ? {
                            content: lastMessage.content,
                            sender: lastMessage.sender.username,
                            timestamp: lastMessage.createdAt
                        } : null
                    };
                })
            );
            
            res.status(200).json({
                success: true,
                count: roomsWithDetails.length,
                data: roomsWithDetails
            });
            
        } catch (error) {
            console.error('获取用户聊天室失败:', error);
            return next(new ErrorResponse('获取聊天室失败', 500));
        }
    });
}

module.exports = new ChatController();

