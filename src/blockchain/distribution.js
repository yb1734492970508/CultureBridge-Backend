/**
 * 代币分配系统模块
 * 
 * 该模块实现了代币分配系统的核心功能，包括:
 * - 初始分配机制
 * - 生态激励分配
 * - 社区贡献奖励
 * - 团队与基金会锁定
 * 
 * @module blockchain/distribution
 */

const ethers = require('ethers');
const { providers, Wallet, utils, BigNumber } = ethers;
const config = require('../config');
const logger = require('../utils/logger');
const { TOKENOMICS_CONFIG } = require('./tokenomics');

// 代币分配系统配置
const DISTRIBUTION_CONFIG = {
  // 分配批次间隔（天）
  batchInterval: process.env.DISTRIBUTION_BATCH_INTERVAL || 30,
  
  // 生态激励分配比例
  ecosystemAllocation: {
    development: 0.30, // 开发激励
    marketing: 0.25, // 市场推广
    partnerships: 0.20, // 合作伙伴
    community: 0.15, // 社区建设
    reserve: 0.10 // 储备金
  },
  
  // 社区贡献奖励系数
  communityRewardFactors: {
    contentCreation: 2.0, // 内容创作
    curation: 1.0, // 内容策展
    engagement: 0.5, // 互动参与
    referral: 1.5, // 推荐新用户
    bugReporting: 1.2 // 问题反馈
  },
  
  // 团队解锁时间表（月数:比例）
  teamVestingSchedule: {
    6: 0.10, // 6个月后解锁10%
    12: 0.15, // 12个月后解锁15%
    18: 0.20, // 18个月后解锁20%
    24: 0.25, // 24个月后解锁25%
    36: 0.30 // 36个月后解锁30%
  },
  
  // 基金会解锁时间表（月数:比例）
  foundationVestingSchedule: {
    3: 0.15, // 3个月后解锁15%
    6: 0.20, // 6个月后解锁20%
    12: 0.30, // 12个月后解锁30%
    24: 0.35 // 24个月后解锁35%
  }
};

/**
 * 代币分配管理器
 * 管理代币分配相关功能
 */
class DistributionManager {
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
    
    // 初始化分配合约
    const distributionAbi = require('../contracts/abis/CultureBridgeDistribution.json');
    this.distributionContract = new ethers.Contract(
      process.env.DISTRIBUTION_CONTRACT_ADDRESS || '0x6C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618',
      distributionAbi,
      this.wallet || this.provider
    );
    
