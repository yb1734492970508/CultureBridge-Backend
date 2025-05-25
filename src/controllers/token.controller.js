// src/controllers/token.controller.js
const tokenService = require('../blockchain/token.service');
const User = require('../models/user.model');
const TokenTransaction = require('../models/token.model');
const { validationResult } = require('express-validator');

/**
 * 获取用户代币余额
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 获取代币余额
    const balance = await tokenService.getBalance(user.walletAddress);
    
    // 获取质押信息
    const stakeInfo = await tokenService.getStakeInfo(user.walletAddress);
    
    // 获取投票权重
    const votingPower = await tokenService.getVotingPower(user.walletAddress);

    return res.status(200).json({
      walletAddress: user.walletAddress,
      balance,
      staked: stakeInfo.amount,
      votingPower,
      rewards: stakeInfo.accumulatedRewards
    });
  } catch (error) {
    console.error('获取代币余额失败:', error);
    return res.status(500).json({ message: '获取代币余额失败', error: error.message });
  }
};

/**
 * 转移代币
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.transferTokens = async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, amount, reason } = req.body;
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 检查接收方地址
    if (!to || !to.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ message: '无效的接收方地址' });
    }

    // 检查金额
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: '无效的转账金额' });
    }

    // 检查余额
    const balance = await tokenService.getBalance(user.walletAddress);
    if (parseFloat(balance) < parseFloat(amount)) {
      return res.status(400).json({ 
        message: '余额不足',
        balance,
        amount
      });
    }

    // 执行转账
    const result = await tokenService.transfer(to, amount, reason || '用户转账');

    return res.status(200).json({
      message: '转账成功',
      transaction: {
        from: user.walletAddress,
        to,
        amount,
        txHash: result.txHash
      }
    });
  } catch (error) {
    console.error('转账失败:', error);
    return res.status(500).json({ message: '转账失败', error: error.message });
  }
};

/**
 * 质押代币
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.stakeTokens = async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, lockPeriodIndex } = req.body;
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 检查金额
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: '无效的质押金额' });
    }

    // 检查锁定期索引
    if (lockPeriodIndex === undefined || lockPeriodIndex < 0 || lockPeriodIndex > 4) {
      return res.status(400).json({ message: '无效的锁定期选项' });
    }

    // 检查余额
    const balance = await tokenService.getBalance(user.walletAddress);
    if (parseFloat(balance) < parseFloat(amount)) {
      return res.status(400).json({ 
        message: '余额不足',
        balance,
        amount
      });
    }

    // 执行质押
    const result = await tokenService.stakeTokens(user.walletAddress, amount, lockPeriodIndex);

    return res.status(200).json({
      message: '质押成功',
      stake: {
        address: user.walletAddress,
        amount,
        lockPeriodIndex,
        txHash: result.txHash
      }
    });
  } catch (error) {
    console.error('质押失败:', error);
    return res.status(500).json({ message: '质押失败', error: error.message });
  }
};

/**
 * 获取质押信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getStakeInfo = async (req, res) => {
  try {
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 获取质押信息
    const stakeInfo = await tokenService.getStakeInfo(user.walletAddress);
    
    // 获取锁定期选项
    const lockPeriods = [
      { days: 0, multiplier: 1.0, name: '无锁定' },
      { days: 30, multiplier: 1.2, name: '30天' },
      { days: 90, multiplier: 1.5, name: '90天' },
      { days: 180, multiplier: 2.0, name: '180天' },
      { days: 365, multiplier: 3.0, name: '365天' }
    ];

    return res.status(200).json({
      walletAddress: user.walletAddress,
      stakeInfo: {
        ...stakeInfo,
        lockPeriod: lockPeriods[stakeInfo.lockPeriodIndex]
      }
    });
  } catch (error) {
    console.error('获取质押信息失败:', error);
    return res.status(500).json({ message: '获取质押信息失败', error: error.message });
  }
};

/**
 * 领取奖励
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.claimRewards = async (req, res) => {
  try {
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 检查是否有可领取的奖励
    const reward = await tokenService.calculateReward(user.walletAddress);
    if (parseFloat(reward) <= 0) {
      return res.status(400).json({ message: '没有可领取的奖励' });
    }

    // 领取奖励
    const result = await tokenService.claimReward(user.walletAddress);

    return res.status(200).json({
      message: '奖励领取成功',
      reward: {
        address: user.walletAddress,
        amount: result.reward,
        txHash: result.txHash
      }
    });
  } catch (error) {
    console.error('领取奖励失败:', error);
    return res.status(500).json({ message: '领取奖励失败', error: error.message });
  }
};

/**
 * 获取交易历史
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10, type } = req.query;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 构建查询条件
    const query = {
      $or: [{ from: user.walletAddress }, { to: user.walletAddress }]
    };
    
    if (type) {
      query.transactionType = type.toUpperCase();
    }

    // 分页查询
    const skip = (page - 1) * limit;
    const transactions = await TokenTransaction.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // 获取总数
    const total = await TokenTransaction.countDocuments(query);

    return res.status(200).json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取交易历史失败:', error);
    return res.status(500).json({ message: '获取交易历史失败', error: error.message });
  }
};

/**
 * 获取代币统计信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getTokenStats = async (req, res) => {
  try {
    // 获取代币总供应量
    const totalSupply = await tokenService.getTotalSupply();
    
    // 获取总质押量
    const totalStaked = await tokenService.getTotalStaked();
    
    // 计算质押率
    const stakingRate = totalStaked && totalSupply ? 
      (parseFloat(totalStaked) / parseFloat(totalSupply) * 100).toFixed(2) : 0;
    
    // 获取交易统计
    const transferCount = await TokenTransaction.countDocuments({ transactionType: 'TRANSFER' });
    const stakeCount = await TokenTransaction.countDocuments({ transactionType: 'STAKE' });
    const rewardCount = await TokenTransaction.countDocuments({ transactionType: 'REWARD' });
    
    // 获取最近交易
    const recentTransactions = await TokenTransaction.find()
      .sort({ timestamp: -1 })
      .limit(5);
    
    return res.status(200).json({
      supply: {
        total: totalSupply,
        staked: totalStaked,
        stakingRate
      },
      transactions: {
        transfer: transferCount,
        stake: stakeCount,
        reward: rewardCount,
        total: transferCount + stakeCount + rewardCount
      },
      recent: recentTransactions
    });
  } catch (error) {
    console.error('获取代币统计信息失败:', error);
    return res.status(500).json({ message: '获取代币统计信息失败', error: error.message });
  }
};
