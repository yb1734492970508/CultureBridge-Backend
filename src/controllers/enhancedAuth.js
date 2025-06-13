const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const EnhancedBlockchainService = require('../services/enhancedBlockchainService');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

class EnhancedAuthController {
    constructor() {
        this.blockchainService = new EnhancedBlockchainService();
        
        // 登录限制器
        this.loginLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 5, // 最多5次尝试
            message: {
                success: false,
                error: '登录尝试次数过多，请15分钟后再试'
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        
        // 注册限制器
        this.registerLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1小时
            max: 3, // 最多3次注册
            message: {
                success: false,
                error: '注册尝试次数过多，请1小时后再试'
            }
        });
    }

    /**
     * @desc    用户注册
     * @route   POST /api/v1/auth/register
     * @access  Public
     */
    register = asyncHandler(async (req, res, next) => {
        const { 
            username, 
            email, 
            password, 
            nativeLanguages, 
            learningLanguages,
            createWallet = true 
        } = req.body;

        // 验证输入
        if (!username || !email || !password) {
            return next(new ErrorResponse('请提供用户名、邮箱和密码', 400));
        }

        // 检查用户名和邮箱是否已存在
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return next(new ErrorResponse('该邮箱已被注册', 400));
            }
            if (existingUser.username === username) {
                return next(new ErrorResponse('该用户名已被使用', 400));
            }
        }

        // 创建用户数据
        const userData = {
            username,
            email,
            password,
            nativeLanguages: nativeLanguages || [],
            learningLanguages: learningLanguages || []
        };

        // 如果需要创建钱包
        if (createWallet) {
            try {
                const wallet = this.blockchainService.generateWallet();
                userData.walletAddress = wallet.address;
                userData.privateKey = this.encryptPrivateKey(wallet.privateKey);
            } catch (error) {
                console.warn('创建钱包失败，用户可稍后创建:', error);
            }
        }

        // 创建用户
        const user = await User.create(userData);

        // 发放注册奖励
        if (user.walletAddress) {
            try {
                await this.distributeRegistrationReward(user);
            } catch (error) {
                console.warn('发放注册奖励失败:', error);
            }
        }

        // 生成响应（不包含敏感信息）
        const userResponse = await User.findById(user._id).select('-privateKey');
        
        this.sendTokenResponse(userResponse, 201, res, {
            message: '注册成功',
            walletCreated: !!user.walletAddress
        });
    });

    /**
     * @desc    用户登录
     * @route   POST /api/v1/auth/login
     * @access  Public
     */
    login = asyncHandler(async (req, res, next) => {
        const { email, password, rememberMe = false } = req.body;

        // 验证邮箱和密码
        if (!email || !password) {
            return next(new ErrorResponse('请提供邮箱和密码', 400));
        }

        // 检查用户（包含密码字段）
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return next(new ErrorResponse('邮箱或密码错误', 401));
        }

        // 检查密码
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return next(new ErrorResponse('邮箱或密码错误', 401));
        }

        // 更新最后登录时间
        user.lastLoginAt = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        // 发放每日登录奖励
        try {
            await this.distributeDailyLoginReward(user);
        } catch (error) {
            console.warn('发放每日登录奖励失败:', error);
        }

        // 生成响应
        const userResponse = await User.findById(user._id).select('-privateKey');
        
        this.sendTokenResponse(userResponse, 200, res, {
            message: '登录成功',
            isFirstLogin: user.loginCount === 1
        }, rememberMe);
    });

    /**
     * @desc    钱包登录
     * @route   POST /api/v1/auth/wallet-login
     * @access  Public
     */
    walletLogin = asyncHandler(async (req, res, next) => {
        const { walletAddress, signature, message } = req.body;

        if (!walletAddress || !signature || !message) {
            return next(new ErrorResponse('请提供钱包地址、签名和消息', 400));
        }

        // 验证钱包地址格式
        if (!this.blockchainService.isValidAddress(walletAddress)) {
            return next(new ErrorResponse('无效的钱包地址', 400));
        }

        // 验证签名（这里需要实现签名验证逻辑）
        const isValidSignature = await this.verifyWalletSignature(walletAddress, signature, message);
        
        if (!isValidSignature) {
            return next(new ErrorResponse('签名验证失败', 401));
        }

        // 查找或创建用户
        let user = await User.findOne({ walletAddress });
        
        if (!user) {
            // 创建新用户
            user = await User.create({
                username: `user_${walletAddress.slice(-8)}`,
                email: `${walletAddress.toLowerCase()}@wallet.local`,
                password: crypto.randomBytes(32).toString('hex'), // 随机密码
                walletAddress,
                isWalletUser: true
            });
        }

        // 更新登录信息
        user.lastLoginAt = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        const userResponse = await User.findById(user._id).select('-privateKey');
        
        this.sendTokenResponse(userResponse, 200, res, {
            message: '钱包登录成功',
            isNewUser: user.loginCount === 1
        });
    });

    /**
     * @desc    用户登出
     * @route   POST /api/v1/auth/logout
     * @access  Private
     */
    logout = asyncHandler(async (req, res, next) => {
        // 清除cookie
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        res.status(200).json({
            success: true,
            message: '登出成功'
        });
    });

    /**
     * @desc    获取当前用户信息
     * @route   GET /api/v1/auth/me
     * @access  Private
     */
    getMe = asyncHandler(async (req, res, next) => {
        const user = await User.findById(req.user.id)
            .select('-privateKey')
            .populate('profile', 'avatar bio location');

        // 获取区块链相关信息
        let blockchainInfo = {};
        if (user.walletAddress) {
            try {
                const [balance, stats] = await Promise.all([
                    this.blockchainService.getUserBalance(user.walletAddress),
                    this.blockchainService.getUserStats(user.walletAddress)
                ]);
                
                blockchainInfo = {
                    cbtBalance: balance,
                    totalEarned: stats.totalEarned,
                    totalSpent: stats.totalSpent,
                    totalTransactions: stats.totalTransactions,
                    todayRewards: stats.todayRewards
                };
            } catch (error) {
                console.warn('获取区块链信息失败:', error);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                user,
                blockchain: blockchainInfo
            }
        });
    });

    /**
     * @desc    更新用户详情
     * @route   PUT /api/v1/auth/update-details
     * @access  Private
     */
    updateDetails = asyncHandler(async (req, res, next) => {
        const allowedFields = [
            'username', 
            'email', 
            'nativeLanguages', 
            'learningLanguages',
            'languageProficiency'
        ];
        
        const fieldsToUpdate = {};
        
        // 只允许更新指定字段
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                fieldsToUpdate[field] = req.body[field];
            }
        });

        // 检查用户名和邮箱唯一性
        if (fieldsToUpdate.username || fieldsToUpdate.email) {
            const query = { _id: { $ne: req.user.id } };
            if (fieldsToUpdate.username) query.username = fieldsToUpdate.username;
            if (fieldsToUpdate.email) query.email = fieldsToUpdate.email;
            
            const existingUser = await User.findOne(query);
            if (existingUser) {
                return next(new ErrorResponse('用户名或邮箱已被使用', 400));
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user.id, 
            fieldsToUpdate, 
            {
                new: true,
                runValidators: true
            }
        ).select('-privateKey');

        res.status(200).json({
            success: true,
            data: user,
            message: '用户信息更新成功'
        });
    });

    /**
     * @desc    更新密码
     * @route   PUT /api/v1/auth/update-password
     * @access  Private
     */
    updatePassword = asyncHandler(async (req, res, next) => {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return next(new ErrorResponse('请提供当前密码和新密码', 400));
        }

        const user = await User.findById(req.user.id).select('+password');

        // 检查当前密码
        if (!(await user.matchPassword(currentPassword))) {
            return next(new ErrorResponse('当前密码不正确', 401));
        }

        // 检查新密码强度
        if (newPassword.length < 8) {
            return next(new ErrorResponse('新密码至少需要8个字符', 400));
        }

        user.password = newPassword;
        await user.save();

        this.sendTokenResponse(user, 200, res, {
            message: '密码更新成功'
        });
    });

    /**
     * @desc    创建或绑定钱包
     * @route   POST /api/v1/auth/create-wallet
     * @access  Private
     */
    createWallet = asyncHandler(async (req, res, next) => {
        const user = await User.findById(req.user.id);

        if (user.walletAddress) {
            return next(new ErrorResponse('用户已有钱包地址', 400));
        }

        try {
            const wallet = this.blockchainService.generateWallet();
            
            user.walletAddress = wallet.address;
            user.privateKey = this.encryptPrivateKey(wallet.privateKey);
            await user.save();

            // 发放钱包创建奖励
            await this.distributeWalletCreationReward(user);

            res.status(200).json({
                success: true,
                data: {
                    walletAddress: wallet.address
                },
                message: '钱包创建成功'
            });
        } catch (error) {
            console.error('创建钱包失败:', error);
            return next(new ErrorResponse('钱包创建失败', 500));
        }
    });

    /**
     * @desc    绑定现有钱包
     * @route   POST /api/v1/auth/bind-wallet
     * @access  Private
     */
    bindWallet = asyncHandler(async (req, res, next) => {
        const { walletAddress, signature, message } = req.body;

        if (!walletAddress || !signature || !message) {
            return next(new ErrorResponse('请提供钱包地址、签名和消息', 400));
        }

        const user = await User.findById(req.user.id);

        if (user.walletAddress) {
            return next(new ErrorResponse('用户已绑定钱包', 400));
        }

        // 验证钱包地址格式
        if (!this.blockchainService.isValidAddress(walletAddress)) {
            return next(new ErrorResponse('无效的钱包地址', 400));
        }

        // 检查钱包是否已被其他用户绑定
        const existingUser = await User.findOne({ walletAddress });
        if (existingUser) {
            return next(new ErrorResponse('该钱包已被其他用户绑定', 400));
        }

        // 验证签名
        const isValidSignature = await this.verifyWalletSignature(walletAddress, signature, message);
        if (!isValidSignature) {
            return next(new ErrorResponse('钱包签名验证失败', 401));
        }

        user.walletAddress = walletAddress;
        await user.save();

        res.status(200).json({
            success: true,
            data: {
                walletAddress
            },
            message: '钱包绑定成功'
        });
    });

    /**
     * 发放注册奖励
     */
    async distributeRegistrationReward(user) {
        if (!user.walletAddress) return;

        try {
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) return;

            await this.blockchainService.distributeReward(
                user.walletAddress,
                10, // 10 CBT注册奖励
                '新用户注册奖励',
                'COMMUNITY_CONTRIBUTION',
                adminPrivateKey
            );

            console.log(`✅ 注册奖励已发放给用户: ${user.username}`);
        } catch (error) {
            console.error('发放注册奖励失败:', error);
        }
    }

    /**
     * 发放每日登录奖励
     */
    async distributeDailyLoginReward(user) {
        if (!user.walletAddress) return;

        try {
            const today = new Date().toDateString();
            const lastRewardDate = user.lastDailyReward ? user.lastDailyReward.toDateString() : null;

            // 检查今天是否已经发放过奖励
            if (lastRewardDate === today) return;

            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) return;

            await this.blockchainService.distributeReward(
                user.walletAddress,
                1, // 1 CBT每日登录奖励
                '每日登录奖励',
                'COMMUNITY_CONTRIBUTION',
                adminPrivateKey
            );

            // 更新最后奖励时间
            user.lastDailyReward = new Date();
            await user.save();

            console.log(`✅ 每日登录奖励已发放给用户: ${user.username}`);
        } catch (error) {
            console.error('发放每日登录奖励失败:', error);
        }
    }

    /**
     * 发放钱包创建奖励
     */
    async distributeWalletCreationReward(user) {
        try {
            const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
            if (!adminPrivateKey) return;

            await this.blockchainService.distributeReward(
                user.walletAddress,
                5, // 5 CBT钱包创建奖励
                '钱包创建奖励',
                'COMMUNITY_CONTRIBUTION',
                adminPrivateKey
            );

            console.log(`✅ 钱包创建奖励已发放给用户: ${user.username}`);
        } catch (error) {
            console.error('发放钱包创建奖励失败:', error);
        }
    }

    /**
     * 验证钱包签名
     */
    async verifyWalletSignature(walletAddress, signature, message) {
        try {
            // 这里需要实现实际的签名验证逻辑
            // 使用ethers.js验证签名
            const { ethers } = require('ethers');
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error('签名验证失败:', error);
            return false;
        }
    }

    /**
     * 加密私钥
     */
    encryptPrivateKey(privateKey) {
        const algorithm = 'aes-256-gcm';
        const secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, secretKey);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return `${iv.toString('hex')}:${encrypted}`;
    }

    /**
     * 解密私钥
     */
    decryptPrivateKey(encryptedPrivateKey) {
        const algorithm = 'aes-256-gcm';
        const secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
        
        const [ivHex, encrypted] = encryptedPrivateKey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        
        const decipher = crypto.createDecipher(algorithm, secretKey);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * 生成token并发送响应
     */
    sendTokenResponse(user, statusCode, res, additionalData = {}, rememberMe = false) {
        // 创建token
        const token = user.getSignedJwtToken();

        // Cookie选项
        const cookieExpire = rememberMe ? 30 : 1; // 记住我：30天，否则1天
        const options = {
            expires: new Date(Date.now() + cookieExpire * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        };

        res
            .status(statusCode)
            .cookie('token', token, options)
            .json({
                success: true,
                token,
                data: user,
                ...additionalData
            });
    }
}

module.exports = new EnhancedAuthController();

