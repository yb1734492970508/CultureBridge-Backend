const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const EnhancedBlockchainService = require('../services/enhancedBlockchainService');
const ContractDeploymentService = require('../services/contractDeploymentService');
const User = require('../models/User');

const router = express.Router();

// 初始化服务
const blockchainService = new EnhancedBlockchainService();
const deploymentService = new ContractDeploymentService();

/**
 * @desc    获取网络状态
 * @route   GET /api/v2/blockchain/network
 * @access  Public
 */
router.get('/network', asyncHandler(async (req, res, next) => {
    try {
        const networkStatus = await blockchainService.getNetworkStatus();
        
        res.status(200).json({
            success: true,
            data: networkStatus
        });
        
    } catch (error) {
        console.error('获取网络状态失败:', error);
        return next(new ErrorResponse('获取网络状态失败', 500));
    }
}));

/**
 * @desc    获取用户钱包余额
 * @route   GET /api/v2/blockchain/balance
 * @access  Private
 */
router.get('/balance', protect, asyncHandler(async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.walletAddress) {
            return next(new ErrorResponse('用户未绑定钱包地址', 400));
        }
        
        const [cbtBalance, bnbBalance, stats] = await Promise.all([
            blockchainService.getUserBalance(user.walletAddress),
            blockchainService.getBNBBalance(user.walletAddress),
            blockchainService.getUserStats(user.walletAddress)
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                walletAddress: user.walletAddress,
                balances: {
                    cbt: cbtBalance,
                    bnb: bnbBalance
                },
                stats
            }
        });
        
    } catch (error) {
        console.error('获取用户余额失败:', error);
        return next(new ErrorResponse('获取用户余额失败', 500));
    }
}));

/**
 * @desc    获取交易历史
 * @route   GET /api/v2/blockchain/transactions
 * @access  Private
 */
router.get('/transactions', protect, asyncHandler(async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const user = await User.findById(req.user.id);
        
        if (!user.walletAddress) {
            return next(new ErrorResponse('用户未绑定钱包地址', 400));
        }
        
        const transactions = await blockchainService.getUserTransactions(
            user.walletAddress,
            parseInt(page),
            parseInt(limit),
            type
        );
        
        res.status(200).json({
            success: true,
            data: transactions
        });
        
    } catch (error) {
        console.error('获取交易历史失败:', error);
        return next(new ErrorResponse('获取交易历史失败', 500));
    }
}));

/**
 * @desc    转账CBT代币
 * @route   POST /api/v2/blockchain/transfer
 * @access  Private
 */
router.post('/transfer', protect, asyncHandler(async (req, res, next) => {
    const { toAddress, amount, purpose, category = 'GENERAL' } = req.body;
    
    if (!toAddress || !amount || !purpose) {
        return next(new ErrorResponse('请提供接收地址、金额和用途', 400));
    }
    
    if (amount <= 0) {
        return next(new ErrorResponse('转账金额必须大于0', 400));
    }
    
    try {
        const user = await User.findById(req.user.id).select('privateKey walletAddress');
        
        if (!user.walletAddress || !user.privateKey) {
            return next(new ErrorResponse('用户钱包信息不完整', 400));
        }
        
        // 验证接收地址
        if (!blockchainService.isValidAddress(toAddress)) {
            return next(new ErrorResponse('无效的接收地址', 400));
        }
        
        // 检查余额
        const balance = await blockchainService.getUserBalance(user.walletAddress);
        if (balance < amount) {
            return next(new ErrorResponse('余额不足', 400));
        }
        
        // 执行转账
        const result = await blockchainService.transferWithPurpose(
            user.privateKey,
            toAddress,
            amount,
            purpose,
            category,
            []
        );
        
        res.status(200).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed,
                amount,
                toAddress,
                purpose,
                category
            },
            message: '转账成功'
        });
        
    } catch (error) {
        console.error('转账失败:', error);
        return next(new ErrorResponse(error.message || '转账失败', 500));
    }
}));

/**
 * @desc    向用户转账（管理员功能）
 * @route   POST /api/v2/blockchain/transfer-to-user
 * @access  Private (Admin)
 */
