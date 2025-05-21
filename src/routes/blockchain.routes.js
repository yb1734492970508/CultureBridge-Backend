// src/routes/blockchain.routes.js
const express = require('express');
const { check } = require('express-validator');
const blockchainController = require('../controllers/blockchain.controller');
const auth = require('../middleware/auth.middleware');
const admin = require('../middleware/admin.middleware');

const router = express.Router();

// @route   POST /api/blockchain/wallet/generate
// @desc    生成钱包地址
// @access  Private
router.post('/wallet/generate', auth, blockchainController.generateWallet);

// @route   POST /api/blockchain/wallet/validate
// @desc    验证钱包地址
// @access  Public
router.post(
  '/wallet/validate',
  [
    check('address', '钱包地址是必填项').not().isEmpty()
  ],
  blockchainController.validateWalletAddress
);

// @route   GET /api/blockchain/wallet/:address/balance
// @desc    获取钱包余额
// @access  Public
router.get('/wallet/:address/balance', blockchainController.getWalletBalance);

// @route   POST /api/blockchain/identity/:userId
// @desc    创建用户链上身份
// @access  Private Admin
router.post('/identity/:userId', [auth, admin], blockchainController.createIdentity);

// @route   PUT /api/blockchain/identity/:userId/reputation
// @desc    更新用户声誉分数
// @access  Private Admin
router.put(
  '/identity/:userId/reputation',
  [
    auth,
    admin,
    check('reputationScore', '声誉分数是必填项').isNumeric()
  ],
  blockchainController.updateReputation
);

// @route   POST /api/blockchain/identity/:userId/contribution
// @desc    添加用户贡献记录
// @access  Private Admin
router.post(
  '/identity/:userId/contribution',
  [
    auth,
    admin,
    check('contributionType', '贡献类型是必填项').not().isEmpty()
  ],
  blockchainController.addContribution
);

// @route   GET /api/blockchain/identity/:userId
// @desc    获取用户链上身份信息
// @access  Private
router.get('/identity/:userId', auth, blockchainController.getIdentity);

module.exports = router;
