// src/routes/governance.routes.js
const express = require('express');
const router = express.Router();
const governanceController = require('../controllers/governance.controller');
const { check } = require('express-validator');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// 获取提案列表
router.get('/proposals', governanceController.getProposals);

// 获取提案详情
router.get('/proposals/:proposalId', governanceController.getProposalById);

// 创建提案
router.post(
  '/proposals',
  [
    authMiddleware,
    check('title').notEmpty().withMessage('提案标题不能为空'),
    check('description').notEmpty().withMessage('提案描述不能为空'),
    check('proposalType').isIn(['PARAMETER_CHANGE', 'FEATURE_REQUEST', 'FUND_ALLOCATION', 'COMMUNITY_INITIATIVE', 'OTHER']).withMessage('无效的提案类型'),
    check('targets').isArray().withMessage('目标合约地址必须是数组'),
    check('values').isArray().withMessage('交易金额必须是数组'),
    check('calldatas').isArray().withMessage('调用数据必须是数组')
  ],
  governanceController.createProposal
);

// 投票
router.post(
  '/vote',
  [
    authMiddleware,
    check('proposalId').notEmpty().withMessage('提案ID不能为空'),
    check('support').isIn(['FOR', 'AGAINST', 'ABSTAIN']).withMessage('无效的投票选项')
  ],
  governanceController.castVote
);

// 执行提案
router.post(
  '/proposals/:proposalId/execute',
  [
    authMiddleware,
    adminMiddleware
  ],
  governanceController.executeProposal
);

// 获取用户提案
router.get(
  '/user/proposals',
  authMiddleware,
  governanceController.getUserProposals
);

// 获取治理统计信息
router.get('/stats', governanceController.getGovernanceStats);

module.exports = router;
