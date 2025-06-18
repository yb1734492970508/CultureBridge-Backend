const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const rewardService = require('../services/rewardService');

// @route   GET /api/rewards/user
// @desc    获取用户奖励信息
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const userStats = await rewardService.getUserStats(req.user.id);
    res.json({
      success: true,
      data: userStats,
    });
  } catch (error) {
    console.error('Get user rewards error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/rewards/checkin
// @desc    用户签到
// @access  Private
router.post('/checkin', auth, async (req, res) => {
  try {
    const result = await rewardService.checkIn(req.user.id);
    res.json({
      success: true,
      message: `签到成功！连续签到${result.streak}天，获得${result.reward}积分`,
      data: result,
    });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/rewards/points
// @desc    添加积分（管理员或系统调用）
// @access  Private
router.post('/points', auth, async (req, res) => {
  try {
    const { type, amount, reason } = req.body;
    
    if (!type || !amount || !reason) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数',
      });
    }
    
    const result = await rewardService.addPoints(req.user.id, type, amount, reason);
    res.json({
      success: true,
      message: `成功获得${amount}${type}积分`,
      data: result,
    });
  } catch (error) {
    console.error('Add points error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/rewards/action
// @desc    记录用户行为
// @access  Private
router.post('/action', auth, async (req, res) => {
  try {
    const { actionType, actionData } = req.body;
    
    if (!actionType) {
      return res.status(400).json({
        success: false,
        message: '缺少行为类型',
      });
    }
    
    const result = await rewardService.recordUserAction(req.user.id, actionType, actionData);
    res.json({
      success: true,
      message: '行为记录成功',
      data: result,
    });
  } catch (error) {
    console.error('Record action error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/rewards/purchase
// @desc    购买奖励
// @access  Private
router.post('/purchase', auth, async (req, res) => {
  try {
    const { rewardId } = req.body;
    
    if (!rewardId) {
      return res.status(400).json({
        success: false,
        message: '缺少奖励ID',
      });
    }
    
    const result = await rewardService.purchaseReward(req.user.id, rewardId);
    res.json({
      success: true,
      message: `成功购买${result.reward.name}`,
      data: result,
    });
  } catch (error) {
    console.error('Purchase reward error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/rewards/shop
// @desc    获取奖励商店
// @access  Public
router.get('/shop', async (req, res) => {
  try {
    const shop = rewardService.getRewardShop();
    res.json({
      success: true,
      data: shop,
    });
  } catch (error) {
    console.error('Get reward shop error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/rewards/achievements
// @desc    获取成就列表
// @access  Public
router.get('/achievements', async (req, res) => {
  try {
    const achievements = rewardService.getAchievements();
    res.json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/rewards/leaderboard
// @desc    获取排行榜
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'total', limit = 10 } = req.query;
    const leaderboard = await rewardService.getLeaderboard(type, parseInt(limit));
    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/rewards/stats
// @desc    获取全局统计
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const stats = await rewardService.getGlobalStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get global stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/rewards/achievement/:achievementId
// @desc    手动解锁成就（管理员）
// @access  Private
router.post('/achievement/:achievementId', auth, async (req, res) => {
  try {
    const { achievementId } = req.params;
    const result = await rewardService.unlockAchievement(req.user.id, achievementId);
    res.json({
      success: true,
      message: `成功解锁成就：${result.achievement.title}`,
      data: result,
    });
  } catch (error) {
    console.error('Unlock achievement error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

