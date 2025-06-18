const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://culturebridge.app', 'https://www.culturebridge.app']
    : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8082'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 认证相关接口更严格
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// 压缩响应
app.use(compression());

// 日志记录
app.use(morgan('combined'));

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// JWT验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }
    req.user = user;
    next();
  });
};

// 输入验证中间件
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

// 模拟数据库
const mockDatabase = {
  users: [
    {
      id: 1,
      username: '文化探索者',
      email: 'explorer@culturebridge.com',
      password: '$2a$10$example.hash', // 实际应用中应该是加密的密码
      avatar: 'https://picsum.photos/100/100?random=1',
      level: 18,
      exp: 2847,
      nextLevelExp: 3000,
      cbtBalance: 1247.89,
      followers: 1234,
      following: 567,
      posts: 89,
      languages: ['中文', '日语', '法语'],
      achievements: 12,
      streak: 15,
      createdAt: new Date('2024-01-01'),
      lastActive: new Date()
    }
  ],
  posts: [
    {
      id: 1,
      authorId: 1,
      content: '今天在浅草寺体验了传统茶道，感受到了日本文化的深邃之美。每一个动作都蕴含着对自然和生活的敬畏...',
      image: 'https://picsum.photos/300/200?random=10',
      likes: 234,
      comments: 45,
      shares: 12,
      tags: ['茶道', '日本文化', '传统艺术'],
      location: '东京·浅草寺',
      language: 'ja',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3小时前
    }
  ],
  chatRooms: [
    {
      id: 1,
      name: '日语学习交流',
      description: '一起学习日语，分享日本文化',
      avatar: 'https://picsum.photos/50/50?random=4',
      members: 156,
      language: 'ja',
      isPublic: true,
      createdAt: new Date('2024-01-01')
    }
  ],
  messages: [],
  transactions: []
};

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 用户认证
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], validateInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 查找用户
    const user = mockDatabase.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 验证密码（实际应用中应该使用bcrypt比较）
    // const isValidPassword = await bcrypt.compare(password, user.password);
    const isValidPassword = password === 'password123'; // 临时验证

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 生成JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    // 更新最后活跃时间
    user.lastActive = new Date();

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        level: user.level,
        cbtBalance: user.cbtBalance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 用户注册
