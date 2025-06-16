const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const WebSocket = require('ws');
const http = require('http');
const Redis = require('redis');

// 导入服务
const EnhancedBlockchainService = require('./services/enhancedBlockchainService');
const TranslationService = require('./services/translationService');
const ChatService = require('./services/chatService');
const UserService = require('./services/userService');
const RewardService = require('./services/rewardService');

class CultureBridgeServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        // 初始化服务
        this.blockchainService = new EnhancedBlockchainService();
        this.translationService = new TranslationService();
        this.chatService = new ChatService();
        this.userService = new UserService();
        this.rewardService = new RewardService();
        
        // 配置
        this.port = process.env.PORT || 5000;
        this.jwtSecret = process.env.JWT_SECRET || 'culturebridge_secret_key_2024';
        
        // 初始化Redis
        this.initializeRedis();
        
        // 配置中间件
        this.configureMiddleware();
        
        // 配置路由
        this.configureRoutes();
        
        // 配置WebSocket
        this.configureWebSocket();
        
        // 错误处理
        this.configureErrorHandling();
    }
    
    /**
     * 初始化Redis连接
     */
    async initializeRedis() {
        try {
            this.redis = Redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });
            
            this.redis.on('error', (err) => {
                console.warn('Redis连接错误:', err);
            });
            
            await this.redis.connect();
            console.log('✅ Redis已连接');
        } catch (error) {
            console.warn('⚠️ Redis连接失败，将使用内存存储:', error.message);
            this.redis = null;
        }
    }
    
    /**
     * 配置中间件
     */
    configureMiddleware() {
        // 安全中间件
        this.app.use(helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:"]
                }
            }
        }));
        
        // CORS配置
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || '*',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        
        // 压缩
        this.app.use(compression());
        
        // 请求日志
        this.app.use(morgan('combined'));
        
        // 请求解析
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // 速率限制
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 1000, // 每个IP最多1000个请求
            message: {
                error: '请求过于频繁，请稍后再试'
            }
        });
        this.app.use(limiter);
        
        // API速率限制
        const apiLimiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1分钟
            max: 100, // 每个IP最多100个API请求
            message: {
                error: 'API请求过于频繁，请稍后再试'
            }
        });
        this.app.use('/api/', apiLimiter);
    }
    
    /**
     * JWT认证中间件
     */
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: '访问令牌缺失' });
        }
        
        jwt.verify(token, this.jwtSecret, (err, user) => {
            if (err) {
                return res.status(403).json({ error: '访问令牌无效' });
            }
            req.user = user;
            next();
        });
    }
    
    /**
     * 配置路由
     */
    configureRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                services: {
                    blockchain: !!this.blockchainService,
                    translation: !!this.translationService,
                    chat: !!this.chatService,
                    redis: !!this.redis
                }
            });
        });
        
        // API根路径
        this.app.get('/api', (req, res) => {
            res.json({
                message: 'CultureBridge API v2.0',
                documentation: '/api/docs',
                endpoints: {
                    auth: '/api/auth',
                    users: '/api/users',
                    blockchain: '/api/blockchain',
                    chat: '/api/chat',
                    translation: '/api/translation',
                    rewards: '/api/rewards'
                }
            });
        });
        
        // 认证路由
        this.configureAuthRoutes();
        
        // 用户路由
        this.configureUserRoutes();
        
        // 区块链路由
        this.configureBlockchainRoutes();
        
        // 聊天路由
        this.configureChatRoutes();
        
        // 翻译路由
        this.configureTranslationRoutes();
        
        // 奖励路由
        this.configureRewardRoutes();
        
        // 静态文件
        this.app.use('/uploads', express.static('uploads'));
        
        // 404处理
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: '接口不存在',
                path: req.originalUrl,
                method: req.method
            });
        });
    }
    
    /**
     * 配置认证路由
     */
    configureAuthRoutes() {
        // 钱包登录
        this.app.post('/api/auth/wallet-login', [
            body('walletAddress').isEthereumAddress().withMessage('无效的钱包地址'),
            body('signature').notEmpty().withMessage('签名不能为空'),
            body('message').notEmpty().withMessage('消息不能为空')
        ], async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ errors: errors.array() });
                }
                
                const { walletAddress, signature, message } = req.body;
                
                // 验证签名
                const isValidSignature = await this.userService.verifyWalletSignature(
                    walletAddress, 
                    signature, 
                    message
                );
                
                if (!isValidSignature) {
                    return res.status(401).json({ error: '签名验证失败' });
                }
                
                // 获取或创建用户
                let user = await this.userService.getUserByWallet(walletAddress);
                if (!user) {
                    user = await this.userService.createUser({
                        walletAddress,
                        username: `用户_${walletAddress.slice(-6)}`,
                        joinedAt: new Date()
                    });
                }
                
                // 更新最后登录时间
                await this.userService.updateLastLogin(user.id);
                
                // 生成JWT令牌
                const token = jwt.sign(
                    { 
                        userId: user.id, 
                        walletAddress: user.walletAddress,
                        username: user.username
                    },
                    this.jwtSecret,
                    { expiresIn: '7d' }
                );
                
                // 获取用户CBT余额
                const cbtBalance = await this.blockchainService.getUserBalance(walletAddress);
                
                res.json({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        walletAddress: user.walletAddress,
                        cbtBalance: parseFloat(cbtBalance),
                        level: this.userService.calculateUserLevel(parseFloat(cbtBalance)),
                        joinedAt: user.joinedAt
                    }
                });
            } catch (error) {
                console.error('钱包登录失败:', error);
                res.status(500).json({ error: '登录失败，请重试' });
            }
        });
        
        // 刷新令牌
        this.app.post('/api/auth/refresh', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const user = await this.userService.getUserById(req.user.userId);
                if (!user) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                // 生成新令牌
                const token = jwt.sign(
                    { 
                        userId: user.id, 
                        walletAddress: user.walletAddress,
                        username: user.username
                    },
                    this.jwtSecret,
                    { expiresIn: '7d' }
                );
                
                res.json({ success: true, token });
            } catch (error) {
                console.error('令牌刷新失败:', error);
                res.status(500).json({ error: '令牌刷新失败' });
            }
        });
    }
    
    /**
     * 配置用户路由
     */
    configureUserRoutes() {
        // 获取用户信息
        this.app.get('/api/users/profile', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const user = await this.userService.getUserById(req.user.userId);
                if (!user) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                // 获取CBT余额
                const cbtBalance = await this.blockchainService.getUserBalance(user.walletAddress);
                
                // 获取用户统计
                const stats = await this.userService.getUserStats(user.id);
                
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        walletAddress: user.walletAddress,
                        cbtBalance: parseFloat(cbtBalance),
                        level: this.userService.calculateUserLevel(parseFloat(cbtBalance)),
                        joinedAt: user.joinedAt,
                        stats
                    }
                });
            } catch (error) {
                console.error('获取用户信息失败:', error);
                res.status(500).json({ error: '获取用户信息失败' });
            }
        });
        
        // 更新用户信息
        this.app.put('/api/users/profile', [
            this.authenticateToken.bind(this),
            body('username').optional().isLength({ min: 2, max: 50 }).withMessage('用户名长度应在2-50字符之间'),
            body('bio').optional().isLength({ max: 500 }).withMessage('个人简介不能超过500字符'),
            body('languages').optional().isArray().withMessage('语言列表应为数组')
        ], async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ errors: errors.array() });
                }
                
                const { username, bio, languages, avatar } = req.body;
                
                const updatedUser = await this.userService.updateUser(req.user.userId, {
                    username,
                    bio,
                    languages,
                    avatar
                });
                
                res.json({ success: true, user: updatedUser });
            } catch (error) {
                console.error('更新用户信息失败:', error);
                res.status(500).json({ error: '更新用户信息失败' });
            }
        });
        
        // 获取用户排行榜
        this.app.get('/api/users/leaderboard', async (req, res) => {
            try {
                const { type = 'cbt', limit = 50 } = req.query;
                const leaderboard = await this.userService.getLeaderboard(type, parseInt(limit));
                
                res.json({ success: true, leaderboard });
            } catch (error) {
                console.error('获取排行榜失败:', error);
                res.status(500).json({ error: '获取排行榜失败' });
            }
        });
    }
    
    /**
     * 配置区块链路由
     */
    configureBlockchainRoutes() {
        // 获取用户CBT余额
        this.app.get('/api/blockchain/balance/:address', async (req, res) => {
            try {
                const { address } = req.params;
                
                if (!this.blockchainService.isValidAddress(address)) {
                    return res.status(400).json({ error: '无效的钱包地址' });
                }
                
                const balance = await this.blockchainService.getUserBalance(address);
                
                res.json({
                    success: true,
                    address,
                    balance: parseFloat(balance),
                    currency: 'CBT'
                });
            } catch (error) {
                console.error('获取余额失败:', error);
                res.status(500).json({ error: '获取余额失败' });
            }
        });
        
        // 分发奖励
        this.app.post('/api/blockchain/distribute-reward', [
            this.authenticateToken.bind(this),
            body('recipient').isEthereumAddress().withMessage('无效的接收者地址'),
            body('amount').isFloat({ min: 0.01 }).withMessage('奖励金额必须大于0.01'),
            body('reason').notEmpty().withMessage('奖励原因不能为空'),
            body('category').isIn(['LEARNING_REWARD', 'CULTURAL_EXCHANGE', 'CONTENT_CREATION', 'COMMUNITY_CONTRIBUTION', 'GOVERNANCE_PARTICIPATION']).withMessage('无效的奖励类别')
        ], async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ errors: errors.array() });
                }
                
                const { recipient, amount, reason, category } = req.body;
                
                // 验证用户权限（只有管理员可以分发奖励）
                const user = await this.userService.getUserById(req.user.userId);
                if (!user.isAdmin) {
                    return res.status(403).json({ error: '权限不足' });
                }
                
                const result = await this.blockchainService.distributeReward(
                    recipient,
                    amount,
                    reason,
                    category,
                    process.env.ADMIN_PRIVATE_KEY
                );
                
                // 记录奖励历史
                await this.rewardService.recordReward({
                    recipient,
                    amount,
                    reason,
                    category,
                    transactionHash: result.transactionHash,
                    distributedBy: req.user.userId
                });
                
                res.json({
                    success: true,
                    transactionHash: result.transactionHash,
                    blockNumber: result.blockNumber,
                    gasUsed: result.gasUsed
                });
            } catch (error) {
                console.error('分发奖励失败:', error);
                res.status(500).json({ error: '分发奖励失败' });
            }
        });
        
        // 获取交易历史
        this.app.get('/api/blockchain/transactions/:address', async (req, res) => {
            try {
                const { address } = req.params;
                const { page = 1, limit = 20 } = req.query;
                
                if (!this.blockchainService.isValidAddress(address)) {
                    return res.status(400).json({ error: '无效的钱包地址' });
                }
                
                const transactions = await this.blockchainService.getUserTransactions(
                    address,
                    parseInt(page),
                    parseInt(limit)
                );
                
                res.json({
                    success: true,
                    transactions,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: transactions.length
                    }
                });
            } catch (error) {
                console.error('获取交易历史失败:', error);
                res.status(500).json({ error: '获取交易历史失败' });
            }
        });
    }
    
    /**
     * 配置聊天路由
     */
    configureChatRoutes() {
        // 获取聊天室列表
        this.app.get('/api/chat/rooms', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const rooms = await this.chatService.getChatRooms();
                res.json({ success: true, rooms });
            } catch (error) {
                console.error('获取聊天室列表失败:', error);
                res.status(500).json({ error: '获取聊天室列表失败' });
            }
        });
        
        // 加入聊天室
        this.app.post('/api/chat/rooms/:roomId/join', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const { roomId } = req.params;
                const userId = req.user.userId;
                
                await this.chatService.joinRoom(roomId, userId);
                
                res.json({ success: true, message: '成功加入聊天室' });
            } catch (error) {
                console.error('加入聊天室失败:', error);
                res.status(500).json({ error: '加入聊天室失败' });
            }
        });
        
        // 获取聊天历史
        this.app.get('/api/chat/rooms/:roomId/messages', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const { roomId } = req.params;
                const { page = 1, limit = 50 } = req.query;
                
                const messages = await this.chatService.getChatHistory(
                    roomId,
                    parseInt(page),
                    parseInt(limit)
                );
                
                res.json({
                    success: true,
                    messages,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit)
                    }
                });
            } catch (error) {
                console.error('获取聊天历史失败:', error);
                res.status(500).json({ error: '获取聊天历史失败' });
            }
        });
    }
    
    /**
     * 配置翻译路由
     */
    configureTranslationRoutes() {
        // 文本翻译
        this.app.post('/api/translation/text', [
            this.authenticateToken.bind(this),
            body('text').notEmpty().withMessage('翻译文本不能为空'),
            body('from').notEmpty().withMessage('源语言不能为空'),
            body('to').notEmpty().withMessage('目标语言不能为空')
        ], async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ errors: errors.array() });
                }
                
                const { text, from, to } = req.body;
                
                const translation = await this.translationService.translateText(text, from, to);
                
                // 奖励用户翻译积分
                await this.rewardService.awardTranslationPoints(req.user.userId, 'TEXT_TRANSLATION');
                
                res.json({
                    success: true,
                    original: text,
                    translated: translation.text,
                    from,
                    to,
                    confidence: translation.confidence
                });
            } catch (error) {
                console.error('文本翻译失败:', error);
                res.status(500).json({ error: '翻译失败，请重试' });
            }
        });
        
        // 语音翻译
        this.app.post('/api/translation/voice', [
            this.authenticateToken.bind(this),
            body('audioData').notEmpty().withMessage('音频数据不能为空'),
            body('from').notEmpty().withMessage('源语言不能为空'),
            body('to').notEmpty().withMessage('目标语言不能为空')
        ], async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ errors: errors.array() });
                }
                
                const { audioData, from, to } = req.body;
                
                const result = await this.translationService.translateVoice(audioData, from, to);
                
                // 奖励用户语音翻译积分
                await this.rewardService.awardTranslationPoints(req.user.userId, 'VOICE_TRANSLATION');
                
                res.json({
                    success: true,
                    originalText: result.originalText,
                    translatedText: result.translatedText,
                    translatedAudio: result.translatedAudio,
                    from,
                    to
                });
            } catch (error) {
                console.error('语音翻译失败:', error);
                res.status(500).json({ error: '语音翻译失败，请重试' });
            }
        });
        
        // 获取支持的语言列表
        this.app.get('/api/translation/languages', async (req, res) => {
            try {
                const languages = await this.translationService.getSupportedLanguages();
                res.json({ success: true, languages });
            } catch (error) {
                console.error('获取语言列表失败:', error);
                res.status(500).json({ error: '获取语言列表失败' });
            }
        });
    }
    
    /**
     * 配置奖励路由
     */
    configureRewardRoutes() {
        // 获取用户奖励历史
        this.app.get('/api/rewards/history', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const { page = 1, limit = 20 } = req.query;
                
                const rewards = await this.rewardService.getUserRewards(
                    req.user.userId,
                    parseInt(page),
                    parseInt(limit)
                );
                
                res.json({
                    success: true,
                    rewards,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit)
                    }
                });
            } catch (error) {
                console.error('获取奖励历史失败:', error);
                res.status(500).json({ error: '获取奖励历史失败' });
            }
        });
        
        // 领取每日奖励
        this.app.post('/api/rewards/daily-claim', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const result = await this.rewardService.claimDailyReward(req.user.userId);
                
                if (result.success) {
                    res.json({
                        success: true,
                        reward: result.reward,
                        message: '每日奖励领取成功'
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        message: result.message
                    });
                }
            } catch (error) {
                console.error('领取每日奖励失败:', error);
                res.status(500).json({ error: '领取每日奖励失败' });
            }
        });
        
        // 获取奖励统计
        this.app.get('/api/rewards/stats', this.authenticateToken.bind(this), async (req, res) => {
            try {
                const stats = await this.rewardService.getRewardStats(req.user.userId);
                res.json({ success: true, stats });
            } catch (error) {
                console.error('获取奖励统计失败:', error);
                res.status(500).json({ error: '获取奖励统计失败' });
            }
        });
    }
    
    /**
     * 配置WebSocket
     */
    configureWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('新的WebSocket连接');
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket消息处理失败:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: '消息处理失败'
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log('WebSocket连接关闭');
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket错误:', error);
            });
        });
    }
    
    /**
     * 处理WebSocket消息
     */
    async handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'join_room':
                await this.handleJoinRoom(ws, data);
                break;
            case 'send_message':
                await this.handleSendMessage(ws, data);
                break;
            case 'voice_message':
                await this.handleVoiceMessage(ws, data);
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '未知的消息类型'
                }));
        }
    }
    
    /**
     * 处理加入房间
     */
    async handleJoinRoom(ws, data) {
        const { roomId, token } = data;
        
        try {
            // 验证JWT令牌
            const decoded = jwt.verify(token, this.jwtSecret);
            ws.userId = decoded.userId;
            ws.roomId = roomId;
            
            // 加入聊天室
            await this.chatService.joinRoom(roomId, decoded.userId);
            
            ws.send(JSON.stringify({
                type: 'room_joined',
                roomId,
                message: '成功加入聊天室'
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: '加入聊天室失败'
            }));
        }
    }
    
    /**
     * 处理发送消息
     */
    async handleSendMessage(ws, data) {
        const { roomId, message, language } = data;
        
        try {
            if (!ws.userId || ws.roomId !== roomId) {
                throw new Error('未授权的操作');
            }
            
            // 保存消息
            const savedMessage = await this.chatService.saveMessage({
                roomId,
                userId: ws.userId,
                message,
                language,
                timestamp: new Date()
            });
            
            // 广播消息给房间内的所有用户
            this.broadcastToRoom(roomId, {
                type: 'new_message',
                message: savedMessage
            });
            
            // 奖励用户聊天积分
            await this.rewardService.awardChatPoints(ws.userId);
            
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: '发送消息失败'
            }));
        }
    }
    
    /**
     * 处理语音消息
     */
    async handleVoiceMessage(ws, data) {
        const { roomId, audioData, language } = data;
        
        try {
            if (!ws.userId || ws.roomId !== roomId) {
                throw new Error('未授权的操作');
            }
            
            // 语音转文字
            const transcription = await this.translationService.speechToText(audioData, language);
            
            // 保存语音消息
            const savedMessage = await this.chatService.saveVoiceMessage({
                roomId,
                userId: ws.userId,
                audioData,
                transcription,
                language,
                timestamp: new Date()
            });
            
            // 广播语音消息
            this.broadcastToRoom(roomId, {
                type: 'new_voice_message',
                message: savedMessage
            });
            
            // 奖励用户语音消息积分
            await this.rewardService.awardVoicePoints(ws.userId);
            
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: '发送语音消息失败'
            }));
        }
    }
    
    /**
     * 向房间广播消息
     */
    broadcastToRoom(roomId, message) {
        this.wss.clients.forEach(client => {
            if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * 配置错误处理
     */
    configureErrorHandling() {
        // 404错误处理
        this.app.use((req, res) => {
            res.status(404).json({
                error: '接口不存在',
                path: req.originalUrl,
                method: req.method
            });
        });
        
        // 全局错误处理
        this.app.use((err, req, res, next) => {
            console.error('服务器错误:', err);
            
            res.status(err.status || 500).json({
                error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
                ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
            });
        });
    }
    
    /**
     * 启动服务器
     */
    async start() {
        try {
            // 启动HTTP服务器
            this.server.listen(this.port, '0.0.0.0', () => {
                console.log(`🚀 CultureBridge服务器已启动`);
                console.log(`📍 HTTP服务: http://0.0.0.0:${this.port}`);
                console.log(`🔌 WebSocket服务: ws://0.0.0.0:${this.port}`);
                console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
                console.log(`⛓️ 区块链网络: ${this.blockchainService.currentNetwork}`);
            });
            
            // 优雅关闭处理
            process.on('SIGTERM', this.gracefulShutdown.bind(this));
            process.on('SIGINT', this.gracefulShutdown.bind(this));
            
        } catch (error) {
            console.error('❌ 服务器启动失败:', error);
            process.exit(1);
        }
    }
    
    /**
     * 优雅关闭
     */
    async gracefulShutdown() {
        console.log('🔄 正在关闭服务器...');
        
        // 关闭WebSocket服务器
        this.wss.close();
        
        // 关闭HTTP服务器
        this.server.close(() => {
            console.log('✅ HTTP服务器已关闭');
        });
        
        // 关闭Redis连接
        if (this.redis) {
            await this.redis.quit();
            console.log('✅ Redis连接已关闭');
        }
        
        console.log('👋 服务器已优雅关闭');
        process.exit(0);
    }
}

// 创建并启动服务器
const server = new CultureBridgeServer();
server.start();

module.exports = CultureBridgeServer;

