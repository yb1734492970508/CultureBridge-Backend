const express = require('express');
const router = express.Router();
const CBTTokenService = require('../services/cbtTokenService');
const UserWallet = require('../models/UserWallet');
const TokenTransaction = require('../models/TokenTransaction');
const DailyReward = require('../models/DailyReward');
const { protect } = require('../middleware/auth');
const { ethers } = require('ethers');

// 初始化CBT代币服务
const cbtTokenService = new CBTTokenService();

/**
 * @desc    获取用户CBT余额
 * @route   GET /api/v2/cbt/balance
 * @access  Private
 */
router.get('/balance', protect, async (req, res) => {
    try {
        const result = await cbtTokenService.getUserBalance(req.user.id);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: {
                balance: result.balance,
                walletAddress: result.walletAddress,
                formatted: `${result.balance} CBT`
            }
        });
        
    } catch (error) {
        console.error('获取CBT余额失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取用户钱包信息
 * @route   GET /api/v2/cbt/wallet
 * @access  Private
 */
router.get('/wallet', protect, async (req, res) => {
    try {
        const wallet = await UserWallet.findOne({ userId: req.user.id })
            .populate('userId', 'username email');
        
        if (!wallet) {
            return res.status(404).json({
                success: false,
                error: '钱包未找到'
            });
        }
        
        res.json({
            success: true,
            data: wallet
        });
        
    } catch (error) {
        console.error('获取钱包信息失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    绑定钱包地址
 * @route   POST /api/v2/cbt/wallet/bind
 * @access  Private
 */
router.post('/wallet/bind', protect, async (req, res) => {
    try {
        const { walletAddress, signature, message, walletType } = req.body;
        
        if (!walletAddress || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        // 验证钱包地址格式
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: '无效的钱包地址'
            });
        }
        
        // 验证签名
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    error: '签名验证失败'
                });
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: '签名格式无效'
            });
        }
        
        // 检查钱包是否已被其他用户绑定
        const existingWallet = await UserWallet.findOne({ 
            walletAddress: walletAddress.toLowerCase(),
            userId: { $ne: req.user.id }
        });
        
        if (existingWallet) {
            return res.status(400).json({
                success: false,
                error: '该钱包地址已被其他用户绑定'
            });
        }
        
        // 创建或更新钱包记录
        let wallet = await UserWallet.findOne({ userId: req.user.id });
        
        if (wallet) {
            // 更新现有钱包
            wallet.walletAddress = walletAddress.toLowerCase();
            wallet.walletType = walletType || 'METAMASK';
            wallet.isVerified = true;
            wallet.verificationSignature = signature;
            wallet.verificationMessage = message;
            wallet.verificationDate = new Date();
        } else {
            // 创建新钱包
            wallet = new UserWallet({
                userId: req.user.id,
                walletAddress: walletAddress.toLowerCase(),
                walletType: walletType || 'METAMASK',
                isVerified: true,
                verificationSignature: signature,
                verificationMessage: message,
                verificationDate: new Date()
            });
        }
        
        await wallet.save();
        
        // 更新用户模型中的钱包地址
        req.user.walletAddress = walletAddress.toLowerCase();
        await req.user.save();
        
        // 发放注册奖励（如果是首次绑定）
        if (!wallet.statistics.firstTransactionDate) {
            try {
                await cbtTokenService.distributeReward(req.user.id, 'REGISTRATION');
            } catch (rewardError) {
                console.warn('发放注册奖励失败:', rewardError.message);
            }
        }
        
        res.json({
            success: true,
            message: '钱包绑定成功',
            data: wallet
        });
        
    } catch (error) {
        console.error('绑定钱包失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    领取每日登录奖励
 * @route   POST /api/v2/cbt/rewards/daily-login
 * @access  Private
 */
router.post('/rewards/daily-login', protect, async (req, res) => {
    try {
        const result = await cbtTokenService.distributeReward(req.user.id, 'DAILY_LOGIN');
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            message: '每日登录奖励领取成功',
            data: result
        });
        
    } catch (error) {
        console.error('领取每日登录奖励失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取用户奖励统计
 * @route   GET /api/v2/cbt/rewards/stats
 * @access  Private
 */
router.get('/rewards/stats', protect, async (req, res) => {
    try {
        const result = await cbtTokenService.getUserRewardStats(req.user.id);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.stats
        });
        
    } catch (error) {
        console.error('获取奖励统计失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取用户交易历史
 * @route   GET /api/v2/cbt/transactions
 * @access  Private
 */
router.get('/transactions', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status } = req.query;
        
        // 构建查询条件
        const query = { userId: req.user.id };
        if (type) query.type = type;
        if (status) query.status = status;
        
        const transactions = await TokenTransaction.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('userId', 'username');
        
        const total = await TokenTransaction.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('获取交易历史失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    获取代币总体统计
 * @route   GET /api/v2/cbt/stats
 * @access  Private
 */
router.get('/stats', protect, async (req, res) => {
    try {
        const result = await cbtTokenService.getTokenStats();
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.stats
        });
        
    } catch (error) {
        console.error('获取代币统计失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    管理员分发奖励
 * @route   POST /api/v2/cbt/admin/distribute-reward
 * @access  Private (Admin only)
 */
router.post('/admin/distribute-reward', protect, async (req, res) => {
    try {
        // 检查管理员权限
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }
        
        const { userId, rewardType, customAmount, customDescription } = req.body;
        
        if (!userId || !rewardType) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        const result = await cbtTokenService.distributeReward(
            userId, 
            rewardType, 
            customAmount, 
            customDescription
        );
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            message: '奖励分发成功',
            data: result
        });
        
    } catch (error) {
        console.error('管理员分发奖励失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    管理员批量分发奖励
 * @route   POST /api/v2/cbt/admin/batch-distribute-rewards
 * @access  Private (Admin only)
 */
router.post('/admin/batch-distribute-rewards', protect, async (req, res) => {
    try {
        // 检查管理员权限
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }
        
        const { rewardList } = req.body;
        
        if (!rewardList || !Array.isArray(rewardList) || rewardList.length === 0) {
            return res.status(400).json({
                success: false,
                error: '奖励列表不能为空'
            });
        }
        
        const result = await cbtTokenService.batchDistributeRewards(rewardList);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            message: '批量奖励分发成功',
            data: result
        });
        
    } catch (error) {
        console.error('管理员批量分发奖励失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @desc    CBT代币服务健康检查
 * @route   GET /api/v2/cbt/health
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const health = await cbtTokenService.healthCheck();
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('CBT服务健康检查失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

module.exports = router;

