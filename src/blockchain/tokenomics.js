/**
 * 代币经济模型升级模块
 * 
 * 该模块实现了代币经济模型的核心功能，包括:
 * - 通证供应与分配机制
 * - 通缩机制设计
 * - 价值捕获模型
 * - 长期可持续性评估
 * 
 * @module blockchain/tokenomics
 */

const ethers = require('ethers');
const { providers, Wallet, utils, BigNumber } = ethers;
const config = require('../config');
const logger = require('../utils/logger');

// 代币经济模型配置
const TOKENOMICS_CONFIG = {
  // 代币总供应量
  totalSupply: process.env.TOKEN_TOTAL_SUPPLY || '1000000000000000000000000000', // 10亿代币
  
  // 代币合约地址
  tokenContractAddress: process.env.TOKEN_CONTRACT_ADDRESS || '0x5C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618',
  
  // 代币分配比例
  allocationRatio: {
    ecosystem: 0.40, // 生态系统激励
    community: 0.25, // 社区奖励
    team: 0.15, // 团队分配
    foundation: 0.10, // 基金会储备
    initialSale: 0.10 // 初始销售
  },
  
  // 通缩参数
  deflationParams: {
    burnRateTransactions: 0.002, // 交易燃烧率 0.2%
    burnRateNftMint: 0.01, // NFT铸造燃烧率 1%
    burnRateFeatures: 0.005, // 特殊功能使用燃烧率 0.5%
    quarterlyBuybackPercentage: 0.1 // 季度回购比例（平台收入的10%）
  },
  
  // 价值捕获参数
  valueCaptureParams: {
    stakingRewardRate: 0.08, // 年化质押奖励率 8%
    governanceRewardRate: 0.02, // 治理参与奖励率 2%
    contentCreationRewardRate: 0.05 // 内容创作奖励率 5%
  },
  
  // 锁定期参数（天数）
  lockupPeriods: {
    team: 365, // 团队锁定1年
    foundation: 180, // 基金会锁定6个月
    ecosystem: [30, 90, 180, 365], // 生态系统多级锁定期
    stakingTiers: [7, 30, 90, 180, 365] // 质押锁定期梯度
  }
};

/**
 * 代币经济模型管理器
 * 管理代币经济模型相关功能
 */
class TokenomicsManager {
  constructor() {
    this.provider = new providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    
    if (process.env.ADMIN_PRIVATE_KEY) {
      this.wallet = new Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);
    }
    
    // 初始化代币合约
    const tokenAbi = require('../contracts/abis/CultureBridgeToken.json');
    this.tokenContract = new ethers.Contract(
      TOKENOMICS_CONFIG.tokenContractAddress,
      tokenAbi,
      this.wallet || this.provider
    );
    
