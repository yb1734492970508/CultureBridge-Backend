const express = require('express');
const { protect } = require('../middleware/auth');
const EnhancedBlockchainService = require('../services/enhancedBlockchainService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

const router = express.Router();
const blockchainService = new EnhancedBlockchainService();

/**
 * @desc    获取CBT代币余额
 * @route   GET /api/v1/blockchain/balance/:address
 * @access  Public
 */
router.get('/balance/:address', asyncHandler(async (req, res, next) => {
    const { address } = req.params;
    
    if (!address) {
        return next(new ErrorResponse('钱包地址不能为空', 400));
    }
    
    try {
        const balance = await blockchainService.getCBTBalance(address);
        
        res.status(200).json({
            success: true,
            data: {
                address,
                balance,
                currency: 'CBT',
                timestamp: new Date()
            }
        });
    } catch (error) {
        return next(new ErrorResponse('获取余额失败', 500));
    }
}));

/**
 * @desc    获取用户交易历史
 * @route   GET /api/v1/blockchain/transactions/:address
 * @access  Public
 */
router.get('/transactions/:address', asyncHandler(async (req, res, next) => {
    const { address } = req.params;
    const { limit = 50 } = req.query;
    
    if (!address) {
        return next(new ErrorResponse('钱包地址不能为空', 400));
    }
    
    try {
        const transactions = await blockchainService.getUserTransactionHistory(address, parseInt(limit));
        
        res.status(200).json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        return next(new ErrorResponse('获取交易历史失败', 500));
    }
}));

/**
 * @desc    获取用户奖励历史
 * @route   GET /api/v1/blockchain/rewards/:address
 * @access  Public
 */
router.get('/rewards/:address', asyncHandler(async (req, res, next) => {
    const { address } = req.params;
    
    if (!address) {
        return next(new ErrorResponse('钱包地址不能为空', 400));
    }
    
    try {
        const rewards = await blockchainService.getUserRewardHistory(address);
        
        res.status(200).json({
            success: true,
            count: rewards.length,
            data: rewards
        });
    } catch (error) {
        return next(new ErrorResponse('获取奖励历史失败', 500));
    }
}));

/**
 * @desc    奖励CBT代币给用户
 * @route   POST /api/v1/blockchain/award
 * @access  Private (Admin only)
 */
router.post('/award', protect, asyncHandler(async (req, res, next) => {
    const { userAddress, amount, reason } = req.body;
    
    // 检查管理员权限
    if (req.user.role !== 'admin') {
        return next(new ErrorResponse('权限不足', 403));
    }
    
    if (!userAddress || !amount || !reason) {
        return next(new ErrorResponse('用户地址、数量和原因不能为空', 400));
    }
    
    try {
        const txHash = await blockchainService.awardCBTTokens(userAddress, amount, reason);
        
        res.status(200).json({
            success: true,
            data: {
                transactionHash: txHash,
                userAddress,
                amount,
                reason,
                timestamp: new Date()
            }
        });
    } catch (error) {
        return next(new ErrorResponse('奖励发放失败', 500));
    }
}));

/**
 * @desc    执行带目的的代币转账
 * @route   POST /api/v1/blockchain/transfer
 * @access  Private
 */
router.post('/transfer', protect, asyncHandler(async (req, res, next) => {
    const { toAddress, amount, purpose, category, tags } = req.body;
    const fromAddress = req.user.walletAddress;
    
    if (!fromAddress) {
        return next(new ErrorResponse('用户未绑定钱包地址', 400));
    }
    
    if (!toAddress || !amount || !purpose) {
        return next(new ErrorResponse('接收地址、数量和目的不能为空', 400));
    }
    
    try {
        const txHash = await blockchainService.transferWithPurpose(
            fromAddress,
            toAddress,
            amount,
            purpose,
            category || '文化交流',
            tags || []
        );
        
        res.status(200).json({
            success: true,
            data: {
                transactionHash: txHash,
                fromAddress,
                toAddress,
                amount,
                purpose,
                category,
                tags,
                timestamp: new Date()
            }
        });
    } catch (error) {
        return next(new ErrorResponse('转账失败', 500));
    }
}));

/**
 * @desc    获取区块链网络状态
 * @route   GET /api/v1/blockchain/status
 * @access  Public
 */
router.get('/status', asyncHandler(async (req, res, next) => {
    try {
        const networkInfo = {
            network: process.env.NODE_ENV === 'production' ? 'BSC Mainnet' : 'BSC Testnet',
            chainId: process.env.NODE_ENV === 'production' ? 56 : 97,
            rpcUrl: process.env.NODE_ENV === 'production' 
                ? 'https://bsc-dataseed1.binance.org:443'
                : 'https://data-seed-prebsc-1-s1.binance.org:8545',
            contracts: {
                CBT_TOKEN: process.env.CBT_TOKEN_ADDRESS || 'Not deployed',
                IDENTITY: process.env.IDENTITY_CONTRACT_ADDRESS || 'Not deployed',
                MARKETPLACE: process.env.MARKETPLACE_CONTRACT_ADDRESS || 'Not deployed',
                EXCHANGE: process.env.EXCHANGE_CONTRACT_ADDRESS || 'Not deployed'
            },
            status: 'active',
            timestamp: new Date()
        };
        
        res.status(200).json({
            success: true,
            data: networkInfo
        });
    } catch (error) {
        return next(new ErrorResponse('获取网络状态失败', 500));
    }
}));

/**
 * @desc    获取代币信息
 * @route   GET /api/v1/blockchain/token-info
 * @access  Public
 */
router.get('/token-info', asyncHandler(async (req, res, next) => {
    try {
        const tokenInfo = {
            name: 'CultureBridge Token',
            symbol: 'CBT',
            decimals: 18,
            totalSupply: '1000000000', // 10亿
            initialSupply: '100000000', // 1亿
            maxSupply: '1000000000',
            annualInflationRate: '5%',
            contractAddress: process.env.CBT_TOKEN_ADDRESS || 'Not deployed',
            features: [
                '文化交流奖励',
                '带目的转账',
                '交易历史记录',
                '通胀控制',
                '治理投票'
            ],
            useCases: [
                '高级功能解锁',
                '内容购买',
                '服务费用支付',
                '治理投票',
                '质押奖励'
            ]
        };
        
        res.status(200).json({
            success: true,
            data: tokenInfo
        });
    } catch (error) {
        return next(new ErrorResponse('获取代币信息失败', 500));
    }
}));

/**
 * @desc    获取用户区块链统计
 * @route   GET /api/v1/blockchain/stats/:address
 * @access  Public
 */
router.get('/stats/:address', asyncHandler(async (req, res, next) => {
    const { address } = req.params;
    
    if (!address) {
        return next(new ErrorResponse('钱包地址不能为空', 400));
    }
    
    try {
        const [balance, transactions, rewards] = await Promise.all([
            blockchainService.getCBTBalance(address),
            blockchainService.getUserTransactionHistory(address, 100),
            blockchainService.getUserRewardHistory(address)
        ]);
        
        const stats = {
            address,
            balance,
            totalTransactions: transactions.length,
            totalRewards: rewards.length,
            totalRewardAmount: rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0),
            lastTransactionDate: transactions.length > 0 ? transactions[0].blockNumber : null,
            lastRewardDate: rewards.length > 0 ? rewards[0].blockNumber : null,
            averageTransactionAmount: transactions.length > 0 
                ? transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) / transactions.length 
                : 0
        };
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        return next(new ErrorResponse('获取统计信息失败', 500));
    }
}));

module.exports = router;

