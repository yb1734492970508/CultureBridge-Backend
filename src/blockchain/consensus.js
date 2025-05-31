/**
 * 共识机制优化模块
 * 
 * 该模块实现了区块链共识机制的优化功能，包括:
 * - PoS机制升级
 * - 验证者节点管理
 * - 区块确认速度优化
 * - 网络拥堵处理
 * 
 * @module blockchain/consensus
 */

const ethers = require('ethers');
const { providers, Wallet, utils } = ethers;
const config = require('../config');
const logger = require('../utils/logger');

// 共识配置
const CONSENSUS_CONFIG = {
  // 验证者最低质押要求
  minStakeAmount: process.env.MIN_STAKE_AMOUNT || '32000000000000000000', // 32 ETH
  
  // 验证者合约地址
  validatorContractAddress: process.env.VALIDATOR_CONTRACT_ADDRESS || '0x4C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618',
  
  // 区块确认阈值
  confirmationThreshold: process.env.CONFIRMATION_THRESHOLD || 2, // 需要多少个验证者确认
  
  // 区块提议间隔（毫秒）
  blockProposalInterval: process.env.BLOCK_PROPOSAL_INTERVAL || 5000,
  
  // 网络拥堵阈值（待处理交易数）
  congestionThreshold: process.env.CONGESTION_THRESHOLD || 1000,
  
  // Gas价格调整系数
  gasPriceAdjustmentFactor: process.env.GAS_PRICE_ADJUSTMENT_FACTOR || 1.1
};

/**
 * PoS共识管理器
 * 管理PoS共识相关功能
 */
class PosConsensusManager {
  constructor() {
    this.provider = new providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    
    if (process.env.VALIDATOR_PRIVATE_KEY) {
      this.wallet = new Wallet(process.env.VALIDATOR_PRIVATE_KEY, this.provider);
    }
    
    // 初始化验证者合约
    const validatorAbi = require('../contracts/abis/ValidatorContract.json');
    this.validatorContract = new ethers.Contract(
      CONSENSUS_CONFIG.validatorContractAddress,
      validatorAbi,
      this.wallet || this.provider
    );
    
    logger.info('PoS共识管理器已初始化');
  }

  /**
   * 注册成为验证者
   * @param {string} validatorName - 验证者名称
   * @param {string} validatorUrl - 验证者URL
   * @returns {Promise<Object>} 注册结果
   */
  async registerValidator(validatorName, validatorUrl) {
    try {
      if (!this.wallet) {
        throw new Error('未配置验证者私钥');
      }
      
      // 检查是否已经是验证者
      const isValidator = await this.validatorContract.isValidator(this.wallet.address);
      
      if (isValidator) {
        throw new Error('该地址已经是验证者');
      }
      
      // 注册成为验证者
      const tx = await this.validatorContract.registerValidator(
        utils.formatBytes32String(validatorName),
        validatorUrl,
        { 
          value: CONSENSUS_CONFIG.minStakeAmount,
          gasLimit: 300000
        }
      );
      
      const receipt = await tx.wait(1);
      
      logger.info(`验证者注册成功: ${receipt.transactionHash}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        validatorAddress: this.wallet.address,
        validatorName,
        validatorUrl
      };
    } catch (error) {
      logger.error(`验证者注册失败: ${error.message}`);
      throw new Error(`验证者注册失败: ${error.message}`);
    }
  }

  /**
   * 增加验证者质押
   * @param {string} amount - 增加的质押金额
   * @returns {Promise<Object>} 质押结果
   */
  async addStake(amount) {
    try {
      if (!this.wallet) {
        throw new Error('未配置验证者私钥');
      }
      
      // 检查是否是验证者
      const isValidator = await this.validatorContract.isValidator(this.wallet.address);
      
      if (!isValidator) {
        throw new Error('该地址不是验证者');
      }
      
      // 增加质押
      const tx = await this.validatorContract.addStake(
        { 
          value: amount,
          gasLimit: 200000
        }
      );
      
      const receipt = await tx.wait(1);
      
      // 获取新的质押总额
      const totalStake = await this.validatorContract.getValidatorStake(this.wallet.address);
      
      logger.info(`验证者增加质押成功: ${receipt.transactionHash}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        validatorAddress: this.wallet.address,
        addedAmount: amount,
        totalStake: totalStake.toString()
      };
    } catch (error) {
      logger.error(`增加质押失败: ${error.message}`);
      throw new Error(`增加质押失败: ${error.message}`);
    }
  }

