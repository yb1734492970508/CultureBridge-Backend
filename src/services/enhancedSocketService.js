const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EnhancedTranslationService = require('./enhancedTranslationService');

/**
 * 增强版WebSocket服务
 * Enhanced WebSocket Service for real-time communication
 */
class EnhancedSocketService {
    constructor(server) {
        // 初始化Socket.IO
        this.io = socketIo(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });
        
        // 初始化服务
        this.translationService = new EnhancedTranslationService();
        
        // 在线用户管理
        this.onlineUsers = new Map();
        this.userRooms = new Map();
        this.roomUsers = new Map();
        
        // 聊天室配置
        this.roomConfig = {
            maxUsers: 100,
            messageRateLimit: 10, // 每分钟最多10条消息
            maxMessageLength: 1000
        };
        
        // 消息类型
        this.messageTypes = {
            TEXT: 'text',
            VOICE: 'voice',
            IMAGE: 'image',
            TRANSLATION: 'translation',
            SYSTEM: 'system'
        };
        
        // 初始化事件监听
        this.initializeEventHandlers();
        
        console.log('🔌 增强版WebSocket服务已启动');
    }

    /**
     * 初始化事件处理器
     */
    initializeEventHandlers() {
        // 中间件：身份验证
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
                
                if (!token) {
                    return next(new Error('未提供认证token'));
                }
                
                // 验证JWT token
                const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
                
                // 获取用户信息
                const user = await User.findById(decoded.id).select('-password');
                if (!user) {
                    return next(new Error('用户不存在'));
                }
                
                if (user.status === 'disabled') {
                    return next(new Error('账户已被禁用'));
                }
                
                // 将用户信息附加到socket
                socket.user = user;
                next();
                
            } catch (error) {
                console.error('Socket认证失败:', error);
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
        const user = socket.user;
        console.log(`👤 用户连接: ${user.username} (${socket.id})`);
        
        // 添加到在线用户列表
        this.onlineUsers.set(user._id.toString(), {
            socketId: socket.id,
            user: user,
            joinedAt: new Date(),
            lastActivity: new Date()
        });
        
        // 更新用户活动时间
        user.updateActivity();
        
        // 发送欢迎消息
        socket.emit('welcome', {
            message: '欢迎来到CultureBridge！',
            user: {
                id: user._id,
                username: user.username,
                level: user.tokenStats.level,
                balance: user.tokenStats.currentBalance
            },
            onlineCount: this.onlineUsers.size
        });
        
        // 广播用户上线
        socket.broadcast.emit('user_online', {
            userId: user._id,
            username: user.username
        });

        // 注册事件处理器
        this.registerEventHandlers(socket);
        
        // 断开连接处理
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
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
        
        // 发送消息
        socket.on('send_message', (data) => this.handleSendMessage(socket, data));
        
        // 发送语音消息
        socket.on('send_voice_message', (data) => this.handleSendVoiceMessage(socket, data));
        
        // 翻译请求
        socket.on('translate_message', (data) => this.handleTranslateMessage(socket, data));
        
        // 语音翻译请求
        socket.on('voice_translate', (data) => this.handleVoiceTranslate(socket, data));
        
        // 私聊消息
        socket.on('private_message', (data) => this.handlePrivateMessage(socket, data));
        
        // 用户状态更新
        socket.on('update_status', (data) => this.handleUpdateStatus(socket, data));
        
        // 心跳检测
        socket.on('ping', () => {
            socket.emit('pong');
            this.updateUserActivity(socket.user._id);
        });
        
        // 获取在线用户列表
        socket.on('get_online_users', () => this.handleGetOnlineUsers(socket));
        
        // 获取聊天室列表
        socket.on('get_rooms', () => this.handleGetRooms(socket));
    }

    /**
     * 处理加入聊天室
     */
    async handleJoinRoom(socket, data) {
        try {
            const { roomId, roomType = 'public' } = data;
            const user = socket.user;
            
            if (!roomId) {
                return socket.emit('error', { message: '房间ID不能为空' });
            }
            
            // 检查房间是否存在，不存在则创建
            if (!this.roomUsers.has(roomId)) {
                this.roomUsers.set(roomId, new Set());
            }
            
            const roomUsers = this.roomUsers.get(roomId);
            
            // 检查房间人数限制
            if (roomUsers.size >= this.roomConfig.maxUsers) {
                return socket.emit('error', { message: '房间人数已满' });
            }
            
            // 加入房间
            socket.join(roomId);
            roomUsers.add(user._id.toString());
            this.userRooms.set(user._id.toString(), roomId);
            
            // 通知房间内其他用户
            socket.to(roomId).emit('user_joined', {
                userId: user._id,
                username: user.username,
                level: user.tokenStats.level,
                joinedAt: new Date()
            });
            
            // 发送房间信息给用户
            socket.emit('room_joined', {
                roomId: roomId,
                roomType: roomType,
                userCount: roomUsers.size,
                users: Array.from(roomUsers).map(userId => {
                    const onlineUser = this.onlineUsers.get(userId);
                    return onlineUser ? {
                        id: onlineUser.user._id,
                        username: onlineUser.user.username,
                        level: onlineUser.user.tokenStats.level
                    } : null;
                }).filter(Boolean)
            });
            
            console.log(`🏠 用户 ${user.username} 加入房间 ${roomId}`);
            
        } catch (error) {
            console.error('加入房间失败:', error);
            socket.emit('error', { message: '加入房间失败' });
        }
    }

    /**
     * 处理离开聊天室
     */
    handleLeaveRoom(socket, data) {
        try {
            const { roomId } = data;
            const user = socket.user;
            
            if (!roomId) {
                return socket.emit('error', { message: '房间ID不能为空' });
            }
            
            // 离开房间
            socket.leave(roomId);
            
            const roomUsers = this.roomUsers.get(roomId);
            if (roomUsers) {
                roomUsers.delete(user._id.toString());
                
                // 如果房间为空，删除房间
                if (roomUsers.size === 0) {
                    this.roomUsers.delete(roomId);
                }
            }
            
            this.userRooms.delete(user._id.toString());
            
            // 通知房间内其他用户
            socket.to(roomId).emit('user_left', {
                userId: user._id,
                username: user.username,
                leftAt: new Date()
            });
            
            socket.emit('room_left', { roomId: roomId });
            
            console.log(`🚪 用户 ${user.username} 离开房间 ${roomId}`);
            
        } catch (error) {
            console.error('离开房间失败:', error);
            socket.emit('error', { message: '离开房间失败' });
        }
    }

    /**
     * 处理发送消息
     */
    async handleSendMessage(socket, data) {
        try {
            const { roomId, content, messageType = 'text' } = data;
            const user = socket.user;
            
            // 验证输入
            if (!roomId || !content) {
                return socket.emit('error', { message: '房间ID和消息内容不能为空' });
            }
            
            if (content.length > this.roomConfig.maxMessageLength) {
                return socket.emit('error', { message: '消息长度超出限制' });
            }
            
            // 检查用户是否在房间内
            const userRoom = this.userRooms.get(user._id.toString());
            if (userRoom !== roomId) {
                return socket.emit('error', { message: '您不在该房间内' });
            }
            
            // 检查消息频率限制
            if (!this.checkMessageRateLimit(user._id)) {
                return socket.emit('error', { message: '发送消息过于频繁' });
            }
            
            // 创建消息对象
            const message = {
                id: this.generateMessageId(),
                roomId: roomId,
                userId: user._id,
                username: user.username,
                userLevel: user.tokenStats.level,
                content: content,
                type: messageType,
                timestamp: new Date(),
                translations: {}
            };
            
            // 广播消息到房间
            this.io.to(roomId).emit('new_message', message);
            
            // 分发消息奖励
            try {
                await this.blockchainService.distributeReward(
                    user.walletAddress,
                    0, // GENERAL category
                    'Send message in chat room'
                );
                
                // 更新用户活动统计
                await user.updateActivityStats('messagesCount');
                
                socket.emit('reward_earned', {
                    type: 'message',
                    amount: 0.1,
                    description: '发送消息奖励'
                });
                
            } catch (rewardError) {
                console.warn('消息奖励分发失败:', rewardError.message);
            }
            
            console.log(`💬 消息发送: ${user.username} -> 房间 ${roomId}`);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            socket.emit('error', { message: '发送消息失败' });
        }
    }

    /**
     * 处理语音消息
     */
    async handleSendVoiceMessage(socket, data) {
        try {
            const { roomId, audioData, duration, language = 'zh-CN' } = data;
            const user = socket.user;
            
            // 验证输入
            if (!roomId || !audioData) {
                return socket.emit('error', { message: '房间ID和音频数据不能为空' });
            }
            
            // 检查用户是否在房间内
            const userRoom = this.userRooms.get(user._id.toString());
            if (userRoom !== roomId) {
                return socket.emit('error', { message: '您不在该房间内' });
            }
            
            // 创建语音消息对象
            const voiceMessage = {
                id: this.generateMessageId(),
                roomId: roomId,
                userId: user._id,
                username: user.username,
                userLevel: user.tokenStats.level,
                type: 'voice',
                audioData: audioData,
                duration: duration,
                language: language,
                timestamp: new Date(),
                transcription: null,
                translations: {}
            };
            
            // 广播语音消息到房间
            this.io.to(roomId).emit('new_voice_message', voiceMessage);
            
            // 分发语音消息奖励
            try {
                await this.blockchainService.distributeReward(
                    user.walletAddress,
                    1, // LEARNING_REWARD category
                    'Send voice message in chat room'
                );
                
                // 更新用户活动统计
                await user.updateActivityStats('voiceMessagesCount');
                
                socket.emit('reward_earned', {
                    type: 'voice_message',
                    amount: 0.2,
                    description: '发送语音消息奖励'
                });
                
            } catch (rewardError) {
                console.warn('语音消息奖励分发失败:', rewardError.message);
            }
            
            console.log(`🎤 语音消息发送: ${user.username} -> 房间 ${roomId}`);
            
        } catch (error) {
            console.error('发送语音消息失败:', error);
            socket.emit('error', { message: '发送语音消息失败' });
        }
    }

    /**
     * 处理翻译请求
     */
    async handleTranslateMessage(socket, data) {
        try {
            const { messageId, text, fromLang, toLang } = data;
            const user = socket.user;
            
            // 验证输入
            if (!messageId || !text || !fromLang || !toLang) {
                return socket.emit('error', { message: '翻译参数不完整' });
            }
            
            // 执行翻译
            const translationResult = await this.translationService.translateText(
                text,
                fromLang,
                toLang,
                user.walletAddress
            );
            
            // 发送翻译结果
            socket.emit('translation_result', {
                messageId: messageId,
                originalText: text,
                translatedText: translationResult.data.translatedText,
                fromLanguage: fromLang,
                toLanguage: toLang,
                qualityScore: translationResult.data.qualityScore,
                reward: translationResult.data.reward
            });
            
            // 更新用户活动统计
            await user.updateActivityStats('translationsCount');
            
            console.log(`🌐 翻译完成: ${user.username} - ${fromLang} -> ${toLang}`);
            
        } catch (error) {
            console.error('翻译失败:', error);
            socket.emit('error', { message: '翻译失败: ' + error.message });
        }
    }

    /**
     * 处理语音翻译
     */
    async handleVoiceTranslate(socket, data) {
        try {
            const { audioData, fromLang, toLang } = data;
            const user = socket.user;
            
            // 验证输入
            if (!audioData || !fromLang || !toLang) {
                return socket.emit('error', { message: '语音翻译参数不完整' });
            }
            
            // 这里应该调用语音翻译服务
            // 暂时返回模拟结果
            const voiceTranslationResult = {
                originalText: '[语音识别结果]',
                translatedText: '[翻译结果]',
                translatedAudio: '[翻译音频数据]',
                fromLanguage: fromLang,
                toLanguage: toLang,
                qualityScore: 0.85
            };
            
            // 发送语音翻译结果
            socket.emit('voice_translation_result', voiceTranslationResult);
            
            // 分发语音翻译奖励
            try {
                await this.blockchainService.distributeReward(
                    user.walletAddress,
                    1, // LEARNING_REWARD category
                    'Voice translation'
                );
                
                socket.emit('reward_earned', {
                    type: 'voice_translation',
                    amount: 1.0,
                    description: '语音翻译奖励'
                });
                
            } catch (rewardError) {
                console.warn('语音翻译奖励分发失败:', rewardError.message);
            }
            
            console.log(`🎤🌐 语音翻译完成: ${user.username} - ${fromLang} -> ${toLang}`);
            
        } catch (error) {
            console.error('语音翻译失败:', error);
            socket.emit('error', { message: '语音翻译失败: ' + error.message });
        }
    }

    /**
     * 处理私聊消息
     */
    async handlePrivateMessage(socket, data) {
        try {
            const { targetUserId, content } = data;
            const user = socket.user;
            
            // 验证输入
            if (!targetUserId || !content) {
                return socket.emit('error', { message: '私聊参数不完整' });
            }
            
            // 检查目标用户是否在线
            const targetUser = this.onlineUsers.get(targetUserId);
            if (!targetUser) {
                return socket.emit('error', { message: '目标用户不在线' });
            }
            
            // 创建私聊消息
            const privateMessage = {
                id: this.generateMessageId(),
                fromUserId: user._id,
                fromUsername: user.username,
                toUserId: targetUserId,
                content: content,
                type: 'private',
                timestamp: new Date()
            };
            
            // 发送给目标用户
            this.io.to(targetUser.socketId).emit('private_message', privateMessage);
            
            // 确认发送给发送者
            socket.emit('private_message_sent', privateMessage);
            
            console.log(`💌 私聊消息: ${user.username} -> ${targetUser.user.username}`);
            
        } catch (error) {
            console.error('发送私聊消息失败:', error);
            socket.emit('error', { message: '发送私聊消息失败' });
        }
    }

    /**
     * 处理用户状态更新
     */
    handleUpdateStatus(socket, data) {
        try {
            const { status, customMessage } = data;
            const user = socket.user;
            
            const onlineUser = this.onlineUsers.get(user._id.toString());
            if (onlineUser) {
                onlineUser.status = status;
                onlineUser.customMessage = customMessage;
                onlineUser.lastActivity = new Date();
            }
            
            // 广播状态更新
            socket.broadcast.emit('user_status_updated', {
                userId: user._id,
                username: user.username,
                status: status,
                customMessage: customMessage
            });
            
        } catch (error) {
            console.error('更新用户状态失败:', error);
            socket.emit('error', { message: '更新状态失败' });
        }
    }

    /**
     * 处理获取在线用户列表
     */
    handleGetOnlineUsers(socket) {
        try {
            const onlineUsersList = Array.from(this.onlineUsers.values()).map(onlineUser => ({
                id: onlineUser.user._id,
                username: onlineUser.user.username,
                level: onlineUser.user.tokenStats.level,
                status: onlineUser.status || 'online',
                customMessage: onlineUser.customMessage,
                joinedAt: onlineUser.joinedAt
            }));
            
            socket.emit('online_users_list', {
                users: onlineUsersList,
                total: onlineUsersList.length
            });
            
        } catch (error) {
            console.error('获取在线用户列表失败:', error);
            socket.emit('error', { message: '获取在线用户列表失败' });
        }
    }

    /**
     * 处理获取聊天室列表
     */
    handleGetRooms(socket) {
        try {
            const roomsList = Array.from(this.roomUsers.entries()).map(([roomId, users]) => ({
                id: roomId,
                name: `房间 ${roomId}`,
                userCount: users.size,
                maxUsers: this.roomConfig.maxUsers,
                type: 'public'
            }));
            
            socket.emit('rooms_list', {
                rooms: roomsList,
                total: roomsList.length
            });
            
        } catch (error) {
            console.error('获取聊天室列表失败:', error);
            socket.emit('error', { message: '获取聊天室列表失败' });
        }
    }

    /**
     * 处理用户断开连接
     */
    handleDisconnection(socket) {
        const user = socket.user;
        console.log(`👋 用户断开连接: ${user.username} (${socket.id})`);
        
        // 从在线用户列表移除
        this.onlineUsers.delete(user._id.toString());
        
        // 从聊天室移除
        const userRoom = this.userRooms.get(user._id.toString());
        if (userRoom) {
            const roomUsers = this.roomUsers.get(userRoom);
            if (roomUsers) {
                roomUsers.delete(user._id.toString());
                
                // 通知房间内其他用户
                socket.to(userRoom).emit('user_left', {
                    userId: user._id,
                    username: user.username,
                    leftAt: new Date()
                });
                
                // 如果房间为空，删除房间
                if (roomUsers.size === 0) {
                    this.roomUsers.delete(userRoom);
                }
            }
            
            this.userRooms.delete(user._id.toString());
        }
        
        // 广播用户下线
        socket.broadcast.emit('user_offline', {
            userId: user._id,
            username: user.username
        });
    }

    /**
     * 检查消息频率限制
     */
    checkMessageRateLimit(userId) {
        // 简化实现，实际应该使用更复杂的频率限制算法
        return true;
    }

    /**
     * 更新用户活动时间
     */
    updateUserActivity(userId) {
        const onlineUser = this.onlineUsers.get(userId.toString());
        if (onlineUser) {
            onlineUser.lastActivity = new Date();
        }
    }

    /**
     * 生成消息ID
     */
    generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 获取在线用户数量
     */
    getOnlineUserCount() {
        return this.onlineUsers.size;
    }

    /**
     * 获取房间数量
     */
    getRoomCount() {
        return this.roomUsers.size;
    }

    /**
     * 广播系统消息
     */
    broadcastSystemMessage(message, roomId = null) {
        const systemMessage = {
            id: this.generateMessageId(),
            type: 'system',
            content: message,
            timestamp: new Date()
        };
        
        if (roomId) {
            this.io.to(roomId).emit('system_message', systemMessage);
        } else {
            this.io.emit('system_message', systemMessage);
        }
    }

    /**
     * 关闭服务
     */
    async close() {
        try {
            // 通知所有用户服务即将关闭
            this.broadcastSystemMessage('服务器即将重启，请稍后重新连接');
            
            // 关闭所有连接
            this.io.close();
            
            // 关闭相关服务
            if (this.blockchainService) {
                await this.blockchainService.close();
            }
            
            if (this.translationService) {
                await this.translationService.close();
            }
            
            console.log('🔒 WebSocket服务已关闭');
        } catch (error) {
            console.error('❌ 关闭WebSocket服务失败:', error);
        }
    }
}

module.exports = EnhancedSocketService;

