const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const BlockchainService = require('../services/blockchainService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

class ChatController {
    constructor() {
        this.blockchainService = new BlockchainService();
    }

    /**
     * @desc    创建聊天室
     * @route   POST /api/v1/chat/rooms
     * @access  Private
     */
    createChatRoom = asyncHandler(async (req, res, next) => {
        const { name, description, type, languages, maxMembers, settings } = req.body;

        const chatRoom = await ChatRoom.create({
            name,
            description,
            type: type || 'public',
            languages: languages || ['zh', 'en'],
            creator: req.user.id,
            maxMembers: maxMembers || 100,
            settings: settings || {},
            members: [{
                user: req.user.id,
                role: 'admin'
            }]
        });

        await chatRoom.populate('creator', 'username email');
        await chatRoom.populate('members.user', 'username email');

        // 奖励创建聊天室的CBT代币
        try {
            const user = await User.findById(req.user.id);
            if (user.walletAddress) {
                const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
                if (adminPrivateKey) {
                    await this.blockchainService.awardTokens(
                        user.walletAddress,
                        '10', // 10 CBT奖励
                        'Created chat room: ' + name,
                        adminPrivateKey
                    );
                }
            }
        } catch (error) {
            console.warn('奖励CBT代币失败:', error);
        }

        res.status(201).json({
            success: true,
            data: chatRoom
        });
    });

    /**
     * @desc    获取所有聊天室
     * @route   GET /api/v1/chat/rooms
     * @access  Public
     */
    getChatRooms = asyncHandler(async (req, res, next) => {
        const { type, language, page = 1, limit = 10 } = req.query;

        let query = { isActive: true };
        
        if (type) {
            query.type = type;
        }
        
        if (language) {
            query.languages = { $in: [language] };
        }

        const startIndex = (page - 1) * limit;
        const total = await ChatRoom.countDocuments(query);

        const chatRooms = await ChatRoom.find(query)
            .populate('creator', 'username email')
            .populate('members.user', 'username email')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(parseInt(limit));

        // 计算分页信息
        const pagination = {};
        if (startIndex + limit < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({
            success: true,
            count: chatRooms.length,
            total,
            pagination,
            data: chatRooms
        });
    });

    /**
     * @desc    加入聊天室
     * @route   POST /api/v1/chat/rooms/:id/join
     * @access  Private
     */
    joinChatRoom = asyncHandler(async (req, res, next) => {
        const chatRoom = await ChatRoom.findById(req.params.id);

        if (!chatRoom) {
            return next(new ErrorResponse('聊天室不存在', 404));
        }

        // 检查是否已经是成员
        const isMember = chatRoom.members.some(
            member => member.user.toString() === req.user.id
        );

        if (isMember) {
            return next(new ErrorResponse('您已经是该聊天室的成员', 400));
        }

        // 检查聊天室是否已满
        if (chatRoom.members.length >= chatRoom.maxMembers) {
            return next(new ErrorResponse('聊天室已满', 400));
        }

        chatRoom.members.push({
            user: req.user.id,
            role: 'member'
        });

        await chatRoom.save();
        await chatRoom.populate('members.user', 'username email');

        // 奖励加入聊天室的CBT代币
        try {
            const user = await User.findById(req.user.id);
            if (user.walletAddress) {
                const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
                if (adminPrivateKey) {
                    await this.blockchainService.awardTokens(
                        user.walletAddress,
                        '5', // 5 CBT奖励
                        'Joined chat room: ' + chatRoom.name,
                        adminPrivateKey
                    );
                }
            }
        } catch (error) {
            console.warn('奖励CBT代币失败:', error);
        }

        res.status(200).json({
            success: true,
            data: chatRoom
        });
    });

    /**
     * @desc    离开聊天室
     * @route   POST /api/v1/chat/rooms/:id/leave
     * @access  Private
     */
    leaveChatRoom = asyncHandler(async (req, res, next) => {
        const chatRoom = await ChatRoom.findById(req.params.id);

        if (!chatRoom) {
            return next(new ErrorResponse('聊天室不存在', 404));
        }

        // 检查是否是成员
        const memberIndex = chatRoom.members.findIndex(
            member => member.user.toString() === req.user.id
        );

        if (memberIndex === -1) {
            return next(new ErrorResponse('您不是该聊天室的成员', 400));
        }

        // 如果是创建者，不能离开
        if (chatRoom.creator.toString() === req.user.id) {
            return next(new ErrorResponse('聊天室创建者不能离开聊天室', 400));
        }

        chatRoom.members.splice(memberIndex, 1);
        await chatRoom.save();

        res.status(200).json({
            success: true,
            data: {}
        });
    });

    /**
     * @desc    发送消息
     * @route   POST /api/v1/chat/rooms/:id/messages
     * @access  Private
     */
    sendMessage = asyncHandler(async (req, res, next) => {
        const { content, messageType, originalLanguage, replyTo } = req.body;
        const chatRoomId = req.params.id;

        const chatRoom = await ChatRoom.findById(chatRoomId);
        if (!chatRoom) {
            return next(new ErrorResponse('聊天室不存在', 404));
        }

        // 检查是否是聊天室成员
        const isMember = chatRoom.members.some(
            member => member.user.toString() === req.user.id
        );

        if (!isMember) {
            return next(new ErrorResponse('您不是该聊天室的成员', 403));
        }

        const message = await ChatMessage.create({
            chatRoom: chatRoomId,
            sender: req.user.id,
            content,
            messageType: messageType || 'text',
            originalLanguage: originalLanguage || 'zh',
            replyTo: replyTo || null
        });

        await message.populate('sender', 'username email');
        if (replyTo) {
            await message.populate('replyTo', 'content sender');
        }

        // 奖励发送消息的CBT代币
        try {
            const user = await User.findById(req.user.id);
            if (user.walletAddress) {
                const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
                if (adminPrivateKey) {
                    const txHash = await this.blockchainService.awardTokens(
                        user.walletAddress,
                        '1', // 1 CBT奖励
                        'Sent message in chat room',
                        adminPrivateKey
                    );
                    
                    // 更新消息的代币奖励信息
                    message.tokenReward = {
                        amount: 1,
                        reason: 'Sent message in chat room',
                        transactionHash: txHash
                    };
                    await message.save();
                }
            }
        } catch (error) {
            console.warn('奖励CBT代币失败:', error);
        }

        res.status(201).json({
            success: true,
            data: message
        });
    });

    /**
     * @desc    获取聊天室消息
     * @route   GET /api/v1/chat/rooms/:id/messages
     * @access  Private
     */
    getChatMessages = asyncHandler(async (req, res, next) => {
        const { page = 1, limit = 50, before } = req.query;
        const chatRoomId = req.params.id;

        const chatRoom = await ChatRoom.findById(chatRoomId);
        if (!chatRoom) {
            return next(new ErrorResponse('聊天室不存在', 404));
        }

        // 检查是否是聊天室成员
        const isMember = chatRoom.members.some(
            member => member.user.toString() === req.user.id
        );

        if (!isMember) {
            return next(new ErrorResponse('您不是该聊天室的成员', 403));
        }

        let query = { 
            chatRoom: chatRoomId,
            isDeleted: false
        };

        // 如果提供了before参数，获取该时间之前的消息
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const startIndex = (page - 1) * limit;
        const total = await ChatMessage.countDocuments(query);

        const messages = await ChatMessage.find(query)
            .populate('sender', 'username email walletAddress')
            .populate('replyTo', 'content sender')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(parseInt(limit));

        // 计算分页信息
        const pagination = {};
        if (startIndex + limit < total) {
            pagination.next = { page: page + 1, limit };
        }
        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({
            success: true,
            count: messages.length,
            total,
            pagination,
            data: messages.reverse() // 反转数组，使最新消息在最后
        });
    });

    /**
     * @desc    删除消息
     * @route   DELETE /api/v1/chat/messages/:id
     * @access  Private
     */
    deleteMessage = asyncHandler(async (req, res, next) => {
        const message = await ChatMessage.findById(req.params.id);

        if (!message) {
            return next(new ErrorResponse('消息不存在', 404));
        }

        // 只有消息发送者或聊天室管理员可以删除消息
        const chatRoom = await ChatRoom.findById(message.chatRoom);
        const isAdmin = chatRoom.members.some(
            member => member.user.toString() === req.user.id && 
                     (member.role === 'admin' || member.role === 'moderator')
        );

        if (message.sender.toString() !== req.user.id && !isAdmin) {
            return next(new ErrorResponse('无权限删除此消息', 403));
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        res.status(200).json({
            success: true,
            data: {}
        });
    });

    /**
     * @desc    添加消息反应
     * @route   POST /api/v1/chat/messages/:id/reactions
     * @access  Private
     */
    addReaction = asyncHandler(async (req, res, next) => {
        const { emoji } = req.body;
        const message = await ChatMessage.findById(req.params.id);

        if (!message) {
            return next(new ErrorResponse('消息不存在', 404));
        }

        // 检查用户是否已经对该消息有相同的反应
        const existingReaction = message.reactions.find(
            reaction => reaction.user.toString() === req.user.id && reaction.emoji === emoji
        );

        if (existingReaction) {
            return next(new ErrorResponse('您已经添加了相同的反应', 400));
        }

        message.reactions.push({
            user: req.user.id,
            emoji
        });

        await message.save();
        await message.populate('reactions.user', 'username email');

        res.status(200).json({
            success: true,
            data: message
        });
    });

    /**
     * @desc    移除消息反应
     * @route   DELETE /api/v1/chat/messages/:id/reactions/:emoji
     * @access  Private
     */
    removeReaction = asyncHandler(async (req, res, next) => {
        const { emoji } = req.params;
        const message = await ChatMessage.findById(req.params.id);

        if (!message) {
            return next(new ErrorResponse('消息不存在', 404));
        }

        const reactionIndex = message.reactions.findIndex(
            reaction => reaction.user.toString() === req.user.id && reaction.emoji === emoji
        );

        if (reactionIndex === -1) {
            return next(new ErrorResponse('反应不存在', 404));
        }

        message.reactions.splice(reactionIndex, 1);
        await message.save();

        res.status(200).json({
            success: true,
            data: {}
        });
    });
}

module.exports = new ChatController();