app.post('/api/auth/register', [
  body('username').isLength({ min: 3, max: 30 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], validateInput, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 检查用户是否已存在
    const existingUser = mockDatabase.users.find(u => 
      u.email === email || u.username === username
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }

    // 创建新用户
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: mockDatabase.users.length + 1,
      username,
      email,
      password: hashedPassword,
      avatar: `https://picsum.photos/100/100?random=${Date.now()}`,
      level: 1,
      exp: 0,
      nextLevelExp: 100,
      cbtBalance: 100, // 新用户奖励
      followers: 0,
      following: 0,
      posts: 0,
      languages: [],
      achievements: 0,
      streak: 0,
      createdAt: new Date(),
      lastActive: new Date()
    };

    mockDatabase.users.push(newUser);

    // 生成JWT
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        username: newUser.username,
        email: newUser.email 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar,
        level: newUser.level,
        cbtBalance: newUser.cbtBalance
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 获取用户信息
app.get('/api/user/profile', authenticateToken, (req, res) => {
  try {
    const user = mockDatabase.users.find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { password, ...userProfile } = user;
    res.json({
      success: true,
      user: userProfile
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 获取帖子列表
app.get('/api/posts', (req, res) => {
  try {
    const { page = 1, limit = 10, language } = req.query;
    const offset = (page - 1) * limit;

    let posts = mockDatabase.posts.map(post => {
      const author = mockDatabase.users.find(u => u.id === post.authorId);
      return {
        ...post,
        author: {
          id: author.id,
          username: author.username,
          avatar: author.avatar
        },
        timeAgo: getTimeAgo(post.createdAt)
      };
    });

    // 语言过滤
    if (language) {
      posts = posts.filter(post => post.language === language);
    }

    // 分页
    const paginatedPosts = posts.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      posts: paginatedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: posts.length,
        pages: Math.ceil(posts.length / limit)
      }
    });
  } catch (error) {
    console.error('Posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 创建帖子
app.post('/api/posts', authenticateToken, [
  body('content').isLength({ min: 1, max: 1000 }).trim(),
  body('tags').optional().isArray(),
  body('language').optional().isLength({ min: 2, max: 5 })
], validateInput, (req, res) => {
  try {
    const { content, image, tags = [], language = 'zh', location } = req.body;

    const newPost = {
      id: mockDatabase.posts.length + 1,
      authorId: req.user.userId,
      content,
      image,
      likes: 0,
      comments: 0,
      shares: 0,
      tags,
      location,
      language,
      createdAt: new Date()
    };

    mockDatabase.posts.unshift(newPost);

    // 更新用户帖子数量
    const user = mockDatabase.users.find(u => u.id === req.user.userId);
    if (user) {
      user.posts += 1;
      user.exp += 10; // 发帖奖励经验
    }

    res.status(201).json({
      success: true,
      post: newPost
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 点赞帖子
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = mockDatabase.posts.find(p => p.id === postId);

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }

    post.likes += 1;

    res.json({
      success: true,
      likes: post.likes
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 获取聊天室列表
app.get('/api/chat/rooms', (req, res) => {
  try {
    const rooms = mockDatabase.chatRooms.map(room => ({
      ...room,
      lastMessage: 'Welcome to the chat room!',
      lastTime: getTimeAgo(room.createdAt)
    }));

    res.json({
      success: true,
      rooms
    });
  } catch (error) {
    console.error('Chat rooms error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// CBT代币转账
app.post('/api/wallet/transfer', authenticateToken, [
  body('toUserId').isInt({ min: 1 }),
  body('amount').isFloat({ min: 0.01 }),
  body('memo').optional().isLength({ max: 200 })
], validateInput, (req, res) => {
  try {
    const { toUserId, amount, memo } = req.body;
    const fromUser = mockDatabase.users.find(u => u.id === req.user.userId);
    const toUser = mockDatabase.users.find(u => u.id === toUserId);

    if (!fromUser || !toUser) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (fromUser.cbtBalance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    // 执行转账
    fromUser.cbtBalance -= amount;
    toUser.cbtBalance += amount;

    // 记录交易
    const transaction = {
      id: mockDatabase.transactions.length + 1,
      fromUserId: fromUser.id,
      toUserId: toUser.id,
      amount,
      memo,
      type: 'transfer',
      status: 'completed',
      createdAt: new Date()
    };

    mockDatabase.transactions.push(transaction);

    res.json({
      success: true,
      transaction,
      newBalance: fromUser.cbtBalance
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 翻译API
app.post('/api/translate', authenticateToken, [
  body('text').isLength({ min: 1, max: 1000 }),
  body('from').isLength({ min: 2, max: 5 }),
  body('to').isLength({ min: 2, max: 5 })
], validateInput, (req, res) => {
  try {
    const { text, from, to } = req.body;

    // 模拟翻译（实际应用中应该调用真实的翻译API）
    const translations = {
      'zh-ja': {
        '你好': 'こんにちは',
        '谢谢': 'ありがとう',
        '再见': 'さようなら'
      },
      'zh-fr': {
        '你好': 'Bonjour',
        '谢谢': 'Merci',
        '再见': 'Au revoir'
      }
    };

    const translationKey = `${from}-${to}`;
    const translatedText = translations[translationKey]?.[text] || 
      `[Translated from ${from} to ${to}] ${text}`;

    // 奖励翻译经验
    const user = mockDatabase.users.find(u => u.id === req.user.userId);
    if (user) {
      user.exp += 2;
    }

    res.json({
      success: true,
      translation: {
        originalText: text,
        translatedText,
        from,
        to,
        confidence: 0.95
      }
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// WebSocket服务器
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // 广播消息给所有连接的客户端
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'message',
            data: {
              ...data,
              timestamp: new Date().toISOString()
            }
          }));
        }
      });
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to CultureBridge chat server'
  }));
});

// 工具函数
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return '刚刚';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
  return `${Math.floor(diffInSeconds / 86400)}天前`;
}

// 启动服务器
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CultureBridge API Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
  console.log(`💬 WebSocket: Chat server ready`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;

