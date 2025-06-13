const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const VoiceTranslation = require('../models/VoiceTranslation');
const TokenRewardService = require('../services/tokenRewardService');
const VoiceTranslationService = require('../services/voiceTranslationService');

class EnhancedSocketService {
    constructor(server) {
        this.io = require('socket.io')(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        // 连接管理
        this.connectedUsers = new Map(); // userId -> socketId
        this.userSockets = new Map(); // socketId -> userInfo
        this.roomMembers = new Map(); // roomId -> Set of userIds
        this.typingUsers = new Map(); // roomId -> Set of userIds
        this.voiceStreams = new Map(); // socketId -> streamInfo
        
        // 服务实例
        this.tokenRewardService = new TokenRewardService();
        this.voiceService = new VoiceTranslationService();
        
        // 统计信息
        this.stats = {
            totalConnections: 0,
            activeRooms: 0,
            messagesCount: 0,
            voiceTranslations: 0
        };
        
        this.initializeSocketHandlers();
        this.startStatsReporting();
    }
    
    initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.stats.totalConnections++;
            console.log(`新用户连接: ${socket.id} (总连接数: ${this.io.engine.clientsCount})`);
            
            // 用户认证
            socket.on('authenticate', async (data) => {
                try {
                    const { userId, username, token } = data;
                    
                    // TODO: 验证JWT token
                    
                    // 存储用户信息
                    this.connectedUsers.set(userId, socket.id);
                    this.userSockets.set(socket.id, { 
                        userId, 
                        username, 
                        connectedAt: new Date(),
                        lastActivity: new Date()
                    });
                    
                    socket.userId = userId;
                    socket.username = username;
                    
                    // 加入用户个人房间（用于私聊和通知）
                    socket.join(`user_${userId}`);
                    
                    // 通知认证成功
                    socket.emit('authenticated', {
                        success: true,
                        message: '认证成功',
                        userId,
                        username
                    });
                    
                    // 广播用户上线状态
                    socket.broadcast.emit('user:online', {
                        userId,
                        username,
                        timestamp: new Date()
                    });
                    
                    console.log(`用户 ${username} (${userId}) 已认证并上线`);
                } catch (error) {
                    console.error('用户认证失败:', error);
                    socket.emit('authenticated', {
                        success: false,
                        message: '认证失败: ' + error.message
                    });
                }
            });
            
            // 加入聊天室
            socket.on('chat:join', async (data) => {
                try {
                    const { roomId, password } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 验证聊天室
                    const room = await ChatRoom.findById(roomId)
                        .populate('members.user', 'username')
                        .populate('creator', 'username');
                    
                    if (!room) {
                        socket.emit('error', { message: '聊天室不存在' });
                        return;
                    }
                    
                    // 检查权限
                    const isMember = room.members.some(member => 
                        member.user._id.toString() === userId
                    );
                    
                    if (!isMember && room.type === 'private') {
                        socket.emit('error', { message: '无权限加入此聊天室' });
                        return;
                    }
                    
                    // 检查密码（如果需要）
                    if (room.password && room.password !== password) {
                        socket.emit('error', { message: '聊天室密码错误' });
                        return;
                    }
                    
                    // 加入Socket.io房间
                    socket.join(roomId);
                    
                    // 更新房间成员列表
                    if (!this.roomMembers.has(roomId)) {
                        this.roomMembers.set(roomId, new Set());
                        this.stats.activeRooms++;
                    }
                    this.roomMembers.get(roomId).add(userId);
                    
                    // 如果不是成员，自动加入
                    if (!isMember && room.type === 'public') {
                        room.members.push({
                            user: userId,
                            joinedAt: new Date(),
                            role: 'member'
                        });
                        await room.save();
                    }
                    
                    // 通知房间其他成员
                    socket.to(roomId).emit('user:joined', {
                        userId,
                        username: socket.username,
                        timestamp: new Date()
                    });
                    
                    // 获取最近消息
                    const recentMessages = await ChatMessage.find({ chatRoom: roomId })
                        .populate('sender', 'username')
                        .sort({ createdAt: -1 })
                        .limit(50);
                    
                    // 发送房间信息给用户
                    socket.emit('chat:joined', {
                        roomId,
                        roomInfo: {
                            name: room.name,
                            description: room.description,
                            type: room.type,
                            creator: room.creator.username,
                            memberCount: this.roomMembers.get(roomId).size,
                            totalMembers: room.members.length
                        },
                        recentMessages: recentMessages.reverse().map(msg => ({
                            id: msg._id,
                            sender: {
                                id: msg.sender._id,
                                username: msg.sender.username
                            },
                            content: msg.content,
                            messageType: msg.messageType,
                            translations: msg.translations,
                            timestamp: msg.createdAt
                        }))
                    });
                    
                    console.log(`用户 ${socket.username} 加入房间 ${room.name}`);
                } catch (error) {
                    console.error('加入聊天室失败:', error);
                    socket.emit('error', { message: '加入聊天室失败: ' + error.message });
                }
            });
            
            // 离开聊天室
            socket.on('chat:leave', (data) => {
                const { roomId } = data;
                const userId = socket.userId;
                
                socket.leave(roomId);
                
                if (this.roomMembers.has(roomId)) {
                    this.roomMembers.get(roomId).delete(userId);
                    
                    // 如果房间没有人了，清理房间
                    if (this.roomMembers.get(roomId).size === 0) {
                        this.roomMembers.delete(roomId);
                        this.stats.activeRooms--;
                    }
                }
                
                // 清理输入状态
                if (this.typingUsers.has(roomId)) {
                    this.typingUsers.get(roomId).delete(userId);
                }
                
                socket.to(roomId).emit('user:left', {
                    userId,
                    username: socket.username,
                    timestamp: new Date()
                });
                
                console.log(`用户 ${socket.username} 离开房间 ${roomId}`);
            });
            
            // 发送文本消息
            socket.on('chat:message', async (data) => {
                try {
                    const { roomId, content, replyTo, messageType = 'text', targetLanguages } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 更新用户活动时间
                    this.updateUserActivity(socket.id);
                    
                    // 创建消息记录
                    const message = new ChatMessage({
                        chatRoom: roomId,
                        sender: userId,
                        content,
                        messageType,
                        replyTo: replyTo || undefined,
                        originalLanguage: data.language || 'zh'
                    });
                    
                    // 如果需要翻译
                    if (targetLanguages && targetLanguages.length > 0) {
                        try {
                            const translations = await this.voiceService.translateText(
                                content,
                                data.language || 'auto',
                                targetLanguages
                            );
                            
                            message.translations = translations.map(t => ({
                                language: t.language,
                                content: t.text,
                                confidence: t.confidence || 0.9
                            }));
                        } catch (error) {
                            console.warn('文本翻译失败:', error);
                        }
                    }
                    
                    await message.save();
                    await message.populate('sender', 'username');
                    
                    this.stats.messagesCount++;
                    
                    // 广播消息到房间
                    this.io.to(roomId).emit('chat:message', {
                        messageId: message._id,
                        sender: {
                            id: message.sender._id,
                            username: message.sender.username
                        },
                        content: message.content,
                        messageType: message.messageType,
                        replyTo: message.replyTo,
                        translations: message.translations,
                        timestamp: message.createdAt
                    });
                    
                    // 奖励代币（发送消息）
                    try {
                        await this.tokenRewardService.rewardCommunityContribution(
                            'comment_creation',
                            userId,
                            { contentType: 'chat_message' }
                        );
                    } catch (error) {
                        console.warn('奖励代币失败:', error);
                    }
                    
                } catch (error) {
                    console.error('发送消息失败:', error);
                    socket.emit('error', { message: '发送消息失败: ' + error.message });
                }
            });
            
            // 语音消息处理
            socket.on('voice:message', async (data) => {
                try {
                    const { roomId, audioData, targetLanguages, sourceLanguage = 'auto' } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    this.updateUserActivity(socket.id);
                    
                    // 通知开始处理
                    socket.emit('voice:processing', {
                        message: '正在处理语音消息...',
                        progress: 0
                    });
                    
                    // 处理语音翻译
                    const audioBuffer = Buffer.from(audioData, 'base64');
                    
                    // 进度更新
                    socket.emit('voice:processing', {
                        message: '正在识别语音...',
                        progress: 30
                    });
                    
                    const result = await this.voiceService.processVoiceMessage(
                        audioBuffer,
                        sourceLanguage,
                        targetLanguages || ['en', 'zh'],
                        userId,
                        roomId
                    );
                    
                    socket.emit('voice:processing', {
                        message: '正在翻译...',
                        progress: 70
                    });
                    
                    // 创建语音消息记录
                    const message = new ChatMessage({
                        chatRoom: roomId,
                        sender: userId,
                        content: result.data.originalText,
                        messageType: 'voice',
                        originalLanguage: result.data.originalLanguage,
                        translations: result.data.translations.map(t => ({
                            language: t.language,
                            content: t.text,
                            confidence: t.confidence
                        })),
                        voiceData: {
                            transcription: result.data.originalText,
                            originalAudioUrl: result.data.audioUrl || null,
                            duration: result.data.duration || 0
                        }
                    });
                    
                    await message.save();
                    await message.populate('sender', 'username');
                    
                    this.stats.messagesCount++;
                    this.stats.voiceTranslations++;
                    
                    socket.emit('voice:processing', {
                        message: '处理完成',
                        progress: 100
                    });
                    
                    // 广播语音消息到房间
                    this.io.to(roomId).emit('voice:message', {
                        messageId: message._id,
                        sender: {
                            id: message.sender._id,
                            username: message.sender.username
                        },
                        originalText: result.data.originalText,
                        originalLanguage: result.data.originalLanguage,
                        translations: result.data.translations,
                        confidence: result.data.confidence,
                        audioUrl: result.data.audioUrl,
                        duration: result.data.duration,
                        timestamp: message.createdAt
                    });
                    
                    // 奖励代币（语音翻译）
                    try {
                        await this.tokenRewardService.rewardCommunityContribution(
                            'helpful_content',
                            userId,
                            { contentType: 'voice_translation' }
                        );
                    } catch (error) {
                        console.warn('奖励代币失败:', error);
                    }
                    
                } catch (error) {
                    console.error('处理语音消息失败:', error);
                    socket.emit('voice:error', {
                        message: '语音处理失败: ' + error.message
                    });
                }
            });
            
            // 实时语音翻译流
            socket.on('voice:stream:start', (data) => {
                const { roomId, targetLanguage, sourceLanguage = 'auto' } = data;
                
                this.voiceStreams.set(socket.id, {
                    roomId,
                    targetLanguage,
                    sourceLanguage,
                    audioChunks: [],
                    startTime: Date.now()
                });
                
                socket.emit('voice:stream:ready', {
                    message: '准备接收语音流',
                    sessionId: socket.id
                });
                
                console.log(`用户 ${socket.username} 开始语音流 (${sourceLanguage} -> ${targetLanguage})`);
            });
            
            socket.on('voice:stream:chunk', (data) => {
                const stream = this.voiceStreams.get(socket.id);
                if (stream) {
                    stream.audioChunks.push(Buffer.from(data.chunk, 'base64'));
                    stream.lastChunkTime = Date.now();
                }
            });
            
            socket.on('voice:stream:end', async () => {
                const stream = this.voiceStreams.get(socket.id);
                if (stream) {
                    try {
                        // 合并音频块
                        const audioBuffer = Buffer.concat(stream.audioChunks);
                        const duration = (Date.now() - stream.startTime) / 1000;
                        
                        if (audioBuffer.length > 0) {
                            // 处理语音翻译
                            const result = await this.voiceService.processVoiceMessage(
                                audioBuffer,
                                stream.sourceLanguage,
                                [stream.targetLanguage],
                                socket.userId,
                                stream.roomId
                            );
                            
                            // 发送结果到房间
                            this.io.to(stream.roomId).emit('voice:stream:result', {
                                originalText: result.data.originalText,
                                translatedText: result.data.translations[0]?.text,
                                confidence: result.data.confidence,
                                duration,
                                sender: {
                                    id: socket.userId,
                                    username: socket.username
                                },
                                timestamp: new Date()
                            });
                            
                            this.stats.voiceTranslations++;
                        }
                        
                    } catch (error) {
                        console.error('实时翻译失败:', error);
                        socket.emit('voice:stream:error', {
                            message: '实时翻译失败: ' + error.message
                        });
                    }
                    
                    this.voiceStreams.delete(socket.id);
                    console.log(`用户 ${socket.username} 结束语音流`);
                }
            });
            
            // 输入状态
            socket.on('chat:typing', (data) => {
                const { roomId, isTyping } = data;
                const userId = socket.userId;
                
                if (userId) {
                    if (!this.typingUsers.has(roomId)) {
                        this.typingUsers.set(roomId, new Set());
                    }
                    
                    if (isTyping) {
                        this.typingUsers.get(roomId).add(userId);
                    } else {
                        this.typingUsers.get(roomId).delete(userId);
                    }
                    
                    socket.to(roomId).emit('chat:typing', {
                        userId,
                        username: socket.username,
                        isTyping,
                        timestamp: new Date()
                    });
                    
                    // 自动清理输入状态
                    if (isTyping) {
                        setTimeout(() => {
                            if (this.typingUsers.has(roomId)) {
                                this.typingUsers.get(roomId).delete(userId);
                                socket.to(roomId).emit('chat:typing', {
                                    userId,
                                    username: socket.username,
                                    isTyping: false,
                                    timestamp: new Date()
                                });
                            }
                        }, 5000);
                    }
                }
            });
            
            // 用户状态更新
            socket.on('user:status', (data) => {
                const { status } = data; // 'online', 'away', 'busy', 'invisible'
                const userId = socket.userId;
                
                if (userId) {
                    const userInfo = this.userSockets.get(socket.id);
                    if (userInfo) {
                        userInfo.status = status;
                        userInfo.lastActivity = new Date();
                    }
                    
                    // 广播状态更新
                    socket.broadcast.emit('user:status', {
                        userId,
                        username: socket.username,
                        status,
                        timestamp: new Date()
                    });
                }
            });
            
            // 私聊消息
            socket.on('private:message', async (data) => {
                try {
                    const { targetUserId, content, messageType = 'text' } = data;
                    const senderId = socket.userId;
                    
                    if (!senderId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 创建或获取私聊房间
                    let privateRoom = await ChatRoom.findOne({
                        type: 'private',
                        'members.user': { $all: [senderId, targetUserId] }
                    });
                    
                    if (!privateRoom) {
                        privateRoom = new ChatRoom({
                            name: `私聊_${senderId}_${targetUserId}`,
                            type: 'private',
                            creator: senderId,
                            members: [
                                { user: senderId, role: 'admin' },
                                { user: targetUserId, role: 'member' }
                            ]
                        });
                        await privateRoom.save();
                    }
                    
                    // 创建消息
                    const message = new ChatMessage({
                        chatRoom: privateRoom._id,
                        sender: senderId,
                        content,
                        messageType
                    });
                    
                    await message.save();
                    await message.populate('sender', 'username');
                    
                    // 发送给双方
                    const messageData = {
                        messageId: message._id,
                        roomId: privateRoom._id,
                        sender: {
                            id: message.sender._id,
                            username: message.sender.username
                        },
                        content: message.content,
                        messageType: message.messageType,
                        timestamp: message.createdAt
                    };
                    
                    socket.emit('private:message', messageData);
                    this.io.to(`user_${targetUserId}`).emit('private:message', messageData);
                    
                } catch (error) {
                    console.error('发送私聊消息失败:', error);
                    socket.emit('error', { message: '发送私聊消息失败' });
                }
            });
            
            // 获取在线用户列表
            socket.on('users:online', () => {
                const onlineUsers = Array.from(this.userSockets.values())
                    .filter(user => user.status !== 'invisible')
                    .map(user => ({
                        userId: user.userId,
                        username: user.username,
                        status: user.status || 'online',
                        lastActivity: user.lastActivity
                    }));
                
                socket.emit('users:online', {
                    users: onlineUsers,
                    count: onlineUsers.length
                });
            });
            
            // 断开连接处理
            socket.on('disconnect', (reason) => {
                const userId = socket.userId;
                const username = socket.username;
                
                if (userId) {
                    // 清理连接记录
                    this.connectedUsers.delete(userId);
                    this.userSockets.delete(socket.id);
                    
                    // 清理房间成员
                    for (const [roomId, members] of this.roomMembers.entries()) {
                        if (members.has(userId)) {
                            members.delete(userId);
                            socket.to(roomId).emit('user:left', {
                                userId,
                                username,
                                timestamp: new Date()
                            });
                            
                            if (members.size === 0) {
                                this.roomMembers.delete(roomId);
                                this.stats.activeRooms--;
                            }
                        }
                    }
                    
                    // 清理输入状态
                    for (const [roomId, typingUsers] of this.typingUsers.entries()) {
                        typingUsers.delete(userId);
                    }
                    
                    // 清理语音流
                    this.voiceStreams.delete(socket.id);
                    
                    // 广播用户离线状态
                    socket.broadcast.emit('user:offline', {
                        userId,
                        username,
                        timestamp: new Date()
                    });
                    
                    console.log(`用户 ${username} (${userId}) 断开连接: ${reason}`);
                } else {
                    console.log(`未认证用户 ${socket.id} 断开连接: ${reason}`);
                }
            });
        });
    }
    
    // 更新用户活动时间
    updateUserActivity(socketId) {
        const userInfo = this.userSockets.get(socketId);
        if (userInfo) {
            userInfo.lastActivity = new Date();
        }
    }
    
    // 获取在线用户数量
    getOnlineUserCount() {
        return this.connectedUsers.size;
    }
    
    // 获取活跃房间数量
    getActiveRoomCount() {
        return this.roomMembers.size;
    }
    
    // 获取统计信息
    getStats() {
        return {
            ...this.stats,
            onlineUsers: this.getOnlineUserCount(),
            activeRooms: this.getActiveRoomCount(),
            totalSockets: this.io.engine.clientsCount
        };
    }
    
    // 发送系统通知
    sendSystemNotification(userId, notification) {
        this.io.to(`user_${userId}`).emit('system:notification', {
            ...notification,
            timestamp: new Date()
        });
    }
    
    // 广播系统消息
    broadcastSystemMessage(message, roomId = null) {
        const data = {
            message,
            timestamp: new Date(),
            type: 'system'
        };
        
        if (roomId) {
            this.io.to(roomId).emit('system:message', data);
        } else {
            this.io.emit('system:message', data);
        }
    }
    
    // 启动统计报告
    startStatsReporting() {
        setInterval(() => {
            const stats = this.getStats();
            console.log(`[Socket统计] 在线用户: ${stats.onlineUsers}, 活跃房间: ${stats.activeRooms}, 总消息: ${stats.messagesCount}, 语音翻译: ${stats.voiceTranslations}`);
            
            // 发送统计信息给管理员
            this.io.emit('admin:stats', stats);
        }, 60000); // 每分钟报告一次
    }
    
    // 清理非活跃连接
    cleanupInactiveConnections() {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30分钟
        
        for (const [socketId, userInfo] of this.userSockets.entries()) {
            if (now - userInfo.lastActivity.getTime() > inactiveThreshold) {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                }
            }
        }
    }
}

module.exports = EnhancedSocketService;