router.post('/transfer-to-user', protect, authorize('admin'), asyncHandler(async (req, res, next) => {
    const { userId, amount, purpose, category = 'ADMIN_TRANSFER' } = req.body;
    
    if (!userId || !amount || !purpose) {
        return next(new ErrorResponse('请提供用户ID、金额和用途', 400));
    }
    
    try {
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return next(new ErrorResponse('目标用户不存在', 404));
        }
        
        if (!targetUser.walletAddress) {
            return next(new ErrorResponse('目标用户未绑定钱包', 400));
        }
        
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
        if (!adminPrivateKey) {
            return next(new ErrorResponse('管理员私钥未配置', 500));
        }
        
        const result = await blockchainService.transferWithPurpose(
            adminPrivateKey,
            targetUser.walletAddress,
            amount,
            purpose,
            category,
            []
        );
        
        res.status(200).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                targetUser: {
                    id: targetUser._id,
                    username: targetUser.username,
                    walletAddress: targetUser.walletAddress
                },
                amount,
                purpose,
                category
            },
            message: '管理员转账成功'
        });
        
    } catch (error) {
        console.error('管理员转账失败:', error);
        return next(new ErrorResponse(error.message || '管理员转账失败', 500));
    }
}));

/**
 * @desc    分发奖励
 * @route   POST /api/v2/blockchain/distribute-reward
 * @access  Private (Admin)
 */
router.post('/distribute-reward', protect, authorize('admin'), asyncHandler(async (req, res, next) => {
    const { userIds, amount, purpose, category = 'REWARD' } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || !amount || !purpose) {
        return next(new ErrorResponse('请提供用户ID列表、金额和用途', 400));
    }
    
    try {
        const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
        if (!adminPrivateKey) {
            return next(new ErrorResponse('管理员私钥未配置', 500));
        }
        
        const results = [];
        const errors = [];
        
        // 批量分发奖励
        for (const userId of userIds) {
            try {
                const user = await User.findById(userId);
                if (!user || !user.walletAddress) {
                    errors.push({ userId, error: '用户不存在或未绑定钱包' });
                    continue;
                }
                
                const result = await blockchainService.distributeReward(
                    user.walletAddress,
                    amount,
                    purpose,
                    category,
                    adminPrivateKey
                );
                
                results.push({
                    userId,
                    username: user.username,
                    walletAddress: user.walletAddress,
                    transactionHash: result.transactionHash,
                    amount
                });
                
            } catch (error) {
                errors.push({ userId, error: error.message });
            }
        }
        
        res.status(200).json({
            success: true,
            data: {
                successful: results,
                failed: errors,
                totalProcessed: userIds.length,
                successCount: results.length,
                failureCount: errors.length
            },
            message: `奖励分发完成，成功${results.length}个，失败${errors.length}个`
        });
        
    } catch (error) {
        console.error('分发奖励失败:', error);
        return next(new ErrorResponse('分发奖励失败', 500));
    }
}));

/**
 * @desc    获取代币信息
 * @route   GET /api/v2/blockchain/token-info
 * @access  Public
 */
router.get('/token-info', asyncHandler(async (req, res, next) => {
    try {
        const tokenInfo = await blockchainService.getTokenInfo();
        
        res.status(200).json({
            success: true,
            data: tokenInfo
        });
        
    } catch (error) {
        console.error('获取代币信息失败:', error);
        return next(new ErrorResponse('获取代币信息失败', 500));
    }
}));

/**
 * @desc    获取合约地址
 * @route   GET /api/v2/blockchain/contracts
 * @access  Public
 */
router.get('/contracts', asyncHandler(async (req, res, next) => {
    try {
        const contracts = await blockchainService.getContractAddresses();
        
        res.status(200).json({
            success: true,
            data: contracts
        });
        
    } catch (error) {
        console.error('获取合约地址失败:', error);
        return next(new ErrorResponse('获取合约地址失败', 500));
    }
}));

/**
 * @desc    验证钱包签名
 * @route   POST /api/v2/blockchain/verify-signature
 * @access  Public
 */
router.post('/verify-signature', asyncHandler(async (req, res, next) => {
    const { walletAddress, signature, message } = req.body;
    
    if (!walletAddress || !signature || !message) {
        return next(new ErrorResponse('请提供钱包地址、签名和消息', 400));
    }
    
    try {
        const isValid = await blockchainService.verifySignature(walletAddress, signature, message);
        
        res.status(200).json({
            success: true,
            data: {
                isValid,
                walletAddress,
                message
            }
        });
        
    } catch (error) {
        console.error('验证签名失败:', error);
        return next(new ErrorResponse('验证签名失败', 500));
    }
}));

/**
 * @desc    生成钱包
 * @route   POST /api/v2/blockchain/generate-wallet
 * @access  Private
 */