    logger.info('代币经济模型管理器已初始化');
  }

  /**
   * 获取代币经济模型概览
   * @returns {Promise<Object>} 代币经济模型概览
   */
  async getTokenomicsOverview() {
    try {
      // 获取代币总供应量
      const totalSupply = await this.tokenContract.totalSupply();
      
      // 获取流通供应量
      const circulatingSupply = await this.getCirculatingSupply();
      
      // 获取已销毁代币数量
      const burnedTokens = await this.getBurnedTokens();
      
      // 获取锁定代币数量
      const lockedTokens = await this.getLockedTokens();
      
      // 获取质押代币数量
      const stakedTokens = await this.getStakedTokens();
      
      // 计算通缩率
      const deflationRate = burnedTokens.mul(10000).div(totalSupply).toNumber() / 100;
      
      // 计算流通率
      const circulationRate = circulatingSupply.mul(10000).div(totalSupply).toNumber() / 100;
      
      // 计算质押率
      const stakingRate = stakedTokens.mul(10000).div(totalSupply).toNumber() / 100;
      
      return {
        totalSupply: utils.formatEther(totalSupply),
        circulatingSupply: utils.formatEther(circulatingSupply),
        burnedTokens: utils.formatEther(burnedTokens),
        lockedTokens: utils.formatEther(lockedTokens),
        stakedTokens: utils.formatEther(stakedTokens),
        deflationRate: `${deflationRate}%`,
        circulationRate: `${circulationRate}%`,
        stakingRate: `${stakingRate}%`,
        allocationRatio: TOKENOMICS_CONFIG.allocationRatio,
        deflationParams: TOKENOMICS_CONFIG.deflationParams,
        valueCaptureParams: TOKENOMICS_CONFIG.valueCaptureParams
      };
    } catch (error) {
      logger.error(`获取代币经济模型概览失败: ${error.message}`);
      throw new Error(`获取代币经济模型概览失败: ${error.message}`);
    }
  }

  /**
   * 获取流通供应量
   * @returns {Promise<BigNumber>} 流通供应量
   */
  async getCirculatingSupply() {
    try {
      // 获取代币总供应量
      const totalSupply = await this.tokenContract.totalSupply();
      
      // 获取锁定代币数量
      const lockedTokens = await this.getLockedTokens();
      
      // 获取已销毁代币数量
      const burnedTokens = await this.getBurnedTokens();
      
      // 计算流通供应量 = 总供应量 - 锁定代币 - 已销毁代币
      const circulatingSupply = totalSupply.sub(lockedTokens).sub(burnedTokens);
      
      return circulatingSupply;
    } catch (error) {
      logger.error(`获取流通供应量失败: ${error.message}`);
      throw new Error(`获取流通供应量失败: ${error.message}`);
    }
  }

  /**
   * 获取已销毁代币数量
   * @returns {Promise<BigNumber>} 已销毁代币数量
   */
  async getBurnedTokens() {
    try {
      // 获取已销毁代币数量
      const burnedTokens = await this.tokenContract.burnedTokens();
      
      return burnedTokens;
    } catch (error) {
      logger.error(`获取已销毁代币数量失败: ${error.message}`);
      throw new Error(`获取已销毁代币数量失败: ${error.message}`);
    }
  }

  /**
   * 获取锁定代币数量
   * @returns {Promise<BigNumber>} 锁定代币数量
   */
  async getLockedTokens() {
    try {
      // 获取锁定代币数量
      const lockedTokens = await this.tokenContract.getLockedTokensTotal();
      
      return lockedTokens;
    } catch (error) {
      logger.error(`获取锁定代币数量失败: ${error.message}`);
      throw new Error(`获取锁定代币数量失败: ${error.message}`);
    }
  }

  /**
   * 获取质押代币数量
   * @returns {Promise<BigNumber>} 质押代币数量
   */
  async getStakedTokens() {
    try {
      // 获取质押代币数量
      const stakedTokens = await this.tokenContract.getStakedTokensTotal();
      
      return stakedTokens;
    } catch (error) {
      logger.error(`获取质押代币数量失败: ${error.message}`);
      throw new Error(`获取质押代币数量失败: ${error.message}`);
    }
  }

  /**
   * 执行代币销毁
   * @param {string} amount - 销毁数量
   * @param {string} reason - 销毁原因
   * @returns {Promise<Object>} 销毁结果
   */
  async burnTokens(amount, reason) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 执行代币销毁
      const tx = await this.tokenContract.burn(
        amount,
        reason,
        { gasLimit: 200000 }
      );
      
      const receipt = await tx.wait(1);
      
      // 获取新的已销毁代币总量
      const burnedTokens = await this.getBurnedTokens();
      
      logger.info(`代币销毁成功: ${receipt.transactionHash}, 数量: ${utils.formatEther(amount)}, 原因: ${reason}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        amount: utils.formatEther(amount),
        reason,
        totalBurned: utils.formatEther(burnedTokens)
      };
    } catch (error) {
      logger.error(`代币销毁失败: ${error.message}`);
      throw new Error(`代币销毁失败: ${error.message}`);
    }
  }

  /**
   * 执行代币回购
   * @param {string} amount - 回购金额（ETH）
   * @returns {Promise<Object>} 回购结果
   */
  async buybackTokens(amount) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 执行代币回购
      const tx = await this.tokenContract.buyback(
        { value: amount, gasLimit: 300000 }
      );
      
      const receipt = await tx.wait(1);
      
      // 获取回购事件
      const buybackEvent = receipt.events.find(e => e.event === 'Buyback');
      const tokensBought = buybackEvent.args.tokenAmount;
      
      logger.info(`代币回购成功: ${receipt.transactionHash}, ETH金额: ${utils.formatEther(amount)}, 回购代币: ${utils.formatEther(tokensBought)}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        ethAmount: utils.formatEther(amount),
        tokensBought: utils.formatEther(tokensBought)
      };
    } catch (error) {
      logger.error(`代币回购失败: ${error.message}`);
      throw new Error(`代币回购失败: ${error.message}`);
    }
  }

  /**
   * 分配代币到指定目标
   * @param {string} target - 目标类型 (ecosystem, community, team, foundation)
   * @param {string} amount - 分配数量
   * @returns {Promise<Object>} 分配结果
   */
  async allocateTokens(target, amount) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 获取目标地址
      const targetAddress = await this.getTargetAddress(target);
      
      // 确定锁定期
      const lockupPeriod = this.getLockupPeriod(target);
      
      // 执行代币分配
      const tx = await this.tokenContract.allocate(
        targetAddress,
        amount,
        lockupPeriod,
        target,
        { gasLimit: 250000 }
      );
      
      const receipt = await tx.wait(1);
      
      logger.info(`代币分配成功: ${receipt.transactionHash}, 目标: ${target}, 数量: ${utils.formatEther(amount)}, 锁定期: ${lockupPeriod}天`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        target,
        targetAddress,
        amount: utils.formatEther(amount),
        lockupPeriod: `${lockupPeriod}天`
      };
    } catch (error) {
      logger.error(`代币分配失败: ${error.message}`);
      throw new Error(`代币分配失败: ${error.message}`);
    }
  }

  /**
   * 获取目标地址
   * @param {string} target - 目标类型
   * @returns {Promise<string>} 目标地址
   */
  async getTargetAddress(target) {
    // 在实际实现中，这里会从配置或合约中获取目标地址
    const targetAddresses = {
      ecosystem: process.env.ECOSYSTEM_ADDRESS || '0x6C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618',
      community: process.env.COMMUNITY_ADDRESS || '0x7C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618',
      team: process.env.TEAM_ADDRESS || '0x8C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618',
      foundation: process.env.FOUNDATION_ADDRESS || '0x9C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618'
    };
    
    if (!targetAddresses[target]) {
      throw new Error(`未知的目标类型: ${target}`);
    }
    
    return targetAddresses[target];
  }

  /**
   * 获取锁定期
   * @param {string} target - 目标类型
   * @returns {number} 锁定期（天数）
   */
  getLockupPeriod(target) {
    if (target === 'team') {
      return TOKENOMICS_CONFIG.lockupPeriods.team;
    } else if (target === 'foundation') {
      return TOKENOMICS_CONFIG.lockupPeriods.foundation;
    } else if (target === 'ecosystem') {
      // 对于生态系统，随机选择一个锁定期
      const periods = TOKENOMICS_CONFIG.lockupPeriods.ecosystem;
      return periods[Math.floor(Math.random() * periods.length)];
    } else {
      // 默认无锁定期
      return 0;
    }
  }

  /**
   * 获取代币分配情况
   * @returns {Promise<Object>} 代币分配情况
   */
  async getTokenAllocation() {
    try {
      // 获取各目标的分配情况
      const targets = ['ecosystem', 'community', 'team', 'foundation', 'initialSale'];
      const allocation = {};
      
      for (const target of targets) {
        const allocated = await this.tokenContract.getAllocatedAmount(target);
        allocation[target] = {
          amount: utils.formatEther(allocated),
          percentage: (allocated.mul(10000).div(TOKENOMICS_CONFIG.totalSupply).toNumber() / 100).toFixed(2) + '%'
        };
      }
      
      return allocation;
    } catch (error) {
      logger.error(`获取代币分配情况失败: ${error.message}`);
      throw new Error(`获取代币分配情况失败: ${error.message}`);
    }
  }

  /**
   * 获取代币锁定情况
   * @returns {Promise<Array<Object>>} 代币锁定情况
   */
  async getTokenLockups() {
    try {
      // 获取锁定记录数量
      const lockupCount = await this.tokenContract.getLockupCount();
      
      // 获取所有锁定记录
      const lockups = [];
      for (let i = 0; i < lockupCount.toNumber(); i++) {
        const lockup = await this.tokenContract.getLockupAt(i);
        
        lockups.push({
          id: i,
          address: lockup.beneficiary,
          amount: utils.formatEther(lockup.amount),
          releaseTime: new Date(lockup.releaseTime.toNumber() * 1000).toISOString(),
          released: lockup.released,
          target: lockup.target
        });
      }
      
      return lockups;
    } catch (error) {
      logger.error(`获取代币锁定情况失败: ${error.message}`);
      throw new Error(`获取代币锁定情况失败: ${error.message}`);
    }
  }

  /**
   * 计算通缩效果
   * @param {number} months - 预测月数
   * @returns {Promise<Object>} 通缩预测
   */
  async calculateDeflationEffect(months = 12) {
    try {
      // 获取当前代币总供应量
      const totalSupply = await this.tokenContract.totalSupply();
      
      // 获取当前已销毁代币数量
      const currentBurned = await this.getBurnedTokens();
      
      // 获取历史交易数据
      const transactionHistory = await this.getTransactionHistory();
      
      // 计算平均月交易量
      const avgMonthlyTransactions = this.calculateAverageMonthlyTransactions(transactionHistory);
      
      // 计算平均月NFT铸造量
      const avgMonthlyNftMints = await this.getAverageMonthlyNftMints();
      
      // 计算平均月特殊功能使用量
      const avgMonthlyFeatureUsage = await this.getAverageMonthlyFeatureUsage();
      
      // 计算平均月平台收入
      const avgMonthlyPlatformRevenue = await this.getAverageMonthlyPlatformRevenue();
      
      // 预测未来每月销毁量
      const monthlyBurnPredictions = [];
      let cumulativeBurned = currentBurned;
      let remainingSupply = totalSupply;
      
      for (let i = 1; i <= months; i++) {
        // 交易销毁
        const transactionBurn = avgMonthlyTransactions.mul(TOKENOMICS_CONFIG.deflationParams.burnRateTransactions);
        
        // NFT铸造销毁
        const nftMintBurn = avgMonthlyNftMints.mul(TOKENOMICS_CONFIG.deflationParams.burnRateNftMint);
        
        // 特殊功能使用销毁
        const featureUsageBurn = avgMonthlyFeatureUsage.mul(TOKENOMICS_CONFIG.deflationParams.burnRateFeatures);
        
        // 季度回购销毁（每3个月一次）
        let buybackBurn = BigNumber.from(0);
        if (i % 3 === 0) {
          buybackBurn = avgMonthlyPlatformRevenue.mul(3).mul(TOKENOMICS_CONFIG.deflationParams.quarterlyBuybackPercentage);
        }
        
        // 当月总销毁量
        const monthlyBurn = transactionBurn.add(nftMintBurn).add(featureUsageBurn).add(buybackBurn);
        
        // 累计销毁量
        cumulativeBurned = cumulativeBurned.add(monthlyBurn);
        
        // 剩余供应量
        remainingSupply = totalSupply.sub(cumulativeBurned);
        
        // 销毁率
        const burnRate = cumulativeBurned.mul(10000).div(totalSupply).toNumber() / 100;
        
        monthlyBurnPredictions.push({
          month: i,
          monthlyBurn: utils.formatEther(monthlyBurn),
          cumulativeBurned: utils.formatEther(cumulativeBurned),
          remainingSupply: utils.formatEther(remainingSupply),
          burnRate: `${burnRate}%`
        });
      }
      
      return {
        initialSupply: utils.formatEther(totalSupply),
        currentBurned: utils.formatEther(currentBurned),
        currentBurnRate: `${currentBurned.mul(10000).div(totalSupply).toNumber() / 100}%`,
        projectedBurnRate: `${cumulativeBurned.mul(10000).div(totalSupply).toNumber() / 100}%`,
        monthlyPredictions: monthlyBurnPredictions
      };
    } catch (error) {
      logger.error(`计算通缩效果失败: ${error.message}`);
      throw new Error(`计算通缩效果失败: ${error.message}`);
    }
  }

  /**
   * 获取交易历史
   * @returns {Promise<Array<Object>>} 交易历史
   */
  async getTransactionHistory() {
    try {
      // 在实际实现中，这里会从数据库或区块链中获取交易历史
      // 这里提供一个模拟实现
      
      // 获取过去30天的交易事件
      const filter = this.tokenContract.filters.Transfer();
      const blockNumber = await this.provider.getBlockNumber();
      const fromBlock = blockNumber - 30 * 6500; // 假设每天6500个区块
      
      const events = await this.tokenContract.queryFilter(filter, fromBlock);
      
      // 转换为交易历史
      const transactions = events.map(event => {
        return {
          from: event.args.from,
          to: event.args.to,
          amount: event.args.value,
          timestamp: event.blockNumber // 在实际实现中，这里会是实际的时间戳
        };
      });
      
      return transactions;
    } catch (error) {
      logger.error(`获取交易历史失败: ${error.message}`);
      throw new Error(`获取交易历史失败: ${error.message}`);
    }
  }

  /**
   * 计算平均月交易量
   * @param {Array<Object>} transactions - 交易历史
   * @returns {BigNumber} 平均月交易量
   */
  calculateAverageMonthlyTransactions(transactions) {
    try {
      // 计算总交易量
      let totalAmount = BigNumber.from(0);
      
      for (const tx of transactions) {
        totalAmount = totalAmount.add(tx.amount);
      }
      
      // 计算平均日交易量
      const avgDailyAmount = totalAmount.div(30);
      
      // 计算平均月交易量（30天）
      const avgMonthlyAmount = avgDailyAmount.mul(30);
      
      return avgMonthlyAmount;
    } catch (error) {
      logger.error(`计算平均月交易量失败: ${error.message}`);
      throw new Error(`计算平均月交易量失败: ${error.message}`);
    }
  }

  /**
   * 获取平均月NFT铸造量
   * @returns {Promise<BigNumber>} 平均月NFT铸造量
   */
  async getAverageMonthlyNftMints() {
    try {
      // 在实际实现中，这里会从数据库或区块链中获取NFT铸造数据
      // 这里提供一个模拟实现
      
      // 假设每月铸造1000个NFT，平均每个NFT消耗10个代币
      return utils.parseEther('10000');
    } catch (error) {
      logger.error(`获取平均月NFT铸造量失败: ${error.message}`);
      throw new Error(`获取平均月NFT铸造量失败: ${error.message}`);
    }
  }

  /**
   * 获取平均月特殊功能使用量
   * @returns {Promise<BigNumber>} 平均月特殊功能使用量
   */
  async getAverageMonthlyFeatureUsage() {
    try {
      // 在实际实现中，这里会从数据库或区块链中获取特殊功能使用数据
      // 这里提供一个模拟实现
      
      // 假设每月特殊功能使用消耗5000个代币
      return utils.parseEther('5000');
    } catch (error) {
      logger.error(`获取平均月特殊功能使用量失败: ${error.message}`);
      throw new Error(`获取平均月特殊功能使用量失败: ${error.message}`);
    }
  }

  /**
   * 获取平均月平台收入
   * @returns {Promise<BigNumber>} 平均月平台收入
   */
  async getAverageMonthlyPlatformRevenue() {
    try {
      // 在实际实现中，这里会从数据库或区块链中获取平台收入数据
      // 这里提供一个模拟实现
      
      // 假设每月平台收入为10 ETH
      return utils.parseEther('10');
    } catch (error) {
      logger.error(`获取平均月平台收入失败: ${error.message}`);
      throw new Error(`获取平均月平台收入失败: ${error.message}`);
    }
  }

  /**
   * 模拟代币经济模型
   * @param {Object} params - 模拟参数
   * @returns {Promise<Object>} 模拟结果
   */
  async simulateTokenomics(params) {
    try {
      // 模拟参数
      const simulationParams = {
        months: params.months || 36, // 默认模拟3年
        monthlyUserGrowth: params.monthlyUserGrowth || 0.05, // 默认月用户增长率5%
        initialUsers: params.initialUsers || 10000, // 默认初始用户数10000
        avgUserTransactions: params.avgUserTransactions || 5, // 默认每用户每月5笔交易
        avgTransactionAmount: params.avgTransactionAmount || '100', // 默认每笔交易100代币
        stakingParticipationRate: params.stakingParticipationRate || 0.3, // 默认30%用户参与质押
        avgStakingAmount: params.avgStakingAmount || '1000', // 默认每用户质押1000代币
        governanceParticipationRate: params.governanceParticipationRate || 0.1, // 默认10%用户参与治理
        nftAdoptionRate: params.nftAdoptionRate || 0.02, // 默认2%用户每月铸造NFT
        avgNftPrice: params.avgNftPrice || '500', // 默认每个NFT价格500代币
        contentCreationRate: params.contentCreationRate || 0.05 // 默认5%用户每月创建内容
      };
      
      // 初始化模拟结果
      const simulationResults = [];
      
      // 初始值
      let users = simulationParams.initialUsers;
      let circulatingSupply = await this.getCirculatingSupply();
      let burnedTokens = await this.getBurnedTokens();
      let stakedTokens = await this.getStakedTokens();
      let totalSupply = await this.tokenContract.totalSupply();
      
      // 月度模拟
      for (let month = 1; month <= simulationParams.months; month++) {
        // 用户增长
        users = Math.floor(users * (1 + simulationParams.monthlyUserGrowth));
        
        // 交易量
        const monthlyTransactions = users * simulationParams.avgUserTransactions;
        const monthlyTransactionVolume = utils.parseEther(simulationParams.avgTransactionAmount).mul(monthlyTransactions);
        
        // 交易销毁
        const transactionBurn = monthlyTransactionVolume.mul(TOKENOMICS_CONFIG.deflationParams.burnRateTransactions).div(1000);
        
        // NFT铸造
        const monthlyNftMints = Math.floor(users * simulationParams.nftAdoptionRate);
        const monthlyNftVolume = utils.parseEther(simulationParams.avgNftPrice).mul(monthlyNftMints);
        const nftBurn = monthlyNftVolume.mul(TOKENOMICS_CONFIG.deflationParams.burnRateNftMint).div(1000);
        
        // 特殊功能使用
        const contentCreators = Math.floor(users * simulationParams.contentCreationRate);
        const monthlyFeatureUsage = utils.parseEther('10').mul(contentCreators); // 假设每个内容创建者使用10代币的特殊功能
        const featureBurn = monthlyFeatureUsage.mul(TOKENOMICS_CONFIG.deflationParams.burnRateFeatures).div(1000);
        
        // 季度回购销毁
        let buybackBurn = BigNumber.from(0);
        if (month % 3 === 0) {
          // 假设平台季度收入与用户数和交易量相关
          const quarterlyRevenue = utils.parseEther('0.0001').mul(users).add(monthlyTransactionVolume.div(10000)).mul(3);
          buybackBurn = quarterlyRevenue.mul(TOKENOMICS_CONFIG.deflationParams.quarterlyBuybackPercentage).div(1000);
        }
        
        // 总销毁量
        const monthlyBurn = transactionBurn.add(nftBurn).add(featureBurn).add(buybackBurn);
        burnedTokens = burnedTokens.add(monthlyBurn);
        
        // 质押量
        const stakingUsers = Math.floor(users * simulationParams.stakingParticipationRate);
        const newStakedTokens = utils.parseEther(simulationParams.avgStakingAmount).mul(stakingUsers);
        stakedTokens = newStakedTokens; // 简化模型，假设每月重新计算质押总量
        
        // 流通供应量
        circulatingSupply = totalSupply.sub(burnedTokens).sub(stakedTokens);
        
        // 计算各种比率
        const burnRate = burnedTokens.mul(10000).div(totalSupply).toNumber() / 100;
        const stakingRate = stakedTokens.mul(10000).div(totalSupply).toNumber() / 100;
        const circulationRate = circulatingSupply.mul(10000).div(totalSupply).toNumber() / 100;
        
        // 记录结果
        simulationResults.push({
          month,
          users,
          circulatingSupply: utils.formatEther(circulatingSupply),
          burnedTokens: utils.formatEther(burnedTokens),
          stakedTokens: utils.formatEther(stakedTokens),
          monthlyBurn: utils.formatEther(monthlyBurn),
          burnRate: `${burnRate}%`,
          stakingRate: `${stakingRate}%`,
          circulationRate: `${circulationRate}%`,
          transactionVolume: utils.formatEther(monthlyTransactionVolume),
          nftMints: monthlyNftMints
        });
      }
      
      return {
        params: simulationParams,
        results: simulationResults,
        summary: {
          finalUsers: users,
          finalBurnRate: `${burnedTokens.mul(10000).div(totalSupply).toNumber() / 100}%`,
          finalStakingRate: `${stakedTokens.mul(10000).div(totalSupply).toNumber() / 100}%`,
          finalCirculationRate: `${circulatingSupply.mul(10000).div(totalSupply).toNumber() / 100}%`,
          totalBurned: utils.formatEther(burnedTokens),
          remainingSupply: utils.formatEther(totalSupply.sub(burnedTokens))
        }
      };
    } catch (error) {
      logger.error(`模拟代币经济模型失败: ${error.message}`);
      throw new Error(`模拟代币经济模型失败: ${error.message}`);
    }
  }
}

// 创建代币经济模型管理器实例
const tokenomicsManager = new TokenomicsManager();

// 导出模块
module.exports = {
  tokenomicsManager,
  TOKENOMICS_CONFIG
};
