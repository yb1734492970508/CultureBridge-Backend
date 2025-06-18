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
const authRoutes = require("./routes/enhancedAuth");
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
const pointsRoutes = require("./routes/points"); // 更新为积分系统
const userRoutes = require("./routes/users");

// 导入新的高级功能路由
const aiContentAssistantRoutes = require("./routes/aiContentAssistant");
const communityEnhancedRoutes = require("./routes/communityEnhanced");
const personalizedRecommendationRoutes = require("./routes/personalizedRecommendation");
const professionalServiceRoutes = require("./routes/professionalService");

const app = express();

// 连接数据库
connectDB();

// 安全中间件
securityMiddleware(app);

// CORS配置 - 允许所有来源
app.use(cors({
  origin: true, // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 基础中间件
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 静态文件服务
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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
app.use("/api/points", pointsRoutes); // 积分系统API
app.use("/api/users", userRoutes);

// 高级功能路由
app.use("/api/ai-content-assistant", aiContentAssistantRoutes);
app.use("/api/community-enhanced", communityEnhancedRoutes);
app.use("/api/personalized-recommendation", personalizedRecommendationRoutes);
app.use("/api/professional-service", professionalServiceRoutes);

// 健康检查端点
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "CultureBridge后端服务运行正常",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: {
      pointsSystem: true,
      languageLearning: true,
      culturalExchange: true,
      voiceTranslation: true,
      aiAssistant: true
    }
  });
});

// API状态端点
app.get("/api/status", (req, res) => {
  res.status(200).json({
    status: "active",
    message: "CultureBridge API服务正常运行",
    endpoints: {
      auth: "/api/auth",
      profiles: "/api/profiles",
      chat: "/api/chat",
      points: "/api/points",
      learning: "/api/language-learning",
      translation: "/api/translation"
    },
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `找不到路由: ${req.originalUrl}`
  });
});

// 错误处理中间件
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// 创建HTTP服务器
const server = http.createServer(app);

// Socket.IO配置
const io = require("socket.io")(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO连接处理
io.on("connection", (socket) => {
  console.log(`✅ 用户连接: ${socket.id}`);

  // 加入聊天室
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`👥 用户 ${socket.id} 加入房间: ${roomId}`);
  });

  // 发送消息
  socket.on("send_message", (data) => {
    io.to(data.roomId).emit("receive_message", {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  // 语言学习进度更新
  socket.on("learning_progress", (data) => {
    socket.broadcast.emit("user_progress_update", data);
  });

  // 积分更新通知
  socket.on("points_update", (data) => {
    socket.emit("points_updated", {
      userId: data.userId,
      newPoints: data.points,
      reason: data.reason,
      timestamp: new Date().toISOString()
    });
  });

  // 断开连接
  socket.on("disconnect", () => {
    console.log(`❌ 用户断开连接: ${socket.id}`);
  });
});

// 启动服务器
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 CultureBridge服务器运行在端口 ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`📡 API状态: http://localhost:${PORT}/api/status`);
  console.log(`💬 Socket.IO已启用`);
  console.log(`⭐ 积分系统已激活`);
});

module.exports = app;

