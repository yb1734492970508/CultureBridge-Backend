# CultureBridge 性能优化指南

## 数据库优化

### 索引策略

#### 用户相关索引
```javascript
// User集合
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })
db.users.createIndex({ "walletAddress": 1 }, { unique: true, sparse: true })
db.users.createIndex({ "createdAt": -1 })

// Profile集合
db.profiles.createIndex({ "user": 1 }, { unique: true })
db.profiles.createIndex({ "country": 1, "city": 1 })
```

#### 聊天相关索引
```javascript
// ChatRoom集合
db.chatrooms.createIndex({ "type": 1, "languages": 1 })
db.chatrooms.createIndex({ "creator": 1 })
db.chatrooms.createIndex({ "members.user": 1 })
db.chatrooms.createIndex({ "isActive": 1, "createdAt": -1 })

// ChatMessage集合
db.chatmessages.createIndex({ "chatRoom": 1, "createdAt": -1 })
db.chatmessages.createIndex({ "sender": 1, "createdAt": -1 })
db.chatmessages.createIndex({ "isDeleted": 1 })
db.chatmessages.createIndex({ "messageType": 1 })
```

#### 代币相关索引
```javascript
// TokenTransaction集合
db.tokentransactions.createIndex({ "transactionHash": 1 }, { unique: true })
db.tokentransactions.createIndex({ "from": 1, "createdAt": -1 })
db.tokentransactions.createIndex({ "to": 1, "createdAt": -1 })
db.tokentransactions.createIndex({ "type": 1, "status": 1 })
db.tokentransactions.createIndex({ "relatedUser": 1, "createdAt": -1 })
db.tokentransactions.createIndex({ "category": 1, "createdAt": -1 })
```

#### 学习相关索引
```javascript
// LanguageLearningProgress集合
db.languagelearningprogresses.createIndex({ "user": 1, "language": 1 }, { unique: true })
db.languagelearningprogresses.createIndex({ "user": 1 })
db.languagelearningprogresses.createIndex({ "language": 1 })
db.languagelearningprogresses.createIndex({ "updatedAt": -1 })

// VoiceTranslation集合
db.voicetranslations.createIndex({ "user": 1, "createdAt": -1 })
db.voicetranslations.createIndex({ "chatRoom": 1, "createdAt": -1 })
db.voicetranslations.createIndex({ "processingStatus": 1 })
```

### 查询优化

#### 分页查询优化
```javascript
// 使用skip和limit进行分页
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;

// 对于大数据集，使用基于游标的分页
const lastId = req.query.lastId;
const query = lastId ? { _id: { $gt: lastId } } : {};
const results = await Model.find(query).limit(limit).sort({ _id: 1 });
```

#### 聚合查询优化
```javascript
// 使用聚合管道进行复杂查询
const stats = await TokenTransaction.aggregate([
    { $match: { relatedUser: userId, status: 'confirmed' } },
    { $group: { 
        _id: '$category', 
        total: { $sum: '$amount' },
        count: { $sum: 1 }
    }},
    { $sort: { total: -1 } }
]);
```

## 缓存策略

### Redis缓存实现
```javascript
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// 缓存用户信息
const cacheUser = async (userId, userData) => {
    await client.setex(`user:${userId}`, 3600, JSON.stringify(userData));
};

// 获取缓存的用户信息
const getCachedUser = async (userId) => {
    const cached = await client.get(`user:${userId}`);
    return cached ? JSON.parse(cached) : null;
};

// 缓存聊天室成员列表
const cacheRoomMembers = async (roomId, members) => {
    await client.setex(`room:${roomId}:members`, 1800, JSON.stringify(members));
};
```

### 应用层缓存
```javascript
// 内存缓存热点数据
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10分钟过期

// 缓存语言列表
const getSupportedLanguages = () => {
    const cacheKey = 'supported_languages';
    let languages = cache.get(cacheKey);
    
    if (!languages) {
        languages = {
            'zh': { name: '中文', voice: 'zh-CN-Wavenet-A' },
            'en': { name: 'English', voice: 'en-US-Wavenet-D' },
            // ... 其他语言
        };
        cache.set(cacheKey, languages);
    }
    
    return languages;
};
```

