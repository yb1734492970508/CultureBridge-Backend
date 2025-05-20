// src/blockchain/adapter.js
const { ethers } = require('ethers');
require('dotenv').config();

/**
 * 区块链适配层
 * 负责与区块链网络和智能合约交互
 */
class BlockchainAdapter {
  constructor() {
    // 初始化提供者
    this.provider = null;
    this.wallet = null;
    this.contracts = {};
    
    // 合约地址配置
    this.contractAddresses = {
      identity: process.env.IDENTITY_CONTRACT_ADDRESS || '',
      events: process.env.EVENTS_CONTRACT_ADDRESS || '',
      nft: process.env.NFT_CONTRACT_ADDRESS || '',
      token: process.env.TOKEN_CONTRACT_ADDRESS || ''
    };
  }

  /**
   * 初始化区块链连接
   * @param {string} network - 网络名称 (mumbai, polygon, hardhat)
   */
  async initialize(network = 'hardhat') {
    try {
      let providerUrl;
      
      switch (network) {
        case 'mumbai':
          providerUrl = process.env.MUMBAI_RPC_URL;
          break;
        case 'polygon':
          providerUrl = process.env.POLYGON_RPC_URL;
          break;
        case 'hardhat':
        default:
          providerUrl = 'http://localhost:8545';
          break;
      }
      
      // 创建提供者和钱包
      this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
      
      if (process.env.PRIVATE_KEY) {
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        console.log(`区块链适配层初始化成功，连接到 ${network} 网络`);
        console.log(`钱包地址: ${this.wallet.address}`);
      } else {
        console.warn('未找到私钥，仅初始化提供者，无法签名交易');
      }
      
      return true;
    } catch (error) {
      console.error('区块链适配层初始化失败:', error);
      return false;
    }
  }

  /**
   * 加载智能合约
   * @param {string} name - 合约名称
   * @param {string} address - 合约地址
   * @param {object} abi - 合约ABI
   */
  loadContract(name, address, abi) {
    try {
      if (!this.provider) {
        throw new Error('区块链适配层尚未初始化');
      }
      
      const contractAddress = address || this.contractAddresses[name];
      
      if (!contractAddress) {
        throw new Error(`未找到合约地址: ${name}`);
      }
      
      // 创建合约实例
      if (this.wallet) {
        // 使用钱包创建可签名的合约实例
        this.contracts[name] = new ethers.Contract(contractAddress, abi, this.wallet);
      } else {
        // 仅创建只读合约实例
        this.contracts[name] = new ethers.Contract(contractAddress, abi, this.provider);
      }
      
      console.log(`已加载合约 ${name}: ${contractAddress}`);
      return this.contracts[name];
    } catch (error) {
      console.error(`加载合约 ${name} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取合约实例
   * @param {string} name - 合约名称
   */
  getContract(name) {
    return this.contracts[name] || null;
  }

  /**
   * 生成随机钱包
   * @returns {object} 包含地址和私钥的钱包对象
   */
  generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }

  /**
   * 检查钱包地址是否有效
   * @param {string} address - 钱包地址
   * @returns {boolean} 地址是否有效
   */
  isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  /**
   * 获取账户余额
   * @param {string} address - 钱包地址
   * @returns {string} 余额（以ETH为单位）
   */
  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('获取余额失败:', error);
      return '0';
    }
  }
}

module.exports = BlockchainAdapter;
