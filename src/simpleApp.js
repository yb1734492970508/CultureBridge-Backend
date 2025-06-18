const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");

// 加载环境变量
dotenv.config();

// 初始化Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 中间件
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
}));

// 基础路由
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'CultureBridge API Server',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// API路由
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profiles", require("./routes/profiles"));
app.use("/api/topics", require("./routes/topics"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/resources", require("./routes/resources"));
app.use("/api/events", require("./routes/events"));
app.use("/api/communities", require("./routes/communities"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/voice", require("./routes/voice"));
app.use("/api/cultural-exchange", require("./routes/culturalExchange"));
app.use("/api/language-learning", require("./routes/languageLearning"));
app.use("/api/translation", require("./routes/translation"));

// 静态文件服务
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API路由未找到'
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 启动服务器
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CultureBridge服务器运行在端口 ${PORT}`);
    console.log(`🌐 API地址: http://localhost:${PORT}`);
    console.log(`📱 前端地址: http://localhost:3000`);
});

// 优雅关闭
process.on("SIGTERM", () => {
    console.log("👋 收到SIGTERM信号，正在关闭服务器...");
    server.close(() => {
        console.log("✅ 服务器已关闭");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("👋 收到SIGINT信号，正在关闭服务器...");
    server.close(() => {
        console.log("✅ 服务器已关闭");
        process.exit(0);
    });
});

module.exports = app;

