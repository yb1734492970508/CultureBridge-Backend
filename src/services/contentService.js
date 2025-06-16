const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

// 内容模型
const ContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  author: {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    avatar: String
  },
  type: {
    type: String,
    enum: ['post', 'article', 'experience', 'workshop', 'tutorial'],
    default: 'post'
  },
  category: {
    type: String,
    enum: ['culture', 'language', 'food', 'travel', 'art', 'music', 'tradition', 'festival'],
    required: true
  },
  language: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio']
    },
    url: String,
    caption: String
  }],
  location: {
    country: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  duration: Number, // 分钟
  price: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'CBT'
    }
  },
  interactions: {
    likes: [{
      userId: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      userId: String,
      username: String,
      avatar: String,
      content: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      replies: [{
        userId: String,
        username: String,
        content: String,
        timestamp: {
          type: Date,
          default: Date.now
        }
      }]
    }],
    shares: [{
      userId: String,
      platform: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    bookmarks: [{
      userId: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    bookmarks: {
      type: Number,
      default: 0
    },
    rating: {
      average: {
        type: Number,
        default: 0
      },
      count: {
        type: Number,
        default: 0
      }
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'reported'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  monetization: {
    enabled: {
      type: Boolean,
      default: false
    },
    earnings: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// 添加索引
ContentSchema.index({ category: 1, language: 1 });
ContentSchema.index({ 'author.userId': 1 });
ContentSchema.index({ tags: 1 });
ContentSchema.index({ createdAt: -1 });
ContentSchema.index({ 'stats.views': -1 });
ContentSchema.index({ 'stats.likes': -1 });

const Content = mongoose.model('Content', ContentSchema);

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/content');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

class ContentService {
  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // 获取内容列表
    this.router.get('/', this.getContents.bind(this));
    
    // 获取单个内容
    this.router.get('/:id', this.getContent.bind(this));
    
    // 创建内容
    this.router.post('/', 
      upload.array('media', 5),
      [
        body('title').notEmpty().withMessage('标题不能为空'),
        body('content').notEmpty().withMessage('内容不能为空'),
        body('category').isIn(['culture', 'language', 'food', 'travel', 'art', 'music', 'tradition', 'festival']).withMessage('无效的分类'),
        body('language').notEmpty().withMessage('语言不能为空')
      ],
      this.createContent.bind(this)
    );
    
    // 更新内容
    this.router.put('/:id', 
      upload.array('media', 5),
      this.updateContent.bind(this)
    );
    
    // 删除内容
    this.router.delete('/:id', this.deleteContent.bind(this));
    
    // 点赞/取消点赞
    this.router.post('/:id/like', this.toggleLike.bind(this));
    
    // 添加评论
    this.router.post('/:id/comment', 
      [body('content').notEmpty().withMessage('评论内容不能为空')],
      this.addComment.bind(this)
    );
    
    // 删除评论
    this.router.delete('/:id/comment/:commentId', this.deleteComment.bind(this));
    
    // 分享内容
    this.router.post('/:id/share', this.shareContent.bind(this));
    
    // 收藏/取消收藏
    this.router.post('/:id/bookmark', this.toggleBookmark.bind(this));
    
    // 评分
    this.router.post('/:id/rate', 
      [body('rating').isInt({ min: 1, max: 5 }).withMessage('评分必须在1-5之间')],
      this.rateContent.bind(this)
    );
    
    // 获取推荐内容
    this.router.get('/recommendations/:userId', this.getRecommendations.bind(this));
    
    // 获取热门内容
    this.router.get('/trending/all', this.getTrendingContents.bind(this));
    
    // 搜索内容
    this.router.get('/search/query', this.searchContents.bind(this));
  }

  // 获取内容列表
  async getContents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        language,
        type,
        author,
        tags,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filter = { status: 'published' };
      
      if (category) filter.category = category;
      if (language) filter.language = language;
      if (type) filter.type = type;
      if (author) filter['author.userId'] = author;
      if (tags) filter.tags = { $in: tags.split(',') };

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const contents = await Content.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await Content.countDocuments(filter);

      res.json({
        contents,
        pagination: {
          current: parseInt(page),
          pageSize: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('获取内容列表失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 获取单个内容
  async getContent(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      const content = await Content.findById(id);
      if (!content) {
        return res.status(404).json({ error: '内容不存在' });
      }

      // 增加浏览量
      await Content.findByIdAndUpdate(id, { $inc: { 'stats.views': 1 } });

      // 检查用户是否已点赞、收藏等
      const userInteractions = {
        liked: userId ? content.interactions.likes.some(like => like.userId === userId) : false,
        bookmarked: userId ? content.interactions.bookmarks.some(bookmark => bookmark.userId === userId) : false
      };

      res.json({
        ...content.toObject(),
        userInteractions
      });
    } catch (error) {
      console.error('获取内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 创建内容
  async createContent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        content,
        type = 'post',
        category,
        language,
        tags = [],
        location,
        difficulty = 'beginner',
        duration,
        price = { amount: 0, currency: 'CBT' }
      } = req.body;

      // 处理上传的媒体文件
      const media = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          const mediaType = file.mimetype.startsWith('image/') ? 'image' :
                           file.mimetype.startsWith('video/') ? 'video' : 'audio';
          
          media.push({
            type: mediaType,
            url: `/uploads/content/${file.filename}`,
            caption: ''
          });
        });
      }

      // 从请求中获取用户信息（通常来自JWT token）
      const author = {
        userId: req.user?.id || 'anonymous',
        username: req.user?.username || '匿名用户',
        avatar: req.user?.avatar || ''
      };

      const newContent = new Content({
        title,
        content,
        author,
        type,
        category,
        language,
        tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
        media,
        location: location ? JSON.parse(location) : undefined,
        difficulty,
        duration: duration ? parseInt(duration) : undefined,
        price: typeof price === 'string' ? JSON.parse(price) : price,
        status: 'published'
      });

      const savedContent = await newContent.save();
      
      res.status(201).json(savedContent);
    } catch (error) {
      console.error('创建内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 更新内容
  async updateContent(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // 检查内容是否存在且用户有权限编辑
      const content = await Content.findById(id);
      if (!content) {
        return res.status(404).json({ error: '内容不存在' });
      }

      if (content.author.userId !== req.user?.id) {
        return res.status(403).json({ error: '无权限编辑此内容' });
      }

      // 处理新上传的媒体文件
      if (req.files && req.files.length > 0) {
        const newMedia = req.files.map(file => ({
          type: file.mimetype.startsWith('image/') ? 'image' :
                file.mimetype.startsWith('video/') ? 'video' : 'audio',
          url: `/uploads/content/${file.filename}`,
          caption: ''
        }));
        
        updates.media = [...(content.media || []), ...newMedia];
      }

      const updatedContent = await Content.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );

      res.json(updatedContent);
    } catch (error) {
      console.error('更新内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 删除内容
  async deleteContent(req, res) {
    try {
      const { id } = req.params;

      const content = await Content.findById(id);
      if (!content) {
        return res.status(404).json({ error: '内容不存在' });
      }

      if (content.author.userId !== req.user?.id) {
        return res.status(403).json({ error: '无权限删除此内容' });
      }

      await Content.findByIdAndDelete(id);
      res.json({ message: '内容已删除' });
    } catch (error) {
      console.error('删除内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 点赞/取消点赞
  async toggleLike(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '请先登录' });
      }

      const content = await Content.findById(id);
      if (!content) {
        return res.status(404).json({ error: '内容不存在' });
      }

      const existingLike = content.interactions.likes.find(like => like.userId === userId);
      
      if (existingLike) {
        // 取消点赞
        content.interactions.likes = content.interactions.likes.filter(like => like.userId !== userId);
        content.stats.likes = Math.max(0, content.stats.likes - 1);
      } else {
        // 添加点赞
        content.interactions.likes.push({ userId, timestamp: new Date() });
        content.stats.likes += 1;
      }

      await content.save();
      res.json({ liked: !existingLike, likes: content.stats.likes });
    } catch (error) {
      console.error('点赞操作失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 添加评论
  async addComment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { content: commentContent } = req.body;
      const userId = req.user?.id;
      const username = req.user?.username;
      const avatar = req.user?.avatar;

      if (!userId) {
        return res.status(401).json({ error: '请先登录' });
      }

      const content = await Content.findById(id);
      if (!content) {
        return res.status(404).json({ error: '内容不存在' });
      }

      const newComment = {
        userId,
        username,
        avatar,
        content: commentContent,
        timestamp: new Date(),
        replies: []
      };

      content.interactions.comments.push(newComment);
      content.stats.comments += 1;

      await content.save();
      res.status(201).json(newComment);
    } catch (error) {
      console.error('添加评论失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 获取推荐内容
  async getRecommendations(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 10 } = req.query;

      // 简单的推荐算法：基于用户历史互动和热门内容
      const recommendations = await Content.find({ 
        status: 'published',
        'author.userId': { $ne: userId }
      })
        .sort({ 'stats.views': -1, 'stats.likes': -1 })
        .limit(parseInt(limit))
        .exec();

      res.json(recommendations);
    } catch (error) {
      console.error('获取推荐内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 获取热门内容
  async getTrendingContents(req, res) {
    try {
      const { limit = 20, timeframe = '7d' } = req.query;
      
      // 计算时间范围
      const now = new Date();
      const timeframeMs = timeframe === '1d' ? 24 * 60 * 60 * 1000 :
                         timeframe === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                         30 * 24 * 60 * 60 * 1000; // 30d
      
      const startDate = new Date(now.getTime() - timeframeMs);

      const trending = await Content.find({
        status: 'published',
        createdAt: { $gte: startDate }
      })
        .sort({ 
          'stats.views': -1, 
          'stats.likes': -1, 
          'stats.comments': -1 
        })
        .limit(parseInt(limit))
        .exec();

      res.json(trending);
    } catch (error) {
      console.error('获取热门内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }

  // 搜索内容
  async searchContents(req, res) {
    try {
      const { 
        q, 
        category, 
        language, 
        type,
        page = 1, 
        limit = 20 
      } = req.query;

      if (!q) {
        return res.status(400).json({ error: '搜索关键词不能为空' });
      }

      const filter = {
        status: 'published',
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { content: { $regex: q, $options: 'i' } },
          { tags: { $regex: q, $options: 'i' } }
        ]
      };

      if (category) filter.category = category;
      if (language) filter.language = language;
      if (type) filter.type = type;

      const results = await Content.find(filter)
        .sort({ 'stats.views': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await Content.countDocuments(filter);

      res.json({
        results,
        pagination: {
          current: parseInt(page),
          pageSize: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('搜索内容失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }
}

module.exports = ContentService;

