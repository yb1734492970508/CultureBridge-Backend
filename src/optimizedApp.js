const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

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

// 数据库连接
const connectDB = async () => {
  try {
    const mongoUri = 'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge';
    
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// 连接数据库
connectDB();

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 压缩中间件
app.use(compression());

// CORS配置 - 允许所有来源
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000个请求
  message: {
    error: "请求过于频繁，请稍后再试"
  }
});
app.use(limiter);

// 解析JSON和URL编码数据
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'CultureBridge API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// API状态端点
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'active',
    service: 'CultureBridge API',
    version: '2.0.0',
    features: [
      'Real-time Translation',
      'Cultural Exchange',
      'Voice Chat',
      'Community Features',
      'Language Learning',
      'Blockchain Integration'
    ],
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 用户模型
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String,
    location: String,
    languages: [String],
    interests: [String],
    culturalBackground: String
  },
  preferences: {
    language: {
      type: String,
      default: 'zh'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    privacy: {
      profileVisibility: { type: String, default: 'public' },
      showLocation: { type: Boolean, default: true }
    }
  },
  stats: {
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    connectionsCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// 消息模型
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  originalLanguage: String,
  translatedContent: String,
  targetLanguage: String,
  messageType: {
    type: String,
    enum: ['text', 'voice', 'image', 'file'],
    default: 'text'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model('Message', messageSchema);

// 文化交流帖子模型
const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['culture', 'language', 'travel', 'food', 'tradition', 'festival', 'lifestyle', 'education'],
    required: true
  },
  tags: [String],
  images: [String],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Post = mongoose.model('Post', postSchema);

// 认证路由
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, profile } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已存在'
      });
    }

    // 创建新用户
    const user = new User({
      username,
      email,
      password, // 在实际应用中应该加密
      profile: profile || {}
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 在实际应用中应该验证密码哈希
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // 更新最后登录时间
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
          preferences: user.preferences,
          stats: user.stats
        },
        token: 'mock-jwt-token' // 在实际应用中应该生成真实的JWT
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 用户路由
app.get('/api/users/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('获取用户资料错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.put('/api/users/profile/:id', async (req, res) => {
  try {
    const { profile, preferences } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          profile: { ...profile },
          preferences: { ...preferences },
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      message: '资料更新成功',
      data: { user }
    });
  } catch (error) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 消息路由
app.get('/api/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const messages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
    .populate('sender', 'username profile.avatar')
    .populate('receiver', 'username profile.avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    res.json({
      success: true,
      data: { messages }
    });
  } catch (error) {
    console.error('获取消息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { sender, receiver, content, messageType = 'text' } = req.body;

    const message = new Message({
      sender,
      receiver,
      content,
      messageType
    });

    await message.save();
    await message.populate('sender', 'username profile.avatar');
    await message.populate('receiver', 'username profile.avatar');

    res.status(201).json({
      success: true,
      message: '消息发送成功',
      data: { message }
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 翻译路由
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage = 'auto' } = req.body;

    // 模拟翻译功能（在实际应用中应该集成真实的翻译API）
    const translations = {
      'zh': {
        'Hello': '你好',
        'How are you?': '你好吗？',
        'Thank you': '谢谢',
        'Good morning': '早上好',
        'Good evening': '晚上好'
      },
      'en': {
        '你好': 'Hello',
        '你好吗？': 'How are you?',
        '谢谢': 'Thank you',
        '早上好': 'Good morning',
        '晚上好': 'Good evening'
      }
    };

    const translatedText = translations[targetLanguage]?.[text] || `[翻译] ${text}`;

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence: 0.95
      }
    });
  } catch (error) {
    console.error('翻译错误:', error);
    res.status(500).json({
      success: false,
      message: '翻译服务暂时不可用'
    });
  }
});

// 文化交流帖子路由
app.get('/api/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    
    let query = { isPublished: true };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const posts = await Post.find(query)
      .populate('author', 'username profile.avatar profile.location')
      .populate('comments.user', 'username profile.avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取帖子错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, category, tags, author } = req.body;

    const post = new Post({
      title,
      content,
      category,
      tags: tags || [],
      author
    });

    await post.save();
    await post.populate('author', 'username profile.avatar profile.location');

    res.status(201).json({
      success: true,
      message: '帖子发布成功',
      data: { post }
    });
  } catch (error) {
    console.error('发布帖子错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username profile.avatar profile.location')
      .populate('comments.user', 'username profile.avatar');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '帖子不存在'
      });
    }

    // 增加浏览量
    post.views += 1;
    await post.save();

    res.json({
      success: true,
      data: { post }
    });
  } catch (error) {
    console.error('获取帖子详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 点赞帖子
app.post('/api/posts/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '帖子不存在'
      });
    }

    const existingLike = post.likes.find(like => like.user.toString() === userId);
    
    if (existingLike) {
      // 取消点赞
      post.likes = post.likes.filter(like => like.user.toString() !== userId);
    } else {
      // 添加点赞
      post.likes.push({ user: userId });
    }

    await post.save();

    res.json({
      success: true,
      message: existingLike ? '取消点赞成功' : '点赞成功',
      data: {
        likesCount: post.likes.length,
        isLiked: !existingLike
      }
    });
  } catch (error) {
    console.error('点赞错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 添加评论
app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const { userId, content } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '帖子不存在'
      });
    }

    post.comments.push({
      user: userId,
      content
    });

    await post.save();
    await post.populate('comments.user', 'username profile.avatar');

    res.status(201).json({
      success: true,
      message: '评论添加成功',
      data: {
        comment: post.comments[post.comments.length - 1]
      }
    });
  } catch (error) {
    console.error('添加评论错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 获取统计数据
app.get('/api/stats', async (req, res) => {
  try {
    const userCount = await User.countDocuments({ isActive: true });
    const postCount = await Post.countDocuments({ isPublished: true });
    const messageCount = await Message.countDocuments();

    res.json({
      success: true,
      data: {
        users: userCount,
        posts: postCount,
        messages: messageCount,
        languages: 50,
        countries: 150
      }
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动服务器
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CultureBridge API Server running on port ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/status`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🔄 收到SIGTERM信号，正在优雅关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB连接已关闭');
      process.exit(0);
    });
  });
});

module.exports = app;

