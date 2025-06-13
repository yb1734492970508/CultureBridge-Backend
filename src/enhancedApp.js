const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const advancedResults = require('./middleware/advancedResults');
const { securityMiddleware } = require('./middleware/security');

// 加载环境变量
dotenv.config();

// 导入模型
const User = require('./models/User');
const Profile = require('./models/Profile');
const Topic = require('./models/Topic');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const Resource = require('./models/Resource');
const Event = require('./models/Event');
const Community = require('./models/Community');
const Message = require('./models/Message');
const ChatRoom = require('./models/ChatRoom');
const ChatMessage = require('./models/ChatMessage');
const CulturalExchange = require('./models/CulturalExchange');
const LanguageLearningSession = require('./models/LanguageLearningSession');
const VoiceTranslation = require('./models/VoiceTranslation');

// 导入路由文件
const auth = require('./routes/auth');
const profiles = require('./routes/profiles');
const topics = require('./routes/topics');
const posts = require('./routes/posts');
const comments = require('./routes/comments');
const resources = require('./routes/resources');
const events = require('./routes/events');
const communities = require('./routes/communities');
const messages = require('./routes/messages');
const chat = require('./routes/chat');
const voice = require('./routes/voice');
const tokens = require('./routes/tokens');
const culturalExchange = require('./routes/culturalExchange');
const languageLearning = require('./routes/languageLearning');

// 导入增强版路由
const enhancedAuth = require('./routes/enhancedAuth');
const enhancedBlockchain = require('./routes/enhancedBlockchain');
const enhancedChat = require('./routes/enhancedChat');
const enhancedVoice = require('./routes/enhancedVoice');

// 导入服务
const EnhancedSocketService = require('./services/enhancedSocketService');
const EnhancedBlockchainService = require('./services/enhancedBlockchainService');
const EnhancedVoiceTranslationService = require('./services/enhancedVoiceTranslationService');
const ContractDeploymentService = require('./services/contractDeploymentService');

// 连接数据库（测试环境跳过）
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// 初始化Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 初始化增强版服务
let socketService = null;
let blockchainService = null;
let voiceService = null;
let deploymentService = null;

if (process.env.NODE_ENV !== 'test') {
    try {
        // 初始化区块链服务
        blockchainService = new EnhancedBlockchainService();
        console.log('✅ 增强版区块链服务已初始化');
        
        // 初始化语音翻译服务
        voiceService = new EnhancedVoiceTranslationService();
        console.log('✅ 增强版语音翻译服务已初始化');
        
        // 初始化Socket.IO服务
        socketService = new EnhancedSocketService(server);
        console.log('✅ 增强版Socket.IO服务已初始化');
        
        // 初始化合约部署服务
        deploymentService = new ContractDeploymentService();
        console.log('✅ 合约部署服务已初始化');
        
    } catch (error) {
        console.warn('⚠️ 部分服务初始化失败:', error.message);
    }
}

