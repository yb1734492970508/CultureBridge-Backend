const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/error");
const securityMiddleware = require("./middleware/security");
const { optionalAuth } = require("./middleware/auth");

// 加载环境变量
dotenv.config();

// 全局错误处理
process.on("unhandledRejection", (err, promise) => {
  console.log("❌ 未处理的Promise拒绝:", err.message);
  console.log("🔄 服务器已关闭，正在退出进程...");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.log("❌ 未捕获的异常:", err.message);
  console.log("🔄 服务器已关闭，正在退出进程...");
  process.exit(1);
});

// 导入路由文件
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profiles");
const topicRoutes = require("./routes/topics");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");
const resourceRoutes = require("./routes/resources");
const eventRoutes = require("./routes/events");
const communityRoutes = require("./routes/communities");
const messageRoutes = require("./routes/messages");
const chatRoutes = require("./routes/chat");
const voiceRoutes = require("./routes/voice");
const culturalExchangeRoutes = require("./routes/culturalExchange");
const languageLearningRoutes = require("./routes/languageLearning");
const translationRoutes = require("./routes/translation");
const rewardRoutes = require("./routes/rewards");
const userRoutes = require("./routes/users");

// 导入服务
const EnhancedSocketService = require("./services/enhancedSocketService");
const EnhancedTranslationService = require("./services/enhancedTranslationService");
const EnhancedVoiceTranslationService = require("./services/enhancedVoiceTranslationService");

// 连接数据库（测试环境跳过）
if (process.env.NODE_ENV !== "test") {
  connectDB();
}

// 初始化Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 初始化服务
let socketService = null;
let translationService = null;
let voiceTranslationService = null;

if (process.env.NODE_ENV !== "test") {
  try {
    // 初始化翻译服务
    translationService = new EnhancedTranslationService();
    console.log("✅ 增强版翻译服务已初始化");

    // 初始化语音翻译服务
    voiceTranslationService = new EnhancedVoiceTranslationService();
    console.log("✅ 增强版语音翻译服务已初始化");

    // 初始化Socket.IO服务
    socketService = new EnhancedSocketService(server);
    console.log("✅ 增强版Socket.IO服务已初始化");

  } catch (error) {
    console.error("❌ 服务初始化失败:", error);
    process.exit(1);
  }
}

// 中间件
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// CORS配置 - 允许所有来源
app.use(cors({
  origin: true, // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
}));

// 安全中间件
securityMiddleware(app);

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
  });
});

// API状态端点
app.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CultureBridge API is running',
    version: '2.0.0',
    features: {
      rewards: true,
      translation: true,
      voiceTranslation: true,
      realTimeChat: true,
      culturalExchange: true,
      languageLearning: true,
    },
    timestamp: new Date().toISOString(),
  });
});

// API路由
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/cultural-exchange", culturalExchangeRoutes);
app.use("/api/language-learning", languageLearningRoutes);
app.use("/api/translation", translationRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/users", userRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CultureBridge API v2.0',
    description: '连接世界文化的学习交流平台',
    features: [
      '智能奖励系统',
      '实时翻译服务',
      '语音翻译功能',
      '文化交流社区',
      '语言学习课程',
      '实时聊天通信',
    ],
    documentation: '/api/docs',
    status: '/api/status',
    health: '/health',
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 CultureBridge服务器已启动
📍 端口: ${PORT}
🌍 环境: ${process.env.NODE_ENV || 'development'}
🔗 API地址: http://localhost:${PORT}
📚 API文档: http://localhost:${PORT}/api/docs
💖 让世界因文化交流而更加美好！
    `);
  });
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🔄 收到SIGTERM信号，正在优雅关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 收到SIGINT信号，正在优雅关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

module.exports = app;

