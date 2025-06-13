const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const EnhancedVoiceTranslationService = require('./enhancedVoiceTranslationService');
const EnhancedBlockchainService = require('./enhancedBlockchainService');

class EnhancedSocketService {
    constructor(server) {
        this.io = socketIo(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        // 初始化服务
        this.voiceService = new EnhancedVoiceTranslationService();
        this.blockchainService = new EnhancedBlockchainService();
        
        // 在线用户管理
        this.onlineUsers = new Map(); // socketId -> userInfo
        this.userSockets = new Map(); // userId -> Set of socketIds
        this.roomUsers = new Map(); // roomId -> Set of userIds
        
        // 消息队列和缓存
        this.messageQueue = new Map(); // roomId -> Array of messages
        this.typingUsers = new Map(); // roomId -> Set of userIds
        
        // 初始化Socket.IO
        this.initializeSocketIO();
        
        console.log('✅ 增强版Socket.IO服务已启动');
    }
    
    /**
     * 初始化Socket.IO事件处理
     */
    initializeSocketIO() {
        // 中间件：身份验证
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return next(new Error('未提供认证令牌'));
                }
                
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password -privateKey');
                
                if (!user) {
                    return next(new Error('用户不存在'));
                }
                
                socket.userId = user._id.toString();
                socket.user = user;
                next();
                
            } catch (error) {
                next(new Error('认证失败'));
            }
        });
        
        // 连接事件
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }
    
    /**
     * 处理用户连接
     */
    handleConnection(socket) {
        const userId = socket.userId;
        const user = socket.user;
        
        console.log(`👤 用户连接: ${user.username} (${userId})`);
        
        // 记录在线用户
        this.onlineUsers.set(socket.id, {
            userId,
            username: user.username,
            avatar: user.avatar,
            connectedAt: new Date()
        });
        
        // 更新用户Socket映射
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        
        // 更新用户在线状态
        this.updateUserOnlineStatus(userId, true);
        
        // 注册事件处理器
        this.registerEventHandlers(socket);
        
        // 发送欢迎消息
        socket.emit('connected', {
            message: '连接成功',
            userId,
            onlineCount: this.getOnlineUserCount()
        });
        
        // 广播用户上线
        socket.broadcast.emit('user_online', {
            userId,
            username: user.username
        });
    }
    
    /**
     * 注册事件处理器
     */
    registerEventHandlers(socket) {
        // 加入聊天室
        socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
        
        // 离开聊天室
        socket.on('leave_room', (data) => this.handleLeaveRoom(socket, data));
        
        // 发送文本消息
        socket.on('send_message', (data) => this.handleSendMessage(socket, data));
        
        // 发送语音消息
        socket.on('send_voice_message', (data) => this.handleSendVoiceMessage(socket, data));
        
        // 正在输入
        socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
        socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
        
        // 消息已读
        socket.on('mark_read', (data) => this.handleMarkRead(socket, data));
        
        // 获取聊天历史
        socket.on('get_chat_history', (data) => this.handleGetChatHistory(socket, data));
        
        // 创建聊天室
        socket.on('create_room', (data) => this.handleCreateRoom(socket, data));
        
        // 邀请用户
        socket.on('invite_user', (data) => this.handleInviteUser(socket, data));
        
        // 语音翻译请求
        socket.on('translate_voice', (data) => this.handleVoiceTranslation(socket, data));
        
        // 代币转账
        socket.on('send_tokens', (data) => this.handleSendTokens(socket, data));
        
        // 断开连接
        socket.on('disconnect', () => this.handleDisconnect(socket));
        
        // 错误处理
        socket.on('error', (error) => this.handleError(socket, error));
    }
    
    /**
     * 处理加入聊天室
     */
    async handleJoinRoom(socket, data) {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            
            // 验证聊天室
            const room = await ChatRoom.findById(roomId);
            if (!room) {
                socket.emit('error', { message: '聊天室不存在' });
                return;
            }
            
            // 检查权限
            if (room.type === 'private' && !room.members.includes(userId)) {
                socket.emit('error', { message: '无权限加入此聊天室' });
                return;
            }
            
            // 加入Socket.IO房间
            socket.join(roomId);
            
            // 更新房间用户映射
            if (!this.roomUsers.has(roomId)) {
                this.roomUsers.set(roomId, new Set());
            }
            this.roomUsers.get(roomId).add(userId);
            
            // 更新数据库中的在线成员
            if (!room.onlineMembers.includes(userId)) {
                room.onlineMembers.push(userId);
                await room.save();
            }
            
            // 通知其他用户
            socket.to(roomId).emit('user_joined_room', {
                userId,
                username: socket.user.username,
                roomId
            });
            
            // 发送房间信息
            socket.emit('room_joined', {
                roomId,
                roomName: room.name,
                roomType: room.type,
                onlineCount: this.roomUsers.get(roomId).size
            });
            
            console.log(`👥 用户 ${socket.user.username} 加入房间 ${room.name}`);
            
        } catch (error) {
            console.error('加入聊天室失败:', error);
            socket.emit('error', { message: '加入聊天室失败' });
        }
    }
    
    /**
     * 处理离开聊天室
     */
    async handleLeaveRoom(socket, data) {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            
            // 离开Socket.IO房间
            socket.leave(roomId);
            
            // 更新房间用户映射
            if (this.roomUsers.has(roomId)) {
                this.roomUsers.get(roomId).delete(userId);
                if (this.roomUsers.get(roomId).size === 0) {
                    this.roomUsers.delete(roomId);
                }
            }
            
            // 更新数据库
            const room = await ChatRoom.findById(roomId);
            if (room) {
                room.onlineMembers = room.onlineMembers.filter(id => id.toString() !== userId);
                await room.save();
            }
            
            // 通知其他用户
            socket.to(roomId).emit('user_left_room', {
                userId,
                username: socket.user.username,
                roomId
            });
            
            socket.emit('room_left', { roomId });
            
        } catch (error) {
            console.error('离开聊天室失败:', error);
            socket.emit('error', { message: '离开聊天室失败' });
        }
    }
    
    /**
     * 处理发送文本消息
     */
    async handleSendMessage(socket, data) {
        try {
            const { roomId, content, type = 'text', replyTo } = data;
            const userId = socket.userId;
            
            // 验证输入
            if (!roomId || !content) {
                socket.emit('error', { message: '消息内容不能为空' });
                return;
            }
            
            // 验证聊天室权限
            const room = await ChatRoom.findById(roomId);
            if (!room || (room.type === 'private' && !room.members.includes(userId))) {
                socket.emit('error', { message: '无权限发送消息' });
                return;
            }
            
            // 创建消息
            const message = new ChatMessage({
                sender: userId,
                chatRoom: roomId,
                content,
                type,
                replyTo
            });
            
            await message.save();
            await message.populate('sender', 'username avatar');
            if (replyTo) {
                await message.populate('replyTo', 'content sender');
            }
            
            // 更新聊天室最后消息
            room.lastMessage = message._id;
            room.lastActivity = new Date();
            await room.save();
            
            // 广播消息
            this.io.to(roomId).emit('new_message', {
                messageId: message._id,
                roomId,
                sender: {
                    id: message.sender._id,
                    username: message.sender.username,
                    avatar: message.sender.avatar
                },
                content,
                type,
                replyTo: message.replyTo,
                timestamp: message.createdAt
            });
            
            // 发放聊天奖励
            await this.distributeChatReward(userId);
            
            console.log(`💬 消息发送: ${socket.user.username} -> ${room.name}`);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            socket.emit('error', { message: '发送消息失败' });
        }
    }
    
    /**
     * 处理发送语音消息
     */
    async handleSendVoiceMessage(socket, data) {
        try {
            const { roomId, audioData, targetLanguages, sourceLanguage = 'auto' } = data;
            const userId = socket.userId;
            
            // 验证输入
            if (!roomId || !audioData) {
                socket.emit('error', { message: '语音数据不能为空' });
                return;
            }
            
            // 验证聊天室权限
            const room = await ChatRoom.findById(roomId);
            if (!room || (room.type === 'private' && !room.members.includes(userId))) {
                socket.emit('error', { message: '无权限发送消息' });
                return;
            }
            
            // 通知开始处理
            socket.emit('voice_processing_start', { roomId });
            
            // 处理语音翻译
            const audioBuffer = Buffer.from(audioData, 'base64');
            const translationResult = await this.voiceService.processVoiceMessage(
                audioBuffer,
                sourceLanguage,
                targetLanguages || ['en-US'],
                userId,
                roomId
            );
            
            // 创建语音消息
            const message = new ChatMessage({
                sender: userId,
                chatRoom: roomId,
                content: translationResult.data.originalText,
                type: 'voice',
                voiceTranslation: translationResult.data.id,
                translations: translationResult.data.translations,
                sourceLanguage: translationResult.data.sourceLanguage
            });
            
            await message.save();
            await message.populate('sender', 'username avatar');
            
            // 更新聊天室
            room.lastMessage = message._id;
            room.lastActivity = new Date();
            await room.save();
            
            // 广播语音消息
            this.io.to(roomId).emit('new_voice_message', {
                messageId: message._id,
                roomId,
                sender: {
                    id: message.sender._id,
                    username: message.sender.username,
                    avatar: message.sender.avatar
                },
                originalText: translationResult.data.originalText,
                sourceLanguage: translationResult.data.sourceLanguage,
                translations: translationResult.data.translations,
                audioTranslations: translationResult.data.audioTranslations,
                confidence: translationResult.data.confidence,
                timestamp: message.createdAt
            });
            
            // 发放语音翻译奖励
            await this.distributeVoiceTranslationReward(userId);
            
            console.log(`🎤 语音消息发送: ${socket.user.username} -> ${room.name}`);
            
        } catch (error) {
            console.error('发送语音消息失败:', error);
            socket.emit('voice_processing_error', { 
                roomId: data.roomId, 
                error: error.message 
            });
        }
    }
    
    /**
     * 处理正在输入
     */
    handleTypingStart(socket, data) {
        const { roomId } = data;
        const userId = socket.userId;
        
        if (!this.typingUsers.has(roomId)) {
            this.typingUsers.set(roomId, new Set());
        }
        
        this.typingUsers.get(roomId).add(userId);
        
        socket.to(roomId).emit('user_typing', {
            userId,
            username: socket.user.username,
            roomId
        });
    }
    
    /**
     * 处理停止输入
     */
    handleTypingStop(socket, data) {
        const { roomId } = data;
        const userId = socket.userId;
        
        if (this.typingUsers.has(roomId)) {
            this.typingUsers.get(roomId).delete(userId);
            
            if (this.typingUsers.get(roomId).size === 0) {
                this.typingUsers.delete(roomId);
            }
        }
        
        socket.to(roomId).emit('user_stop_typing', {
            userId,
            username: socket.user.username,
            roomId
        });
    }
    
    /**
     * 处理消息已读
     */
    async handleMarkRead(socket, data) {
        try {
            const { messageId, roomId } = data;
            const userId = socket.userId;
            
            // 更新消息已读状态
            await ChatMessage.findByIdAndUpdate(messageId, {
                $addToSet: { readBy: userId }
            });
            
            // 通知其他用户
            socket.to(roomId).emit('message_read', {
                messageId,
                userId,
                username: socket.user.username
            });
            
        } catch (error) {
            console.error('标记消息已读失败:', error);
        }
    }
    
    /**
     * 处理获取聊天历史
     */
    async handleGetChatHistory(socket, data) {
        try {
            const { roomId, page = 1, limit = 50 } = data;
            const skip = (page - 1) * limit;
            
            const messages = await ChatMessage.find({ chatRoom: roomId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .populate('sender', 'username avatar')
                .populate('replyTo', 'content sender');
            
            socket.emit('chat_history', {
                roomId,
                messages: messages.reverse(),
                page,
                hasMore: messages.length === limit
            });
            
        } catch (error) {
            console.error('获取聊天历史失败:', error);
            socket.emit('error', { message: '获取聊天历史失败' });
        }
    }
    
    /**
     * 处理创建聊天室
     */
    async handleCreateRoom(socket, data) {
        try {
            const { name, type = 'public', description, members = [] } = data;
            const userId = socket.userId;
            
            const room = new ChatRoom({
                name,
                type,
                description,
                creator: userId,
                members: type === 'private' ? [userId, ...members] : [userId],
                onlineMembers: [userId]
            });
            
            await room.save();
            await room.populate('creator', 'username avatar');
            
            // 加入房间
            socket.join(room._id.toString());
            
            // 通知被邀请的用户
            if (type === 'private' && members.length > 0) {
                members.forEach(memberId => {
                    this.notifyUser(memberId, 'room_invitation', {
                        roomId: room._id,
                        roomName: name,
                        inviter: socket.user.username
                    });
                });
            }
            
            socket.emit('room_created', {
                roomId: room._id,
                roomName: name,
                roomType: type
            });
            
            console.log(`🏠 聊天室创建: ${name} by ${socket.user.username}`);
            
        } catch (error) {
            console.error('创建聊天室失败:', error);
            socket.emit('error', { message: '创建聊天室失败' });
        }
    }
    
    /**
     * 处理语音翻译
     */
    async handleVoiceTranslation(socket, data) {
        try {
            const { audioData, sourceLanguage, targetLanguages } = data;
            const userId = socket.userId;
            
            socket.emit('translation_start');
            
            const audioBuffer = Buffer.from(audioData, 'base64');
            const result = await this.voiceService.processVoiceMessage(
                audioBuffer,
                sourceLanguage,
                targetLanguages,
                userId
            );
            
            socket.emit('translation_complete', result.data);
            
        } catch (error) {
            console.error('语音翻译失败:', error);
            socket.emit('translation_error', { error: error.message });
        }
    }
    
    /**
     * 处理代币转账
     */
    async handleSendTokens(socket, data) {
        try {
            const { toUserId, amount, purpose, category = 'GENERAL' } = data;
            const fromUserId = socket.userId;
            
            // 获取用户信息
            const [fromUser, toUser] = await Promise.all([
                User.findById(fromUserId).select('privateKey walletAddress'),
                User.findById(toUserId).select('walletAddress username')
            ]);
            
            if (!fromUser.walletAddress || !fromUser.privateKey) {
                socket.emit('error', { message: '发送者钱包信息不完整' });
                return;
            }
            
            if (!toUser.walletAddress) {
                socket.emit('error', { message: '接收者未绑定钱包' });
                return;
            }
            
            // 执行转账
            const result = await this.blockchainService.transferWithPurpose(
                fromUser.privateKey,
                toUser.walletAddress,
                amount,
                purpose,
                category,
                []
            );
            
            // 通知双方
            socket.emit('tokens_sent', {
                toUser: toUser.username,
                amount,
                transactionHash: result.transactionHash
            });
            
            this.notifyUser(toUserId, 'tokens_received', {
                fromUser: socket.user.username,
                amount,
                purpose,
                transactionHash: result.transactionHash
            });
            
            console.log(`💰 代币转账: ${socket.user.username} -> ${toUser.username} (${amount} CBT)`);
            
        } catch (error) {
            console.error('代币转账失败:', error);
            socket.emit('error', { message: '代币转账失败: ' + error.message });
        }
    }
    
    /**
     * 处理断开连接
     */
    async handleDisconnect(socket) {
        const userId = socket.userId;
        const user = socket.user;
        
        console.log(`👋 用户断开连接: ${user.username} (${userId})`);
        
        // 清理在线用户记录
        this.onlineUsers.delete(socket.id);
        
        // 更新用户Socket映射
        if (this.userSockets.has(userId)) {
            this.userSockets.get(userId).delete(socket.id);
            if (this.userSockets.get(userId).size === 0) {
                this.userSockets.delete(userId);
                // 用户完全离线
                this.updateUserOnlineStatus(userId, false);
                socket.broadcast.emit('user_offline', {
                    userId,
                    username: user.username
                });
            }
        }
        
        // 清理房间用户映射
        for (const [roomId, userSet] of this.roomUsers.entries()) {
            if (userSet.has(userId)) {
                userSet.delete(userId);
                if (userSet.size === 0) {
                    this.roomUsers.delete(roomId);
                }
                
                // 更新数据库中的在线成员
                try {
                    await ChatRoom.findByIdAndUpdate(roomId, {
                        $pull: { onlineMembers: userId }
                    });
                } catch (error) {
                    console.error('更新房间在线成员失败:', error);
                }
            }
        }
        
        // 清理正在输入状态
        for (const [roomId, typingSet] of this.typingUsers.entries()) {
            if (typingSet.has(userId)) {
                typingSet.delete(userId);
                socket.to(roomId).emit('user_stop_typing', {
                    userId,
                    username: user.username,
                    roomId
                });
            }
        }
    }
    
    /**
     * 处理错误
     */
    handleError(socket, error) {
        console.error(`Socket错误 (${socket.user.username}):`, error);
        socket.emit('error', { message: '服务器内部错误' });
    }
    
    /**
     * 通知特定用户
     */
    notifyUser(userId, event, data) {
        if (this.userSockets.has(userId)) {
            const socketIds = this.userSockets.get(userId);
            socketIds.forEach(socketId => {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit(event, data);
                }
            });
        }
    }
    
    /**
     * 更新用户在线状态
     */
    async updateUserOnlineStatus(userId, isOnline) {
        try {
            await User.findByIdAndUpdate(userId, {
                isOnline,
                lastSeenAt: new Date()
            });
        } catch (error) {
            console.error('更新用户在线状态失败:', error);
        }
    }
    
    /**
     * 发放聊天奖励
     */
    async distributeChatReward(userId) {
        try {
            const user = await User.findById(userId);
            if (!user.walletAddress) return;
            
            // 检查今天是否已经发放过聊天奖励
            const today = new Date().toDateString();
            const lastChatReward = user.lastChatReward ? user.lastChatReward.toDateString() : null;
            
            if (lastChatReward === today) return;
            
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) return;
            
            await this.blockchainService.distributeReward(
                user.walletAddress,
                0.5, // 0.5 CBT聊天奖励
                '参与聊天奖励',
                'CULTURAL_EXCHANGE',
                adminPrivateKey
            );
            
            user.lastChatReward = new Date();
            await user.save();
            
        } catch (error) {
            console.error('发放聊天奖励失败:', error);
        }
    }
    
    /**
     * 发放语音翻译奖励
     */
    async distributeVoiceTranslationReward(userId) {
        try {
            const user = await User.findById(userId);
            if (!user.walletAddress) return;
            
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) return;
            
            await this.blockchainService.distributeReward(
                user.walletAddress,
                2, // 2 CBT语音翻译奖励
                '使用语音翻译奖励',
                'LEARNING_REWARD',
                adminPrivateKey
            );
            
        } catch (error) {
            console.error('发放语音翻译奖励失败:', error);
        }
    }
    
    /**
     * 获取在线用户数量
     */
    getOnlineUserCount() {
        return this.userSockets.size;
    }
    
    /**
     * 获取房间在线用户数量
     */
    getRoomOnlineCount(roomId) {
        return this.roomUsers.get(roomId)?.size || 0;
    }
    
    /**
     * 广播系统消息
     */
    broadcastSystemMessage(message, data = {}) {
        this.io.emit('system_message', {
            message,
            timestamp: new Date(),
            ...data
        });
    }
    
    /**
     * 获取服务状态
     */
    getServiceStatus() {
        return {
            onlineUsers: this.getOnlineUserCount(),
            activeRooms: this.roomUsers.size,
            totalConnections: this.onlineUsers.size,
            uptime: process.uptime()
        };
    }
}

module.exports = EnhancedSocketService;

