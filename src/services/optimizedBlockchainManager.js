const { ethers } = require('ethers');
const { databaseManager } = require('../utils/databaseManager');

class OptimizedBlockchainManager {
  constructor() {
    this.providers = new Map();
    this.contracts = new Map();
    this.transactionQueue = [];
    this.batchSize = 10;
    this.batchTimeout = 5000; // 5秒
    this.gasOptimization = true;
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2秒
    
    // 网络配置
    this.networks = {
      bscMainnet: {
        name: 'BSC Mainnet',
        chainId: 56,
        rpcUrl: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org/',
        gasPrice: '5000000000', // 5 Gwei
        gasLimit: '300000'
      },
      bscTestnet: {
        name: 'BSC Testnet',
        chainId: 97,
        rpcUrl: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        gasPrice: '10000000000', // 10 Gwei
        gasLimit: '300000'
      }
    };

    // 合约地址
    this.contractAddresses = {
      CBT: {
        mainnet: process.env.CBT_CONTRACT_MAINNET,
        testnet: process.env.CBT_CONTRACT_TESTNET || '0x...' // 测试网地址
      }
    };

    // 初始化
    this.initialize();
  }

  // 初始化区块链管理器
  async initialize() {
    try {
      console.log('🔄 初始化区块链管理器...');
      
      // 初始化网络提供者
      await this.initializeProviders();
      
      // 初始化智能合约
      await this.initializeContracts();
      
      // 启动批处理定时器
      this.startBatchProcessor();
      
      console.log('✅ 区块链管理器初始化完成');
    } catch (error) {
      console.error('❌ 区块链管理器初始化失败:', error);
      throw error;
    }
  }