router.post('/generate-wallet', protect, asyncHandler(async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (user.walletAddress) {
            return next(new ErrorResponse('用户已有钱包地址', 400));
        }
        
        const wallet = blockchainService.generateWallet();
        
        // 加密并保存私钥
        const encryptedPrivateKey = blockchainService.encryptPrivateKey(wallet.privateKey);
        
        user.walletAddress = wallet.address;
        user.privateKey = encryptedPrivateKey;
        await user.save();
        
        // 发放钱包创建奖励
        try {
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (adminPrivateKey) {
                await blockchainService.distributeReward(
                    wallet.address,
                    5, // 5 CBT钱包创建奖励
                    '钱包创建奖励',
                    'COMMUNITY_CONTRIBUTION',
                    adminPrivateKey
                );
            }
        } catch (error) {
            console.warn('发放钱包创建奖励失败:', error);
        }
        
        res.status(200).json({
            success: true,
            data: {
                walletAddress: wallet.address,
                mnemonic: wallet.mnemonic // 注意：生产环境中应该安全处理助记词
            },
            message: '钱包创建成功'
        });
        
    } catch (error) {
        console.error('生成钱包失败:', error);
        return next(new ErrorResponse('生成钱包失败', 500));
    }
}));

/**
 * @desc    导入钱包
 * @route   POST /api/v2/blockchain/import-wallet
 * @access  Private
 */
router.post('/import-wallet', protect, asyncHandler(async (req, res, next) => {
    const { privateKey, mnemonic } = req.body;
    
    if (!privateKey && !mnemonic) {
        return next(new ErrorResponse('请提供私钥或助记词', 400));
    }
    
    try {
        const user = await User.findById(req.user.id);
        
        if (user.walletAddress) {
            return next(new ErrorResponse('用户已有钱包地址', 400));
        }
        
        let wallet;
        if (privateKey) {
            wallet = blockchainService.importWalletFromPrivateKey(privateKey);
        } else {
            wallet = blockchainService.importWalletFromMnemonic(mnemonic);
        }
        
        // 检查钱包是否已被其他用户使用
        const existingUser = await User.findOne({ walletAddress: wallet.address });
        if (existingUser) {
            return next(new ErrorResponse('该钱包已被其他用户使用', 400));
        }
        
        // 加密并保存私钥
        const encryptedPrivateKey = blockchainService.encryptPrivateKey(wallet.privateKey);
        
        user.walletAddress = wallet.address;
        user.privateKey = encryptedPrivateKey;
        await user.save();
        
        res.status(200).json({
            success: true,
            data: {
                walletAddress: wallet.address
            },
            message: '钱包导入成功'
        });
        
    } catch (error) {
        console.error('导入钱包失败:', error);
        return next(new ErrorResponse(error.message || '导入钱包失败', 500));
    }
}));

/**
 * @desc    获取区块链统计信息
 * @route   GET /api/v2/blockchain/stats
 * @access  Public
 */
router.get('/stats', asyncHandler(async (req, res, next) => {
    try {
        const stats = await blockchainService.getBlockchainStats();
        
        res.status(200).json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('获取区块链统计失败:', error);
        return next(new ErrorResponse('获取区块链统计失败', 500));
    }
}));

/**
 * @desc    部署合约（管理员功能）
 * @route   POST /api/v2/blockchain/deploy-contracts
 * @access  Private (Admin)
 */
router.post('/deploy-contracts', protect, authorize('admin'), asyncHandler(async (req, res, next) => {
    try {
        const deploymentResults = await deploymentService.deployAllContracts();
        
        res.status(200).json({
            success: true,
            data: deploymentResults,
            message: '合约部署完成'
        });
        
    } catch (error) {
        console.error('部署合约失败:', error);
        return next(new ErrorResponse(error.message || '部署合约失败', 500));
    }
}));

/**
 * @desc    获取部署状态
 * @route   GET /api/v2/blockchain/deployment-status
 * @access  Private (Admin)
 */
router.get('/deployment-status', protect, authorize('admin'), asyncHandler(async (req, res, next) => {
    try {
        const [deploymentSummary, networkStatus] = await Promise.all([
            deploymentService.getDeploymentSummary(),
            deploymentService.getNetworkStatus()
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                deployment: deploymentSummary,
                network: networkStatus
            }
        });
        
    } catch (error) {
        console.error('获取部署状态失败:', error);
        return next(new ErrorResponse('获取部署状态失败', 500));
    }
}));

/**
 * @desc    区块链服务健康检查
 * @route   GET /api/v2/blockchain/health
 * @access  Public
 */
router.get('/health', asyncHandler(async (req, res, next) => {
    try {
        const healthStatus = await blockchainService.healthCheck();
        
        res.status(200).json({
            success: true,
            data: {
                ...healthStatus,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('区块链健康检查失败:', error);
        return next(new ErrorResponse('区块链健康检查失败', 500));
    }
}));

module.exports = router;

