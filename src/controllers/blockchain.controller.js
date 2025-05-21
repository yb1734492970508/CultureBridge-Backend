// src/controllers/blockchain.controller.js
const User = require('../models/user.model');
const blockchainService = require('../blockchain/service');
const { ethers } = require('ethers');

// 初始化区块链服务
const initializeBlockchain = async () => {
  if (!blockchainService.initialized) {
    // 根据环境变量选择网络
    const network = process.env.NODE_ENV === 'production' ? 'polygon' : 'mumbai';
    await blockchainService.initialize(network);
  }
};

// 用户钱包地址生成
exports.generateWallet = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const wallet = blockchainService.generateUserWallet();
    
    res.status(200).json({
      success: true,
      data: {
        address: wallet.address,
        privateKey: wallet.privateKey
      },
      message: '钱包地址生成成功'
    });
  } catch (err) {
    console.error('生成钱包地址失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 验证钱包地址
exports.validateWalletAddress = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        message: '钱包地址是必填项'
      });
    }
    
    const isValid = blockchainService.validateWalletAddress(address);
    
    res.status(200).json({
      success: true,
      data: {
        isValid
      },
      message: isValid ? '钱包地址有效' : '钱包地址无效'
    });
  } catch (err) {
    console.error('验证钱包地址失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取钱包余额
exports.getWalletBalance = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        message: '钱包地址是必填项'
      });
    }
    
    const isValid = blockchainService.validateWalletAddress(address);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '钱包地址无效'
      });
    }
    
    const balance = await blockchainService.getWalletBalance(address);
    
    res.status(200).json({
      success: true,
      data: {
        address,
        balance
      },
      message: '获取钱包余额成功'
    });
  } catch (err) {
    console.error('获取钱包余额失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 创建用户链上身份
exports.createIdentity = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { userId } = req.params;
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否已有钱包地址
    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未绑定钱包地址'
      });
    }
    
    // 检查用户是否已有链上身份
    if (user.blockchainIdentityId) {
      return res.status(400).json({
        success: false,
        message: '用户已有链上身份'
      });
    }
    
    // 创建链上身份
    const identityContract = blockchainService.getIdentityContract();
    if (!identityContract) {
      return res.status(500).json({
        success: false,
        message: '身份合约未初始化'
      });
    }
    
    // 调用合约创建身份
    const tx = await identityContract.createIdentity(user.walletAddress, user.username);
    const receipt = await tx.wait();
    
    // 解析事件获取身份ID
    const event = receipt.events.find(e => e.event === 'IdentityCreated');
    const identityId = event.args.id.toNumber();
    
    // 更新用户记录
    user.blockchainIdentityId = identityId;
    user.blockchainSyncedAt = new Date();
    await user.save();
    
    res.status(201).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        blockchainIdentityId: identityId
      },
      message: '用户链上身份创建成功'
    });
  } catch (err) {
    console.error('创建用户链上身份失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 更新用户声誉分数
exports.updateReputation = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { userId } = req.params;
    const { reputationScore } = req.body;
    
    // 验证声誉分数
    if (reputationScore === undefined || isNaN(reputationScore)) {
      return res.status(400).json({
        success: false,
        message: '声誉分数无效'
      });
    }
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否有链上身份
    if (!user.blockchainIdentityId || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未创建链上身份'
      });
    }
    
    // 获取身份合约
    const identityContract = blockchainService.getIdentityContract();
    if (!identityContract) {
      return res.status(500).json({
        success: false,
        message: '身份合约未初始化'
      });
    }
    
    // 调用合约更新声誉分数
    const tx = await identityContract.updateReputation(user.walletAddress, reputationScore);
    await tx.wait();
    
    // 更新用户记录
    user.reputationScore = reputationScore;
    user.blockchainSyncedAt = new Date();
    await user.save();
    
    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        reputationScore
      },
      message: '用户声誉分数更新成功'
    });
  } catch (err) {
    console.error('更新用户声誉分数失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 添加用户贡献记录
exports.addContribution = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { userId } = req.params;
    const { contributionType, description } = req.body;
    
    // 验证贡献类型
    if (!contributionType) {
      return res.status(400).json({
        success: false,
        message: '贡献类型是必填项'
      });
    }
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否有链上身份
    if (!user.blockchainIdentityId || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未创建链上身份'
      });
    }
    
    // 获取身份合约
    const identityContract = blockchainService.getIdentityContract();
    if (!identityContract) {
      return res.status(500).json({
        success: false,
        message: '身份合约未初始化'
      });
    }
    
    // 调用合约添加贡献记录
    const tx = await identityContract.addContribution(user.walletAddress);
    await tx.wait();
    
    // 更新用户记录
    user.contributionCount = (user.contributionCount || 0) + 1;
    user.blockchainSyncedAt = new Date();
    await user.save();
    
    res.status(201).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        contributionCount: user.contributionCount,
        contributionType,
        description
      },
      message: '用户贡献记录添加成功'
    });
  } catch (err) {
    console.error('添加用户贡献记录失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取用户链上身份信息
exports.getIdentity = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { userId } = req.params;
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否有链上身份
    if (!user.blockchainIdentityId || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未创建链上身份'
      });
    }
    
    // 获取身份合约
    const identityContract = blockchainService.getIdentityContract();
    if (!identityContract) {
      return res.status(500).json({
        success: false,
        message: '身份合约未初始化'
      });
    }
    
    // 调用合约获取身份信息
    const identity = await identityContract.getIdentity(user.walletAddress);
    
    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        blockchainIdentityId: identity.id.toNumber(),
        reputationScore: identity.reputationScore.toNumber(),
        contributionCount: identity.contributionCount.toNumber(),
        createdAt: new Date(identity.createdAt.toNumber() * 1000),
        updatedAt: new Date(identity.updatedAt.toNumber() * 1000)
      },
      message: '获取用户链上身份信息成功'
    });
  } catch (err) {
    console.error('获取用户链上身份信息失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};
