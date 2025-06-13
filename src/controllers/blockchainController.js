const BlockchainService = require('../services/blockchainService');
const User = require('../models/User');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

class BlockchainController {
    constructor() {
        this.blockchainService = new BlockchainService();
    }

    /**
     * @desc    获取用户CBT代币余额
     * @route   GET /api/v1/blockchain/balance/:address
     * @access  Public
     */
    getBalance = asyncHandler(async (req, res, next) => {
        const { address } = req.params;

        if (!this.blockchainService.isValidAddress(address)) {
            return next(new ErrorResponse('无效的钱包地址', 400));
        }

        try {
            const balance = await this.blockchainService.getUserBalance(address);
            const bnbBalance = await this.blockchainService.getBNBBalance(address);

            res.status(200).json({
                success: true,
                data: {
                    address,
                    cbtBalance: balance,
                    bnbBalance,
                    timestamp: new Date()
                }
            });
        } catch (error) {
            return next(new ErrorResponse('获取余额失败', 500));
        }
    });

    /**
     * @desc    奖励CBT代币给用户
     * @route   POST /api/v1/blockchain/award
     * @access  Private/Admin
     */
    awardTokens = asyncHandler(async (req, res, next) => {
        const { userAddress, amount, reason } = req.body;

        if (!userAddress || !amount || !reason) {
            return next(new ErrorResponse('请提供用户地址、代币数量和奖励原因', 400));
        }

        if (!this.blockchainService.isValidAddress(userAddress)) {
            return next(new ErrorResponse('无效的钱包地址', 400));
        }

        try {
            // 检查用户是否存在
            const user = await User.findOne({ walletAddress: userAddress });
            if (!user) {
                return next(new ErrorResponse('用户不存在', 404));
            }

            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) {
                return next(new ErrorResponse('管理员私钥未配置', 500));
            }

            const txHash = await this.blockchainService.awardTokens(
                userAddress,
                amount,
                reason,
                adminPrivateKey
            );

            // 记录奖励历史到数据库
            user.tokenRewards.push({
                amount: parseFloat(amount),
                reason,
                transactionHash: txHash,
                timestamp: new Date()
            });
            await user.save();

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
            console.error('奖励代币失败:', error);
            return next(new ErrorResponse('奖励代币失败', 500));
        }
    });

    /**
     * @desc    执行带目的的代币转账
     * @route   POST /api/v1/blockchain/transfer
     * @access  Private
     */
    transferTokens = asyncHandler(async (req, res, next) => {
        const { toAddress, amount, purpose, category, tags } = req.body;
        const fromUserId = req.user.id;

        if (!toAddress || !amount || !purpose) {
            return next(new ErrorResponse('请提供接收地址、代币数量和转账目的', 400));
        }

        if (!this.blockchainService.isValidAddress(toAddress)) {
            return next(new ErrorResponse('无效的接收地址', 400));
        }

        try {
            // 获取发送者信息
            const fromUser = await User.findById(fromUserId);
            if (!fromUser || !fromUser.walletAddress || !fromUser.privateKey) {
                return next(new ErrorResponse('用户钱包信息不完整', 400));
            }

            // 检查接收者是否存在
            const toUser = await User.findOne({ walletAddress: toAddress });
            if (!toUser) {
                return next(new ErrorResponse('接收者不存在', 404));
            }

            const result = await this.blockchainService.transferWithPurpose(
                fromUser.privateKey,
                toAddress,
                amount,
                purpose,
                category || 'general',
                tags || []
            );

            // 记录转账历史到数据库
            const transferRecord = {
                from: fromUser.walletAddress,
                to: toAddress,
                amount: parseFloat(amount),
                purpose,
                category: category || 'general',
                tags: tags || [],
                transactionHash: result.transactionHash,
                blockchainTransactionId: result.transactionId,
                timestamp: new Date()
            };

            fromUser.tokenTransfers.push(transferRecord);
            toUser.tokenTransfers.push(transferRecord);
            
            await fromUser.save();
            await toUser.save();

            res.status(200).json({
                success: true,
                data: {
                    transactionHash: result.transactionHash,
                    transactionId: result.transactionId,
                    from: fromUser.walletAddress,
                    to: toAddress,
                    amount,
                    purpose,
                    category: category || 'general',
                    tags: tags || [],
                    timestamp: new Date()
                }
            });
        } catch (error) {
            console.error('代币转账失败:', error);
            return next(new ErrorResponse('代币转账失败', 500));
        }
    });

    /**
     * @desc    获取交易详情
     * @route   GET /api/v1/blockchain/transaction/:id
     * @access  Public
     */
    getTransaction = asyncHandler(async (req, res, next) => {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return next(new ErrorResponse('无效的交易ID', 400));
        }

        try {
            const transaction = await this.blockchainService.getTransaction(parseInt(id));

            res.status(200).json({
                success: true,
                data: transaction
            });
        } catch (error) {
            console.error('获取交易详情失败:', error);
            return next(new ErrorResponse('获取交易详情失败', 500));
        }
    });

    /**
     * @desc    获取用户交易历史
     * @route   GET /api/v1/blockchain/transactions/:address
     * @access  Private
     */
    getUserTransactions = asyncHandler(async (req, res, next) => {
        const { address } = req.params;

        if (!this.blockchainService.isValidAddress(address)) {
            return next(new ErrorResponse('无效的钱包地址', 400));
        }

        try {
            const transactions = await this.blockchainService.getUserTransactions(address);

            res.status(200).json({
                success: true,
                count: transactions.length,
                data: transactions
            });
        } catch (error) {
            console.error('获取交易历史失败:', error);
            return next(new ErrorResponse('获取交易历史失败', 500));
        }
    });

    /**
     * @desc    生成新钱包
     * @route   POST /api/v1/blockchain/wallet/generate
     * @access  Private
     */
    generateWallet = asyncHandler(async (req, res, next) => {
        try {
            const wallet = this.blockchainService.generateWallet();

            // 更新用户钱包信息
            const user = await User.findById(req.user.id);
            user.walletAddress = wallet.address;
            user.privateKey = wallet.privateKey; // 注意：实际生产环境中应该加密存储
            await user.save();

            res.status(200).json({
                success: true,
                data: {
                    address: wallet.address,
                    // 不返回私钥给前端
                    message: '钱包生成成功，私钥已安全存储'
                }
            });
        } catch (error) {
            console.error('生成钱包失败:', error);
            return next(new ErrorResponse('生成钱包失败', 500));
        }
    });

    /**
     * @desc    获取当前Gas价格
     * @route   GET /api/v1/blockchain/gas-price
     * @access  Public
     */
    getGasPrice = asyncHandler(async (req, res, next) => {
        try {
            const gasPrice = await this.blockchainService.getGasPrice();

            res.status(200).json({
                success: true,
                data: {
                    gasPrice: gasPrice + ' Gwei',
                    timestamp: new Date()
                }
            });
        } catch (error) {
            console.error('获取Gas价格失败:', error);
            return next(new ErrorResponse('获取Gas价格失败', 500));
        }
    });

    /**
     * @desc    获取用户代币奖励历史
     * @route   GET /api/v1/blockchain/rewards/:userId
     * @access  Private
     */
    getUserRewards = asyncHandler(async (req, res, next) => {
        const { userId } = req.params;

        try {
            const user = await User.findById(userId).select('tokenRewards walletAddress');
            if (!user) {
                return next(new ErrorResponse('用户不存在', 404));
            }

            // 如果用户有钱包地址，也从区块链获取奖励历史
            let blockchainRewards = [];
            if (user.walletAddress) {
                try {
                    // 这里可以调用区块链服务获取奖励历史
                    // blockchainRewards = await this.blockchainService.getUserRewardHistory(user.walletAddress);
                } catch (error) {
                    console.warn('获取区块链奖励历史失败:', error);
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    databaseRewards: user.tokenRewards || [],
                    blockchainRewards,
                    totalRewards: (user.tokenRewards || []).reduce((sum, reward) => sum + reward.amount, 0)
                }
            });
        } catch (error) {
            console.error('获取用户奖励历史失败:', error);
            return next(new ErrorResponse('获取用户奖励历史失败', 500));
        }
    });
}

module.exports = new BlockchainController();

