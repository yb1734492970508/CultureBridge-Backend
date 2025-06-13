/**
 * CultureBridge Backend Application
 * 文化桥梁后端应用程序
 * 
 * @author Bin Yi <binyi@culturebridge.com>
 * @version 2.1.0
 * @description 基于区块链的跨文化交流平台后端服务
 *              Blockchain-based cross-cultural communication platform backend service
 */

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const advancedResults = require('./middleware/advancedResults');
const { securityMiddleware } = require('./middleware/security');

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

// 条件导入区块链相关模块
let blockchain = null;
let SocketService = null;

try {
    // 只在非测试环境加载区块链服务
    if (process.env.NODE_ENV !== 'test') {
        blockchain = require('./routes/blockchain');
        SocketService = require('./services/socketService');
    }
} catch (error) {
    console.warn('区块链服务不可用，跳过加载:', error.message);
}

// 加载环境变量
dotenv.config();

// 连接数据库（测试环境跳过）
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// 初始化Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 初始化Socket.IO服务（非测试环境）
let socketService = null;
if (process.env.NODE_ENV !== 'test' && SocketService) {
    try {
        socketService = new SocketService(server);
    } catch (error) {
        console.warn('Socket服务初始化失败:', error.message);
    }
}

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS配置
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// 应用安全中间件
securityMiddleware(app);

// 设置静态文件夹
app.use('/uploads', express.static('uploads'));

// 路由
app.get('/', (req, res) => {
  res.json({
    message: 'CultureBridge API 运行中...',
    version: '2.0.0',
    features: [
      'BNB链区块链集成',
      'CBT代币系统',
      '实时聊天',
      '语音翻译',
      '跨文化交流',
      '语言学习'
    ],
    endpoints: {
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
    }
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    onlineUsers: socketService ? socketService.getOnlineUserCount() : 0,
    environment: process.env.NODE_ENV || 'development'
  });
});

// 挂载路由
app.use('/api/v1/auth', auth);
app.use('/api/v1/chat', chat);
app.use('/api/v1/voice', voice);
app.use('/api/v1/tokens', tokens);
app.use('/api/v1/cultural-exchanges', culturalExchange);
app.use('/api/v1/language-learning', languageLearning);

// 条件挂载区块链路由
if (blockchain) {
    app.use('/api/v1/blockchain', blockchain);
}

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

// 错误处理中间件
app.use(errorHandler);

// 启动服务器（非测试环境）
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 CultureBridge服务器运行在端口 ${PORT}`);
        console.log(`📱 Socket.IO服务${socketService ? '已启动' : '未启动'}`);
        console.log(`🔗 区块链服务${blockchain ? '已集成' : '未集成'}`);
        console.log(`🎤 语音翻译服务已启用`);
        console.log(`💬 实时聊天服务已启用`);
        console.log(`🌍 文化交流功能已启用`);
        console.log(`📚 语言学习功能已启用`);
    });

    // 处理未捕获的异常
    process.on('unhandledRejection', (err, promise) => {
        console.log(`错误: ${err.message}`);
        // 关闭服务器并退出进程
        server.close(() => process.exit(1));
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
        console.log('收到SIGTERM信号，正在优雅关闭...');
        server.close(() => {
            console.log('服务器已关闭');
            process.exit(0);
        });
    });
}

module.exports = { app, server, socketService };

