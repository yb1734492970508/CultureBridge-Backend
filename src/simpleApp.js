const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

// 导入新的API路由
const voiceTranslation = require('./routes/voiceTranslation');

// 导入服务
const ChatService = require('./services/chatService');

// 初始化Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 初始化聊天服务
let chatService = null;
try {
    chatService = new ChatService(server);
    console.log('✅ 实时聊天服务已初始化');
} catch (error) {
    console.warn('⚠️ 聊天服务初始化失败:', error.message);
}

// 基础中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS配置
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true
}));

// 健康检查端点
app.get('/health', async (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
        services: {
            chat: !!chatService,
            voice: true
        }
    };
    
    if (chatService) {
        const chatStats = chatService.getStats();
        healthStatus.chatStats = chatStats;
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
            '🎤 AI语音翻译（多语言支持）',
            '💬 实时聊天（支持语音消息）',
            '🌍 文化交流社区',
            '📚 语言学习平台'
        ],
        endpoints: {
            voiceTranslation: '/api/v2/voice',
            health: '/health',
            status: '/api/status'
        }
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
        
        if (chatService) {
            status.services.chat = chatService.getStats();
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

// 挂载语音翻译路由
app.use('/api/v2/voice', voiceTranslation);

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: '请求的资源不存在'
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('API错误:', error);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CultureBridge后端服务器已启动`);
    console.log(`📡 服务器地址: http://localhost:${PORT}`);
    console.log(`🎤 语音翻译API: http://localhost:${PORT}/api/v2/voice`);
    console.log(`💬 实时聊天: Socket.IO已启用`);
    console.log(`📊 健康检查: http://localhost:${PORT}/health`);
});

// 导出应用和服务实例
module.exports = {
    app,
    server,
    chatService
};

