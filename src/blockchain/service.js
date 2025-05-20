// src/blockchain/service.js
const BlockchainAdapter = require('./adapter');

/**
 * 区块链服务
 * 提供业务层面的区块链功能接口
 */
class BlockchainService {
  constructor() {
    this.adapter = new BlockchainAdapter();
    this.initialized = false;
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
    this.initialized = success;
    return success;
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
   * 加载智能合约
   * @param {string} name - 合约名称
   * @param {string} address - 合约地址
   * @param {object} abi - 合约ABI
   */
  loadContract(name, address, abi) {
    return this.adapter.loadContract(name, address, abi);
  }
}

// 创建单例实例
const blockchainService = new BlockchainService();

module.exports = blockchainService;
