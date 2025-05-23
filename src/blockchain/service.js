// src/blockchain/service.js 更新版 - 添加活动合约支持
const BlockchainAdapter = require('./adapter');
const CultureBridgeIdentityABI = require('../contracts/abis/CultureBridgeIdentity.json');
const CultureBridgeActivityABI = require('../contracts/abis/CultureBridgeActivity.json');

/**
 * 区块链服务
 * 提供业务层面的区块链功能接口
 */
class BlockchainService {
  constructor() {
    this.adapter = new BlockchainAdapter();
    this.initialized = false;
    this.contracts = {};
  }

  /**
   * 初始化区块链服务
   * @param {string} network - 网络名称
   */
  async initialize(network = 'hardhat') {
    if (this.initialized) {
      return true;
    }

    const success = await this.adapter.initialize(network);
    
    if (success) {
      // 加载身份合约
      if (process.env.IDENTITY_CONTRACT_ADDRESS) {
        this.loadIdentityContract(process.env.IDENTITY_CONTRACT_ADDRESS);
      }
      
      // 加载活动合约
      if (process.env.ACTIVITY_CONTRACT_ADDRESS) {
        this.loadActivityContract(process.env.ACTIVITY_CONTRACT_ADDRESS);
      }
    }
    
    this.initialized = success;
    return success;
  }

  /**
   * 加载身份合约
   * @param {string} address - 合约地址
   */
  loadIdentityContract(address) {
    try {
      this.contracts.identity = this.adapter.loadContract('identity', address, CultureBridgeIdentityABI);
      return true;
    } catch (error) {
      console.error('加载身份合约失败:', error);
      return false;
    }
  }
  
  /**
   * 加载活动合约
   * @param {string} address - 合约地址
   */
  loadActivityContract(address) {
    try {
      this.contracts.activity = this.adapter.loadContract('activity', address, CultureBridgeActivityABI);
      return true;
    } catch (error) {
      console.error('加载活动合约失败:', error);
      return false;
    }
  }

  /**
   * 获取身份合约实例
   * @returns {object} 合约实例
   */
  getIdentityContract() {
    return this.contracts.identity;
  }
  
  /**
   * 获取活动合约实例
   * @returns {object} 合约实例
   */
  getActivityContract() {
    return this.contracts.activity;
  }

  /**
   * 为用户生成钱包地址
   * @returns {object} 包含地址和私钥的钱包对象
   */
  generateUserWallet() {
    return this.adapter.generateWallet();
  }

  /**
   * 验证钱包地址
   * @param {string} address - 钱包地址
   * @returns {boolean} 地址是否有效
   */
  validateWalletAddress(address) {
    return this.adapter.isValidAddress(address);
  }

  /**
   * 获取钱包余额
   * @param {string} address - 钱包地址
   * @returns {string} 余额（以ETH为单位）
   */
  async getWalletBalance(address) {
    return await this.adapter.getBalance(address);
  }
  