    logger.info('代币分配管理器已初始化');
  }

  /**
   * 创建初始分配计划
   * @param {Object} allocationPlan - 分配计划
   * @returns {Promise<Object>} 分配结果
   */
  async createInitialAllocation(allocationPlan) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 验证分配计划
      this.validateAllocationPlan(allocationPlan);
      
      // 创建分配计划
      const tx = await this.distributionContract.createInitialAllocation(
        allocationPlan.ecosystem,
        allocationPlan.community,
        allocationPlan.team,
        allocationPlan.foundation,
        allocationPlan.initialSale,
        { gasLimit: 300000 }
      );
      
      const receipt = await tx.wait(1);
      
      logger.info(`初始分配计划创建成功: ${receipt.transactionHash}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        allocationPlan
      };
    } catch (error) {
      logger.error(`创建初始分配计划失败: ${error.message}`);
      throw new Error(`创建初始分配计划失败: ${error.message}`);
    }
  }

  /**
   * 验证分配计划
   * @param {Object} allocationPlan - 分配计划
   */
  validateAllocationPlan(allocationPlan) {
    // 检查所有必要的字段
    const requiredFields = ['ecosystem', 'community', 'team', 'foundation', 'initialSale'];
    for (const field of requiredFields) {
      if (!allocationPlan[field]) {
        throw new Error(`分配计划缺少必要字段: ${field}`);
      }
    }
    
    // 检查总和是否为100%
    const total = Object.values(allocationPlan).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.0001) {
      throw new Error(`分配比例总和必须为100%，当前为: ${total * 100}%`);
    }
  }

  /**
   * 执行生态激励分配
   * @param {string} amount - 分配数量
   * @param {Object} customAllocation - 自定义分配比例（可选）
   * @returns {Promise<Object>} 分配结果
   */
  async distributeEcosystemIncentives(amount, customAllocation = null) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 使用默认或自定义分配比例
      const allocation = customAllocation || DISTRIBUTION_CONFIG.ecosystemAllocation;
      
      // 验证分配比例
      this.validateAllocationRatio(allocation);
      
      // 准备分配数据
      const recipients = [];
      const amounts = [];
      const lockPeriods = [];
      const purposes = [];
      
      // 开发激励
      if (allocation.development > 0) {
        const devAmount = BigNumber.from(amount).mul(Math.floor(allocation.development * 10000)).div(10000);
        recipients.push(await this.getEcosystemAddress('development'));
        amounts.push(devAmount);
        lockPeriods.push(90); // 锁定90天
        purposes.push('Development Incentives');
      }
      
      // 市场推广
      if (allocation.marketing > 0) {
        const marketingAmount = BigNumber.from(amount).mul(Math.floor(allocation.marketing * 10000)).div(10000);
        recipients.push(await this.getEcosystemAddress('marketing'));
        amounts.push(marketingAmount);
        lockPeriods.push(60); // 锁定60天
        purposes.push('Marketing Campaigns');
      }
      
      // 合作伙伴
      if (allocation.partnerships > 0) {
        const partnershipsAmount = BigNumber.from(amount).mul(Math.floor(allocation.partnerships * 10000)).div(10000);
        recipients.push(await this.getEcosystemAddress('partnerships'));
        amounts.push(partnershipsAmount);
        lockPeriods.push(120); // 锁定120天
        purposes.push('Strategic Partnerships');
      }
      
      // 社区建设
      if (allocation.community > 0) {
        const communityAmount = BigNumber.from(amount).mul(Math.floor(allocation.community * 10000)).div(10000);
        recipients.push(await this.getEcosystemAddress('community'));
        amounts.push(communityAmount);
        lockPeriods.push(30); // 锁定30天
        purposes.push('Community Building');
      }
      
      // 储备金
      if (allocation.reserve > 0) {
        const reserveAmount = BigNumber.from(amount).mul(Math.floor(allocation.reserve * 10000)).div(10000);
        recipients.push(await this.getEcosystemAddress('reserve'));
        amounts.push(reserveAmount);
        lockPeriods.push(180); // 锁定180天
        purposes.push('Ecosystem Reserve');
      }
      
      // 执行批量分配
      const tx = await this.distributionContract.batchDistribute(
        recipients,
        amounts,
        lockPeriods,
        purposes,
        { gasLimit: 500000 }
      );
      
      const receipt = await tx.wait(1);
      
      // 构建分配结果
      const distributionResults = [];
      for (let i = 0; i < recipients.length; i++) {
        distributionResults.push({
          recipient: recipients[i],
          amount: utils.formatEther(amounts[i]),
          lockPeriod: lockPeriods[i],
          purpose: purposes[i]
        });
      }
      
      logger.info(`生态激励分配成功: ${receipt.transactionHash}, 总金额: ${utils.formatEther(amount)}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        totalAmount: utils.formatEther(amount),
        distributions: distributionResults
      };
    } catch (error) {
      logger.error(`生态激励分配失败: ${error.message}`);
      throw new Error(`生态激励分配失败: ${error.message}`);
    }
  }

  /**
   * 验证分配比例
   * @param {Object} allocation - 分配比例
   */
  validateAllocationRatio(allocation) {
    // 检查总和是否为100%
    const total = Object.values(allocation).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.0001) {
      throw new Error(`分配比例总和必须为100%，当前为: ${total * 100}%`);
    }
  }

  /**
   * 获取生态系统地址
   * @param {string} purpose - 用途
   * @returns {Promise<string>} 地址
   */
  async getEcosystemAddress(purpose) {
    // 在实际实现中，这里会从配置或合约中获取地址
    const addresses = {
      development: process.env.ECO_DEV_ADDRESS || '0xA1234567890123456789012345678901234567890',
      marketing: process.env.ECO_MARKETING_ADDRESS || '0xB1234567890123456789012345678901234567890',
      partnerships: process.env.ECO_PARTNERSHIPS_ADDRESS || '0xC1234567890123456789012345678901234567890',
      community: process.env.ECO_COMMUNITY_ADDRESS || '0xD1234567890123456789012345678901234567890',
      reserve: process.env.ECO_RESERVE_ADDRESS || '0xE1234567890123456789012345678901234567890'
    };
    
    if (!addresses[purpose]) {
      throw new Error(`未知的生态系统用途: ${purpose}`);
    }
    
    return addresses[purpose];
  }

  /**
   * 分配社区贡献奖励
   * @param {Array<Object>} contributions - 贡献列表
   * @returns {Promise<Object>} 分配结果
   */
  async distributeCommunityRewards(contributions) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 验证贡献列表
      this.validateContributions(contributions);
      
      // 准备分配数据
      const recipients = [];
      const amounts = [];
      const contributionTypes = [];
      const references = [];
      
      // 计算每种贡献类型的奖励
      for (const contribution of contributions) {
        // 基础奖励金额
        let rewardAmount = utils.parseEther(contribution.baseAmount.toString());
        
        // 应用奖励系数
        const factor = DISTRIBUTION_CONFIG.communityRewardFactors[contribution.type] || 1.0;
        rewardAmount = rewardAmount.mul(Math.floor(factor * 100)).div(100);
        
        // 添加到分配列表
        recipients.push(contribution.address);
        amounts.push(rewardAmount);
        contributionTypes.push(contribution.type);
        references.push(contribution.reference || '');
      }
      
      // 执行批量奖励分配
      const tx = await this.distributionContract.distributeCommunityRewards(
        recipients,
        amounts,
        contributionTypes,
        references,
        { gasLimit: 500000 }
      );
      
      const receipt = await tx.wait(1);
      
      // 构建分配结果
      const rewardResults = [];
      for (let i = 0; i < recipients.length; i++) {
        rewardResults.push({
          recipient: recipients[i],
          amount: utils.formatEther(amounts[i]),
          contributionType: contributionTypes[i],
          reference: references[i]
        });
      }
      
      // 计算总奖励金额
      const totalReward = amounts.reduce((sum, amount) => sum.add(amount), BigNumber.from(0));
      
      logger.info(`社区贡献奖励分配成功: ${receipt.transactionHash}, 总金额: ${utils.formatEther(totalReward)}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        totalAmount: utils.formatEther(totalReward),
        rewards: rewardResults
      };
    } catch (error) {
      logger.error(`社区贡献奖励分配失败: ${error.message}`);
      throw new Error(`社区贡献奖励分配失败: ${error.message}`);
    }
  }

  /**
   * 验证贡献列表
   * @param {Array<Object>} contributions - 贡献列表
   */
  validateContributions(contributions) {
    if (!Array.isArray(contributions) || contributions.length === 0) {
      throw new Error('贡献列表不能为空');
    }
    
    // 检查每个贡献
    for (const contribution of contributions) {
      // 检查必要字段
      if (!contribution.address || !contribution.type || !contribution.baseAmount) {
        throw new Error('贡献缺少必要字段: address, type, baseAmount');
      }
      
      // 检查贡献类型是否有效
      if (!DISTRIBUTION_CONFIG.communityRewardFactors[contribution.type]) {
        throw new Error(`无效的贡献类型: ${contribution.type}`);
      }
      
      // 检查基础奖励金额是否有效
      if (isNaN(contribution.baseAmount) || contribution.baseAmount <= 0) {
        throw new Error(`无效的基础奖励金额: ${contribution.baseAmount}`);
      }
      
      // 检查地址是否有效
      if (!utils.isAddress(contribution.address)) {
        throw new Error(`无效的地址: ${contribution.address}`);
      }
    }
  }

  /**
   * 创建团队代币解锁计划
   * @param {Array<Object>} teamMembers - 团队成员列表
   * @param {string} totalAmount - 总分配金额
   * @returns {Promise<Object>} 解锁计划结果
   */
  async createTeamVestingSchedule(teamMembers, totalAmount) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 验证团队成员列表
      this.validateTeamMembers(teamMembers);
      
      // 计算总权重
      const totalWeight = teamMembers.reduce((sum, member) => sum + member.weight, 0);
      
      // 准备解锁计划数据
      const vestingPlans = [];
      
      // 为每个团队成员创建解锁计划
      for (const member of teamMembers) {
        // 计算成员分配金额
        const memberAmount = BigNumber.from(totalAmount).mul(member.weight).div(totalWeight);
        
        // 创建分阶段解锁计划
        const vestingSchedule = [];
        let cumulativePercentage = 0;
        
        // 按照团队解锁时间表创建解锁阶段
        for (const [monthStr, percentage] of Object.entries(DISTRIBUTION_CONFIG.teamVestingSchedule)) {
          const month = parseInt(monthStr);
          const releaseTime = Math.floor(Date.now() / 1000) + month * 30 * 24 * 60 * 60; // 当前时间 + 月数 * 30天
          const releaseAmount = memberAmount.mul(Math.floor(percentage * 10000)).div(10000);
          
          vestingSchedule.push({
            releaseTime,
            amount: releaseAmount
          });
          
          cumulativePercentage += percentage;
        }
        
        // 检查解锁比例总和是否为100%
        if (Math.abs(cumulativePercentage - 1) > 0.0001) {
          throw new Error(`团队成员 ${member.address} 的解锁比例总和必须为100%，当前为: ${cumulativePercentage * 100}%`);
        }
        
        vestingPlans.push({
          beneficiary: member.address,
          schedule: vestingSchedule
        });
      }
      
      // 执行批量创建解锁计划
      const tx = await this.distributionContract.createBatchVestingSchedules(
        vestingPlans.map(plan => plan.beneficiary),
        vestingPlans.map(plan => plan.schedule.map(stage => stage.releaseTime)),
        vestingPlans.map(plan => plan.schedule.map(stage => stage.amount)),
        'Team Allocation',
        { gasLimit: 1000000 }
      );
      
      const receipt = await tx.wait(1);
      
      logger.info(`团队代币解锁计划创建成功: ${receipt.transactionHash}, 总金额: ${utils.formatEther(totalAmount)}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        totalAmount: utils.formatEther(totalAmount),
        vestingPlans: vestingPlans.map(plan => ({
          beneficiary: plan.beneficiary,
          schedule: plan.schedule.map(stage => ({
            releaseTime: new Date(stage.releaseTime * 1000).toISOString(),
            amount: utils.formatEther(stage.amount)
          }))
        }))
      };
    } catch (error) {
      logger.error(`创建团队代币解锁计划失败: ${error.message}`);
      throw new Error(`创建团队代币解锁计划失败: ${error.message}`);
    }
  }

  /**
   * 验证团队成员列表
   * @param {Array<Object>} teamMembers - 团队成员列表
   */
  validateTeamMembers(teamMembers) {
    if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
      throw new Error('团队成员列表不能为空');
    }
    
    // 检查每个团队成员
    for (const member of teamMembers) {
      // 检查必要字段
      if (!member.address || !member.weight) {
        throw new Error('团队成员缺少必要字段: address, weight');
      }
      
      // 检查权重是否有效
      if (isNaN(member.weight) || member.weight <= 0) {
        throw new Error(`无效的权重: ${member.weight}`);
      }
      
      // 检查地址是否有效
      if (!utils.isAddress(member.address)) {
        throw new Error(`无效的地址: ${member.address}`);
      }
    }
  }

  /**
   * 创建基金会代币解锁计划
   * @param {string} totalAmount - 总分配金额
   * @returns {Promise<Object>} 解锁计划结果
   */
  async createFoundationVestingSchedule(totalAmount) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 获取基金会地址
      const foundationAddress = process.env.FOUNDATION_ADDRESS || '0x9C3bFe3530e92E2B9e8e05a7B97A61AaF6ae8618';
      
      // 创建分阶段解锁计划
      const vestingSchedule = [];
      let cumulativePercentage = 0;
      
      // 按照基金会解锁时间表创建解锁阶段
      for (const [monthStr, percentage] of Object.entries(DISTRIBUTION_CONFIG.foundationVestingSchedule)) {
        const month = parseInt(monthStr);
        const releaseTime = Math.floor(Date.now() / 1000) + month * 30 * 24 * 60 * 60; // 当前时间 + 月数 * 30天
        const releaseAmount = BigNumber.from(totalAmount).mul(Math.floor(percentage * 10000)).div(10000);
        
        vestingSchedule.push({
          releaseTime,
          amount: releaseAmount
        });
        
        cumulativePercentage += percentage;
      }
      
      // 检查解锁比例总和是否为100%
      if (Math.abs(cumulativePercentage - 1) > 0.0001) {
        throw new Error(`基金会解锁比例总和必须为100%，当前为: ${cumulativePercentage * 100}%`);
      }
      
      // 执行创建解锁计划
      const tx = await this.distributionContract.createVestingSchedule(
        foundationAddress,
        vestingSchedule.map(stage => stage.releaseTime),
        vestingSchedule.map(stage => stage.amount),
        'Foundation Allocation',
        { gasLimit: 500000 }
      );
      
      const receipt = await tx.wait(1);
      
      logger.info(`基金会代币解锁计划创建成功: ${receipt.transactionHash}, 总金额: ${utils.formatEther(totalAmount)}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        totalAmount: utils.formatEther(totalAmount),
        foundationAddress,
        vestingSchedule: vestingSchedule.map(stage => ({
          releaseTime: new Date(stage.releaseTime * 1000).toISOString(),
          amount: utils.formatEther(stage.amount)
        }))
      };
    } catch (error) {
      logger.error(`创建基金会代币解锁计划失败: ${error.message}`);
      throw new Error(`创建基金会代币解锁计划失败: ${error.message}`);
    }
  }

  /**
   * 获取解锁计划详情
   * @param {string} beneficiary - 受益人地址
   * @returns {Promise<Object>} 解锁计划详情
   */
  async getVestingSchedule(beneficiary) {
    try {
      // 获取解锁计划ID
      const scheduleId = await this.distributionContract.getVestingScheduleIdByBeneficiary(beneficiary);
      
      // 获取解锁计划详情
      const schedule = await this.distributionContract.getVestingSchedule(scheduleId);
      
      // 获取已释放金额
      const releasedAmount = await this.distributionContract.getVestingScheduleReleased(scheduleId);
      
      // 计算总金额
      const totalAmount = schedule.amountTotal;
      
      // 计算剩余金额
      const remainingAmount = totalAmount.sub(releasedAmount);
      
      // 获取解锁阶段
      const sliceCount = await this.distributionContract.getVestingScheduleSliceCount(scheduleId);
      const slices = [];
      
      for (let i = 0; i < sliceCount.toNumber(); i++) {
        const slice = await this.distributionContract.getVestingScheduleSlice(scheduleId, i);
        
        slices.push({
          releaseTime: new Date(slice.releaseTime.toNumber() * 1000).toISOString(),
          amount: utils.formatEther(slice.amount),
          released: slice.released
        });
      }
      
      return {
        beneficiary,
        scheduleId: scheduleId.toString(),
        totalAmount: utils.formatEther(totalAmount),
        releasedAmount: utils.formatEther(releasedAmount),
        remainingAmount: utils.formatEther(remainingAmount),
        startTime: new Date(schedule.start.toNumber() * 1000).toISOString(),
        purpose: schedule.purpose,
        slices
      };
    } catch (error) {
      logger.error(`获取解锁计划详情失败: ${error.message}`);
      throw new Error(`获取解锁计划详情失败: ${error.message}`);
    }
  }

  /**
   * 释放可用代币
   * @param {string} beneficiary - 受益人地址
   * @returns {Promise<Object>} 释放结果
   */
  async releaseVestedTokens(beneficiary) {
    try {
      if (!this.wallet) {
        throw new Error('未配置管理员私钥');
      }
      
      // 获取解锁计划ID
      const scheduleId = await this.distributionContract.getVestingScheduleIdByBeneficiary(beneficiary);
      
      // 计算可释放金额
      const releasableAmount = await this.distributionContract.computeReleasableAmount(scheduleId);
      
      // 如果没有可释放金额，则返回
      if (releasableAmount.isZero()) {
        return {
          success: false,
          message: '没有可释放的代币',
          releasableAmount: '0'
        };
      }
      
      // 执行释放
      const tx = await this.distributionContract.release(scheduleId, releasableAmount, { gasLimit: 200000 });
      const receipt = await tx.wait(1);
      
      logger.info(`代币释放成功: ${receipt.transactionHash}, 受益人: ${beneficiary}, 金额: ${utils.formatEther(releasableAmount)}`);
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        beneficiary,
        releasedAmount: utils.formatEther(releasableAmount)
      };
    } catch (error) {
      logger.error(`释放代币失败: ${error.message}`);
      throw new Error(`释放代币失败: ${error.message}`);
    }
  }

  /**
   * 获取分配统计信息
   * @returns {Promise<Object>} 分配统计信息
   */
  async getDistributionStats() {
    try {
      // 获取总分配金额
      const totalDistributed = await this.distributionContract.getTotalDistributed();
      
      // 获取各类型分配金额
      const ecosystemDistributed = await this.distributionContract.getDistributedByType('ecosystem');
      const communityDistributed = await this.distributionContract.getDistributedByType('community');
      const teamDistributed = await this.distributionContract.getDistributedByType('team');
      const foundationDistributed = await this.distributionContract.getDistributedByType('foundation');
      const initialSaleDistributed = await this.distributionContract.getDistributedByType('initialSale');
      
      // 获取总解锁金额
      const totalVested = await this.distributionContract.getTotalVested();
      
      // 获取总释放金额
      const totalReleased = await this.distributionContract.getTotalReleased();
      
      // 计算待释放金额
      const pendingRelease = totalVested.sub(totalReleased);
      
      return {
        totalDistributed: utils.formatEther(totalDistributed),
        distribution: {
          ecosystem: utils.formatEther(ecosystemDistributed),
          community: utils.formatEther(communityDistributed),
          team: utils.formatEther(teamDistributed),
          foundation: utils.formatEther(foundationDistributed),
          initialSale: utils.formatEther(initialSaleDistributed)
        },
        totalVested: utils.formatEther(totalVested),
        totalReleased: utils.formatEther(totalReleased),
        pendingRelease: utils.formatEther(pendingRelease)
      };
    } catch (error) {
      logger.error(`获取分配统计信息失败: ${error.message}`);
      throw new Error(`获取分配统计信息失败: ${error.message}`);
    }
  }
}

// 创建代币分配管理器实例
const distributionManager = new DistributionManager();

// 导出模块
module.exports = {
  distributionManager,
  DISTRIBUTION_CONFIG
};
