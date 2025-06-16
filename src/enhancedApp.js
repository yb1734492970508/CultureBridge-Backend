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

// 配置BigInt序列化支持
BigInt.prototype.toJSON = function () {
  return this.toString();
};

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
const tokenRoutes = require("./routes/tokens");
const culturalExchangeRoutes = require("./routes/culturalExchange");
const languageLearningRoutes = require("./routes/languageLearning");

// 导入增强版路由
const blockchainRoutes = require("./routes/blockchain"); // 使用新的区块链路由
const translationRoutes = require("./routes/translation"); // 使用新的翻译路由

// 导入服务
const EnhancedSocketService = require("./services/enhancedSocketService");
const EnhancedBlockchainService = require("./services/enhancedBlockchainService");
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
let blockchainService = null;
let translationService = null;
let voiceTranslationService = null;

if (process.env.NODE_ENV !== "test") {
  try {
    // 初始化区块链服务
    blockchainService = new EnhancedBlockchainService();
    console.log("✅ 增强版区块链服务已初始化");

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
app.use(cors());
app.use(securityMiddleware);
app.use(optionalAuth); // 可选认证，用于公共API

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
app.use("/api/tokens", tokenRoutes);
app.use("/api/cultural-exchange", culturalExchangeRoutes);
app.use("/api/language-learning", languageLearningRoutes);

// 增强版API路由
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/translation", translationRoutes);

// 静态文件服务 (用于上传的文件)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 服务器运行在 ${process.env.NODE_ENV} 模式，端口 ${PORT}`);
  console.log(`🔗 API文档: http://localhost:${PORT}/api-docs`);
});

// 优雅关闭
process.on("SIGTERM", async () => {
  console.log("👋 收到SIGTERM信号，正在关闭服务器...");
  server.close(async () => {
    console.log("✅ HTTP服务器已关闭");
    if (socketService) await socketService.close();
    if (blockchainService) await blockchainService.close();
    if (translationService) await translationService.close();
    if (voiceTranslationService) await voiceTranslationService.close();
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB连接已关闭");
      process.exit(0);
    });
  });
});

module.exports = { app, server };