## API性能优化

### 响应压缩
```javascript
const compression = require('compression');

// 启用Gzip压缩
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024
}));
```

### 字段选择优化
```javascript
// 只返回必要的字段
const getUsers = async (req, res) => {
    const users = await User.find()
        .select('username email createdAt')
        .populate('profile', 'firstName lastName avatar');
    
    res.json({ success: true, data: users });
};
```

### 批量操作优化
```javascript
// 批量插入消息
const insertMessages = async (messages) => {
    return await ChatMessage.insertMany(messages, { ordered: false });
};

// 批量更新用户状态
const updateUserStatuses = async (userIds, status) => {
    return await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { lastActive: new Date(), status } }
    );
};
```

## Socket.IO性能优化

### 连接管理优化
```javascript
// 使用Redis适配器进行横向扩展
const redisAdapter = require('socket.io-redis');
io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

// 连接池管理
const connectionPool = new Map();

io.on('connection', (socket) => {
    // 限制每个用户的连接数
    const userId = socket.userId;
    if (connectionPool.has(userId)) {
        const connections = connectionPool.get(userId);
        if (connections.length >= 3) {
            socket.emit('error', { message: '连接数超限' });
            socket.disconnect();
            return;
        }
        connections.push(socket.id);
    } else {
        connectionPool.set(userId, [socket.id]);
    }
});
```

### 消息队列优化
```javascript
// 使用消息队列处理高并发消息
const Queue = require('bull');
const messageQueue = new Queue('message processing', process.env.REDIS_URL);

// 处理消息任务
messageQueue.process('sendMessage', async (job) => {
    const { roomId, message, senderId } = job.data;
    
    // 保存消息到数据库
    const savedMessage = await ChatMessage.create({
        chatRoom: roomId,
        sender: senderId,
        content: message.content,
        messageType: message.type
    });
    
    // 广播消息
    io.to(roomId).emit('message', savedMessage);
});

// 添加消息到队列
const queueMessage = (roomId, message, senderId) => {
    messageQueue.add('sendMessage', { roomId, message, senderId });
};
```

## 文件上传优化

### 多媒体文件处理
```javascript
const multer = require('multer');
const path = require('path');

// 配置文件存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads', file.fieldname);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    const allowedTypes = {
        'voice': ['audio/webm', 'audio/wav', 'audio/mp3'],
        'image': ['image/jpeg', 'image/png', 'image/gif'],
        'document': ['application/pdf', 'text/plain']
    };
    
    const fieldAllowedTypes = allowedTypes[file.fieldname] || [];
    if (fieldAllowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5
    }
});
```

## 监控和日志

### 性能监控
```javascript
const prometheus = require('prom-client');

// 创建指标
const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP请求持续时间',
    labelNames: ['method', 'route', 'status']
});

const activeConnections = new prometheus.Gauge({
    name: 'websocket_active_connections',
    help: '活跃WebSocket连接数'
});

// 中间件记录请求时间
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration
            .labels(req.method, req.route?.path || req.path, res.statusCode)
            .observe(duration);
    });
    
    next();
});
```

### 结构化日志
```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// 使用结构化日志
logger.info('用户登录', {
    userId: user.id,
    username: user.username,
    ip: req.ip,
    userAgent: req.get('User-Agent')
});
```

## 安全性优化

### 输入验证和清理
```javascript
const validator = require('express-validator');

// 验证规则
const messageValidation = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 2000 })
        .withMessage('消息内容长度必须在1-2000字符之间'),
    body('messageType')
        .isIn(['text', 'voice', 'image', 'file'])
        .withMessage('无效的消息类型')
];

// 验证中间件
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};
```

### 敏感数据保护
```javascript
const crypto = require('crypto');

// 加密敏感数据
const encrypt = (text) => {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('additional data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
};

// 解密敏感数据
const decrypt = (encryptedData) => {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('additional data'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};
```

这些优化措施将显著提升CultureBridge后端系统的性能、安全性和可维护性。

