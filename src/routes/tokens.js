const express = require('express');
const tokenRewardController = require('../controllers/tokenRewardController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// 需要认证的路由
router.use(protect);

// 代币奖励路由
router.post('/daily-checkin', tokenRewardController.dailyCheckin);
router.post('/learning-reward', tokenRewardController.learningReward);
router.post('/content-reward', tokenRewardController.contentReward);
router.post('/social-reward', tokenRewardController.socialReward);

// 代币查询路由
router.get('/balance', tokenRewardController.getBalance);
router.get('/rewards', tokenRewardController.getRewardHistory);
router.get('/learning-progress', tokenRewardController.getLearningProgress);
router.get('/stats', tokenRewardController.getTokenStats);

// 代币支付路由
router.post('/payment', tokenRewardController.makePayment);

module.exports = router;