  /**
   * 提取验证者质押
   * @param {string} amount - 提取的质押金额
   * @returns {Promise<Object>} 提取结果
   */
  async withdrawStake(amount) {
    try {
      if (!this.wallet) {
        throw new Error('未配置验证者私钥');
      }
      
      // 检查是否是验证者
      const isValidator = await this.validatorContract.isValidator(this.wallet.address);
      
      if (!isValidator) {
        throw new Error('该地址不是验证者');
      }
      
      // 获取当前质押总额
      const totalStake = await this.validatorContract.getValidatorStake(this.wallet.address);
      
      // 检查是否有足够的质押可提取
      const remainingStake = totalStake.sub(amount);
      if (remainingStake.lt(CONSENSUS_CONFIG.minStakeAmount)) {
        throw new Error('提取后质押金额低于最低要求');
      }
      
      // 提取质押
      const tx = await this.validatorContract.withdrawStake(
        amount,
        { gasLimit: 200000 }
      );
      
      const receipt = await tx.wait(1);
      
      // 获取新的质押总额
      const newTotalStake = await this.validatorContract.getValidatorStake(this.wallet.address);
      
      logger.info(`验证者提取质押成功: ${receipt.transactionHash}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        validatorAddress: this.wallet.address,
        withdrawnAmount: amount,
        totalStake: newTotalStake.toString()
      };
    } catch (error) {
      logger.error(`提取质押失败: ${error.message}`);
      throw new Error(`提取质押失败: ${error.message}`);
    }
  }

  /**
   * 获取验证者信息
   * @param {string} validatorAddress - 验证者地址
   * @returns {Promise<Object>} 验证者信息
   */
  async getValidatorInfo(validatorAddress) {
    try {
      // 检查是否是验证者
      const isValidator = await this.validatorContract.isValidator(validatorAddress);
      
      if (!isValidator) {
        throw new Error('该地址不是验证者');
      }
      
      // 获取验证者信息
      const info = await this.validatorContract.getValidatorInfo(validatorAddress);
      
      return {
        address: validatorAddress,
        name: utils.parseBytes32String(info.name),
        url: info.url,
        stake: info.stake.toString(),
        status: this.parseValidatorStatus(info.status),
        joinedAt: new Date(info.joinedAt.toNumber() * 1000).toISOString(),
        proposedBlocks: info.proposedBlocks.toNumber(),
        performance: info.performance.toNumber() / 100 // 百分比
      };
    } catch (error) {
      logger.error(`获取验证者信息失败: ${error.message}`);
      throw new Error(`获取验证者信息失败: ${error.message}`);
    }
  }

  /**
   * 解析验证者状态
   * @param {number} statusCode - 状态码
   * @returns {string} 状态描述
   */
  parseValidatorStatus(statusCode) {
    const statuses = {
      0: 'Inactive',
      1: 'Active',
      2: 'Probation',
      3: 'Slashed',
      4: 'Exited'
    };
    
    return statuses[statusCode] || 'Unknown';
  }

  /**
   * 获取所有活跃验证者
   * @returns {Promise<Array<Object>>} 验证者列表
   */
  async getActiveValidators() {
    try {
      // 获取活跃验证者数量
      const validatorCount = await this.validatorContract.getActiveValidatorCount();
      
      // 获取所有活跃验证者地址
      const validatorAddresses = [];
      for (let i = 0; i < validatorCount.toNumber(); i++) {
        const address = await this.validatorContract.getActiveValidatorAt(i);
        validatorAddresses.push(address);
      }
      
      // 获取每个验证者的详细信息
      const validators = [];
      for (const address of validatorAddresses) {
        const info = await this.getValidatorInfo(address);
        validators.push(info);
      }
      
      return validators;
    } catch (error) {
      logger.error(`获取活跃验证者失败: ${error.message}`);
      throw new Error(`获取活跃验证者失败: ${error.message}`);
    }
  }
}

/**
 * 区块确认优化器
 * 优化区块确认速度和可靠性
 */
class BlockConfirmationOptimizer {
  constructor(posManager) {
    this.posManager = posManager;
    this.confirmationCallbacks = {};
    
    logger.info('区块确认优化器已初始化');
  }

  /**
   * 监听区块确认
   * @param {string} txHash - 交易哈希
   * @param {Function} callback - 确认回调函数
   * @returns {Promise<void>}
   */
  async watchConfirmation(txHash, callback) {
    try {
      // 获取交易收据
      const receipt = await this.posManager.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        // 交易尚未被打包，设置监听
        this.confirmationCallbacks[txHash] = callback;
        this.posManager.provider.once(txHash, (transaction) => {
          this.handleTransaction(transaction);
        });
        
        return;
      }
      
      // 交易已被打包，检查确认数
      if (receipt.confirmations >= CONSENSUS_CONFIG.confirmationThreshold) {
        // 已经有足够的确认
        callback(null, {
          txHash,
          confirmations: receipt.confirmations,
          blockNumber: receipt.blockNumber,
          status: receipt.status === 1 ? 'success' : 'failed'
        });
      } else {
        // 等待更多确认
        this.confirmationCallbacks[txHash] = callback;
        this.posManager.provider.on('block', (blockNumber) => {
          this.checkConfirmation(txHash, receipt.blockNumber);
        });
      }
    } catch (error) {
      logger.error(`监听区块确认失败: ${error.message}`);
      callback(error);
    }
  }

  /**
   * 处理新交易
   * @param {Object} transaction - 交易对象
   */
  async handleTransaction(transaction) {
    try {
      const txHash = transaction.hash;
      
      // 等待交易被打包
      const receipt = await transaction.wait(1);
      
      // 检查是否有回调
      if (this.confirmationCallbacks[txHash]) {
        // 开始监听确认
        this.posManager.provider.on('block', (blockNumber) => {
          this.checkConfirmation(txHash, receipt.blockNumber);
        });
      }
    } catch (error) {
      logger.error(`处理交易失败: ${error.message}`);
      
      // 通知回调交易失败
      if (this.confirmationCallbacks[transaction.hash]) {
        this.confirmationCallbacks[transaction.hash](error);
        delete this.confirmationCallbacks[transaction.hash];
      }
    }
  }

  /**
   * 检查交易确认状态
   * @param {string} txHash - 交易哈希
   * @param {number} txBlockNumber - 交易所在区块号
   */
  async checkConfirmation(txHash, txBlockNumber) {
    try {
      // 获取当前区块号
      const currentBlockNumber = await this.posManager.provider.getBlockNumber();
      
      // 计算确认数
      const confirmations = currentBlockNumber - txBlockNumber + 1;
      
      // 检查是否达到确认阈值
      if (confirmations >= CONSENSUS_CONFIG.confirmationThreshold) {
        // 获取交易收据
        const receipt = await this.posManager.provider.getTransactionReceipt(txHash);
        
        // 停止监听
        this.posManager.provider.removeAllListeners('block');
        
        // 通知回调
        if (this.confirmationCallbacks[txHash]) {
          this.confirmationCallbacks[txHash](null, {
            txHash,
            confirmations,
            blockNumber: txBlockNumber,
            status: receipt.status === 1 ? 'success' : 'failed'
          });
          
          // 删除回调
          delete this.confirmationCallbacks[txHash];
        }
      }
    } catch (error) {
      logger.error(`检查确认状态失败: ${error.message}`);
      
      // 通知回调出错
      if (this.confirmationCallbacks[txHash]) {
        this.confirmationCallbacks[txHash](error);
        delete this.confirmationCallbacks[txHash];
      }
    }
  }

  /**
   * 获取交易的快速确认状态
   * @param {string} txHash - 交易哈希
   * @returns {Promise<Object>} 确认状态
   */
  async getFastConfirmationStatus(txHash) {
    try {
      // 获取交易收据
      const receipt = await this.posManager.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { status: 'pending', confirmations: 0 };
      }
      
      // 获取验证者确认信息
      const validatorConfirmations = await this.getValidatorConfirmations(txHash);
      
      // 计算确认百分比
      const activeValidators = await this.posManager.getActiveValidators();
      const confirmationPercentage = (validatorConfirmations.length / activeValidators.length) * 100;
      
      return {
        txHash,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        validatorConfirmations: validatorConfirmations.length,
        confirmationPercentage,
        status: receipt.status === 1 ? 'success' : 'failed',
        fastConfirmed: validatorConfirmations.length >= CONSENSUS_CONFIG.confirmationThreshold
      };
    } catch (error) {
      logger.error(`获取快速确认状态失败: ${error.message}`);
      throw new Error(`获取快速确认状态失败: ${error.message}`);
    }
  }

  /**
   * 获取交易的验证者确认信息
   * @param {string} txHash - 交易哈希
   * @returns {Promise<Array<Object>>} 验证者确认列表
   */
  async getValidatorConfirmations(txHash) {
    try {
      // 在实际实现中，这里会查询验证者确认信息
      // 这里提供一个模拟实现
      
      // 获取交易收据
      const receipt = await this.posManager.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return [];
      }
      
      // 模拟验证者确认
      const confirmations = [];
      const activeValidators = await this.posManager.getActiveValidators();
      
      // 假设每个区块确认增加一个验证者确认
      const confirmationCount = Math.min(receipt.confirmations, activeValidators.length);
      
      for (let i = 0; i < confirmationCount; i++) {
        confirmations.push({
          validator: activeValidators[i].address,
          validatorName: activeValidators[i].name,
          confirmedAt: new Date(Date.now() - (i * 12000)).toISOString() // 假设每12秒一个确认
        });
      }
      
      return confirmations;
    } catch (error) {
      logger.error(`获取验证者确认信息失败: ${error.message}`);
      throw new Error(`获取验证者确认信息失败: ${error.message}`);
    }
  }
}

/**
 * 网络拥堵处理器
 * 处理网络拥堵和交易优先级
 */
class CongestionHandler {
  constructor(posManager) {
    this.posManager = posManager;
    this.congestionStatus = 'normal'; // normal, moderate, severe
    this.lastGasPrice = null;
    this.gasPriceHistory = [];
    
    // 启动拥堵监控
    this.startCongestionMonitoring();
    
    logger.info('网络拥堵处理器已初始化');
  }

  /**
   * 启动拥堵监控
   */
  startCongestionMonitoring() {
    // 每分钟检查一次
    setInterval(() => this.checkCongestion(), 60000);
  }

  /**
   * 检查网络拥堵状态
   */
  async checkCongestion() {
    try {
      // 获取待处理交易数
      const pendingTransactions = await this.getPendingTransactionCount();
      
      // 获取当前Gas价格
      const gasPrice = await this.posManager.provider.getGasPrice();
      this.lastGasPrice = gasPrice;
      
      // 记录Gas价格历史
      this.gasPriceHistory.push({
        timestamp: Date.now(),
        gasPrice: gasPrice.toString()
      });
      
      // 只保留最近24小时的数据
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.gasPriceHistory = this.gasPriceHistory.filter(item => item.timestamp >= oneDayAgo);
      
      // 更新拥堵状态
      if (pendingTransactions > CONSENSUS_CONFIG.congestionThreshold * 2) {
        this.congestionStatus = 'severe';
      } else if (pendingTransactions > CONSENSUS_CONFIG.congestionThreshold) {
        this.congestionStatus = 'moderate';
      } else {
        this.congestionStatus = 'normal';
      }
      
      logger.info(`网络拥堵状态: ${this.congestionStatus}, 待处理交易: ${pendingTransactions}, Gas价格: ${utils.formatUnits(gasPrice, 'gwei')} Gwei`);
    } catch (error) {
      logger.error(`检查网络拥堵失败: ${error.message}`);
    }
  }

  /**
   * 获取待处理交易数
   * @returns {Promise<number>} 待处理交易数
   */
  async getPendingTransactionCount() {
    try {
      // 获取待处理交易数
      const pendingBlock = await this.posManager.provider.send('eth_getBlockByNumber', ['pending', false]);
      return pendingBlock.transactions.length;
    } catch (error) {
      logger.error(`获取待处理交易数失败: ${error.message}`);
      throw new Error(`获取待处理交易数失败: ${error.message}`);
    }
  }

  /**
   * 获取当前网络拥堵状态
   * @returns {Promise<Object>} 拥堵状态
   */
  async getCongestionStatus() {
    try {
      // 获取待处理交易数
      const pendingTransactions = await this.getPendingTransactionCount();
      
      // 获取当前Gas价格
      const gasPrice = this.lastGasPrice || await this.posManager.provider.getGasPrice();
      
      // 计算建议的Gas价格
      const suggestedGasPrices = this.calculateSuggestedGasPrices(gasPrice);
      
      // 计算平均确认时间
      const estimatedConfirmationTimes = this.estimateConfirmationTimes(this.congestionStatus);
      
      return {
        status: this.congestionStatus,
        pendingTransactions,
        currentGasPrice: utils.formatUnits(gasPrice, 'gwei'),
        suggestedGasPrices: {
          slow: utils.formatUnits(suggestedGasPrices.slow, 'gwei'),
          standard: utils.formatUnits(suggestedGasPrices.standard, 'gwei'),
          fast: utils.formatUnits(suggestedGasPrices.fast, 'gwei'),
          rapid: utils.formatUnits(suggestedGasPrices.rapid, 'gwei')
        },
        estimatedConfirmationTimes
      };
    } catch (error) {
      logger.error(`获取拥堵状态失败: ${error.message}`);
      throw new Error(`获取拥堵状态失败: ${error.message}`);
    }
  }

  /**
   * 计算建议的Gas价格
   * @param {BigNumber} currentGasPrice - 当前Gas价格
   * @returns {Object} 建议的Gas价格
   */
  calculateSuggestedGasPrices(currentGasPrice) {
    // 根据拥堵状态调整Gas价格
    let factor;
    
    switch (this.congestionStatus) {
      case 'severe':
        factor = 2.0;
        break;
      case 'moderate':
        factor = 1.5;
        break;
      default:
        factor = 1.2;
    }
    
    return {
      slow: currentGasPrice.mul(Math.floor(factor * 80)).div(100),
      standard: currentGasPrice.mul(Math.floor(factor * 100)).div(100),
      fast: currentGasPrice.mul(Math.floor(factor * 130)).div(100),
      rapid: currentGasPrice.mul(Math.floor(factor * 200)).div(100)
    };
  }

  /**
   * 估计确认时间
   * @param {string} congestionStatus - 拥堵状态
   * @returns {Object} 估计的确认时间（秒）
   */
  estimateConfirmationTimes(congestionStatus) {
    // 根据拥堵状态估计确认时间
    switch (congestionStatus) {
      case 'severe':
        return {
          slow: 300, // 5分钟
          standard: 180, // 3分钟
          fast: 60, // 1分钟
          rapid: 15 // 15秒
        };
      case 'moderate':
        return {
          slow: 180, // 3分钟
          standard: 60, // 1分钟
          fast: 30, // 30秒
          rapid: 12 // 12秒
        };
      default:
        return {
          slow: 60, // 1分钟
          standard: 30, // 30秒
          fast: 15, // 15秒
          rapid: 5 // 5秒
        };
    }
  }

  /**
   * 获取Gas价格历史
   * @param {number} hours - 小时数
   * @returns {Array<Object>} Gas价格历史
   */
  getGasPriceHistory(hours = 24) {
    try {
      const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
      const history = this.gasPriceHistory.filter(item => item.timestamp >= cutoffTime);
      
      // 格式化数据
      return history.map(item => ({
        timestamp: new Date(item.timestamp).toISOString(),
        gasPrice: utils.formatUnits(item.gasPrice, 'gwei')
      }));
    } catch (error) {
      logger.error(`获取Gas价格历史失败: ${error.message}`);
      throw new Error(`获取Gas价格历史失败: ${error.message}`);
    }
  }

  /**
   * 提交优先级交易
   * @param {Object} transaction - 交易对象
   * @param {string} priorityLevel - 优先级级别 (slow, standard, fast, rapid)
   * @returns {Promise<Object>} 交易结果
   */
  async submitPriorityTransaction(transaction, priorityLevel = 'standard') {
    try {
      if (!this.posManager.wallet) {
        throw new Error('未配置钱包');
      }
      
      // 获取当前Gas价格
      const gasPrice = await this.posManager.provider.getGasPrice();
      
      // 计算建议的Gas价格
      const suggestedGasPrices = this.calculateSuggestedGasPrices(gasPrice);
      
      // 设置Gas价格
      transaction.gasPrice = suggestedGasPrices[priorityLevel];
      
      // 发送交易
      const tx = await this.posManager.wallet.sendTransaction(transaction);
      
      logger.info(`优先级交易已提交: ${tx.hash}, 优先级: ${priorityLevel}, Gas价格: ${utils.formatUnits(transaction.gasPrice, 'gwei')} Gwei`);
      return {
        success: true,
        transactionHash: tx.hash,
        priorityLevel,
        gasPrice: utils.formatUnits(transaction.gasPrice, 'gwei'),
        estimatedConfirmationTime: this.estimateConfirmationTimes(this.congestionStatus)[priorityLevel]
      };
    } catch (error) {
      logger.error(`提交优先级交易失败: ${error.message}`);
      throw new Error(`提交优先级交易失败: ${error.message}`);
    }
  }
}

// 创建PoS共识管理器实例
const posConsensusManager = new PosConsensusManager();

// 导出模块
module.exports = {
  posConsensusManager,
  BlockConfirmationOptimizer: new BlockConfirmationOptimizer(posConsensusManager),
  CongestionHandler: new CongestionHandler(posConsensusManager)
};
