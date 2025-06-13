const express = require('express');
const {
    getBalance,
    awardTokens,
    transferTokens,
    getTransaction,
    getUserTransactions,
    generateWallet,
    getGasPrice,
    getUserRewards
} = require('../controllers/blockchainController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// 公开路由
router.get('/balance/:address', getBalance);
router.get('/transaction/:id', getTransaction);
router.get('/gas-price', getGasPrice);

// 需要认证的路由
router.use(protect);

router.post('/wallet/generate', generateWallet);
router.post('/transfer', transferTokens);
router.get('/transactions/:address', getUserTransactions);
router.get('/rewards/:userId', getUserRewards);

// 管理员路由
router.post('/award', authorize('admin'), awardTokens);

module.exports = router;

