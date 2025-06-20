const express = require("express");
const router = express.Router();
const enhancedUserService = require("../services/enhancedUserService");
const auth = require("../middleware/auth");

/**
 * @route   POST /api/users/register
 * @desc    注册新用户
 * @access  Public
 */
router.post("/register", async (req, res) => {
  try {
    const result = await enhancedUserService.register(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   POST /api/users/login
 * @desc    用户登录
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const result = await enhancedUserService.login(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   GET /api/users/profile
 * @desc    获取当前用户资料
 * @access  Private
 */
router.get("/profile", auth, async (req, res) => {
  try {
    const result = await enhancedUserService.getUserProfile(req.user.userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    更新用户资料
 * @access  Private
 */
router.put("/profile", auth, async (req, res) => {
  try {
    const result = await enhancedUserService.updateUserProfile(req.user.userId, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   GET /api/users/stats
 * @desc    获取用户统计信息
 * @access  Private
 */
router.get("/stats", auth, async (req, res) => {
  try {
    const result = await enhancedUserService.getUserStats(req.user.userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   GET /api/users/leaderboard
 * @desc    获取用户排行榜
 * @access  Private
 */
router.get("/leaderboard", auth, async (req, res) => {
  try {
    const { type = "total", limit = 50 } = req.query;
    const result = await enhancedUserService.getUserLeaderboard(type, parseInt(limit));
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   GET /api/users/search
 * @desc    搜索用户
 * @access  Private
 */
router.get("/search", auth, async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "搜索关键词至少需要2个字符"
      });
    }
    
    const result = await enhancedUserService.searchUsers(
      query.trim(), 
      req.user.userId, 
      parseInt(limit)
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   POST /api/users/logout
 * @desc    用户登出
 * @access  Private
 */
router.post("/logout", auth, async (req, res) => {
  try {
    // 在实际应用中，可以将token加入黑名单
    // 这里简单返回成功消息
    res.json({
      success: true,
      message: "登出成功"
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   GET /api/users/:id/profile
 * @desc    获取指定用户的公开资料
 * @access  Private
 */
router.get("/:id/profile", auth, async (req, res) => {
  try {
    const result = await enhancedUserService.getUserProfile(req.params.id);
    
    if (result.success) {
      // 只返回公开信息
      const publicProfile = {
        user: {
          _id: result.user._id,
          username: result.user.username,
          avatar: result.user.avatar,
          profile: {
            firstName: result.user.profile?.firstName,
            lastName: result.user.profile?.lastName,
            bio: result.user.profile?.bio,
            location: result.user.profile?.location,
            languages: result.user.profile?.languages,
            interests: result.user.profile?.interests
          },
          stats: {
            lastActive: result.user.stats?.lastActive
          }
        }
      };
      
      res.json({
        success: true,
        ...publicProfile
      });
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

/**
 * @route   GET /api/users/dashboard
 * @desc    获取用户仪表板数据
 * @access  Private
 */
router.get("/dashboard", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 模拟仪表板数据
    const dashboardData = {
      success: true,
      data: {
        user: {
          id: userId,
          username: '文化探索者',
          avatar: '/api/placeholder/64/64',
          level: 18,
          exp: 2847,
          nextLevelExp: 3000,
          cbtBalance: 1247.89,
          followers: 1234,
          following: 567,
          posts: 89
        },
        achievements: [
          { id: 1, name: '翻译达人', icon: '🌐', color: '#1890ff', earned: true },
          { id: 2, name: '文化使者', icon: '🎭', color: '#52c41a', earned: true },
          { id: 3, name: '语言大师', icon: '📚', color: '#722ed1', earned: false },
          { id: 4, name: '社交明星', icon: '⭐', color: '#fa8c16', earned: true },
        ],
        learningProgress: [
          { language: '日语', progress: 75, level: 'N3', color: '#ff6b6b' },
          { language: '法语', progress: 45, level: 'A2', color: '#4ecdc4' },
          { language: '西班牙语', progress: 30, level: 'A1', color: '#45b7d1' },
        ],
        recentActivities: [
          { type: 'post', content: '分享了一张京都金阁寺的照片', time: '2小时前', likes: 23 },
          { type: 'comment', content: '评论了"法式料理制作技巧"', time: '4小时前', likes: 8 },
          { type: 'achievement', content: '获得了"翻译达人"徽章', time: '1天前', likes: 45 },
          { type: 'learning', content: '完成了日语N3语法练习', time: '2天前', likes: 12 },
        ],
        trendingPosts: [
          {
            id: 1,
            author: '东京茶道师',
            avatar: '/api/placeholder/40/40',
            content: '今天在浅草寺体验了传统茶道，感受到了日本文化的深邃之美。每一个动作都蕴含着对自然和生活的敬畏...',
            images: ['/api/placeholder/300/200'],
            likes: 234,
            comments: 45,
            shares: 12,
            time: '3小时前',
            tags: ['茶道', '日本文化', '传统艺术'],
            location: '东京·浅草寺'
          },
          {
            id: 2,
            author: '巴黎美食家',
            avatar: '/api/placeholder/40/40',
            content: '在蒙马特高地发现了一家百年老店，他们的可颂酥脆香甜，配上一杯香浓的咖啡，这就是法式慢生活的精髓',
            images: ['/api/placeholder/300/200', '/api/placeholder/300/200'],
            likes: 189,
            comments: 32,
            shares: 8,
            time: '5小时前',
            tags: ['法式美食', '巴黎', '咖啡文化'],
            location: '巴黎·蒙马特'
          }
        ],
        culturalEvents: [
          {
            id: 1,
            title: '日本茶道体验课',
            description: '学习正宗的日式茶道礼仪',
            date: '2024-01-20',
            time: '14:00',
            participants: 12,
            maxParticipants: 15,
            price: 50,
            image: '/api/placeholder/200/120',
            host: '茶道大师田中',
            rating: 4.9
          },
          {
            id: 2,
            title: '法语角聚会',
            description: '与法国朋友一起练习口语',
            date: '2024-01-22',
            time: '19:00',
            participants: 8,
            maxParticipants: 10,
            price: 0,
            image: '/api/placeholder/200/120',
            host: '巴黎留学生协会',
            rating: 4.7
          }
        ]
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

module.exports = router;

