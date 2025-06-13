const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const TranslationService = require('./translationService');
const BlockchainService = require('./blockchainService');

class SocketService {
    constructor(server) {
        this.io = socketIo(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.translationService = new TranslationService();
        this.blockchainService = new BlockchainService();
        this.connectedUsers = new Map(); // 存储连接的用户
        this.userRooms = new Map(); // 存储用户加入的房间
        
        this.setupMiddleware();
        this.setupEventHandlers();
    }

    /**
     * 设置中间件
     */
    setupMiddleware() {
        // JWT认证中间件
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return next(new Error('未提供认证令牌'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                
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
    }

    /**
     * 设置事件处理器
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`用户 ${socket.user.username} 已连接`);
            
            // 存储用户连接
            this.connectedUsers.set(socket.userId, {
                socketId: socket.id,
                user: socket.user,
                lastSeen: new Date()
            });

            // 用户连接事件
            this.handleUserConnection(socket);
            
            // 聊天室事件
            this.handleChatRoomEvents(socket);
            
            // 消息事件
            this.handleMessageEvents(socket);
            
            // 翻译事件
            this.handleTranslationEvents(socket);
            
            // 语音事件
            this.handleVoiceEvents(socket);
            
            // 断开连接事件
            this.handleDisconnection(socket);
        });
    }

    /**
     * 处理用户连接
     */
    handleUserConnection(socket) {
        // 发送用户信息
        socket.emit('user:connected', {
            user: socket.user,
            timestamp: new Date()
        });

        // 获取用户的聊天室列表
        socket.on('user:getRooms', async () => {
            try {
                const rooms = await ChatRoom.find({
                    'members.user': socket.userId,
                    isActive: true
                }).populate('creator', 'username email')
                  .populate('members.user', 'username email');

                socket.emit('user:rooms', rooms);
            } catch (error) {
                socket.emit('error', { message: '获取聊天室列表失败' });
            }
        });

        // 获取在线用户列表
        socket.on('user:getOnlineUsers', () => {
            const onlineUsers = Array.from(this.connectedUsers.values()).map(conn => ({
                id: conn.user._id,
                username: conn.user.username,
                lastSeen: conn.lastSeen
            }));
            
            socket.emit('user:onlineUsers', onlineUsers);
        });
    }

    /**
     * 处理聊天室事件
     */
    handleChatRoomEvents(socket) {
        // 加入聊天室
        socket.on('room:join', async (roomId) => {
            try {
                const room = await ChatRoom.findById(roomId);
                if (!room) {
                    return socket.emit('error', { message: '聊天室不存在' });
                }

                // 检查是否是成员
                const isMember = room.members.some(
                    member => member.user.toString() === socket.userId
                );

                if (!isMember) {
                    return socket.emit('error', { message: '您不是该聊天室的成员' });
                }

                // 加入Socket.IO房间
                socket.join(roomId);
                
                // 记录用户房间
                if (!this.userRooms.has(socket.userId)) {
                    this.userRooms.set(socket.userId, new Set());
                }
                this.userRooms.get(socket.userId).add(roomId);

                // 通知其他用户
                socket.to(roomId).emit('room:userJoined', {
                    user: socket.user,
                    timestamp: new Date()
                });

                socket.emit('room:joined', { roomId, room });
            } catch (error) {
                socket.emit('error', { message: '加入聊天室失败' });
            }
        });

        // 离开聊天室
        socket.on('room:leave', (roomId) => {
            socket.leave(roomId);
            
            if (this.userRooms.has(socket.userId)) {
                this.userRooms.get(socket.userId).delete(roomId);
            }

            // 通知其他用户
            socket.to(roomId).emit('room:userLeft', {
                user: socket.user,
                timestamp: new Date()
            });

            socket.emit('room:left', { roomId });
        });

        // 获取聊天室成员
        socket.on('room:getMembers', async (roomId) => {
            try {
                const room = await ChatRoom.findById(roomId)
                    .populate('members.user', 'username email walletAddress');
                
                if (!room) {
                    return socket.emit('error', { message: '聊天室不存在' });
                }

                // 添加在线状态
                const membersWithStatus = room.members.map(member => ({
                    ...member.toObject(),
                    isOnline: this.connectedUsers.has(member.user._id.toString())
                }));

                socket.emit('room:members', { roomId, members: membersWithStatus });
            } catch (error) {
                socket.emit('error', { message: '获取成员列表失败' });
            }
        });
    }

    /**
     * 处理消息事件
     */
    handleMessageEvents(socket) {
        // 发送消息
        socket.on('message:send', async (data) => {
            try {
                const { roomId, content, messageType, originalLanguage, replyTo } = data;

                // 验证聊天室
                const room = await ChatRoom.findById(roomId);
                if (!room) {
                    return socket.emit('error', { message: '聊天室不存在' });
                }

                // 检查是否是成员
                const isMember = room.members.some(
                    member => member.user.toString() === socket.userId
                );

                if (!isMember) {
                    return socket.emit('error', { message: '您不是该聊天室的成员' });
                }

                // 创建消息
                const message = await ChatMessage.create({
                    chatRoom: roomId,
                    sender: socket.userId,
                    content,
                    messageType: messageType || 'text',
                    originalLanguage: originalLanguage || 'zh',
                    replyTo: replyTo || null
                });

                await message.populate('sender', 'username email walletAddress');
                if (replyTo) {
                    await message.populate('replyTo', 'content sender');
                }

                // 自动翻译消息
                if (room.settings.allowTranslation) {
                    try {
                        const targetLanguages = room.languages.filter(lang => lang !== originalLanguage);
                        const translations = await this.translationService.batchTranslate(
                            content,
                            originalLanguage || 'zh',
                            targetLanguages
                        );
                        
                        message.translations = translations;
                        await message.save();
                    } catch (error) {
                        console.warn('自动翻译失败:', error);
                    }
                }

                // 奖励CBT代币
                try {
                    const user = await User.findById(socket.userId);
                    if (user.walletAddress) {
                        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
                        if (adminPrivateKey) {
                            const txHash = await this.blockchainService.awardTokens(
                                user.walletAddress,
                                '1',
                                'Sent message in chat room',
                                adminPrivateKey
                            );
                            
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

                // 广播消息到聊天室
                this.io.to(roomId).emit('message:new', message);

            } catch (error) {
                console.error('发送消息失败:', error);
                socket.emit('error', { message: '发送消息失败' });
            }
        });

        // 编辑消息
        socket.on('message:edit', async (data) => {
            try {
                const { messageId, newContent } = data;

                const message = await ChatMessage.findById(messageId);
                if (!message) {
                    return socket.emit('error', { message: '消息不存在' });
                }

                if (message.sender.toString() !== socket.userId) {
                    return socket.emit('error', { message: '无权限编辑此消息' });
                }

                // 保存编辑历史
                message.editHistory.push({
                    content: message.content,
                    editedAt: new Date()
                });

                message.content = newContent;
                message.isEdited = true;
                await message.save();

                // 广播编辑后的消息
                this.io.to(message.chatRoom.toString()).emit('message:edited', message);

            } catch (error) {
                socket.emit('error', { message: '编辑消息失败' });
            }
        });

        // 删除消息
        socket.on('message:delete', async (messageId) => {
            try {
                const message = await ChatMessage.findById(messageId);
                if (!message) {
                    return socket.emit('error', { message: '消息不存在' });
                }

                // 检查权限
                const room = await ChatRoom.findById(message.chatRoom);
                const isAdmin = room.members.some(
                    member => member.user.toString() === socket.userId && 
                             (member.role === 'admin' || member.role === 'moderator')
                );

                if (message.sender.toString() !== socket.userId && !isAdmin) {
                    return socket.emit('error', { message: '无权限删除此消息' });
                }

                message.isDeleted = true;
                message.deletedAt = new Date();
                await message.save();

                // 广播删除事件
                this.io.to(message.chatRoom.toString()).emit('message:deleted', { messageId });

            } catch (error) {
                socket.emit('error', { message: '删除消息失败' });
            }
        });

        // 正在输入
        socket.on('message:typing', (data) => {
            const { roomId, isTyping } = data;
            socket.to(roomId).emit('message:userTyping', {
                user: socket.user,
                isTyping,
                timestamp: new Date()
            });
        });
    }

    /**
     * 处理翻译事件
     */
    handleTranslationEvents(socket) {
        // 翻译消息
        socket.on('translation:translate', async (data) => {
            try {
                const { messageId, targetLanguage } = data;

                const message = await ChatMessage.findById(messageId);
                if (!message) {
                    return socket.emit('error', { message: '消息不存在' });
                }

                // 检查是否已有该语言的翻译
                const existingTranslation = message.translations.find(
                    t => t.language === targetLanguage
                );

                if (existingTranslation) {
                    return socket.emit('translation:result', {
                        messageId,
                        translation: existingTranslation
                    });
                }

                // 执行翻译
                const result = await this.translationService.translateText(
                    message.content,
                    message.originalLanguage,
                    targetLanguage
                );

                // 保存翻译结果
                message.translations.push({
                    language: targetLanguage,
                    content: result.translatedText,
                    confidence: result.confidence
                });
                await message.save();

                socket.emit('translation:result', {
                    messageId,
                    translation: {
                        language: targetLanguage,
                        content: result.translatedText,
                        confidence: result.confidence
                    }
                });

            } catch (error) {
                socket.emit('error', { message: '翻译失败' });
            }
        });

        // 检测语言
        socket.on('translation:detect', async (text) => {
            try {
                const language = await this.translationService.detectLanguage(text);
                socket.emit('translation:detected', { text, language });
            } catch (error) {
                socket.emit('error', { message: '语言检测失败' });
            }
        });
    }

    /**
     * 处理语音事件
     */
    handleVoiceEvents(socket) {
        // 语音消息
        socket.on('voice:message', async (data) => {
            try {
                const { roomId, audioData, duration } = data;

                // 这里应该实现语音转文字和翻译功能
                // 暂时作为占位符
                const voiceMessage = {
                    chatRoom: roomId,
                    sender: socket.userId,
                    messageType: 'voice',
                    voiceData: {
                        audioUrl: audioData, // 实际应该上传到文件服务器
                        duration,
                        transcription: '语音转文字功能待实现'
                    },
                    content: '语音消息',
                    originalLanguage: 'zh'
                };

                const message = await ChatMessage.create(voiceMessage);
                await message.populate('sender', 'username email');

                this.io.to(roomId).emit('message:new', message);

            } catch (error) {
                socket.emit('error', { message: '发送语音消息失败' });
            }
        });

        // 语音通话请求
        socket.on('voice:call', (data) => {
            const { targetUserId, roomId } = data;
            const targetConnection = this.connectedUsers.get(targetUserId);
            
            if (targetConnection) {
                this.io.to(targetConnection.socketId).emit('voice:incomingCall', {
                    caller: socket.user,
                    roomId,
                    timestamp: new Date()
                });
            } else {
                socket.emit('error', { message: '用户不在线' });
            }
        });
    }

    /**
     * 处理断开连接
     */
    handleDisconnection(socket) {
        socket.on('disconnect', () => {
            console.log(`用户 ${socket.user.username} 已断开连接`);
            
            // 移除用户连接记录
            this.connectedUsers.delete(socket.userId);
            this.userRooms.delete(socket.userId);

            // 通知所有房间用户离线
            socket.rooms.forEach(roomId => {
                if (roomId !== socket.id) {
                    socket.to(roomId).emit('room:userLeft', {
                        user: socket.user,
                        timestamp: new Date()
                    });
                }
            });
        });
    }

    /**
     * 获取在线用户数量
     */
    getOnlineUserCount() {
        return this.connectedUsers.size;
    }

    /**
     * 获取房间在线用户
     */
    getRoomOnlineUsers(roomId) {
        const room = this.io.sockets.adapter.rooms.get(roomId);
        if (!room) return [];

        const onlineUsers = [];
        room.forEach(socketId => {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket && socket.user) {
                onlineUsers.push(socket.user);
            }
        });

        return onlineUsers;
    }

    /**
     * 向特定用户发送消息
     */
    sendToUser(userId, event, data) {
        const connection = this.connectedUsers.get(userId);
        if (connection) {
            this.io.to(connection.socketId).emit(event, data);
            return true;
        }
        return false;
    }

    /**
     * 向房间发送消息
     */
    sendToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }
}

module.exports = SocketService;

