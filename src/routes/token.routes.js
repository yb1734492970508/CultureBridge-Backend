// src/routes/token.routes.js
const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/token.controller');
const { check } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');

// 获取用户代币余额
router.get('/balance', authMiddleware, tokenController.getBalance);

// 转移代币
router.post(
  '/transfer',
  [
    authMiddleware,
    check('to').notEmpty().withMessage('接收方地址不能为空'),
    check('amount').isNumeric().withMessage('金额必须是数字').custom(value => value > 0).withMessage('金额必须大于0')
  ],
  tokenController.transferTokens
);

// 质押代币
router.post(
  '/stake',
  [
    authMiddleware,
    check('amount').isNumeric().withMessage('金额必须是数字').custom(value => value > 0).withMessage('金额必须大于0'),
    check('lockPeriodIndex').isInt({ min: 0, max: 4 }).withMessage('锁定期索引必须在0-4之间')
  ],
  tokenController.stakeTokens
);

// 获取质押信息
router.get('/stake', authMiddleware, tokenController.getStakeInfo);

// 领取奖励
router.post('/rewards/claim', authMiddleware, tokenController.claimRewards);

// 获取交易历史
router.get('/transactions', authMiddleware, tokenController.getTransactionHistory);

// 获取代币统计信息
router.get('/stats', tokenController.getTokenStats);

module.exports = router;
