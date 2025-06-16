const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 智能合约ABI
const CBT_ABI = require('../blockchain/artifacts/contracts/CultureBridgeToken.sol/CultureBridgeToken.json').abi;
const MARKETPLACE_ABI = require('../blockchain/artifacts/contracts/CultureBridgeMarketplace.sol/CultureBridgeMarketplace.json').abi;
const ASSET_ABI = require('../blockchain/artifacts/contracts/CultureBridgeAsset.sol/CultureBridgeAsset.json').abi;

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.networkConfig = {};
    this.isInitialized = false;
  }

  /**
   * 初始化区块链服务
   */
  async initialize() {
    try {
      // 设置网络配置
      this.setupNetworkConfig();
      
      // 连接到区块链网络
      await this.connectToNetwork();
      
      // 初始化合约实例
      await this.initializeContracts();
      
      // 设置事件监听器
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('区块链服务初始化成功');
    } catch (error) {
      console.error('区块链服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 设置网络配置
   */
  setupNetworkConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.networkConfig = {
      rpcUrl: isProduction 
        ? process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org/'
        : process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      chainId: isProduction ? 56 : 97,
      privateKey: process.env.DEPLOYER_PRIVATE_KEY,
      gasPrice: ethers.utils.parseUnits('5', 'gwei'),
      gasLimit: 500000
    };

    // 加载合约地址
    this.loadContractAddresses();
  }

  /**
   * 加载合约地址
   */
  loadContractAddresses() {
    try {
      const configPath = path.join(__dirname, '../config/contracts.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.contractAddresses = config.contracts;
      } else {
        console.warn('合约配置文件不存在，请先部署合约');
        this.contractAddresses = {};
      }
    } catch (error) {
      console.error('加载合约地址失败:', error);
      this.contractAddresses = {};
    }
  }

  /**
   * 连接到区块链网络
   */
  async connectToNetwork() {
    this.provider = new ethers.providers.JsonRpcProvider(this.networkConfig.rpcUrl);
    
    if (this.networkConfig.privateKey) {
      this.signer = new ethers.Wallet(this.networkConfig.privateKey, this.provider);
    }

    // 验证网络连接
    const network = await this.provider.getNetwork();
    console.log(`已连接到网络: ${network.name} (Chain ID: ${network.chainId})`);
  }

  /**
   * 初始化合约实例
   */
  async initializeContracts() {
    if (!this.contractAddresses.CBT_TOKEN_ADDRESS) {
      console.warn('CBT代币合约地址未配置');
      return;
    }

    // 初始化CBT代币合约
    this.contracts.cbtToken = new ethers.Contract(
      this.contractAddresses.CBT_TOKEN_ADDRESS,
      CBT_ABI,
      this.signer || this.provider
    );

    // 初始化市场合约
    if (this.contractAddresses.MARKETPLACE_CONTRACT_ADDRESS) {
      this.contracts.marketplace = new ethers.Contract(
        this.contractAddresses.MARKETPLACE_CONTRACT_ADDRESS,
        MARKETPLACE_ABI,
        this.signer || this.provider
      );
    }

    // 初始化资产合约
    if (this.contractAddresses.ASSET_CONTRACT_ADDRESS) {
      this.contracts.asset = new ethers.Contract(
        this.contractAddresses.ASSET_CONTRACT_ADDRESS,
        ASSET_ABI,
        this.signer || this.provider
      );
    }

    console.log('智能合约实例初始化完成');
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    if (!this.contracts.cbtToken) return;

    // 监听代币转账事件
    this.contracts.cbtToken.on('Transfer', (from, to, amount, event) => {
      console.log(`CBT转账: ${from} -> ${to}, 数量: ${ethers.utils.formatEther(amount)}`);
      // 这里可以添加数据库记录逻辑
    });

    // 监听奖励分发事件
    this.contracts.cbtToken.on('RewardDistributed', (recipient, amount, category, description, event) => {
      console.log(`奖励分发: ${recipient}, 数量: ${ethers.utils.formatEther(amount)}, 类别: ${category}`);
      // 这里可以添加通知逻辑
    });
  }

  /**
   * 获取CBT代币余额
   */
  async getCBTBalance(address) {
    if (!this.contracts.cbtToken) {
      throw new Error('CBT合约未初始化');
    }

    const balance = await this.contracts.cbtToken.balanceOf(address);
    return ethers.utils.formatEther(balance);
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(address) {
    if (!this.contracts.cbtToken) {
      throw new Error('CBT合约未初始化');
    }

    const stats = await this.contracts.cbtToken.getUserStats(address);
    return {
      totalEarned: ethers.utils.formatEther(stats[0]),
      totalSpent: ethers.utils.formatEther(stats[1]),
      transactionCount: stats[2].toString(),
      lastActivityTime: new Date(stats[3].toNumber() * 1000)
    };
  }

  /**
   * 分发奖励
   */
  async distributeReward(recipient, category, description) {
    if (!this.contracts.cbtToken || !this.signer) {
      throw new Error('合约或签名者未初始化');
    }

    try {
      const tx = await this.contracts.cbtToken.distributeReward(
        recipient,
        category,
        description,
        {
          gasPrice: this.networkConfig.gasPrice,
          gasLimit: this.networkConfig.gasLimit
        }
      );

      const receipt = await tx.wait();
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('分发奖励失败:', error);
      throw error;
    }
  }

  /**
   * 批量分发奖励
   */
  async batchDistributeRewards(recipients, categories, descriptions) {
    if (!this.contracts.cbtToken || !this.signer) {
      throw new Error('合约或签名者未初始化');
    }

    try {
      const tx = await this.contracts.cbtToken.batchDistributeRewards(
        recipients,
        categories,
        descriptions,
        {
          gasPrice: this.networkConfig.gasPrice,
          gasLimit: this.networkConfig.gasLimit * 2 // 批量操作需要更多gas
        }
      );

      const receipt = await tx.wait();
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('批量分发奖励失败:', error);
      throw error;
    }
  }

  /**
   * 获取交易详情
   */
  async getTransaction(transactionId) {
    if (!this.contracts.cbtToken) {
      throw new Error('CBT合约未初始化');
    }

    const transaction = await this.contracts.cbtToken.getTransaction(transactionId);
    return {
      id: transaction.id.toString(),
      from: transaction.from,
      to: transaction.to,
      amount: ethers.utils.formatEther(transaction.amount),
      category: transaction.category,
      description: transaction.description,
      timestamp: new Date(transaction.timestamp.toNumber() * 1000),
      isReward: transaction.isReward
    };
  }

  /**
   * 获取代币总供应量
   */
  async getTotalSupply() {
    if (!this.contracts.cbtToken) {
      throw new Error('CBT合约未初始化');
    }

    const totalSupply = await this.contracts.cbtToken.totalSupply();
    return ethers.utils.formatEther(totalSupply);
  }

  /**
   * 获取总奖励分发量
   */
  async getTotalRewardsDistributed() {
    if (!this.contracts.cbtToken) {
      throw new Error('CBT合约未初始化');
    }

    const totalRewards = await this.contracts.cbtToken.totalRewardsDistributed();
    return ethers.utils.formatEther(totalRewards);
  }

  /**
   * 验证地址格式
   */
  isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  /**
   * 获取当前gas价格
   */
  async getCurrentGasPrice() {
    const gasPrice = await this.provider.getGasPrice();
    return ethers.utils.formatUnits(gasPrice, 'gwei');
  }

  /**
   * 估算交易gas费用
   */
  async estimateGas(contractMethod, ...args) {
    try {
      const gasEstimate = await contractMethod.estimateGas(...args);
      const gasPrice = await this.provider.getGasPrice();
      const gasCost = gasEstimate.mul(gasPrice);
      
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        estimatedCost: ethers.utils.formatEther(gasCost)
      };
    } catch (error) {
      console.error('估算gas失败:', error);
      throw error;
    }
  }

  /**
   * 获取区块链网络状态
   */
  async getNetworkStatus() {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    const gasPrice = await this.provider.getGasPrice();

    return {
      chainId: network.chainId,
      name: network.name,
      blockNumber,
      gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
      isConnected: true
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'error', message: '服务未初始化' };
      }

      const networkStatus = await this.getNetworkStatus();
      const cbtBalance = this.contracts.cbtToken ? 
        await this.getCBTBalance(this.signer?.address || ethers.constants.AddressZero) : '0';

      return {
        status: 'healthy',
        network: networkStatus,
        contracts: {
          cbtToken: !!this.contracts.cbtToken,
          marketplace: !!this.contracts.marketplace,
          asset: !!this.contracts.asset
        },
        signer: !!this.signer
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// 创建单例实例
const blockchainService = new BlockchainService();

module.exports = blockchainService;