// 基础中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS配置
app.use(cors({
    origin: function(origin, callback) {
        // 允许的域名列表
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://culturebridge.app',
            'https://app.culturebridge.io'
        ];
        
        // 开发环境允许所有来源
        if (process.env.NODE_ENV === 'development' || !origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('不被CORS策略允许'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400 // 24小时
}));

// 应用安全中间件
securityMiddleware(app);

// 设置静态文件夹
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/temp', express.static(path.join(__dirname, '../temp')));

// 健康检查端点
app.get('/health', async (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
        services: {
            database: true,
            blockchain: false,
            voice: false,
            socket: false,
            deployment: false
        }
    };
    
    // 检查各服务状态
    try {
        if (blockchainService) {
            const blockchainHealth = await blockchainService.healthCheck();
            healthStatus.services.blockchain = Object.values(blockchainHealth).every(status => status);
        }
        
        if (voiceService) {
            const voiceHealth = await voiceService.healthCheck();
            healthStatus.services.voice = Object.values(voiceHealth).every(status => status);
        }
        
        if (socketService) {
            healthStatus.services.socket = true;
            healthStatus.onlineUsers = socketService.getOnlineUserCount();
        }
        
        if (deploymentService) {
            const networkStatus = await deploymentService.getNetworkStatus();
            healthStatus.services.deployment = networkStatus.isConnected;
            healthStatus.network = networkStatus;
        }
        
    } catch (error) {
        console.error('健康检查失败:', error);
    }
    
    res.json(healthStatus);
});

// API信息端点
app.get('/', (req, res) => {
    res.json({
        name: 'CultureBridge API',
        version: '2.0.0',
        description: '跨文化交流平台后端API - 集成区块链和AI技术',
        features: [
            '🔐 增强版用户认证（支持钱包登录）',
            '🪙 CBT代币奖励系统',
            '🎤 AI语音翻译（多语言支持）',
            '💬 实时聊天（支持语音消息）',
            '🌍 文化交流社区',
            '📚 语言学习平台',
            '⛓️ BNB链区块链集成',
            '🎁 智能奖励分发'
        ],
        endpoints: {
            // 增强版API
            enhancedAuth: '/api/v2/auth',
            enhancedBlockchain: '/api/v2/blockchain',
            enhancedChat: '/api/v2/chat',
            enhancedVoice: '/api/v2/voice',
            
            // 标准API
            auth: '/api/v1/auth',
            blockchain: '/api/v1/blockchain',
            chat: '/api/v1/chat',
            voice: '/api/v1/voice',
            tokens: '/api/v1/tokens',
            profiles: '/api/v1/profiles',
            topics: '/api/v1/topics',
            posts: '/api/v1/posts',
            comments: '/api/v1/comments',
            resources: '/api/v1/resources',
            events: '/api/v1/events',
            communities: '/api/v1/communities',
            messages: '/api/v1/messages',
            culturalExchange: '/api/v1/cultural-exchanges',
            languageLearning: '/api/v1/language-learning'
        },
        documentation: '/api/docs',
        status: '/health'
    });
});

// 服务状态端点
app.get('/api/status', async (req, res) => {
    try {
        const status = {
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            services: {}
        };
        
        if (socketService) {
            status.services.socket = socketService.getServiceStatus();
        }
        
        if (blockchainService) {
            status.services.blockchain = await blockchainService.getNetworkStatus();
        }
        
        if (voiceService) {
            status.services.voice = await voiceService.getServiceStats();
        }
        
        if (deploymentService) {
            status.services.deployment = await deploymentService.getDeploymentSummary();
        }
        
        res.json(status);
        
    } catch (error) {
        console.error('获取服务状态失败:', error);
        res.status(500).json({
            success: false,
            error: '获取服务状态失败'
        });
    }
});

// 挂载增强版路由 (v2)
app.use('/api/v2/auth', enhancedAuth);
app.use('/api/v2/blockchain', enhancedBlockchain);
app.use('/api/v2/chat', enhancedChat);
app.use('/api/v2/voice', enhancedVoice);

// 挂载标准路由 (v1)
app.use('/api/v1/auth', auth);
app.use('/api/v1/chat', chat);
app.use('/api/v1/voice', voice);
app.use('/api/v1/tokens', tokens);
app.use('/api/v1/cultural-exchanges', culturalExchange);
app.use('/api/v1/language-learning', languageLearning);

// 条件挂载区块链路由
try {
    const blockchain = require('./routes/blockchain');
    app.use('/api/v1/blockchain', blockchain);
} catch (error) {
    console.warn('⚠️ 标准区块链路由加载失败:', error.message);
}

// 挂载其他路由（带高级结果中间件）
app.use('/api/v1/profiles', advancedResults(Profile, { path: 'user', select: 'username email' }), profiles);
app.use('/api/v1/topics', advancedResults(Topic, { path: 'user', select: 'username' }), topics);
app.use('/api/v1/posts', advancedResults(Post, [
    { path: 'user', select: 'username' },
    { path: 'topic', select: 'title category' }
]), posts);
app.use('/api/v1/topics/:topicId/posts', posts);
app.use('/api/v1/comments', advancedResults(Comment, [
    { path: 'user', select: 'username' },
    { path: 'post', select: 'title' }
]), comments);
app.use('/api/v1/posts/:postId/comments', comments);
app.use('/api/v1/resources', advancedResults(Resource, { path: 'user', select: 'username' }), resources);
app.use('/api/v1/events', advancedResults(Event, { path: 'organizer', select: 'username' }), events);
app.use('/api/v1/communities', advancedResults(Community, { path: 'creator', select: 'username' }), communities);
app.use('/api/v1/messages', messages);

// 管理员路由
app.use('/api/admin', require('./routes/admin'));

// API文档路由（如果存在）
try {
    app.use('/api/docs', require('./routes/docs'));
} catch (error) {
    console.warn('⚠️ API文档路由不可用');
}

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `路由 ${req.originalUrl} 不存在`
    });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器（非测试环境）
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';
    
    server.listen(PORT, HOST, () => {
        console.log('\n🚀 CultureBridge服务器启动成功!');
        console.log(`📍 服务器地址: http://${HOST}:${PORT}`);
        console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📱 Socket.IO: ${socketService ? '✅ 已启用' : '❌ 未启用'}`);
        console.log(`⛓️ 区块链服务: ${blockchainService ? '✅ 已启用' : '❌ 未启用'}`);
        console.log(`🎤 语音翻译: ${voiceService ? '✅ 已启用' : '❌ 未启用'}`);
        console.log(`🔧 合约部署: ${deploymentService ? '✅ 已启用' : '❌ 未启用'}`);
        console.log('\n📚 API文档: http://localhost:' + PORT + '/api/docs');
        console.log('🏥 健康检查: http://localhost:' + PORT + '/health');
        console.log('📊 服务状态: http://localhost:' + PORT + '/api/status');
        console.log('\n🎉 准备接收请求...\n');
    });

    // 处理未捕获的异常
    process.on('unhandledRejection', (err, promise) => {
        console.error(`❌ 未处理的Promise拒绝: ${err.message}`);
        // 关闭服务器并退出进程
        server.close(() => {
            console.log('🔄 服务器已关闭，正在退出进程...');
            process.exit(1);
        });
    });

    process.on('uncaughtException', (err) => {
        console.error(`❌ 未捕获的异常: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
        console.log('📨 收到SIGTERM信号，正在优雅关闭...');
        server.close(() => {
            console.log('✅ HTTP服务器已关闭');
            
            // 关闭数据库连接
            if (process.env.NODE_ENV !== 'test') {
                require('mongoose').connection.close(() => {
                    console.log('✅ 数据库连接已关闭');
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });
    });

    process.on('SIGINT', () => {
        console.log('\n📨 收到SIGINT信号，正在优雅关闭...');
        server.close(() => {
            console.log('✅ 服务器已关闭');
            process.exit(0);
        });
    });
}

// 导出应用和服务实例
module.exports = { 
    app, 
    server, 
    socketService, 
    blockchainService, 
    voiceService, 
    deploymentService 
};

