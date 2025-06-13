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

// 导入增强的路由文件
const enhancedBlockchain = require('./routes/enhancedBlockchain');
const enhancedChat = require('./routes/enhancedChat');
const enhancedVoice = require('./routes/enhancedVoice');
const tokens = require('./routes/tokens');

// 导入增强的服务
const EnhancedSocketService = require('./services/enhancedSocketService');

// 加载环境变量
dotenv.config();

// 连接数据库
connectDB();

// 初始化Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 初始化增强的Socket.IO服务
const socketService = new EnhancedSocketService(server);

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
app.use('/audio', express.static('uploads/audio'));

// 主页路由
app.get('/', (req, res) => {
  res.json({
    message: 'CultureBridge API v2.0 运行中...',
    version: '2.0.0',
    features: [
      'BNB链区块链集成',
      'CBT代币系统',
      '增强实时聊天',
      '智能语音翻译',
      '文化交流奖励',
      '跨语言沟通',
      '实时语音识别',
      '文化内容检测'
    ],
    blockchain: {
      network: process.env.NODE_ENV === 'production' ? 'BSC Mainnet' : 'BSC Testnet',
      chainId: process.env.NODE_ENV === 'production' ? 56 : 97,
      token: 'CBT (CultureBridge Token)'
    },
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
      messages: '/api/v1/messages'
    },
    websocket: {
      endpoint: '/socket.io',
      events: [
        'authenticate',
        'chat:join',
        'chat:leave',
        'chat:message',
        'chat:voice',
        'translate:request',
        'culture:suggest',
        'reward:earned'
      ]
    }
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    onlineUsers: socketService.connectedUsers.size,
    activeRooms: socketService.roomMembers.size,
    version: '2.0.0',
    services: {
      database: 'connected',
      blockchain: 'active',
      voice: 'active',
      socket: 'active'
    }
  });
});

// API信息端点
app.get('/api', (req, res) => {
  res.json({
    name: 'CultureBridge API',
    version: '2.0.0',
    description: '基于区块链的跨文化交流平台API',
    documentation: '/api/docs',
    features: {
      blockchain: {
        description: 'BNB链集成，CBT代币奖励系统',
        endpoints: [
          'GET /api/v1/blockchain/balance/:address',
          'GET /api/v1/blockchain/transactions/:address',
          'POST /api/v1/blockchain/award',
          'POST /api/v1/blockchain/transfer'
        ]
      },
      chat: {
        description: '增强实时聊天系统，支持文化交流奖励',
        endpoints: [
          'GET /api/v1/chat/rooms',
          'POST /api/v1/chat/rooms',
          'GET /api/v1/chat/rooms/:id/messages',
          'POST /api/v1/chat/rooms/:id/messages'
        ]
      },
      voice: {
        description: '智能语音翻译，支持多语言实时转换',
        endpoints: [
          'POST /api/v1/voice/transcribe',
          'POST /api/v1/voice/translate',
          'POST /api/v1/voice/synthesize',
          'POST /api/v1/voice/translate-audio'
        ]
      }
    }
  });
});

// 挂载路由
app.use('/api/v1/auth', auth);
app.use('/api/v1/blockchain', enhancedBlockchain);
app.use('/api/v1/chat', enhancedChat);
app.use('/api/v1/voice', enhancedVoice);
app.use('/api/v1/tokens', tokens);
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

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    availableEndpoints: [
      '/api/v1/auth',
      '/api/v1/blockchain',
      '/api/v1/chat',
      '/api/v1/voice',
      '/api/v1/tokens'
    ]
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CultureBridge v2.0 服务器运行在端口 ${PORT}`);
  console.log(`📱 增强Socket.IO服务已启动`);
  console.log(`🔗 BNB链区块链服务已集成`);
  console.log(`🎤 智能语音翻译服务已启用`);
  console.log(`💬 文化交流聊天服务已启用`);
  console.log(`🪙 CBT代币奖励系统已激活`);
  console.log(`🌍 跨文化交流平台已就绪`);
  console.log(`📊 实时指标收集已开始`);
});

// 处理未捕获的异常
process.on('unhandledRejection', (err, promise) => {
  console.log(`错误: ${err.message}`);
  // 关闭服务器并退出进程
  server.close(() => process.exit(1));
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在优雅关闭...');
  
  // 关闭Socket服务
  if (socketService) {
    await socketService.close();
  }
  
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，正在优雅关闭...');
  
  // 关闭Socket服务
  if (socketService) {
    await socketService.close();
  }
  
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

module.exports = { app, server, socketService };

