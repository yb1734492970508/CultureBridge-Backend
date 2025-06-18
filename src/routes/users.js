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
    res.status(500).json({
      success: false,
      error: "服务器内部错误"
    });
  }
});

module.exports = router;


