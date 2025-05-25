// src/blockchain/token.service.js
const ethers = require('ethers');
const TokenABI = require('../contracts/abis/CultureBridgeToken.json').abi;
const GovernanceABI = require('../contracts/abis/CultureBridgeGovernance.json').abi;
const StakingABI = require('../contracts/abis/CultureBridgeStaking.json').abi;
const TokenTransaction = require('../models/token.model');
const User = require('../models/user.model');
const config = require('../config/blockchain.config');

class TokenService {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.tokenContract = new ethers.Contract(config.tokenAddress, TokenABI, this.wallet);
    this.governanceContract = new ethers.Contract(config.governanceAddress, GovernanceABI, this.wallet);
    this.stakingContract = new ethers.Contract(config.stakingAddress, StakingABI, this.wallet);
  }

  /**
   * 获取代币余额
   * @param {string} address 用户钱包地址
   * @returns {Promise<string>} 代币余额
   */
  async getBalance(address) {
    try {
      const balance = await this.tokenContract.balanceOf(address);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('获取代币余额失败:', error);
      throw new Error('获取代币余额失败');
    }
  }

  /**
   * 获取用户投票权重
   * @param {string} address 用户钱包地址
   * @returns {Promise<string>} 投票权重
   */
  async getVotingPower(address) {
    try {
      const votingPower = await this.tokenContract.getVotes(address);
      return ethers.utils.formatEther(votingPower);
    } catch (error) {
      console.error('获取投票权重失败:', error);
      throw new Error('获取投票权重失败');
    }
  }

  /**
   * 转移代币
   * @param {string} to 接收方地址
   * @param {string} amount 代币数量
   * @param {string} reason 转移原因
   * @returns {Promise<object>} 交易结果
   */
  async transfer(to, amount, reason) {
    try {
      const amountWei = ethers.utils.parseEther(amount);
      const tx = await this.tokenContract.transfer(to, amountWei);
      await tx.wait();

      // 记录交易
      const transaction = new TokenTransaction({
        txHash: tx.hash,
        from: this.wallet.address,
        to: to,
        amount: amount,
        tokenType: 'CBT',
        transactionType: 'TRANSFER',
        blockNumber: tx.blockNumber,
        status: 'CONFIRMED',
        reason: reason
      });
      await transaction.save();

      return {
        success: true,
        txHash: tx.hash,
        from: this.wallet.address,
        to: to,
        amount: amount
      };
    } catch (error) {
      console.error('转移代币失败:', error);
      throw new Error('转移代币失败');
    }
  }

  /**
   * 铸造代币
   * @param {string} to 接收方地址
   * @param {string} amount 代币数量
   * @param {string} reason 铸造原因
   * @returns {Promise<object>} 交易结果
   */
  async mint(to, amount, reason) {
    try {
      const amountWei = ethers.utils.parseEther(amount);
      const tx = await this.tokenContract.mint(to, amountWei);
      await tx.wait();

      // 记录交易
      const transaction = new TokenTransaction({
        txHash: tx.hash,
        from: this.wallet.address,
        to: to,
        amount: amount,
        tokenType: 'CBT',
        transactionType: 'MINT',
        blockNumber: tx.blockNumber,
        status: 'CONFIRMED',
        reason: reason
      });
      await transaction.save();

      return {
        success: true,
        txHash: tx.hash,
        to: to,
        amount: amount
      };
    } catch (error) {
      console.error('铸造代币失败:', error);
      throw new Error('铸造代币失败');
    }
  }

  /**
   * 质押代币
   * @param {string} address 用户钱包地址
   * @param {string} amount 质押数量
   * @param {number} lockPeriodIndex 锁定期索引
   * @returns {Promise<object>} 质押结果
   */
  async stakeTokens(address, amount, lockPeriodIndex) {
    try {
      // 这里需要用户自己签名交易，后端只提供辅助功能
      // 实际应用中，这部分应该在前端完成，后端只记录结果
      const amountWei = ethers.utils.parseEther(amount);
      const tx = await this.stakingContract.stake(amountWei, lockPeriodIndex);
      await tx.wait();

      // 记录交易
      const transaction = new TokenTransaction({
        txHash: tx.hash,
        from: address,
        to: this.stakingContract.address,
        amount: amount,
        tokenType: 'CBT',
        transactionType: 'STAKE',
        blockNumber: tx.blockNumber,
        status: 'CONFIRMED',
        metadata: { lockPeriodIndex }
      });
      await transaction.save();

      return {
        success: true,
        txHash: tx.hash,
        address: address,
        amount: amount,
        lockPeriodIndex: lockPeriodIndex
      };
    } catch (error) {
      console.error('质押代币失败:', error);
      throw new Error('质押代币失败');
    }
  }

  /**
   * 获取质押信息
   * @param {string} address 用户钱包地址
   * @returns {Promise<object>} 质押信息
   */
  async getStakeInfo(address) {
    try {
      const stakeInfo = await this.stakingContract.getUserStakeInfo(address);
      return {
        amount: ethers.utils.formatEther(stakeInfo.amount),
        startTime: new Date(stakeInfo.startTime.toNumber() * 1000),
        lastRewardTime: new Date(stakeInfo.lastRewardTime.toNumber() * 1000),
        accumulatedRewards: ethers.utils.formatEther(stakeInfo.accumulatedRewards),
        lockPeriodIndex: stakeInfo.lockPeriodIndex.toNumber(),
        lockEndTime: new Date(stakeInfo.lockEndTime.toNumber() * 1000)
      };
    } catch (error) {
      console.error('获取质押信息失败:', error);
      throw new Error('获取质押信息失败');
    }
  }

  /**
   * 计算奖励
   * @param {string} address 用户钱包地址
   * @returns {Promise<string>} 奖励数量
   */
  async calculateReward(address) {
    try {
      const reward = await this.stakingContract.calculateReward(address);
      return ethers.utils.formatEther(reward);
    } catch (error) {
      console.error('计算奖励失败:', error);
      throw new Error('计算奖励失败');
    }
  }

  /**
   * 领取奖励
   * @param {string} address 用户钱包地址
   * @returns {Promise<object>} 领取结果
   */
  async claimReward(address) {
    try {
      // 这里需要用户自己签名交易，后端只提供辅助功能
      const tx = await this.stakingContract.claimReward();
      await tx.wait();

      const reward = await this.calculateReward(address);

      // 记录交易
      const transaction = new TokenTransaction({
        txHash: tx.hash,
        from: this.stakingContract.address,
        to: address,
        amount: reward,
        tokenType: 'REWARD',
        transactionType: 'REWARD',
        blockNumber: tx.blockNumber,
        status: 'CONFIRMED'
      });
      await transaction.save();

      return {
        success: true,
        txHash: tx.hash,
        address: address,
        reward: reward
      };
    } catch (error) {
      console.error('领取奖励失败:', error);
      throw new Error('领取奖励失败');
    }
  }

  /**
   * 更新用户声誉分数
   * @param {string} address 用户钱包地址
   * @param {number} score 新的声誉分数
   * @returns {Promise<object>} 更新结果
   */
  async updateReputationScore(address, score) {
    try {
      const tx = await this.tokenContract.updateReputationScore(address, score);
      await tx.wait();

      // 更新用户模型中的声誉分数
      await User.findOneAndUpdate(
        { walletAddress: address },
        { $set: { reputationScore: score } }
      );

      return {
        success: true,
        txHash: tx.hash,
        address: address,
        score: score
      };
    } catch (error) {
      console.error('更新声誉分数失败:', error);
      throw new Error('更新声誉分数失败');
    }
  }

  /**
   * 获取交易历史
   * @param {string} address 用户钱包地址
   * @param {number} limit 限制数量
   * @param {number} skip 跳过数量
   * @returns {Promise<Array>} 交易历史
   */
  async getTransactionHistory(address, limit = 10, skip = 0) {
    try {
      return await TokenTransaction.find({
        $or: [{ from: address }, { to: address }]
      })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      console.error('获取交易历史失败:', error);
      throw new Error('获取交易历史失败');
    }
  }

  /**
   * 获取代币总供应量
   * @returns {Promise<string>} 总供应量
   */
  async getTotalSupply() {
    try {
      const totalSupply = await this.tokenContract.totalSupply();
      return ethers.utils.formatEther(totalSupply);
    } catch (error) {
      console.error('获取总供应量失败:', error);
      throw new Error('获取总供应量失败');
    }
  }

  /**
   * 获取总质押量
   * @returns {Promise<string>} 总质押量
   */
  async getTotalStaked() {
    try {
      const totalStaked = await this.stakingContract.totalStaked();
      return ethers.utils.formatEther(totalStaked);
    } catch (error) {
      console.error('获取总质押量失败:', error);
      throw new Error('获取总质押量失败');
    }
  }
}

module.exports = new TokenService();
