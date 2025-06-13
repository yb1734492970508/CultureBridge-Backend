const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const VoiceTranslation = require('../models/VoiceTranslation');
const TokenRewardService = require('../services/tokenRewardService');
const VoiceTranslationService = require('../services/voiceTranslationService');
const EnhancedBlockchainService = require('../services/enhancedBlockchainService');

class EnhancedSocketService {
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
        this.activeConversations = new Map(); // roomId -> conversation data
        this.culturalExchangeMetrics = new Map(); // userId -> metrics
        
        this.tokenRewardService = new TokenRewardService();
        this.voiceService = new VoiceTranslationService();
        this.blockchainService = new EnhancedBlockchainService();
        
        this.initializeSocketHandlers();
        this.startMetricsCollection();
    }
    
    initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`用户连接: ${socket.id}`);
            
            // 用户认证
            socket.on('authenticate', async (data) => {
                try {
                    const { userId, username, walletAddress } = data;
                    
                    // 存储用户信息
                    this.connectedUsers.set(userId, socket.id);
                    this.userSockets.set(socket.id, { 
                        userId, 
                        username, 
                        walletAddress,
                        joinTime: new Date(),
                        lastActivity: new Date()
                    });
                    
                    socket.userId = userId;
                    socket.username = username;
                    socket.walletAddress = walletAddress;
                    
                    // 初始化用户文化交流指标
                    if (!this.culturalExchangeMetrics.has(userId)) {
                        this.culturalExchangeMetrics.set(userId, {
                            messagesCount: 0,
                            languagesUsed: new Set(),
                            culturalTopics: new Set(),
                            qualityScore: 0,
                            rewardsEarned: 0,
                            lastRewardTime: null
                        });
                    }
                    
                    // 加入用户个人房间（用于私聊）
                    socket.join(`user_${userId}`);
                    
                    // 获取用户CBT余额
                    let cbtBalance = '0';
                    if (walletAddress) {
                        try {
                            cbtBalance = await this.blockchainService.getCBTBalance(walletAddress);
                        } catch (error) {
                            console.error('获取CBT余额失败:', error);
                        }
                    }
                    
                    // 通知认证成功
                    socket.emit('authenticated', {
                        success: true,
                        message: '认证成功',
                        cbtBalance,
                        metrics: this.culturalExchangeMetrics.get(userId)
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
                    const { roomId, language = 'zh' } = data;
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
                    socket.currentRoom = roomId;
                    socket.preferredLanguage = language;
                    
                    // 更新房间成员列表
                    if (!this.roomMembers.has(roomId)) {
                        this.roomMembers.set(roomId, new Set());
                    }
                    this.roomMembers.get(roomId).add(userId);
                    
                    // 初始化房间对话数据
                    if (!this.activeConversations.has(roomId)) {
                        this.activeConversations.set(roomId, {
                            startTime: new Date(),
                            participants: new Set(),
                            messageCount: 0,
                            languagesUsed: new Set(),
                            culturalTopics: new Set(),
                            qualityMetrics: {
                                averageLength: 0,
                                languageDiversity: 0,
                                culturalDepth: 0
                            }
                        });
                    }
                    
                    const conversation = this.activeConversations.get(roomId);
                    conversation.participants.add(userId);
                    conversation.languagesUsed.add(language);
                    
                    // 通知房间其他成员
                    socket.to(roomId).emit('user:joined', {
                        userId,
                        username: socket.username,
                        language,
                        timestamp: new Date()
                    });
                    
                    // 发送房间信息给用户
                    socket.emit('chat:joined', {
                        roomId,
                        roomName: room.name,
                        memberCount: this.roomMembers.get(roomId).size,
                        activeLanguages: Array.from(conversation.languagesUsed),
                        culturalTopics: Array.from(conversation.culturalTopics)
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
                socket.currentRoom = null;
                
                if (this.roomMembers.has(roomId)) {
                    this.roomMembers.get(roomId).delete(userId);
                }
                
                if (this.activeConversations.has(roomId)) {
                    this.activeConversations.get(roomId).participants.delete(userId);
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
                    const { 
                        roomId, 
                        content, 
                        replyTo, 
                        messageType = 'text',
                        language = 'zh',
                        culturalContext = null
                    } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 更新用户活动时间
                    const userInfo = this.userSockets.get(socket.id);
                    if (userInfo) {
                        userInfo.lastActivity = new Date();
                    }
                    
                    // 创建消息记录
                    const message = new ChatMessage({
                        chatRoom: roomId,
                        sender: userId,
                        content,
                        messageType,
                        language,
                        culturalContext,
                        replyTo,
                        timestamp: new Date()
                    });
                    
                    await message.save();
                    
                    // 更新对话指标
                    this.updateConversationMetrics(roomId, content, language, culturalContext);
                    
                    // 更新用户文化交流指标
                    this.updateUserMetrics(userId, content, language, culturalContext);
                    
                    // 计算消息质量分数
                    const qualityScore = this.calculateMessageQuality(content, language, culturalContext);
                    
                    // 广播消息到房间
                    const messageData = {
                        messageId: message._id,
                        userId,
                        username: socket.username,
                        content,
                        messageType,
                        language,
                        culturalContext,
                        qualityScore,
                        timestamp: message.timestamp,
                        replyTo
                    };
                    
                    this.io.to(roomId).emit('chat:message', messageData);
                    
                    // 检查是否应该奖励CBT代币
                    await this.checkAndRewardCBT(userId, qualityScore, language, culturalContext);
                    
                    console.log(`消息发送: ${socket.username} -> ${roomId}`);
                } catch (error) {
                    console.error('发送消息失败:', error);
                    socket.emit('error', { message: '发送消息失败' });
                }
            });
            
            // 语音消息处理
            socket.on('chat:voice', async (data) => {
                try {
                    const { 
                        roomId, 
                        audioData, 
                        sourceLanguage = 'zh',
                        targetLanguage = 'en',
                        culturalContext = null
                    } = data;
                    const userId = socket.userId;
                    
                    if (!userId) {
                        socket.emit('error', { message: '请先认证' });
                        return;
                    }
                    
                    // 处理语音翻译
                    const translationResult = await this.voiceService.processVoiceMessage({
                        audioData,
                        sourceLanguage,
                        targetLanguage,
                        userId,
                        roomId
                    });
                    
                    if (translationResult.success) {
                        // 创建语音消息记录
                        const message = new ChatMessage({
                            chatRoom: roomId,
                            sender: userId,
                            content: translationResult.originalText,
                            messageType: 'voice',
                            language: sourceLanguage,
                            culturalContext,
                            voiceData: {
                                originalAudio: translationResult.originalAudioUrl,
                                translatedText: translationResult.translatedText,
                                translatedAudio: translationResult.translatedAudioUrl,
                                targetLanguage
                            },
                            timestamp: new Date()
                        });
                        
                        await message.save();
                        
                        // 更新指标
                        this.updateConversationMetrics(roomId, translationResult.originalText, sourceLanguage, culturalContext);
                        this.updateUserMetrics(userId, translationResult.originalText, sourceLanguage, culturalContext);
                        
                        // 计算质量分数（语音消息有额外加分）
                        const qualityScore = this.calculateMessageQuality(
                            translationResult.originalText, 
                            sourceLanguage, 
                            culturalContext,
                            true // 语音消息标识
                        );
                        
                        // 广播语音消息
                        const messageData = {
                            messageId: message._id,
                            userId,
                            username: socket.username,
                            content: translationResult.originalText,
                            messageType: 'voice',
                            language: sourceLanguage,
                            culturalContext,
                            qualityScore,
                            voiceData: message.voiceData,
                            timestamp: message.timestamp
                        };
                        
                        this.io.to(roomId).emit('chat:voice', messageData);
                        
                        // 语音消息有更高的CBT奖励
                        await this.checkAndRewardCBT(userId, qualityScore * 1.5, sourceLanguage, culturalContext);
                        
                        console.log(`语音消息发送: ${socket.username} -> ${roomId}`);
                    } else {
                        socket.emit('error', { message: '语音处理失败' });
                    }
                } catch (error) {
                    console.error('处理语音消息失败:', error);
                    socket.emit('error', { message: '处理语音消息失败' });
                }
            });
            
            // 实时翻译请求
            socket.on('translate:request', async (data) => {
                try {
                    const { text, sourceLanguage, targetLanguage } = data;
                    
                    const translationResult = await this.voiceService.translateText({
                        text,
                        sourceLanguage,
                        targetLanguage
                    });
                    
                    socket.emit('translate:response', {
                        originalText: text,
                        translatedText: translationResult.translatedText,
                        sourceLanguage,
                        targetLanguage,
                        confidence: translationResult.confidence
                    });
                } catch (error) {
                    console.error('翻译失败:', error);
                    socket.emit('translate:error', { message: '翻译失败' });
                }
            });
            
            // 文化话题建议
            socket.on('culture:suggest', async (data) => {
                try {
                    const { userLanguage, targetLanguage, interests = [] } = data;
                    
                    const suggestions = await this.generateCulturalTopics(userLanguage, targetLanguage, interests);
                    
                    socket.emit('culture:suggestions', {
                        topics: suggestions,
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.error('生成文化话题失败:', error);
                    socket.emit('error', { message: '生成文化话题失败' });
                }
            });
            
            // 用户断开连接
            socket.on('disconnect', () => {
                const userId = socket.userId;
                
                if (userId) {
                    this.connectedUsers.delete(userId);
                    
                    // 从所有房间移除用户
                    for (const [roomId, members] of this.roomMembers.entries()) {
                        if (members.has(userId)) {
                            members.delete(userId);
                            socket.to(roomId).emit('user:left', {
                                userId,
                                username: socket.username,
                                timestamp: new Date()
                            });
                        }
                    }
                    
                    // 从活跃对话中移除用户
                    for (const [roomId, conversation] of this.activeConversations.entries()) {
                        conversation.participants.delete(userId);
                    }
                }
                
                this.userSockets.delete(socket.id);
                console.log(`用户断开连接: ${socket.id}`);
            });
        });
    }
    
    /**
     * 更新对话指标
     */
    updateConversationMetrics(roomId, content, language, culturalContext) {
        if (!this.activeConversations.has(roomId)) return;
        
        const conversation = this.activeConversations.get(roomId);
        conversation.messageCount++;
        conversation.languagesUsed.add(language);
        
        if (culturalContext) {
            conversation.culturalTopics.add(culturalContext);
        }
        
        // 更新质量指标
        const metrics = conversation.qualityMetrics;
        metrics.averageLength = (metrics.averageLength * (conversation.messageCount - 1) + content.length) / conversation.messageCount;
        metrics.languageDiversity = conversation.languagesUsed.size;
        metrics.culturalDepth = conversation.culturalTopics.size;
    }
    
    /**
     * 更新用户指标
     */
    updateUserMetrics(userId, content, language, culturalContext) {
        if (!this.culturalExchangeMetrics.has(userId)) return;
        
        const metrics = this.culturalExchangeMetrics.get(userId);
        metrics.messagesCount++;
        metrics.languagesUsed.add(language);
        
        if (culturalContext) {
            metrics.culturalTopics.add(culturalContext);
        }
        
        // 更新质量分数
        const messageQuality = this.calculateMessageQuality(content, language, culturalContext);
        metrics.qualityScore = (metrics.qualityScore * (metrics.messagesCount - 1) + messageQuality) / metrics.messagesCount;
    }
    
    /**
     * 计算消息质量分数
     */
    calculateMessageQuality(content, language, culturalContext, isVoice = false) {
        let score = 0;
        
        // 基础分数（基于内容长度）
        score += Math.min(content.length / 10, 10);
        
        // 语言多样性加分
        if (language !== 'zh') {
            score += 5;
        }
        
        // 文化内容加分
        if (culturalContext) {
            score += 10;
        }
        
        // 语音消息加分
        if (isVoice) {
            score += 5;
        }
        
        // 内容质量检测（简化版）
        const culturalKeywords = ['文化', '传统', '习俗', 'culture', 'tradition', 'custom'];
        const hasCulturalContent = culturalKeywords.some(keyword => 
            content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasCulturalContent) {
            score += 8;
        }
        
        return Math.min(score, 50); // 最高50分
    }
    
    /**
     * 检查并奖励CBT代币
     */
    async checkAndRewardCBT(userId, qualityScore, language, culturalContext) {
        try {
            const metrics = this.culturalExchangeMetrics.get(userId);
            if (!metrics) return;
            
            // 奖励条件检查
            const shouldReward = (
                qualityScore >= 20 && // 质量分数达到20分
                (!metrics.lastRewardTime || 
                 Date.now() - metrics.lastRewardTime > 300000) // 5分钟冷却时间
            );
            
            if (shouldReward) {
                const userInfo = Array.from(this.userSockets.values())
                    .find(user => user.userId === userId);
                
                if (userInfo && userInfo.walletAddress) {
                    // 计算奖励数量
                    let rewardAmount = qualityScore / 10; // 基础奖励
                    
                    // 语言多样性奖励
                    if (language !== 'zh') {
                        rewardAmount *= 1.2;
                    }
                    
                    // 文化内容奖励
                    if (culturalContext) {
                        rewardAmount *= 1.3;
                    }
                    
                    // 发放CBT奖励
                    const txHash = await this.blockchainService.awardCBTTokens(
                        userInfo.walletAddress,
                        rewardAmount.toFixed(4),
                        `文化交流奖励 - 质量分数: ${qualityScore}`
                    );
                    
                    // 更新用户指标
                    metrics.rewardsEarned += parseFloat(rewardAmount.toFixed(4));
                    metrics.lastRewardTime = Date.now();
                    
                    // 通知用户获得奖励
                    const socketId = this.connectedUsers.get(userId);
                    if (socketId) {
                        this.io.to(socketId).emit('reward:earned', {
                            amount: rewardAmount.toFixed(4),
                            reason: '文化交流奖励',
                            qualityScore,
                            txHash,
                            timestamp: new Date()
                        });
                    }
                    
                    console.log(`CBT奖励发放: 用户${userId} 获得 ${rewardAmount.toFixed(4)} CBT`);
                }
            }
        } catch (error) {
            console.error('CBT奖励发放失败:', error);
        }
    }
    
    /**
     * 生成文化话题建议
     */
    async generateCulturalTopics(userLanguage, targetLanguage, interests) {
        const topics = [
            {
                title: '传统节日对比',
                description: '比较不同文化的传统节日和庆祝方式',
                keywords: ['节日', '传统', '庆祝'],
                difficulty: 'beginner'
            },
            {
                title: '饮食文化探索',
                description: '分享各自国家的特色美食和饮食习惯',
                keywords: ['美食', '饮食', '文化'],
                difficulty: 'beginner'
            },
            {
                title: '教育体系差异',
                description: '讨论不同国家的教育制度和学习方式',
                keywords: ['教育', '学习', '制度'],
                difficulty: 'intermediate'
            },
            {
                title: '商务礼仪文化',
                description: '交流商务场合的礼仪和沟通方式',
                keywords: ['商务', '礼仪', '沟通'],
                difficulty: 'advanced'
            }
        ];
        
        // 根据用户兴趣过滤话题
        if (interests.length > 0) {
            return topics.filter(topic => 
                topic.keywords.some(keyword => 
                    interests.some(interest => 
                        interest.toLowerCase().includes(keyword.toLowerCase())
                    )
                )
            );
        }
        
        return topics;
    }
    
    /**
     * 开始指标收集
     */
    startMetricsCollection() {
        // 每5分钟收集一次指标
        setInterval(() => {
            this.collectAndBroadcastMetrics();
        }, 300000);
    }
    
    /**
     * 收集并广播指标
     */
    collectAndBroadcastMetrics() {
        const globalMetrics = {
            totalUsers: this.connectedUsers.size,
            activeRooms: this.roomMembers.size,
            totalMessages: Array.from(this.activeConversations.values())
                .reduce((sum, conv) => sum + conv.messageCount, 0),
            languageDiversity: new Set(
                Array.from(this.activeConversations.values())
                    .flatMap(conv => Array.from(conv.languagesUsed))
            ).size,
            timestamp: new Date()
        };
        
        // 广播全局指标
        this.io.emit('metrics:global', globalMetrics);
        
        console.log('全局指标:', globalMetrics);
    }
    
    /**
     * 获取用户指标
     */
    getUserMetrics(userId) {
        return this.culturalExchangeMetrics.get(userId) || null;
    }
    
    /**
     * 获取房间指标
     */
    getRoomMetrics(roomId) {
        return this.activeConversations.get(roomId) || null;
    }
    
    /**
     * 关闭服务
     */
    async close() {
        if (this.blockchainService) {
            await this.blockchainService.close();
        }
        
        if (this.io) {
            this.io.close();
        }
    }
}

module.exports = EnhancedSocketService;

