// src/blockchain/service.js 更新版
const BlockchainAdapter = require('./adapter');
const CultureBridgeIdentityABI = require('../contracts/abis/CultureBridgeIdentity.json');

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
   * 获取身份合约实例
   * @returns {object} 合约实例
   */
  getIdentityContract() {
    return this.contracts.identity;
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
}

// 创建单例实例
const blockchainService = new BlockchainService();

module.exports = blockchainService;
