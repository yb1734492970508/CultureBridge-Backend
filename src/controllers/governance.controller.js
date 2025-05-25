// src/controllers/governance.controller.js
const ethers = require('ethers');
const GovernanceProposal = require('../models/governance.model');
const User = require('../models/user.model');
const TokenTransaction = require('../models/token.model');
const tokenService = require('../blockchain/token.service');
const config = require('../config/blockchain.config');
const { validationResult } = require('express-validator');

/**
 * 创建治理提案
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.createProposal = async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, proposalType, targets, values, calldatas } = req.body;
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 检查用户投票权重是否满足提案门槛
    const votingPower = await tokenService.getVotingPower(user.walletAddress);
    const minProposalThreshold = 10000; // 最低提案门槛，单位为代币数量

    if (parseFloat(votingPower) < minProposalThreshold) {
      return res.status(403).json({ 
        message: '投票权重不足，无法创建提案',
        required: minProposalThreshold,
        current: votingPower
      });
    }

    // 调用区块链服务创建提案
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(user.privateKey || config.privateKey, provider);
    const governanceContract = new ethers.Contract(
      config.governanceAddress,
      require('../contracts/abis/CultureBridgeGovernance.json').abi,
      wallet
    );

    // 将提案类型转换为合约枚举值
    let proposalTypeEnum;
    switch (proposalType) {
      case 'PARAMETER_CHANGE':
        proposalTypeEnum = 1; // 对应合约中的 ProposalType.PARAMETER_CHANGE
        break;
      case 'FEATURE_REQUEST':
        proposalTypeEnum = 0; // 对应合约中的 ProposalType.PLATFORM_FEATURE
        break;
      case 'FUND_ALLOCATION':
        proposalTypeEnum = 2; // 对应合约中的 ProposalType.FUND_ALLOCATION
        break;
      case 'COMMUNITY_INITIATIVE':
      case 'OTHER':
      default:
        proposalTypeEnum = 0; // 默认为平台功能提案
    }

    // 创建提案
    const tx = await governanceContract.proposeWithMetadata(
      targets,
      values.map(v => ethers.utils.parseEther(v.toString())),
      calldatas,
      description,
      proposalTypeEnum,
      title
    );

    const receipt = await tx.wait();
    
    // 从事件中获取提案ID
    const proposalCreatedEvent = receipt.events.find(e => e.event === 'ProposalCreatedWithMetadata');
    const proposalId = proposalCreatedEvent.args.proposalId.toString();

    // 获取提案详情
    const proposalDetails = await governanceContract.proposals(proposalId);
    const startBlock = proposalDetails.startBlock.toNumber();
    const endBlock = proposalDetails.endBlock.toNumber();
    
    // 估算开始和结束时间
    const currentBlock = await provider.getBlockNumber();
    const currentBlockData = await provider.getBlock(currentBlock);
    const blockTime = 15; // 平均出块时间，单位为秒
    
    const startTime = new Date(currentBlockData.timestamp * 1000 + (startBlock - currentBlock) * blockTime * 1000);
    const endTime = new Date(currentBlockData.timestamp * 1000 + (endBlock - currentBlock) * blockTime * 1000);

    // 保存提案到数据库
    const proposal = new GovernanceProposal({
      proposalId,
      title,
      description,
      proposalType,
      proposer: user.walletAddress,
      targets,
      values: values.map(v => v.toString()),
      calldatas,
      startBlock,
      endBlock,
      startTime,
      endTime,
      status: 'PENDING',
      quorum: ethers.utils.formatEther(proposalDetails.quorum),
      transactionHash: tx.hash,
      metadata: {
        createdBy: userId,
        blockTimestamp: currentBlockData.timestamp
      }
    });

    await proposal.save();

    // 记录交易
    const transaction = new TokenTransaction({
      txHash: tx.hash,
      from: user.walletAddress,
      to: config.governanceAddress,
      amount: '0',
      tokenType: 'CBT',
      transactionType: 'GOVERNANCE',
      blockNumber: receipt.blockNumber,
      status: 'CONFIRMED',
      reason: `创建提案: ${title}`,
      metadata: {
        proposalId,
        proposalType
      }
    });

    await transaction.save();

    return res.status(201).json({
      message: '提案创建成功',
      proposal: {
        id: proposalId,
        title,
        description,
        proposalType,
        startBlock,
        endBlock,
        startTime,
        endTime,
        status: 'PENDING',
        transactionHash: tx.hash
      }
    });
  } catch (error) {
    console.error('创建提案失败:', error);
    return res.status(500).json({ message: '创建提案失败', error: error.message });
  }
};

/**
 * 获取提案列表
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getProposals = async (req, res) => {
  try {
    const { status, proposalType, page = 1, limit = 10 } = req.query;
    
    // 构建查询条件
    const query = {};
    if (status) query.status = status.toUpperCase();
    if (proposalType) query.proposalType = proposalType.toUpperCase();
    
    // 分页查询
    const skip = (page - 1) * limit;
    const proposals = await GovernanceProposal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总数
    const total = await GovernanceProposal.countDocuments(query);
    
    return res.status(200).json({
      proposals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取提案列表失败:', error);
    return res.status(500).json({ message: '获取提案列表失败', error: error.message });
  }
};

/**
 * 获取提案详情
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getProposalById = async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    // 从数据库获取提案
    const proposal = await GovernanceProposal.findOne({ proposalId });
    if (!proposal) {
      return res.status(404).json({ message: '提案不存在' });
    }
    
    // 从区块链获取最新状态
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const governanceContract = new ethers.Contract(
      config.governanceAddress,
      require('../contracts/abis/CultureBridgeGovernance.json').abi,
      provider
    );
    
    // 获取提案状态
    const proposalState = await governanceContract.state(proposalId);
    const stateMap = [
      'PENDING', 'ACTIVE', 'CANCELED', 'DEFEATED', 'SUCCEEDED', 'QUEUED', 'EXPIRED', 'EXECUTED'
    ];
    const currentStatus = stateMap[proposalState] || 'UNKNOWN';
    
    // 获取投票数据
    const proposalVotes = await governanceContract.proposalVotes(proposalId);
    const forVotes = ethers.utils.formatEther(proposalVotes.forVotes);
    const againstVotes = ethers.utils.formatEther(proposalVotes.againstVotes);
    const abstainVotes = ethers.utils.formatEther(proposalVotes.abstainVotes);
    
    // 更新数据库中的提案状态和投票数据
    if (proposal.status !== currentStatus || 
        proposal.forVotes !== parseFloat(forVotes) ||
        proposal.againstVotes !== parseFloat(againstVotes) ||
        proposal.abstainVotes !== parseFloat(abstainVotes)) {
      
      proposal.status = currentStatus;
      proposal.forVotes = parseFloat(forVotes);
      proposal.againstVotes = parseFloat(againstVotes);
      proposal.abstainVotes = parseFloat(abstainVotes);
      await proposal.save();
    }
    
    // 获取提案者信息
    const proposer = await User.findOne({ walletAddress: proposal.proposer }, { username: 1, avatar: 1, reputationScore: 1 });
    
    return res.status(200).json({
      proposal: {
        ...proposal.toObject(),
        proposer: proposer ? {
          walletAddress: proposal.proposer,
          username: proposer.username,
          avatar: proposer.avatar,
          reputationScore: proposer.reputationScore
        } : { walletAddress: proposal.proposer },
        totalVotes: parseFloat(forVotes) + parseFloat(againstVotes) + parseFloat(abstainVotes),
        supportRate: parseFloat(forVotes) > 0 ? 
          (parseFloat(forVotes) / (parseFloat(forVotes) + parseFloat(againstVotes) + parseFloat(abstainVotes))) * 100 : 0
      }
    });
  } catch (error) {
    console.error('获取提案详情失败:', error);
    return res.status(500).json({ message: '获取提案详情失败', error: error.message });
  }
};

/**
 * 投票
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.castVote = async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { proposalId, support } = req.body;
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 检查提案是否存在
    const proposal = await GovernanceProposal.findOne({ proposalId });
    if (!proposal) {
      return res.status(404).json({ message: '提案不存在' });
    }

    // 检查提案状态是否为活跃
    if (proposal.status !== 'ACTIVE') {
      return res.status(400).json({ message: `提案当前状态为 ${proposal.status}，无法投票` });
    }

    // 调用区块链服务进行投票
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(user.privateKey || config.privateKey, provider);
    const governanceContract = new ethers.Contract(
      config.governanceAddress,
      require('../contracts/abis/CultureBridgeGovernance.json').abi,
      wallet
    );

    // 将支持类型转换为合约支持的值
    let supportValue;
    switch (support) {
      case 'FOR':
        supportValue = 1;
        break;
      case 'AGAINST':
        supportValue = 0;
        break;
      case 'ABSTAIN':
        supportValue = 2;
        break;
      default:
        return res.status(400).json({ message: '无效的投票选项' });
    }

    // 进行投票
    const tx = await governanceContract.castVote(proposalId, supportValue);
    const receipt = await tx.wait();

    // 记录交易
    const transaction = new TokenTransaction({
      txHash: tx.hash,
      from: user.walletAddress,
      to: config.governanceAddress,
      amount: '0',
      tokenType: 'CBT',
      transactionType: 'GOVERNANCE',
      blockNumber: receipt.blockNumber,
      status: 'CONFIRMED',
      reason: `对提案 ${proposalId} 进行投票: ${support}`,
      metadata: {
        proposalId,
        support
      }
    });

    await transaction.save();

    // 获取最新的投票数据
    const proposalVotes = await governanceContract.proposalVotes(proposalId);
    const forVotes = ethers.utils.formatEther(proposalVotes.forVotes);
    const againstVotes = ethers.utils.formatEther(proposalVotes.againstVotes);
    const abstainVotes = ethers.utils.formatEther(proposalVotes.abstainVotes);

    // 更新提案投票数据
    proposal.forVotes = parseFloat(forVotes);
    proposal.againstVotes = parseFloat(againstVotes);
    proposal.abstainVotes = parseFloat(abstainVotes);
    await proposal.save();

    return res.status(200).json({
      message: '投票成功',
      vote: {
        proposalId,
        voter: user.walletAddress,
        support,
        transactionHash: tx.hash
      },
      currentVotes: {
        forVotes: parseFloat(forVotes),
        againstVotes: parseFloat(againstVotes),
        abstainVotes: parseFloat(abstainVotes),
        totalVotes: parseFloat(forVotes) + parseFloat(againstVotes) + parseFloat(abstainVotes)
      }
    });
  } catch (error) {
    console.error('投票失败:', error);
    return res.status(500).json({ message: '投票失败', error: error.message });
  }
};

/**
 * 执行提案
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.executeProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const userId = req.userId;

    // 检查用户是否为管理员
    const user = await User.findById(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: '只有管理员可以执行提案' });
    }

    // 检查提案是否存在
    const proposal = await GovernanceProposal.findOne({ proposalId });
    if (!proposal) {
      return res.status(404).json({ message: '提案不存在' });
    }

    // 检查提案状态是否为已排队
    if (proposal.status !== 'QUEUED') {
      return res.status(400).json({ message: `提案当前状态为 ${proposal.status}，无法执行` });
    }

    // 调用区块链服务执行提案
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const governanceContract = new ethers.Contract(
      config.governanceAddress,
      require('../contracts/abis/CultureBridgeGovernance.json').abi,
      wallet
    );

    // 计算描述哈希
    const descriptionHash = ethers.utils.id(proposal.description);

    // 执行提案
    const tx = await governanceContract.execute(
      proposal.targets,
      proposal.values.map(v => ethers.utils.parseEther(v)),
      proposal.calldatas,
      descriptionHash
    );

    const receipt = await tx.wait();

    // 更新提案状态
    proposal.status = 'EXECUTED';
    proposal.executionTime = new Date();
    proposal.transactionHash = tx.hash;
    await proposal.save();

    // 记录交易
    const transaction = new TokenTransaction({
      txHash: tx.hash,
      from: wallet.address,
      to: config.governanceAddress,
      amount: '0',
      tokenType: 'CBT',
      transactionType: 'GOVERNANCE',
      blockNumber: receipt.blockNumber,
      status: 'CONFIRMED',
      reason: `执行提案: ${proposal.title}`,
      metadata: {
        proposalId,
        title: proposal.title
      }
    });

    await transaction.save();

    return res.status(200).json({
      message: '提案执行成功',
      proposal: {
        id: proposalId,
        title: proposal.title,
        status: 'EXECUTED',
        executionTime: proposal.executionTime,
        transactionHash: tx.hash
      }
    });
  } catch (error) {
    console.error('执行提案失败:', error);
    return res.status(500).json({ message: '执行提案失败', error: error.message });
  }
};

/**
 * 获取用户提案
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getUserProposals = async (req, res) => {
  try {
    const userId = req.userId;

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ message: '用户钱包地址未设置' });
    }

    // 获取用户提案
    const proposals = await GovernanceProposal.find({ proposer: user.walletAddress })
      .sort({ createdAt: -1 });

    return res.status(200).json({ proposals });
  } catch (error) {
    console.error('获取用户提案失败:', error);
    return res.status(500).json({ message: '获取用户提案失败', error: error.message });
  }
};

/**
 * 获取治理统计信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getGovernanceStats = async (req, res) => {
  try {
    // 获取提案统计
    const totalProposals = await GovernanceProposal.countDocuments();
    const activeProposals = await GovernanceProposal.countDocuments({ status: 'ACTIVE' });
    const executedProposals = await GovernanceProposal.countDocuments({ status: 'EXECUTED' });
    
    // 按类型统计提案
    const proposalsByType = await GovernanceProposal.aggregate([
      { $group: { _id: '$proposalType', count: { $sum: 1 } } }
    ]);
    
    // 获取代币统计
    const totalSupply = await tokenService.getTotalSupply();
    const totalStaked = await tokenService.getTotalStaked();
    
    // 计算参与率
    const participationRate = totalStaked && totalSupply ? 
      (parseFloat(totalStaked) / parseFloat(totalSupply) * 100).toFixed(2) : 0;
    
    return res.status(200).json({
      proposals: {
        total: totalProposals,
        active: activeProposals,
        executed: executedProposals,
        byType: proposalsByType.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      },
      token: {
        totalSupply,
        totalStaked,
        participationRate
      }
    });
  } catch (error) {
    console.error('获取治理统计信息失败:', error);
    return res.status(500).json({ message: '获取治理统计信息失败', error: error.message });
  }
};
