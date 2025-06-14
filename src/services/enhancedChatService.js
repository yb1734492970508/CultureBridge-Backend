const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const CBTTokenService = require('./cbtTokenService');

class EnhancedChatService {
    constructor(server) {
        this.io = socketIo(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });
        
        this.connectedUsers = new Map(); // userId -> { socketId, userInfo, rooms }
        this.roomConnections = new Map(); // roomId -> Set of userIds
        this.typingUsers = new Map(); // roomId -> Set of userIds
        this.cbtTokenService = new CBTTokenService();
        
        this.setupSocketHandlers();
        this.setupCleanupTasks();
        
        console.log('✅ 增强聊天服务已初始化');
    }
    
    /**
     * 设置Socket处理器
     */
    setupSocketHandlers() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }
                
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                
                if (!user) {
                    return next(new Error('Authentication error: User not found'));
                }
                
                socket.userId = user._id.toString();
                socket.userInfo = {
                    id: user._id,
                    username: user.username,
                    avatar: user.avatar,
                    status: 'online'
                };
                
                next();
            } catch (error) {
                console.error('Socket认证失败:', error.message);
                next(new Error('Authentication error'));
            }
        });
        
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }
    
    /**
     * 处理连接
     */
    handleConnection(socket) {
        const userId = socket.userId;
        const userInfo = socket.userInfo;
        
        console.log(`用户连接: ${userInfo.username} (${userId})`);
        
        // 记录连接用户
        this.connectedUsers.set(userId, {
            socketId: socket.id,
            userInfo: userInfo,
            rooms: new Set(),
            lastActivity: new Date()
        });
        
        // 设置事件处理器
        this.setupSocketEvents(socket);
        
        // 发送连接成功消息
        socket.emit('connected', {
            success: true,
            user: userInfo,
            timestamp: new Date()
        });
        
        // 处理断开连接
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
    }
    
    /**
     * 设置Socket事件
     */
    setupSocketEvents(socket) {
        const userId = socket.userId;
        
        // 加入聊天室
        socket.on('join_room', async (data) => {
            await this.handleJoinRoom(socket, data);
        });
        
        // 离开聊天室
        socket.on('leave_room', async (data) => {
            await this.handleLeaveRoom(socket, data);
        });
        
        // 发送消息
        socket.on('send_message', async (data) => {
            await this.handleSendMessage(socket, data);
        });
        
        // 编辑消息
        socket.on('edit_message', async (data) => {
            await this.handleEditMessage(socket, data);
        });
        
        // 删除消息
        socket.on('delete_message', async (data) => {
            await this.handleDeleteMessage(socket, data);
        });
        
        // 消息反应
        socket.on('message_reaction', async (data) => {
            await this.handleMessageReaction(socket, data);
        });
        
        // 标记消息已读
        socket.on('mark_read', async (data) => {
            await this.handleMarkRead(socket, data);
        });
        
        // 正在输入
        socket.on('typing_start', async (data) => {
            await this.handleTypingStart(socket, data);
        });
        
        // 停止输入
        socket.on('typing_stop', async (data) => {
            await this.handleTypingStop(socket, data);
        });
        
        // 语音消息
        socket.on('voice_message', async (data) => {
            await this.handleVoiceMessage(socket, data);
        });
        
        // 文件分享
        socket.on('file_share', async (data) => {
            await this.handleFileShare(socket, data);
        });
        
        // 获取聊天历史
        socket.on('get_history', async (data) => {
            await this.handleGetHistory(socket, data);
        });
        
        // 搜索消息
        socket.on('search_messages', async (data) => {
            await this.handleSearchMessages(socket, data);
        });
        
        // 举报消息
        socket.on('report_message', async (data) => {
            await this.handleReportMessage(socket, data);
        });
        
        // 更新用户状态
        socket.on('update_status', async (data) => {
            await this.handleUpdateStatus(socket, data);
        });
        
        // 心跳
        socket.on('ping', () => {
            socket.emit('pong');
            this.updateUserActivity(userId);
        });
    }
    
    /**
     * 处理加入聊天室
     */
    async handleJoinRoom(socket, data) {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            
            if (!roomId) {
                socket.emit('error', { message: '聊天室ID不能为空' });
                return;
            }
            
            // 获取聊天室信息
            const chatRoom = await ChatRoom.findById(roomId);
            if (!chatRoom) {
                socket.emit('error', { message: '聊天室不存在' });
                return;
            }
            
            // 检查用户是否有权限加入
            if (chatRoom.settings.isPrivate && !chatRoom.participants.some(p => p.user.toString() === userId)) {
                socket.emit('error', { message: '无权限加入私有聊天室' });
                return;
            }
            
            // 加入Socket房间
            socket.join(roomId);
            
            // 更新用户连接信息
            const userConnection = this.connectedUsers.get(userId);
            if (userConnection) {
                userConnection.rooms.add(roomId);
            }
            
            // 更新房间连接信息
            if (!this.roomConnections.has(roomId)) {
                this.roomConnections.set(roomId, new Set());
            }
            this.roomConnections.get(roomId).add(userId);
            
            // 添加用户到聊天室参与者（如果不存在）
            const added = chatRoom.addParticipant(userId);
            if (added) {
                await chatRoom.save();
            }
            
            // 更新用户活动
            chatRoom.updateParticipantActivity(userId);
            await chatRoom.save();
            
            // 通知房间其他用户
            socket.to(roomId).emit('user_joined', {
                user: socket.userInfo,
                timestamp: new Date()
            });
            
            // 发送加入成功消息
            socket.emit('room_joined', {
                success: true,
                room: chatRoom,
                onlineUsers: Array.from(this.roomConnections.get(roomId) || []).map(id => {
                    const connection = this.connectedUsers.get(id);
                    return connection ? connection.userInfo : null;
                }).filter(Boolean),
                timestamp: new Date()
            });
            
            console.log(`用户 ${socket.userInfo.username} 加入聊天室: ${chatRoom.name}`);
            
        } catch (error) {
            console.error('加入聊天室失败:', error.message);
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
            
            // 离开Socket房间
            socket.leave(roomId);
            
            // 更新用户连接信息
            const userConnection = this.connectedUsers.get(userId);
            if (userConnection) {
                userConnection.rooms.delete(roomId);
            }
            
            // 更新房间连接信息
            const roomConnections = this.roomConnections.get(roomId);
            if (roomConnections) {
                roomConnections.delete(userId);
                if (roomConnections.size === 0) {
                    this.roomConnections.delete(roomId);
                }
            }
            
            // 停止输入状态
            this.handleTypingStop(socket, { roomId });
            
            // 通知房间其他用户
            socket.to(roomId).emit('user_left', {
                user: socket.userInfo,
                timestamp: new Date()
            });
            
            socket.emit('room_left', {
                success: true,
                roomId: roomId,
                timestamp: new Date()
            });
            
            console.log(`用户 ${socket.userInfo.username} 离开聊天室: ${roomId}`);
            
        } catch (error) {
            console.error('离开聊天室失败:', error.message);
            socket.emit('error', { message: '离开聊天室失败' });
        }
    }
    
    /**
     * 处理发送消息
     */
    async handleSendMessage(socket, data) {
        try {
            const { roomId, content, type = 'TEXT', replyTo, mentions } = data;
            const userId = socket.userId;
            
            if (!roomId || !content) {
                socket.emit('error', { message: '消息内容不能为空' });
                return;
            }
            
            // 获取聊天室
            const chatRoom = await ChatRoom.findById(roomId);
            if (!chatRoom) {
                socket.emit('error', { message: '聊天室不存在' });
                return;
            }
            
            // 检查用户是否可以发言
            if (!chatRoom.canUserPost(userId)) {
                socket.emit('error', { message: '您已被禁言或封禁' });
                return;
            }
            
            // 创建消息
            const message = new ChatMessage({
                chatRoom: roomId,
                sender: userId,
                type: type,
                content: this.processMessageContent(content, type),
                replyTo: replyTo,
                mentions: mentions || [],
                metadata: {
                    clientId: data.clientId,
                    platform: data.platform || 'WEB',
                    userAgent: socket.handshake.headers['user-agent'],
                    ipAddress: socket.handshake.address
                }
            });
            
            // 保存消息
            await message.save();
            
            // 填充发送者信息
            await message.populate('sender', 'username avatar');
            if (message.replyTo) {
                await message.populate('replyTo', 'content.text sender');
            }
            
            // 更新聊天室统计
            chatRoom.updateMessageStats(message.content.text?.length || 0);
            chatRoom.updateParticipantActivity(userId);
            await chatRoom.save();
            
            // 自动翻译（如果启用）
            if (chatRoom.settings.autoTranslation.enabled) {
                await this.autoTranslateMessage(message, chatRoom.settings.autoTranslation.targetLanguages);
            }
            
            // 计算奖励
            const reward = message.calculateReward();
            if (reward > 0) {
                await this.cbtTokenService.distributeReward(
                    userId,
                    'CHAT_PARTICIPATION',
                    reward.toString(),
                    '聊天参与奖励'
                );
            }
            
            // 广播消息到房间
            this.io.to(roomId).emit('new_message', {
                message: message,
                timestamp: new Date()
            });
            
            // 处理提及通知
            if (mentions && mentions.length > 0) {
                await this.handleMentionNotifications(message, mentions);
            }
            
            console.log(`消息发送成功: ${socket.userInfo.username} -> ${chatRoom.name}`);
            
        } catch (error) {
            console.error('发送消息失败:', error.message);
            socket.emit('error', { message: '发送消息失败' });
        }
    }
    
    /**
     * 处理编辑消息
     */
    async handleEditMessage(socket, data) {
        try {
            const { messageId, newContent } = data;
            const userId = socket.userId;
            
            const message = await ChatMessage.findById(messageId);
            if (!message) {
                socket.emit('error', { message: '消息不存在' });
                return;
            }
            
            if (message.sender.toString() !== userId) {
                socket.emit('error', { message: '只能编辑自己的消息' });
                return;
            }
            
            // 检查编辑时间限制（5分钟内）
            const editTimeLimit = 5 * 60 * 1000; // 5分钟
            if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
                socket.emit('error', { message: '消息编辑时间已过期' });
                return;
            }
            
            message.editContent(newContent);
            await message.save();
            
            // 广播编辑事件
            this.io.to(message.chatRoom.toString()).emit('message_edited', {
                messageId: messageId,
                newContent: newContent,
                editedAt: new Date(),
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('编辑消息失败:', error.message);
            socket.emit('error', { message: '编辑消息失败' });
        }
    }
    
    /**
     * 处理删除消息
     */
    async handleDeleteMessage(socket, data) {
        try {
            const { messageId } = data;
            const userId = socket.userId;
            
            const message = await ChatMessage.findById(messageId);
            if (!message) {
                socket.emit('error', { message: '消息不存在' });
                return;
            }
            
            // 检查权限（发送者或管理员）
            const chatRoom = await ChatRoom.findById(message.chatRoom);
            const isSender = message.sender.toString() === userId;
            const isModerator = chatRoom.moderators.some(m => m.user.toString() === userId);
            const isCreator = chatRoom.creator.toString() === userId;
            
            if (!isSender && !isModerator && !isCreator) {
                socket.emit('error', { message: '无权限删除此消息' });
                return;
            }
            
            message.status = 'DELETED';
            await message.save();
            
            // 广播删除事件
            this.io.to(message.chatRoom.toString()).emit('message_deleted', {
                messageId: messageId,
                deletedBy: userId,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('删除消息失败:', error.message);
            socket.emit('error', { message: '删除消息失败' });
        }
    }
    
    /**
     * 处理消息反应
     */
    async handleMessageReaction(socket, data) {
        try {
            const { messageId, emoji, action } = data; // action: 'add' or 'remove'
            const userId = socket.userId;
            
            const message = await ChatMessage.findById(messageId);
            if (!message) {
                socket.emit('error', { message: '消息不存在' });
                return;
            }
            
            let success = false;
            if (action === 'add') {
                success = message.addReaction(userId, emoji);
            } else if (action === 'remove') {
                success = message.removeReaction(userId, emoji);
            }
            
            if (success) {
                await message.save();
                
                // 广播反应更新
                this.io.to(message.chatRoom.toString()).emit('message_reaction_updated', {
                    messageId: messageId,
                    reactions: message.reactions,
                    timestamp: new Date()
                });
            }
            
        } catch (error) {
            console.error('处理消息反应失败:', error.message);
            socket.emit('error', { message: '处理消息反应失败' });
        }
    }
    
    /**
     * 处理标记已读
     */
    async handleMarkRead(socket, data) {
        try {
            const { messageIds } = data;
            const userId = socket.userId;
            
            if (!Array.isArray(messageIds) || messageIds.length === 0) {
                return;
            }
            
            // 批量更新消息已读状态
            await ChatMessage.updateMany(
                { 
                    _id: { $in: messageIds },
                    'readBy.user': { $ne: userId }
                },
                { 
                    $push: { 
                        readBy: { 
                            user: userId, 
                            readAt: new Date() 
                        } 
                    } 
                }
            );
            
            // 获取第一条消息的聊天室ID
            const firstMessage = await ChatMessage.findById(messageIds[0]).select('chatRoom');
            if (firstMessage) {
                // 广播已读状态更新
                socket.to(firstMessage.chatRoom.toString()).emit('messages_read', {
                    messageIds: messageIds,
                    readBy: userId,
                    timestamp: new Date()
                });
            }
            
        } catch (error) {
            console.error('标记已读失败:', error.message);
        }
    }
    
    /**
     * 处理开始输入
     */
    async handleTypingStart(socket, data) {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            
            if (!this.typingUsers.has(roomId)) {
                this.typingUsers.set(roomId, new Set());
            }
            
            this.typingUsers.get(roomId).add(userId);
            
            // 通知房间其他用户
            socket.to(roomId).emit('user_typing', {
                user: socket.userInfo,
                isTyping: true,
                timestamp: new Date()
            });
            
            // 设置自动停止输入（10秒后）
            setTimeout(() => {
                this.handleTypingStop(socket, { roomId });
            }, 10000);
            
        } catch (error) {
            console.error('处理开始输入失败:', error.message);
        }
    }
    
    /**
     * 处理停止输入
     */
    async handleTypingStop(socket, data) {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            
            const typingUsers = this.typingUsers.get(roomId);
            if (typingUsers) {
                typingUsers.delete(userId);
                
                if (typingUsers.size === 0) {
                    this.typingUsers.delete(roomId);
                }
            }
            
            // 通知房间其他用户
            socket.to(roomId).emit('user_typing', {
                user: socket.userInfo,
                isTyping: false,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('处理停止输入失败:', error.message);
        }
    }
    
    /**
     * 处理语音消息
     */
    async handleVoiceMessage(socket, data) {
        try {
            const { roomId, voiceData, duration } = data;
            
            // 这里应该保存语音文件并返回URL
            // 暂时使用模拟数据
            const voiceUrl = `/uploads/voice/${Date.now()}.webm`;
            
            await this.handleSendMessage(socket, {
                roomId: roomId,
                content: {
                    voiceUrl: voiceUrl,
                    voiceDuration: duration
                },
                type: 'VOICE'
            });
            
        } catch (error) {
            console.error('处理语音消息失败:', error.message);
            socket.emit('error', { message: '发送语音消息失败' });
        }
    }
    
    /**
     * 处理文件分享
     */
    async handleFileShare(socket, data) {
        try {
            const { roomId, fileUrl, fileName, fileSize, fileType } = data;
            
            await this.handleSendMessage(socket, {
                roomId: roomId,
                content: {
                    fileUrl: fileUrl,
                    fileName: fileName,
                    fileSize: fileSize,
                    fileType: fileType
                },
                type: 'FILE'
            });
            
        } catch (error) {
            console.error('处理文件分享失败:', error.message);
            socket.emit('error', { message: '文件分享失败' });
        }
    }
    
    /**
     * 处理获取历史消息
     */
    async handleGetHistory(socket, data) {
        try {
            const { roomId, before, limit = 50 } = data;
            
            const messages = await ChatMessage.getRecentMessages(roomId, limit, before);
            
            socket.emit('chat_history', {
                messages: messages,
                hasMore: messages.length === limit,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('获取历史消息失败:', error.message);
            socket.emit('error', { message: '获取历史消息失败' });
        }
    }
    
    /**
     * 处理搜索消息
     */
    async handleSearchMessages(socket, data) {
        try {
            const { roomId, searchText, limit = 20 } = data;
            
            const messages = await ChatMessage.searchMessages(roomId, searchText, limit);
            
            socket.emit('search_results', {
                messages: messages,
                searchText: searchText,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('搜索消息失败:', error.message);
            socket.emit('error', { message: '搜索消息失败' });
        }
    }
    
    /**
     * 处理举报消息
     */
    async handleReportMessage(socket, data) {
        try {
            const { messageId, reason, description } = data;
            const userId = socket.userId;
            
            const message = await ChatMessage.findById(messageId);
            if (!message) {
                socket.emit('error', { message: '消息不存在' });
                return;
            }
            
            message.reportMessage(userId, reason, description);
            await message.save();
            
            socket.emit('message_reported', {
                success: true,
                messageId: messageId,
                timestamp: new Date()
            });
            
            // 通知管理员（如果需要）
            // this.notifyModerators(message.chatRoom, message);
            
        } catch (error) {
            console.error('举报消息失败:', error.message);
            socket.emit('error', { message: '举报消息失败' });
        }
    }
    
    /**
     * 处理更新用户状态
     */
    async handleUpdateStatus(socket, data) {
        try {
            const { status } = data; // online, away, busy, invisible
            const userId = socket.userId;
            
            const userConnection = this.connectedUsers.get(userId);
            if (userConnection) {
                userConnection.userInfo.status = status;
                
                // 广播状态更新到所有相关房间
                for (const roomId of userConnection.rooms) {
                    socket.to(roomId).emit('user_status_updated', {
                        user: userConnection.userInfo,
                        timestamp: new Date()
                    });
                }
            }
            
        } catch (error) {
            console.error('更新用户状态失败:', error.message);
        }
    }
    
    /**
     * 处理断开连接
     */
    handleDisconnection(socket) {
        const userId = socket.userId;
        const userInfo = socket.userInfo;
        
        console.log(`用户断开连接: ${userInfo.username} (${userId})`);
        
        // 清理用户连接信息
        const userConnection = this.connectedUsers.get(userId);
        if (userConnection) {
            // 通知所有相关房间用户离线
            for (const roomId of userConnection.rooms) {
                socket.to(roomId).emit('user_offline', {
                    user: userInfo,
                    timestamp: new Date()
                });
                
                // 清理房间连接信息
                const roomConnections = this.roomConnections.get(roomId);
                if (roomConnections) {
                    roomConnections.delete(userId);
                    if (roomConnections.size === 0) {
                        this.roomConnections.delete(roomId);
                    }
                }
                
                // 清理输入状态
                const typingUsers = this.typingUsers.get(roomId);
                if (typingUsers) {
                    typingUsers.delete(userId);
                    if (typingUsers.size === 0) {
                        this.typingUsers.delete(roomId);
                    }
                }
            }
            
            this.connectedUsers.delete(userId);
        }
    }
    
    /**
     * 辅助方法
     */
    processMessageContent(content, type) {
        if (type === 'TEXT') {
            return {
                text: content.text || content,
                originalText: content.originalText,
                detectedLanguage: content.detectedLanguage
            };
        } else if (type === 'VOICE') {
            return {
                voiceUrl: content.voiceUrl,
                voiceDuration: content.voiceDuration
            };
        } else if (type === 'IMAGE') {
            return {
                imageUrl: content.imageUrl
            };
        } else if (type === 'FILE') {
            return {
                fileUrl: content.fileUrl,
                fileName: content.fileName,
                fileSize: content.fileSize,
                fileType: content.fileType
            };
        }
        
        return content;
    }
    
    async autoTranslateMessage(message, targetLanguages) {
        try {
            // 这里应该调用翻译服务
            // 暂时使用模拟翻译
            for (const language of targetLanguages) {
                if (language !== message.content.detectedLanguage) {
                    const translatedText = `[翻译到${language}] ${message.content.text}`;
                    message.addTranslation(language, translatedText, 0.9);
                }
            }
            
            await message.save();
        } catch (error) {
            console.error('自动翻译失败:', error.message);
        }
    }
    
    async handleMentionNotifications(message, mentions) {
        try {
            for (const mention of mentions) {
                const mentionedUser = this.connectedUsers.get(mention.user.toString());
                if (mentionedUser) {
                    this.io.to(mentionedUser.socketId).emit('mentioned', {
                        message: message,
                        mentionedBy: message.sender,
                        timestamp: new Date()
                    });
                }
            }
        } catch (error) {
            console.error('处理提及通知失败:', error.message);
        }
    }
    
    updateUserActivity(userId) {
        const userConnection = this.connectedUsers.get(userId);
        if (userConnection) {
            userConnection.lastActivity = new Date();
        }
    }
    
    /**
     * 设置清理任务
     */
    setupCleanupTasks() {
        // 每5分钟清理不活跃的连接
        setInterval(() => {
            this.cleanupInactiveConnections();
        }, 5 * 60 * 1000);
        
        // 每小时清理输入状态
        setInterval(() => {
            this.cleanupTypingStates();
        }, 60 * 60 * 1000);
    }
    
    cleanupInactiveConnections() {
        const inactiveThreshold = 30 * 60 * 1000; // 30分钟
        const now = new Date();
        
        for (const [userId, connection] of this.connectedUsers.entries()) {
            if (now - connection.lastActivity > inactiveThreshold) {
                console.log(`清理不活跃连接: ${connection.userInfo.username}`);
                this.connectedUsers.delete(userId);
            }
        }
    }
    
    cleanupTypingStates() {
        this.typingUsers.clear();
    }
    
    /**
     * 获取在线用户统计
     */
    getOnlineStats() {
        return {
            totalConnections: this.connectedUsers.size,
            activeRooms: this.roomConnections.size,
            typingUsers: Array.from(this.typingUsers.values()).reduce((sum, set) => sum + set.size, 0)
        };
    }
    
    /**
     * 广播系统消息
     */
    broadcastSystemMessage(roomId, message) {
        this.io.to(roomId).emit('system_message', {
            message: message,
            timestamp: new Date()
        });
    }
    
    /**
     * 关闭服务
     */
    async shutdown() {
        try {
            // 通知所有连接的用户
            this.io.emit('server_shutdown', {
                message: '服务器即将关闭，请保存您的工作',
                timestamp: new Date()
            });
            
            // 等待2秒让消息发送完成
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 关闭Socket.IO服务器
            this.io.close();
            
            console.log('✅ 聊天服务已关闭');
        } catch (error) {
            console.error('❌ 关闭聊天服务失败:', error.message);
        }
    }
}

module.exports = EnhancedChatService;