  /**
   * 创建文化活动
   * @param {object} activityData - 活动数据
   * @returns {Promise<object>} 交易结果
   */
  async createActivity(activityData) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
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
      contentHash,
      culturalTags
    } = activityData;
    
    // 调用合约创建活动
    const tx = await this.contracts.activity.createActivity(
      name,
      description,
      activityType,
      startTime,
      endTime,
      location,
      capacity,
      fee,
      contentHash,
      culturalTags
    );
    
    const receipt = await tx.wait();
    
    // 解析事件获取活动ID
    const event = receipt.events.find(e => e.event === 'ActivityCreated');
    const activityId = event.args.activityId.toNumber();
    
    return {
      activityId,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 更新文化活动
   * @param {number} activityId - 活动ID
   * @param {object} activityData - 活动数据
   * @returns {Promise<object>} 交易结果
   */
  async updateActivity(activityId, activityData) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
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
      contentHash,
      culturalTags
    } = activityData;
    
    // 调用合约更新活动
    const tx = await this.contracts.activity.updateActivity(
      activityId,
      name,
      description,
      activityType,
      startTime,
      endTime,
      location,
      capacity,
      fee,
      contentHash,
      culturalTags
    );
    
    const receipt = await tx.wait();
    
    return {
      activityId,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 更改活动状态
   * @param {number} activityId - 活动ID
   * @param {number} status - 活动状态
   * @returns {Promise<object>} 交易结果
   */
  async changeActivityStatus(activityId, status) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    // 调用合约更改活动状态
    const tx = await this.contracts.activity.changeActivityStatus(activityId, status);
    const receipt = await tx.wait();
    
    return {
      activityId,
      status,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 验证活动
   * @param {number} activityId - 活动ID
   * @param {number} status - 验证状态
   * @param {string} comments - 验证评论
   * @returns {Promise<object>} 交易结果
   */
  async verifyActivity(activityId, status, comments) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    // 调用合约验证活动
    const tx = await this.contracts.activity.verifyActivity(activityId, status, comments);
    const receipt = await tx.wait();
    
    return {
      activityId,
      status,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 参与活动
   * @param {number} activityId - 活动ID
   * @returns {Promise<object>} 交易结果
   */
  async joinActivity(activityId) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    // 调用合约参与活动
    const tx = await this.contracts.activity.joinActivity(activityId);
    const receipt = await tx.wait();
    
    return {
      activityId,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 记录参与者出席
   * @param {number} activityId - 活动ID
   * @param {string} participant - 参与者地址
   * @returns {Promise<object>} 交易结果
   */
  async recordAttendance(activityId, participant) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    // 调用合约记录出席
    const tx = await this.contracts.activity.recordAttendance(activityId, participant);
    const receipt = await tx.wait();
    
    return {
      activityId,
      participant,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 提交参与反馈
   * @param {number} activityId - 活动ID
   * @param {string} feedback - 反馈内容
   * @returns {Promise<object>} 交易结果
   */
  async submitFeedback(activityId, feedback) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    // 调用合约提交反馈
    const tx = await this.contracts.activity.submitFeedback(activityId, feedback);
    const receipt = await tx.wait();
    
    return {
      activityId,
      transactionHash: receipt.transactionHash
    };
  }
  
  /**
   * 获取活动信息
   * @param {number} activityId - 活动ID
   * @returns {Promise<object>} 活动信息
   */
  async getActivity(activityId) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    // 调用合约获取活动信息
    const activity = await this.contracts.activity.getActivity(activityId);
    
    // 获取活动标签
    const tags = await this.contracts.activity.getActivityTags(activityId);
    
    return {
      id: activity.id.toNumber(),
      name: activity.name,
      description: activity.description,
      activityType: activity.activityType,
      startTime: new Date(activity.startTime.toNumber() * 1000),
      endTime: new Date(activity.endTime.toNumber() * 1000),
      location: activity.location,
      organizer: activity.organizer,
      status: activity.status,
      capacity: activity.capacity.toNumber(),
      fee: activity.fee.toNumber(),
      contentHash: activity.contentHash,
      createdAt: new Date(activity.createdAt.toNumber() * 1000),
      updatedAt: new Date(activity.updatedAt.toNumber() * 1000),
      verificationStatus: activity.verificationStatus,
      verifier: activity.verifier,
      participantCount: activity.participantCount.toNumber(),
      culturalTags: tags
    };
  }
  
  /**
   * 获取活动参与者列表
   * @param {number} activityId - 活动ID
   * @returns {Promise<array>} 参与者地址数组
   */
  async getActivityParticipants(activityId) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    return await this.contracts.activity.getActivityParticipants(activityId);
  }
  
  /**
   * 获取用户组织的活动列表
   * @param {string} organizer - 组织者地址
   * @returns {Promise<array>} 活动ID数组
   */
  async getOrganizerActivities(organizer) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    const activityIds = await this.contracts.activity.getOrganizerActivities(organizer);
    return activityIds.map(id => id.toNumber());
  }
  
  /**
   * 获取用户参与的活动列表
   * @param {string} participant - 参与者地址
   * @returns {Promise<array>} 活动ID数组
   */
  async getParticipantActivities(participant) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    const activityIds = await this.contracts.activity.getParticipantActivities(participant);
    return activityIds.map(id => id.toNumber());
  }
  
  /**
   * 获取特定标签的活动列表
   * @param {string} tag - 文化标签
   * @returns {Promise<array>} 活动ID数组
   */
  async getActivitiesByTag(tag) {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    const activityIds = await this.contracts.activity.getActivitiesByTag(tag);
    return activityIds.map(id => id.toNumber());
  }
  
  /**
   * 获取活动总数
   * @returns {Promise<number>} 活动总数
   */
  async getActivityCount() {
    if (!this.contracts.activity) {
      throw new Error('活动合约未初始化');
    }
    
    const count = await this.contracts.activity.getActivityCount();
    return count.toNumber();
  }
}

// 创建单例实例
const blockchainService = new BlockchainService();

module.exports = blockchainService;
