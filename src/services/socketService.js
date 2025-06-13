const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const VoiceTranslation = require('../models/VoiceTranslation');
const TokenRewardService = require('../services/tokenRewardService');
const VoiceTranslationService = require('../services/voiceTranslationService');

class SocketService {
    constructor(server) {
        this.io = require('socket.io')(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });
        
        this.connectedUsers = new Map(); // userId -> socketId
        this.userSockets = new Map(); // socketId -> userInfo
        this.roomMembers = new Map(); // roomId -> Set of userIds
        
        this.tokenRewardService = new TokenRewardService();
        this.voiceService = new VoiceTranslationService();
        
        this.initializeSocketHandlers();
    }
    
    initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`用户连接: ${socket.id}`);
            
            // 用户认证
            socket.on('authenticate', async (data) => {
                try {
                    const { userId, username } = data;
                    
                    // 存储用户信息
                    this.connectedUsers.set(userId, socket.id);
                    this.userSockets.set(socket.id, { userId, username });
                    
                    socket.userId = userId;
                    socket.username = username;
                    
                    // 加入用户个人房间（用于私聊）
                    socket.join(`user_${userId}`);
                    
                    // 通知认证成功
                    socket.emit('authenticated', {
                        success: true,
                        message: '认证成功'
                    });
                    
                    console.log(`用户 ${username} (${userId}) 已认证`);
                } catch (error) {
                    socket.emit('authenticated', {
                        success: false,
                        message: '认证失败'
                    });
                }
            });
            
            // 加入聊天室
            socket.on('chat:join', async (data) => {
                try {
                    const { roomId } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 验证用户是否有权限加入房间
                    const room = await ChatRoom.findById(roomId);
                    if (!room) {
                        socket.emit('error', { message: '聊天室不存在' });
                        return;
                    }
                    
                    const isMember = room.members.some(member => 
                        member.user.toString() === userId
                    );
                    
                    if (!isMember && room.type === 'private') {
                        socket.emit('error', { message: '无权限加入此聊天室' });
                        return;
                    }
                    
                    // 加入Socket.io房间
                    socket.join(roomId);
                    
                    // 更新房间成员列表
                    if (!this.roomMembers.has(roomId)) {
                        this.roomMembers.set(roomId, new Set());
                    }
                    this.roomMembers.get(roomId).add(userId);
                    
                    // 通知房间其他成员
                    socket.to(roomId).emit('user:joined', {
                        userId,
                        username: socket.username,
                        timestamp: new Date()
                    });
                    
                    // 发送房间信息给用户
                    socket.emit('chat:joined', {
                        roomId,
                        roomName: room.name,
                        memberCount: this.roomMembers.get(roomId).size
                    });
                    
                    console.log(`用户 ${socket.username} 加入房间 ${room.name}`);
                } catch (error) {
                    console.error('加入聊天室失败:', error);
                    socket.emit('error', { message: '加入聊天室失败' });
                }
            });
            
            // 离开聊天室
            socket.on('chat:leave', (data) => {
                const { roomId } = data;
                const userId = socket.userId;
                
                socket.leave(roomId);
                
                if (this.roomMembers.has(roomId)) {
                    this.roomMembers.get(roomId).delete(userId);
                }
                
                socket.to(roomId).emit('user:left', {
                    userId,
                    username: socket.username,
                    timestamp: new Date()
                });
            });
            
            // 发送文本消息
            socket.on('chat:message', async (data) => {
                try {
                    const { roomId, content, replyTo, messageType = 'text' } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 创建消息记录
                    const message = new ChatMessage({
                        chatRoom: roomId,
                        sender: userId,
                        content,
                        messageType,
                        replyTo: replyTo || undefined,
                        originalLanguage: data.language || 'zh'
                    });
                    
                    await message.save();
                    await message.populate('sender', 'username');
                    
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
                        timestamp: message.createdAt
                    });
                    
                    // 奖励代币（发送消息）
                    try {
                        await this.tokenRewardService.awardTokens(userId, 'content.comment', {
                            contentType: 'chat_message',
                            contentId: message._id
                        });
                    } catch (error) {
                        console.warn('奖励代币失败:', error);
                    }
                    
                } catch (error) {
                    console.error('发送消息失败:', error);
                    socket.emit('error', { message: '发送消息失败' });
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
                    
                    // 通知开始处理
                    socket.emit('voice:processing', {
                        message: '正在处理语音消息...'
                    });
                    
                    // 处理语音翻译
                    const audioBuffer = Buffer.from(audioData, 'base64');
                    const result = await this.voiceService.processVoiceMessage(
                        audioBuffer,
                        sourceLanguage,
                        targetLanguages || ['en', 'zh'],
                        userId,
                        roomId
                    );
                    
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
                            originalAudioUrl: `/uploads/voice/original_${Date.now()}.webm`
                        }
                    });
                    
                    await message.save();
                    await message.populate('sender', 'username');
                    
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
                        timestamp: message.createdAt
                    });
                    
                    // 奖励代币（语音翻译）
                    try {
                        await this.tokenRewardService.awardTokens(userId, 'content.translation', {
                            contentType: 'voice_translation',
                            contentId: result.data.id
                        });
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
                const { roomId, targetLanguage } = data;
                socket.voiceStream = {
                    roomId,
                    targetLanguage,
                    audioChunks: []
                };
                
                socket.emit('voice:stream:ready', {
                    message: '准备接收语音流'
                });
            });
            
            socket.on('voice:stream:chunk', (data) => {
                if (socket.voiceStream) {
                    socket.voiceStream.audioChunks.push(data.chunk);
                }
            });
            
            socket.on('voice:stream:end', async () => {
                if (socket.voiceStream) {
                    try {
                        // 合并音频块
                        const audioBuffer = Buffer.concat(socket.voiceStream.audioChunks);
                        
                        // 处理语音翻译
                        const result = await this.voiceService.processVoiceMessage(
                            audioBuffer,
                            'auto',
                            [socket.voiceStream.targetLanguage],
                            socket.userId,
                            socket.voiceStream.roomId
                        );
                        
                        // 发送结果到房间
                        this.io.to(socket.voiceStream.roomId).emit('voice:stream:result', {
                            originalText: result.data.originalText,
                            translatedText: result.data.translations[0]?.text,
                            confidence: result.data.confidence,
                            sender: {
                                id: socket.userId,
                                username: socket.username
                            }
                        });
                        
                    } catch (error) {
                        socket.emit('voice:stream:error', {
                            message: '实时翻译失败: ' + error.message
                        });
                    }
                    
                    socket.voiceStream = null;
                }
            });
            
            // 用户状态更新
            socket.on('user:status', (data) => {
                const { status } = data; // 'online', 'away', 'busy'
                const userId = socket.userId;
                
                if (userId) {
                    // 广播状态更新到所有相关房间
                    socket.broadcast.emit('user:status', {
                        userId,
                        username: socket.username,
                        status,
                        timestamp: new Date()
                    });
                }
            });
            
            // 输入状态
            socket.on('chat:typing', (data) => {
                const { roomId, isTyping } = data;
                const userId = socket.userId;
                
                if (userId) {
                    socket.to(roomId).emit('chat:typing', {
                        userId,
                        username: socket.username,
                        isTyping,
                        timestamp: new Date()
                    });
                }
            });
            
            // 消息反应
            socket.on('message:reaction', async (data) => {
                try {
                    const { messageId, emoji, action } = data; // action: 'add' | 'remove'
                    const userId = socket.userId;
                    
                    const message = await ChatMessage.findById(messageId);
                    if (!message) {
                        socket.emit('error', { message: '消息不存在' });
                        return;
                    }
                    
                    if (action === 'add') {
                        // 添加反应
                        const existingReaction = message.reactions.find(r => 
                            r.user.toString() === userId && r.emoji === emoji
                        );
                        
                        if (!existingReaction) {
                            message.reactions.push({
                                user: userId,
                                emoji,
                                timestamp: new Date()
                            });
                        }
                    } else if (action === 'remove') {
                        // 移除反应
                        message.reactions = message.reactions.filter(r => 
                            !(r.user.toString() === userId && r.emoji === emoji)
                        );
                    }
                    
                    await message.save();
                    
                    // 广播反应更新
                    this.io.to(message.chatRoom.toString()).emit('message:reaction', {
                        messageId,
                        userId,
                        username: socket.username,
                        emoji,
                        action,
                        timestamp: new Date()
                    });
                    
                } catch (error) {
                    console.error('处理消息反应失败:', error);
                    socket.emit('error', { message: '操作失败' });
                }
            });
            
            // 断开连接处理
            socket.on('disconnect', () => {
                const userInfo = this.userSockets.get(socket.id);
                
                if (userInfo) {
                    const { userId, username } = userInfo;
                    
                    // 清理用户连接信息
                    this.connectedUsers.delete(userId);
                    this.userSockets.delete(socket.id);
                    
                    // 从所有房间移除用户
                    for (const [roomId, members] of this.roomMembers.entries()) {
                        if (members.has(userId)) {
                            members.delete(userId);
                            
                            // 通知房间其他成员
                            socket.to(roomId).emit('user:left', {
                                userId,
                                username,
                                timestamp: new Date()
                            });
                        }
                    }
                    
                    console.log(`用户 ${username} (${userId}) 已断开连接`);
                }
            });
        });
    }
    
    /**
     * 获取在线用户数量
     * @returns {number} 在线用户数量
     */
    getOnlineUserCount() {
        return this.connectedUsers.size;
    }
    
    /**
     * 获取房间在线成员数量
     * @param {string} roomId 房间ID
     * @returns {number} 在线成员数量
     */
    getRoomMemberCount(roomId) {
        return this.roomMembers.get(roomId)?.size || 0;
    }
    
    /**
     * 向特定用户发送消息
     * @param {string} userId 用户ID
     * @param {string} event 事件名称
     * @param {Object} data 数据
     */
    sendToUser(userId, event, data) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }
    
    /**
     * 向房间发送消息
     * @param {string} roomId 房间ID
     * @param {string} event 事件名称
     * @param {Object} data 数据
     */
    sendToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }
}

module.exports = SocketService;

