const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 安全中间件配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// 压缩中间件
app.use(compression());

// 日志中间件
app.use(morgan('combined'));

// API限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 认证相关API限制更严格
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  }
});

// 应用限流中间件
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// CORS配置
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
}));

// 数据清理和安全中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge';

// 连接MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// 用户模型
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '👤' },
  level: { type: String, default: 'Beginner' },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  languagesLearning: [String],
  culturesExplored: { type: Number, default: 0 },
  friendsConnected: { type: Number, default: 0 },
  achievements: [{
    id: Number,
    title: String,
    description: String,
    icon: String,
    progress: Number,
    total: Number,
    unlocked: Boolean
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 文化内容模型
const cultureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  country: { type: String, required: true },
  image: { type: String, default: '🌍' },
  difficulty: { type: String, default: 'Beginner' },
  duration: { type: String, default: '30 min' },
  participants: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Culture = mongoose.model('Culture', cultureSchema);

// 聊天室模型
const chatRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  language: { type: String, required: true },
  members: { type: Number, default: 0 },
  lastMessage: String,
  lastMessageTime: { type: Date, default: Date.now },
  online: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

// 消息模型
const messageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  avatar: { type: String, default: '👤' },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// JWT认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// 输入验证中间件
const validateUserInput = [
  body('name').trim().isLength({ min: 2, max: 50 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6, max: 128 }),
];

const validateMessageInput = [
  body('message').trim().isLength({ min: 1, max: 1000 }).escape(),
];

// 初始化数据库数据
const initializeDatabase = async () => {
  try {
    // 检查是否已有数据
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      // 创建默认用户
      const hashedPassword = await bcrypt.hash('password123', 12);
      const defaultUser = new User({
        id: 'user1',
        name: 'Sarah',
        username: '@sarah_s',
        email: 'sarah@example.com',
        password: hashedPassword,
        avatar: '👩🏻‍🦱',
        level: 'Intermediate',
        points: 2300,
        streak: 15,
        languagesLearning: ['Spanish', 'Japanese', 'French'],
        culturesExplored: 12,
        friendsConnected: 89,
        achievements: [
          {
            id: 1,
            title: "Cultural Explorer",
            description: "Explored 10+ different cultures",
            icon: "🌍",
            progress: 12,
            total: 15,
            unlocked: true
          },
          {
            id: 2,
            title: "Language Master",
            description: "Completed 50 language lessons",
            icon: "🗣️",
            progress: 47,
            total: 50,
            unlocked: false
          }
        ]
      });
      await defaultUser.save();
      console.log('✅ Default user created');
    }

    // 检查文化内容
    const cultureCount = await Culture.countDocuments();
    if (cultureCount === 0) {
      const cultures = [
        {
          title: "Japanese Tea Ceremony",
          description: "Discover the meditative art of Japanese tea preparation and its deep cultural significance.",
          category: "traditions",
          country: "Japan",
          image: "🍵",
          difficulty: "Beginner",
          duration: "45 min",
          participants: 1247
        },
        {
          title: "Spanish Flamenco",
          description: "Experience the passionate rhythms and expressive movements of traditional Spanish dance.",
          category: "arts",
          country: "Spain",
          image: "💃",
          difficulty: "Intermediate",
          duration: "60 min",
          participants: 892
        },
        {
          title: "Nordic Hygge",
          description: "Embrace the Danish philosophy of cozy contentment and simple pleasures.",
          category: "lifestyle",
          country: "Denmark",
          image: "🕯️",
          difficulty: "Beginner",
          duration: "30 min",
          participants: 2156
        }
      ];
      await Culture.insertMany(cultures);
      console.log('✅ Default cultures created');
    }

    // 检查聊天室
    const roomCount = await ChatRoom.countDocuments();
    if (roomCount === 0) {
      const rooms = [
        {
          name: "Spanish Learners",
          language: "🇪🇸",
          members: 1247,
          lastMessage: "¡Hola! ¿Cómo están todos?",
          online: 23
        },
        {
          name: "Japanese Culture",
          language: "🇯🇵",
          members: 892,
          lastMessage: "今日は桜について話しましょう",
          online: 18
        }
      ];
      await ChatRoom.insertMany(rooms);
      console.log('✅ Default chat rooms created');
    }

  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// API 路由

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'CultureBridge Enhanced Backend is running',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// 用户认证API
app.post('/api/auth/register', validateUserInput, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, username } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建新用户
    const user = new User({
      id: `user_${Date.now()}`,
      name,
      email,
      username,
      password: hashedPassword
    });

    await user.save();

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        level: user.level,
        points: user.points
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 用户相关API
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ id: userId }).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    // 确保用户只能更新自己的信息
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 移除敏感字段
    delete updates.password;
    delete updates.email;
    updates.updatedAt = new Date();
    
    const user = await User.findOneAndUpdate(
      { id: userId },
      updates,
      { new: true, select: '-password' }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 积分系统API
app.get('/api/points/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ id: userId }).select('points level streak achievements');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: {
        points: user.points,
        level: user.level,
        streak: user.streak,
        achievements: user.achievements
      }
    });
  } catch (error) {
    console.error('Get points error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/points/:userId/add', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { points, reason } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Invalid points value' });
    }
    
    const user = await User.findOneAndUpdate(
      { id: userId },
      { 
        $inc: { points: points },
        updatedAt: new Date()
      },
      { new: true, select: 'points level streak' }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: {
        points: user.points,
        added: points,
        reason: reason || 'Points added'
      }
    });
  } catch (error) {
    console.error('Add points error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 文化探索API
app.get('/api/cultures', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const cultures = await Culture.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ participants: -1 });
    
    const total = await Culture.countDocuments(query);
    
    res.json({
      success: true,
      data: cultures,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get cultures error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cultures/:cultureId', async (req, res) => {
  try {
    const { cultureId } = req.params;
    const culture = await Culture.findById(cultureId);
    
    if (!culture) {
      return res.status(404).json({ error: 'Culture not found' });
    }
    
    res.json({
      success: true,
      data: culture
    });
  } catch (error) {
    console.error('Get culture error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 语言学习API
app.get('/api/languages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ id: userId }).select('languagesLearning');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const languages = [
      {
        id: 'spanish',
        name: 'Spanish',
        flag: '🇪🇸',
        level: 'Intermediate',
        progress: 68,
        speakers: '500M+',
        difficulty: 'Medium'
      },
      {
        id: 'japanese',
        name: 'Japanese',
        flag: '🇯🇵',
        level: 'Beginner',
        progress: 23,
        speakers: '125M+',
        difficulty: 'Hard'
      },
      {
        id: 'french',
        name: 'French',
        flag: '🇫🇷',
        level: 'Advanced',
        progress: 89,
        speakers: '280M+',
        difficulty: 'Medium'
      }
    ];
    
    res.json({
      success: true,
      data: languages
    });
  } catch (error) {
    console.error('Get languages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 聊天室API
app.get('/api/chat/rooms', async (req, res) => {
  try {
    const rooms = await ChatRoom.find().sort({ lastMessageTime: -1 });
    
    res.json({
      success: true,
      data: rooms
    });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    res.json({
      success: true,
      data: messages.reverse() // 返回时间正序
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/rooms/:roomId/messages', authenticateToken, validateMessageInput, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { roomId } = req.params;
    const { message } = req.body;
    const { userId } = req.user;
    
    const user = await User.findOne({ id: userId }).select('name avatar');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const newMessage = new Message({
      roomId,
      userId,
      userName: user.name,
      avatar: user.avatar,
      message
    });
    
    await newMessage.save();
    
    // 更新聊天室最后消息
    await ChatRoom.findByIdAndUpdate(roomId, {
      lastMessage: message,
      lastMessageTime: new Date()
    });
    
    // 通过Socket.IO广播消息
    io.to(`room_${roomId}`).emit('new_message', newMessage);
    
    res.json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 翻译API (增强版)
app.post("/api/translate/text", async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;

    if (!text || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ 
        error: "Missing required parameters: text, sourceLanguage, targetLanguage" 
      });
    }

    // 这里应该集成真实的翻译API，如Google Translate
    // 目前使用模拟翻译
    const translatedText = `[Translated from ${sourceLanguage} to ${targetLanguage}: ${text}]`;
    
    res.json({
      success: true,
      translatedText,
      sourceLanguage,
      targetLanguage,
      confidence: 0.95
    });
  } catch (error) {
    console.error("Text translation error:", error);
    res.status(500).json({ error: "Failed to translate text" });
  }
});

app.post("/api/translate/mobile-content", async (req, res) => {
  try {
    const { audioContent, sourceLanguage, targetLanguage } = req.body;

    if (!audioContent || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ 
        error: "Missing required parameters: audioContent, sourceLanguage, targetLanguage" 
      });
    }

    // 模拟翻译服务
    const translatedText = `[Translated from ${sourceLanguage} to ${targetLanguage}: ${audioContent}]`;
    
    res.json({
      success: true,
      translatedText,
      sourceLanguage,
      targetLanguage,
      confidence: 0.92
    });
  } catch (error) {
    console.error("Mobile content translation error:", error);
    res.status(500).json({ error: "Failed to translate mobile content" });
  }
});

app.post("/api/translate/external-audio", async (req, res) => {
  try {
    const { audioData, sourceLanguage, targetLanguage } = req.body;

    if (!audioData || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ 
        error: "Missing required parameters: audioData, sourceLanguage, targetLanguage" 
      });
    }

    // 模拟翻译服务
    const translatedText = `[Translated external audio from ${sourceLanguage} to ${targetLanguage}: ${audioData}]`;
    
    res.json({
      success: true,
      translatedText,
      sourceLanguage,
      targetLanguage,
      confidence: 0.88
    });
  } catch (error) {
    console.error("External audio translation error:", error);
    res.status(500).json({ error: "Failed to translate external audio" });
  }
});

// 语音通话匹配API
app.post("/api/call/match", authenticateToken, async (req, res) => {
  try {
    const { language, country } = req.body;
    const { userId } = req.user;

    if (!language || !country) {
      return res.status(400).json({ 
        error: "Missing required parameters: language, country" 
      });
    }

    // 模拟匹配逻辑
    const matchedUser = { 
      id: "matched_user_id", 
      name: "Matched User", 
      language: "en", 
      country: "US" 
    };

    if (matchedUser) {
      res.json({
        success: true,
        matchedUser,
        callId: `call_${Date.now()}_${userId}`
      });
    } else {
      res.status(404).json({ error: "No matching user found" });
    }
  } catch (error) {
    console.error("Call matching error:", error);
    res.status(500).json({ error: "Failed to match for call" });
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // 加入聊天室
  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });
  
  // 离开聊天室
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
    console.log(`User ${socket.id} left room ${roomId}`);
  });
  
  // 发送消息
  socket.on('send_message', async (data) => {
    try {
      const { roomId, userId, message } = data;
      const user = await User.findOne({ id: userId }).select('name avatar');
      
      if (user) {
        const newMessage = new Message({
          roomId,
          userId,
          userName: user.name,
          avatar: user.avatar,
          message
        });
        
        await newMessage.save();
        
        // 更新聊天室最后消息
        await ChatRoom.findByIdAndUpdate(roomId, {
          lastMessage: message,
          lastMessageTime: new Date()
        });
        
        io.to(`room_${roomId}`).emit('new_message', newMessage);
      }
    } catch (error) {
      console.error('Socket message error:', error);
    }
  });

  // 语音通话事件
  socket.on("join_call", (callId) => {
    socket.join(callId);
    console.log(`User ${socket.id} joined call ${callId}`);
    io.to(callId).emit("user_joined_call", socket.id);
  });

  socket.on("send_audio", (data) => {
    const { callId, audioChunk } = data;
    socket.to(callId).emit("receive_audio", audioChunk);
  });

  socket.on("leave_call", (callId) => {
    socket.leave(callId);
    console.log(`User ${socket.id} left call ${callId}`);
    io.to(callId).emit("user_left_call", socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  
  // 根据错误类型返回不同的响应
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.message
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// 初始化数据库并启动服务器
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initializeDatabase();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 CultureBridge Enhanced Backend Server running on port ${PORT}`);
      console.log(`📡 Socket.IO server ready for real-time communication`);
      console.log(`🌍 Server accessible at http://0.0.0.0:${PORT}`);
      console.log(`🔒 Security middleware enabled`);
      console.log(`⚡ API rate limiting active`);
      console.log(`📊 Request logging enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