  // 初始化网络提供者
  async initializeProviders() {
    for (const [networkName, config] of Object.entries(this.networks)) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        
        // 测试连接
        const network = await provider.getNetwork();
        console.log(`✅ ${config.name} 连接成功, Chain ID: ${network.chainId}`);
        
        this.providers.set(networkName, provider);
      } catch (error) {
        console.error(`❌ ${config.name} 连接失败:`, error);
      }
    }
  }

  // 初始化智能合约
  async initializeContracts() {
    const cbtABI = [
      // ERC20 标准方法
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      
      // CBT 特定方法
      "function mint(address to, uint256 amount) returns (bool)",
      "function burn(uint256 amount) returns (bool)",
      "function burnFrom(address from, uint256 amount) returns (bool)",
      "function pause() returns (bool)",
      "function unpause() returns (bool)",
      "function paused() view returns (bool)",
      
      // 奖励和统计方法
      "function rewardUser(address user, uint256 amount, string reason) returns (bool)",
      "function getUserStats(address user) view returns (uint256 totalEarned, uint256 totalSpent, uint256 transactionCount)",
      "function getRewardHistory(address user, uint256 offset, uint256 limit) view returns (tuple(uint256 amount, string reason, uint256 timestamp)[])",
      
      // 事件
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Approval(address indexed owner, address indexed spender, uint256 value)",
      "event RewardDistributed(address indexed user, uint256 amount, string reason)",
      "event Mint(address indexed to, uint256 amount)",
      "event Burn(address indexed from, uint256 amount)"
    ];

    for (const [networkName, provider] of this.providers) {
      try {
        const contractAddress = networkName === 'bscMainnet' 
          ? this.contractAddresses.CBT.mainnet 
          : this.contractAddresses.CBT.testnet;

        if (contractAddress && contractAddress !== '0x...') {
          const contract = new ethers.Contract(contractAddress, cbtABI, provider);
          this.contracts.set(`CBT_${networkName}`, contract);
          
          console.log(`✅ CBT合约已连接 (${networkName}): ${contractAddress}`);
        }
      } catch (error) {
        console.error(`❌ CBT合约连接失败 (${networkName}):`, error);
      }
    }
  }

  // 获取优化的Gas价格
  async getOptimizedGasPrice(networkName) {
    try {
      const provider = this.providers.get(networkName);
      if (!provider) {
        throw new Error(`网络 ${networkName} 不可用`);
      }

      // 获取当前Gas价格
      const currentGasPrice = await provider.getFeeData();
      
      if (this.gasOptimization) {
        // 智能Gas价格优化
        const baseGasPrice = currentGasPrice.gasPrice;
        const maxFeePerGas = currentGasPrice.maxFeePerGas;
        const maxPriorityFeePerGas = currentGasPrice.maxPriorityFeePerGas;

        // 根据网络拥堵情况调整
        const networkConfig = this.networks[networkName];
        const minGasPrice = ethers.parseUnits(networkConfig.gasPrice, 'wei');

        return {
          gasPrice: baseGasPrice > minGasPrice ? baseGasPrice : minGasPrice,
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas
        };
      }

      return currentGasPrice;
    } catch (error) {
      console.error('获取Gas价格失败:', error);
      // 返回默认Gas价格
      const networkConfig = this.networks[networkName];
      return {
        gasPrice: ethers.parseUnits(networkConfig.gasPrice, 'wei')
      };
    }
  }

  // 估算Gas限制
  async estimateGasLimit(contract, method, params, options = {}) {
    try {
      const gasEstimate = await contract[method].estimateGas(...params, options);
      
      // 添加20%的缓冲
      const gasLimit = gasEstimate * BigInt(120) / BigInt(100);
      
      return gasLimit;
    } catch (error) {
      console.error('Gas估算失败:', error);
      // 返回默认Gas限制
      return ethers.parseUnits('300000', 'wei');
    }
  }

  // 创建钱包实例
  createWallet(privateKey, networkName = 'bscTestnet') {
    try {
      const provider = this.providers.get(networkName);
      if (!provider) {
        throw new Error(`网络 ${networkName} 不可用`);
      }

      return new ethers.Wallet(privateKey, provider);
    } catch (error) {
      console.error('创建钱包失败:', error);
      throw error;
    }
  }

  // 获取代币余额
  async getTokenBalance(address, networkName = 'bscTestnet') {
    try {
      const contract = this.contracts.get(`CBT_${networkName}`);
      if (!contract) {
        throw new Error(`CBT合约不可用 (${networkName})`);
      }

      const balance = await contract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('获取代币余额失败:', error);
      return '0';
    }
  }

  // 获取用户统计
  async getUserStats(address, networkName = 'bscTestnet') {
    try {
      const contract = this.contracts.get(`CBT_${networkName}`);
      if (!contract) {
        throw new Error(`CBT合约不可用 (${networkName})`);
      }

      const stats = await contract.getUserStats(address);
      return {
        totalEarned: ethers.formatEther(stats.totalEarned),
        totalSpent: ethers.formatEther(stats.totalSpent),
        transactionCount: stats.transactionCount.toString()
      };
    } catch (error) {
      console.error('获取用户统计失败:', error);
      return {
        totalEarned: '0',
        totalSpent: '0',
        transactionCount: '0'
      };
    }
  }

  // 添加交易到批处理队列
  addToBatch(transaction) {
    this.transactionQueue.push({
      ...transaction,
      timestamp: Date.now(),
      id: this.generateTransactionId()
    });

    // 如果队列达到批处理大小，立即处理
    if (this.transactionQueue.length >= this.batchSize) {
      this.processBatch();
    }
  }

  // 生成交易ID
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 启动批处理定时器
  startBatchProcessor() {
    setInterval(() => {
      if (this.transactionQueue.length > 0) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  // 处理批量交易
  async processBatch() {
    if (this.transactionQueue.length === 0) {
      return;
    }

    const batch = this.transactionQueue.splice(0, this.batchSize);
    console.log(`🔄 处理批量交易: ${batch.length} 笔`);

    const results = await Promise.allSettled(
      batch.map(tx => this.executeTransaction(tx))
    );

    // 处理结果
    results.forEach((result, index) => {
      const transaction = batch[index];
      
      if (result.status === 'fulfilled') {
        console.log(`✅ 交易成功: ${transaction.id}`);
        this.onTransactionSuccess(transaction, result.value);
      } else {
        console.error(`❌ 交易失败: ${transaction.id}`, result.reason);
        this.onTransactionFailure(transaction, result.reason);
      }
    });
  }

  // 执行单个交易
  async executeTransaction(transaction) {
    const { type, params, networkName, privateKey, retryCount = 0 } = transaction;

    try {
      const wallet = this.createWallet(privateKey, networkName);
      const contract = this.contracts.get(`CBT_${networkName}`).connect(wallet);

      // 获取优化的Gas配置
      const gasConfig = await this.getOptimizedGasPrice(networkName);
      
      let txResponse;
      
      switch (type) {
        case 'transfer':
          const gasLimit = await this.estimateGasLimit(contract, 'transfer', [params.to, ethers.parseEther(params.amount)]);
          txResponse = await contract.transfer(
            params.to, 
            ethers.parseEther(params.amount),
            { ...gasConfig, gasLimit }
          );
          break;

        case 'reward':
          const rewardGasLimit = await this.estimateGasLimit(contract, 'rewardUser', [params.user, ethers.parseEther(params.amount), params.reason]);
          txResponse = await contract.rewardUser(
            params.user,
            ethers.parseEther(params.amount),
            params.reason,
            { ...gasConfig, gasLimit: rewardGasLimit }
          );
          break;

        case 'mint':
          const mintGasLimit = await this.estimateGasLimit(contract, 'mint', [params.to, ethers.parseEther(params.amount)]);
          txResponse = await contract.mint(
            params.to,
            ethers.parseEther(params.amount),
            { ...gasConfig, gasLimit: mintGasLimit }
          );
          break;

        case 'burn':
          const burnGasLimit = await this.estimateGasLimit(contract, 'burn', [ethers.parseEther(params.amount)]);
          txResponse = await contract.burn(
            ethers.parseEther(params.amount),
            { ...gasConfig, gasLimit: burnGasLimit }
          );
          break;

        default:
          throw new Error(`不支持的交易类型: ${type}`);
      }

      // 等待交易确认
      const receipt = await txResponse.wait();
      
      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      };

    } catch (error) {
      // 重试机制
      if (retryCount < this.retryAttempts) {
        console.log(`🔄 重试交易: ${transaction.id} (${retryCount + 1}/${this.retryAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        
        return this.executeTransaction({
          ...transaction,
          retryCount: retryCount + 1
        });
      }

      throw error;
    }
  }

  // 交易成功回调
  async onTransactionSuccess(transaction, result) {
    try {
      // 保存交易记录到数据库
      const transactionRecord = {
        id: transaction.id,
        type: transaction.type,
        params: transaction.params,
        networkName: transaction.networkName,
        hash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        status: 'success',
        timestamp: new Date()
      };

      // 缓存交易记录
      await databaseManager.cacheSet(
        `transaction:${transaction.id}`,
        transactionRecord,
        86400 // 24小时
      );

      // 更新用户余额缓存
      if (transaction.params.user || transaction.params.to) {
        const userAddress = transaction.params.user || transaction.params.to;
        await this.updateUserBalanceCache(userAddress, transaction.networkName);
      }

    } catch (error) {
      console.error('交易成功回调处理失败:', error);
    }
  }

  // 交易失败回调
  async onTransactionFailure(transaction, error) {
    try {
      // 保存失败记录
      const failureRecord = {
        id: transaction.id,
        type: transaction.type,
        params: transaction.params,
        networkName: transaction.networkName,
        error: error.message,
        status: 'failed',
        timestamp: new Date()
      };

      await databaseManager.cacheSet(
        `transaction_failure:${transaction.id}`,
        failureRecord,
        86400 // 24小时
      );

    } catch (cacheError) {
      console.error('交易失败回调处理失败:', cacheError);
    }
  }

  // 更新用户余额缓存
  async updateUserBalanceCache(address, networkName) {
    try {
      const balance = await this.getTokenBalance(address, networkName);
      const stats = await this.getUserStats(address, networkName);

      const cacheData = {
        balance,
        stats,
        lastUpdated: new Date().toISOString()
      };

      await databaseManager.cacheSet(
        `user_balance:${networkName}:${address}`,
        cacheData,
        300 // 5分钟
      );
    } catch (error) {
      console.error('更新用户余额缓存失败:', error);
    }
  }

  // 获取缓存的用户余额
  async getCachedUserBalance(address, networkName) {
    try {
      const cached = await databaseManager.cacheGet(`user_balance:${networkName}:${address}`);
      
      if (cached) {
        return cached;
      }

      // 缓存未命中，获取最新数据
      const balance = await this.getTokenBalance(address, networkName);
      const stats = await this.getUserStats(address, networkName);

      const cacheData = {
        balance,
        stats,
        lastUpdated: new Date().toISOString()
      };

      await databaseManager.cacheSet(
        `user_balance:${networkName}:${address}`,
        cacheData,
        300 // 5分钟
      );

      return cacheData;
    } catch (error) {
      console.error('获取用户余额失败:', error);
      return {
        balance: '0',
        stats: {
          totalEarned: '0',
          totalSpent: '0',
          transactionCount: '0'
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // 便捷方法：发送奖励
  async sendReward(userAddress, amount, reason, networkName = 'bscTestnet') {
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      throw new Error('管理员私钥未配置');
    }

    this.addToBatch({
      type: 'reward',
      params: {
        user: userAddress,
        amount: amount.toString(),
        reason
      },
      networkName,
      privateKey: adminPrivateKey
    });
  }

  // 便捷方法：转账
  async transferTokens(fromPrivateKey, toAddress, amount, networkName = 'bscTestnet') {
    this.addToBatch({
      type: 'transfer',
      params: {
        to: toAddress,
        amount: amount.toString()
      },
      networkName,
      privateKey: fromPrivateKey
    });
  }

  // 获取交易状态
  async getTransactionStatus(transactionId) {
    try {
      // 先检查成功记录
      const successRecord = await databaseManager.cacheGet(`transaction:${transactionId}`);
      if (successRecord) {
        return successRecord;
      }

      // 再检查失败记录
      const failureRecord = await databaseManager.cacheGet(`transaction_failure:${transactionId}`);
      if (failureRecord) {
        return failureRecord;
      }

      // 检查是否在队列中
      const queuedTransaction = this.transactionQueue.find(tx => tx.id === transactionId);
      if (queuedTransaction) {
        return {
          id: transactionId,
          status: 'queued',
          queuePosition: this.transactionQueue.indexOf(queuedTransaction) + 1
        };
      }

      return {
        id: transactionId,
        status: 'not_found'
      };
    } catch (error) {
      console.error('获取交易状态失败:', error);
      return {
        id: transactionId,
        status: 'error',
        error: error.message
      };
    }
  }

  // 获取网络状态
  async getNetworkStatus() {
    const status = {};

    for (const [networkName, provider] of this.providers) {
      try {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        const gasPrice = await provider.getFeeData();

        status[networkName] = {
          connected: true,
          chainId: network.chainId.toString(),
          blockNumber,
          gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') + ' Gwei' : 'N/A'
        };
      } catch (error) {
        status[networkName] = {
          connected: false,
          error: error.message
        };
      }
    }

    return status;
  }

  // 健康检查
  async healthCheck() {
    try {
      const networkStatus = await this.getNetworkStatus();
      const queueLength = this.transactionQueue.length;
      
      const health = {
        healthy: true,
        networks: networkStatus,
        transactionQueue: {
          length: queueLength,
          processing: queueLength > 0
        },
        contracts: {},
        timestamp: new Date().toISOString()
      };

      // 检查合约状态
      for (const [contractName, contract] of this.contracts) {
        try {
          const name = await contract.name();
          health.contracts[contractName] = {
            connected: true,
            name
          };
        } catch (error) {
          health.contracts[contractName] = {
            connected: false,
            error: error.message
          };
          health.healthy = false;
        }
      }

      return health;
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 创建单例实例
const optimizedBlockchainManager = new OptimizedBlockchainManager();

module.exports = {
  OptimizedBlockchainManager,
  optimizedBlockchainManager,
  
  // 便捷方法
  sendReward: (userAddress, amount, reason, networkName) => 
    optimizedBlockchainManager.sendReward(userAddress, amount, reason, networkName),
  
  transferTokens: (fromPrivateKey, toAddress, amount, networkName) =>
    optimizedBlockchainManager.transferTokens(fromPrivateKey, toAddress, amount, networkName),
  
  getTokenBalance: (address, networkName) =>
    optimizedBlockchainManager.getCachedUserBalance(address, networkName),
  
  getTransactionStatus: (transactionId) =>
    optimizedBlockchainManager.getTransactionStatus(transactionId),
  
  getNetworkStatus: () =>
    optimizedBlockchainManager.getNetworkStatus(),
  
  healthCheck: () =>
    optimizedBlockchainManager.healthCheck()
};

