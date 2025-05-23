// src/controllers/activity.controller.js
const User = require('../models/user.model');
const Activity = require('../models/activity.model');
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

// 创建文化活动
exports.createActivity = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const {
      name,
      description,
      activityType,
      startTime,
      endTime,
      location,
      capacity,
      fee,
      culturalTags
    } = req.body;
    
    // 验证必填字段
    if (!name || !description || !activityType || !startTime || !endTime || !location) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }
    
    // 验证时间
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();
    
    if (startDate <= now) {
      return res.status(400).json({
        success: false,
        message: '开始时间必须在当前时间之后'
      });
    }
    
    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: '结束时间必须在开始时间之后'
      });
    }
    
    // 查找用户
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否有钱包地址
    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未绑定钱包地址'
      });
    }
    
    // 创建活动数据模型
    const activity = new Activity({
      name,
      description,
      activityType,
      startTime: startDate,
      endTime: endDate,
      location,
      capacity: capacity || 0,
      fee: fee || 0,
      organizer: user._id,
      organizerWallet: user.walletAddress,
      culturalTags: culturalTags || []
    });
    
    // 生成内容哈希
    const contentHash = ethers.utils.id(activity.generateContentHash());
    activity.contentHash = contentHash;
    
    // 保存到数据库
    await activity.save();
    
    // 调用区块链服务创建活动
    const activityData = {
      name,
      description,
      activityType,
      startTime: Math.floor(startDate.getTime() / 1000),
      endTime: Math.floor(endDate.getTime() / 1000),
      location,
      capacity: capacity || 0,
      fee: fee || 0,
      contentHash,
      culturalTags: culturalTags || []
    };
    
    const result = await blockchainService.createActivity(activityData);
    
    // 更新活动记录
    activity.blockchainActivityId = result.activityId;
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(201).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          name: activity.name,
          description: activity.description,
          activityType: activity.activityType,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          organizer: activity.organizer,
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash,
          status: activity.status,
          verificationStatus: activity.verificationStatus,
          culturalTags: activity.culturalTags
        }
      },
      message: '文化活动创建成功并已上链'
    });
  } catch (err) {
    console.error('创建文化活动失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 更新文化活动
exports.updateActivity = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { activityId } = req.params;
    
    // 查找活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 检查权限
    if (activity.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有活动组织者或管理员可以更新活动'
      });
    }
    
    // 检查活动是否已开始
    const now = new Date();
    if (activity.startTime <= now && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: '活动已开始，无法更新'
      });
    }
    
    const {
      name,
      description,
      activityType,
      startTime,
      endTime,
      location,
      capacity,
      fee,
      culturalTags
    } = req.body;
    
    // 更新活动字段
    if (name) activity.name = name;
    if (description) activity.description = description;
    if (activityType) activity.activityType = activityType;
    
    if (startTime) {
      const startDate = new Date(startTime);
      if (startDate <= now) {
        return res.status(400).json({
          success: false,
          message: '开始时间必须在当前时间之后'
        });
      }
      activity.startTime = startDate;
    }
    
    if (endTime) {
      const endDate = new Date(endTime);
      if (endDate <= activity.startTime) {
        return res.status(400).json({
          success: false,
          message: '结束时间必须在开始时间之后'
        });
      }
      activity.endTime = endDate;
    }
    
    if (location) activity.location = location;
    if (capacity !== undefined) activity.capacity = capacity;
    if (fee !== undefined) activity.fee = fee;
    if (culturalTags) activity.culturalTags = culturalTags;
    
    // 重新生成内容哈希
    const contentHash = ethers.utils.id(activity.generateContentHash());
    activity.contentHash = contentHash;
    
    // 保存到数据库
    await activity.save();
    
    // 检查是否已上链
    if (!activity.blockchainActivityId) {
      return res.status(400).json({
        success: false,
        message: '活动尚未上链，无法更新链上数据'
      });
    }
    
    // 调用区块链服务更新活动
    const activityData = {
      name: activity.name,
      description: activity.description,
      activityType: activity.activityType,
      startTime: Math.floor(activity.startTime.getTime() / 1000),
      endTime: Math.floor(activity.endTime.getTime() / 1000),
      location: activity.location,
      capacity: activity.capacity,
      fee: activity.fee,
      contentHash,
      culturalTags: activity.culturalTags
    };
    
    const result = await blockchainService.updateActivity(activity.blockchainActivityId, activityData);
    
    // 更新活动记录
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(200).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          name: activity.name,
          description: activity.description,
          activityType: activity.activityType,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          organizer: activity.organizer,
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash,
          status: activity.status,
          verificationStatus: activity.verificationStatus,
          culturalTags: activity.culturalTags
        }
      },
      message: '文化活动更新成功并已同步到区块链'
    });
  } catch (err) {
    console.error('更新文化活动失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 更改活动状态
exports.changeActivityStatus = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { activityId } = req.params;
    const { status } = req.body;
    
    // 验证状态
    const validStatuses = ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的活动状态'
      });
    }
    
    // 查找活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 检查权限
    if (activity.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有活动组织者或管理员可以更改活动状态'
      });
    }
    
    // 更新活动状态
    activity.status = status;
    await activity.save();
    
    // 检查是否已上链
    if (!activity.blockchainActivityId) {
      return res.status(400).json({
        success: false,
        message: '活动尚未上链，无法更新链上数据'
      });
    }
    
    // 映射状态到合约枚举
    const statusMap = {
      'PLANNED': 0,
      'ONGOING': 1,
      'COMPLETED': 2,
      'CANCELLED': 3
    };
    
    // 调用区块链服务更改活动状态
    const result = await blockchainService.changeActivityStatus(activity.blockchainActivityId, statusMap[status]);
    
    // 更新活动记录
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(200).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          status: activity.status,
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash
        }
      },
      message: '活动状态更新成功并已同步到区块链'
    });
  } catch (err) {
    console.error('更改活动状态失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 验证活动
exports.verifyActivity = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { activityId } = req.params;
    const { status, comments } = req.body;
    
    // 验证状态
    const validStatuses = ['VERIFIED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的验证状态'
      });
    }
    
    // 检查用户是否为验证人
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否有钱包地址
    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未绑定钱包地址'
      });
    }
    
    // 检查用户是否为验证人
    const isVerifier = await blockchainService.getActivityContract().isVerifier(user.walletAddress);
    if (!isVerifier && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有验证人或管理员可以验证活动'
      });
    }
    
    // 查找活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 检查是否已上链
    if (!activity.blockchainActivityId) {
      return res.status(400).json({
        success: false,
        message: '活动尚未上链，无法验证'
      });
    }
    
    // 更新活动验证状态
    activity.verificationStatus = status;
    activity.verifier = user._id;
    activity.verifierWallet = user.walletAddress;
    activity.verificationComments = comments || '';
    await activity.save();
    
    // 映射状态到合约枚举
    const statusMap = {
      'PENDING': 0,
      'VERIFIED': 1,
      'REJECTED': 2
    };
    
    // 调用区块链服务验证活动
    const result = await blockchainService.verifyActivity(
      activity.blockchainActivityId,
      statusMap[status],
      comments || ''
    );
    
    // 更新活动记录
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(200).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          verificationStatus: activity.verificationStatus,
          verifier: activity.verifier,
          verificationComments: activity.verificationComments,
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash
        }
      },
      message: '活动验证成功并已同步到区块链'
    });
  } catch (err) {
    console.error('验证活动失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 参与活动
exports.joinActivity = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { activityId } = req.params;
    
    // 查找活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 检查活动状态
    if (activity.status !== 'PLANNED' && activity.status !== 'ONGOING') {
      return res.status(400).json({
        success: false,
        message: '活动不可参与'
      });
    }
    
    // 检查活动容量
    if (activity.capacity > 0 && activity.participantCount >= activity.capacity) {
      return res.status(400).json({
        success: false,
        message: '活动已满员'
      });
    }
    
    // 查找用户
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 检查用户是否有钱包地址
    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: '用户尚未绑定钱包地址'
      });
    }
    
    // 检查用户是否已参与
    const existingParticipant = activity.participants.find(p => 
      p.user.toString() === user._id.toString()
    );
    
    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        message: '用户已参与该活动'
      });
    }
    
    // 检查是否已上链
    if (!activity.blockchainActivityId) {
      return res.status(400).json({
        success: false,
        message: '活动尚未上链，无法参与'
      });
    }
    
    // 调用区块链服务参与活动
    const result = await blockchainService.joinActivity(activity.blockchainActivityId);
    
    // 更新活动记录
    activity.addParticipant(user, user.walletAddress);
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(200).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          name: activity.name,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          participantCount: activity.participantCount,
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash
        }
      },
      message: '成功参与活动并已同步到区块链'
    });
  } catch (err) {
    console.error('参与活动失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 记录参与者出席
exports.recordAttendance = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { activityId, userId } = req.params;
    
    // 查找活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 检查权限
    if (activity.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '只有活动组织者或管理员可以记录出席'
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
    
    // 检查用户是否已参与
    const participant = activity.participants.find(p => 
      p.user.toString() === userId
    );
    
    if (!participant) {
      return res.status(400).json({
        success: false,
        message: '用户未参与该活动'
      });
    }
    
    // 检查是否已上链
    if (!activity.blockchainActivityId) {
      return res.status(400).json({
        success: false,
        message: '活动尚未上链，无法记录出席'
      });
    }
    
    // 调用区块链服务记录出席
    const result = await blockchainService.recordAttendance(activity.blockchainActivityId, user.walletAddress);
    
    // 更新活动记录
    activity.recordAttendance(userId);
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(200).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          name: activity.name,
          participant: {
            userId: userId,
            attended: true
          },
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash
        }
      },
      message: '成功记录参与者出席并已同步到区块链'
    });
  } catch (err) {
    console.error('记录参与者出席失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 提交参与反馈
exports.submitFeedback = async (req, res) => {
  try {
    await initializeBlockchain();
    
    const { activityId } = req.params;
    const { feedback } = req.body;
    
    if (!feedback) {
      return res.status(400).json({
        success: false,
        message: '反馈内容是必填项'
      });
    }
    
    // 查找活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 检查用户是否已参与
    const participant = activity.participants.find(p => 
      p.user.toString() === req.user.id
    );
    
    if (!participant) {
      return res.status(400).json({
        success: false,
        message: '用户未参与该活动'
      });
    }
    
    // 检查是否已上链
    if (!activity.blockchainActivityId) {
      return res.status(400).json({
        success: false,
        message: '活动尚未上链，无法提交反馈'
      });
    }
    
    // 调用区块链服务提交反馈
    const result = await blockchainService.submitFeedback(activity.blockchainActivityId, feedback);
    
    // 更新活动记录
    activity.submitFeedback(req.user.id, feedback);
    activity.transactionHash = result.transactionHash;
    activity.blockchainSyncedAt = new Date();
    await activity.save();
    
    res.status(200).json({
      success: true,
      data: {
        activity: {
          _id: activity._id,
          name: activity.name,
          feedback: feedback,
          blockchainActivityId: activity.blockchainActivityId,
          transactionHash: activity.transactionHash
        }
      },
      message: '成功提交参与反馈并已同步到区块链'
    });
  } catch (err) {
    console.error('提交参与反馈失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 获取活动列表
exports.getActivities = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      verificationStatus, 
      tag,
      organizer,
      participant,
      search
    } = req.query;
    
    // 构建查询条件
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }
    
    if (tag) {
      query.culturalTags = tag;
    }
    
    if (organizer) {
      query.organizer = organizer;
    }
    
    if (participant) {
      query['participants.user'] = participant;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    // 计算分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 查询活动
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('organizer', 'username email walletAddress')
      .populate('verifier', 'username email walletAddress');
    
    // 计算总数
    const total = await Activity.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      message: '获取活动列表成功'
    });
  } catch (err) {
    console.error('获取活动列表失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 获取活动详情
exports.getActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    
    // 查找活动
    const activity = await Activity.findById(activityId)
      .populate('organizer', 'username email walletAddress')
      .populate('verifier', 'username email walletAddress')
      .populate('participants.user', 'username email walletAddress');
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 如果活动已上链，获取链上数据
    let blockchainData = null;
    if (activity.blockchainActivityId) {
      await initializeBlockchain();
      try {
        blockchainData = await blockchainService.getActivity(activity.blockchainActivityId);
      } catch (error) {
        console.error('获取链上活动数据失败:', error);
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        activity,
        blockchainData
      },
      message: '获取活动详情成功'
    });
  } catch (err) {
    console.error('获取活动详情失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 获取用户组织的活动
exports.getOrganizerActivities = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 查询活动
    const activities = await Activity.find({ organizer: userId })
      .sort({ createdAt: -1 })
      .populate('organizer', 'username email walletAddress');
    
    res.status(200).json({
      success: true,
      data: {
        activities
      },
      message: '获取用户组织的活动成功'
    });
  } catch (err) {
    console.error('获取用户组织的活动失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 获取用户参与的活动
exports.getParticipantActivities = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 查询活动
    const activities = await Activity.find({ 'participants.user': userId })
      .sort({ createdAt: -1 })
      .populate('organizer', 'username email walletAddress');
    
    res.status(200).json({
      success: true,
      data: {
        activities
      },
      message: '获取用户参与的活动成功'
    });
  } catch (err) {
    console.error('获取用户参与的活动失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// 获取活动统计数据
exports.getActivityStats = async (req, res) => {
  try {
    // 总活动数
    const totalActivities = await Activity.countDocuments();
    
    // 已验证活动数
    const verifiedActivities = await Activity.countDocuments({ verificationStatus: 'VERIFIED' });
    
    // 活动状态统计
    const statusStats = await Activity.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // 活动类型统计
    const typeStats = await Activity.aggregate([
      { $group: { _id: '$activityType', count: { $sum: 1 } } }
    ]);
    
    // 标签统计
    const tagStats = await Activity.aggregate([
      { $unwind: '$culturalTags' },
      { $group: { _id: '$culturalTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // 参与人数最多的活动
    const topActivities = await Activity.find()
      .sort({ participantCount: -1 })
      .limit(5)
      .select('name participantCount');
    
    res.status(200).json({
      success: true,
      data: {
        totalActivities,
        verifiedActivities,
        statusStats,
        typeStats,
        tagStats,
        topActivities
      },
      message: '获取活动统计数据成功'
    });
  } catch (err) {
    console.error('获取活动统计数据失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
