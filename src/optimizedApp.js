const cluster = require('cluster');
const os = require('os');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

// 性能监控
const performanceMonitor = require('./middleware/performanceMonitor');
const memoryMonitor = require('./middleware/memoryMonitor');
const healthCheck = require('./middleware/healthCheck');

// 数据库连接优化
const connectDB = require('./config/optimizedDb');
const redisClient = require('./config/redis');

// 中间件
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

// 导入优化的路由文件
const optimizedBlockchain = require('./routes/optimizedBlockchain');
const optimizedChat = require('./routes/optimizedChat');
const optimizedVoice = require('./routes/optimizedVoice');
const tokens = require('./routes/tokens');

// 导入优化的服务
const OptimizedSocketService = require('./services/optimizedSocketService');

// 加载环境变量
dotenv.config();

// 集群模式支持
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
    const numCPUs = os.cpus().length;
    console.log(`🚀 Master process ${process.pid} is running`);
    console.log(`🔄 Forking ${numCPUs} workers...`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`💀 Worker ${worker.process.pid} died`);
        console.log('🔄 Starting a new worker...');
        cluster.fork();
    });
} else {
    startServer();
}

async function startServer() {
    try {
        // 连接数据库
        await connectDB();
        
        // 初始化Redis
        await redisClient.connect();
        
        // 初始化Express应用
        const app = express();
        
        // 创建HTTP服务器
        const server = http.createServer(app);
        
        // 初始化优化的Socket.IO服务
        const socketService = new OptimizedSocketService(server);
        
        // 性能监控中间件
        app.use(performanceMonitor);
        app.use(memoryMonitor);
        
        // 安全中间件
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                }
            },
            crossOriginEmbedderPolicy: false
        }));
        
        // 压缩中间件
        app.use(compression({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        }));
        
        // 速率限制
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15分钟
            max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 限制每个IP的请求数
            message: {
                error: 'Too many requests from this IP, please try again later.',
                message: '请求过于频繁，请稍后再试'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                // 跳过健康检查和静态资源
                return req.path === '/health' || req.path.startsWith('/uploads');
            }
        });
        app.use('/api/', limiter);
        
        // 基础中间件
        app.use(express.json({ 
            limit: '10mb',
            verify: (req, res, buf) => {
                req.rawBody = buf;
            }
        }));
        app.use(express.urlencoded({ 
            extended: true, 
            limit: '10mb' 
        }));
        
        // CORS配置
        app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://culturebridge.app', 'https://www.culturebridge.app']
                : "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
            credentials: true,
            maxAge: 86400 // 24小时
        }));
        
        // 数据清理中间件
        app.use(mongoSanitize());
        app.use(xss());
        app.use(hpp({
            whitelist: ['sort', 'fields', 'page', 'limit', 'language', 'category']
        }));
        
        // 应用安全中间件
        securityMiddleware(app);
        
        // 设置静态文件夹（带缓存）
        app.use('/uploads', express.static('uploads', {
            maxAge: '1d',
            etag: true,
            lastModified: true
        }));
        app.use('/audio', express.static('uploads/audio', {
            maxAge: '1h',
            etag: true,
            lastModified: true
        }));
        
        // 健康检查端点
        app.use('/health', healthCheck);
        
        // 主页路由
        app.get('/', (req, res) => {
            res.json({
                message: 'CultureBridge API v2.1 运行中... / CultureBridge API v2.1 Running...',
                version: '2.1.0',
                status: 'optimized',
                features: [
                    'BNB链区块链集成 / BNB Chain Blockchain Integration',
                    'CBT代币系统 / CBT Token System',
                    '增强实时聊天 / Enhanced Real-time Chat',
                    '智能语音翻译 / Intelligent Voice Translation',
                    '文化交流奖励 / Cultural Exchange Rewards',
                    '跨语言沟通 / Cross-language Communication',
                    '实时语音识别 / Real-time Speech Recognition',
                    '文化内容检测 / Cultural Content Detection',
                    '性能优化 / Performance Optimization',
                    '集群支持 / Cluster Support'
                ],
                blockchain: {
                    network: process.env.NODE_ENV === 'production' ? 'BSC Mainnet' : 'BSC Testnet',
                    chainId: process.env.NODE_ENV === 'production' ? 56 : 97,
                    token: 'CBT (CultureBridge Token)'
                },
                performance: {
                    cluster: cluster.isWorker ? `Worker ${process.pid}` : 'Single Process',
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
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
        
        // API信息端点
        app.get('/api', (req, res) => {
            res.json({
                name: 'CultureBridge API',
                version: '2.1.0',
                description: '基于区块链的跨文化交流平台API / Blockchain-based Cross-cultural Communication Platform API',
                documentation: '/api/docs',
                performance: {
                    optimized: true,
                    cluster: cluster.isWorker,
                    compression: true,
                    caching: true,
                    rateLimit: true
                },
                features: {
                    blockchain: {
                        description: 'BNB链集成，CBT代币奖励系统 / BNB Chain Integration, CBT Token Reward System',
                        endpoints: [
                            'GET /api/v1/blockchain/balance/:address',
                            'GET /api/v1/blockchain/transactions/:address',
                            'POST /api/v1/blockchain/award',
                            'POST /api/v1/blockchain/transfer'
                        ]
                    },
                    chat: {
                        description: '增强实时聊天系统，支持文化交流奖励 / Enhanced Real-time Chat System with Cultural Exchange Rewards',
                        endpoints: [
                            'GET /api/v1/chat/rooms',
                            'POST /api/v1/chat/rooms',
                            'GET /api/v1/chat/rooms/:id/messages',
                            'POST /api/v1/chat/rooms/:id/messages'
                        ]
                    },
                    voice: {
                        description: '智能语音翻译，支持多语言实时转换 / Intelligent Voice Translation with Multi-language Real-time Conversion',
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
        app.use('/api/v1/blockchain', optimizedBlockchain);
        app.use('/api/v1/chat', optimizedChat);
        app.use('/api/v1/voice', optimizedVoice);
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
                message: '接口不存在 / Endpoint not found',
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
            console.log(`🚀 CultureBridge v2.1 服务器运行在端口 ${PORT} (Worker ${process.pid})`);
            console.log(`📱 优化Socket.IO服务已启动`);
            console.log(`🔗 BNB链区块链服务已集成`);
            console.log(`🎤 智能语音翻译服务已启用`);
            console.log(`💬 文化交流聊天服务已启用`);
            console.log(`🪙 CBT代币奖励系统已激活`);
            console.log(`🌍 跨文化交流平台已就绪`);
            console.log(`📊 性能监控已开始`);
            console.log(`⚡ 性能优化已启用`);
            console.log(`🔒 安全防护已加强`);
        });
        
        // 优雅关闭
        const gracefulShutdown = async (signal) => {
            console.log(`收到${signal}信号，正在优雅关闭...`);
            
            // 停止接受新连接
            server.close(async () => {
                console.log('HTTP服务器已关闭');
                
                try {
                    // 关闭Socket服务
                    if (socketService) {
                        await socketService.close();
                        console.log('Socket.IO服务已关闭');
                    }
                    
                    // 关闭Redis连接
                    if (redisClient) {
                        await redisClient.quit();
                        console.log('Redis连接已关闭');
                    }
                    
                    // 关闭数据库连接
                    const mongoose = require('mongoose');
                    await mongoose.connection.close();
                    console.log('数据库连接已关闭');
                    
                    console.log('优雅关闭完成');
                    process.exit(0);
                } catch (error) {
                    console.error('关闭过程中发生错误:', error);
                    process.exit(1);
                }
            });
            
            // 强制关闭超时
            setTimeout(() => {
                console.error('强制关闭超时，立即退出');
                process.exit(1);
            }, 30000);
        };
        
        // 处理未捕获的异常
        process.on('unhandledRejection', (err, promise) => {
            console.log(`错误: ${err.message}`);
            gracefulShutdown('unhandledRejection');
        });
        
        process.on('uncaughtException', (err) => {
            console.log(`未捕获的异常: ${err.message}`);
            gracefulShutdown('uncaughtException');
        });
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // 导出应用实例
        module.exports = { app, server, socketService };
        
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

