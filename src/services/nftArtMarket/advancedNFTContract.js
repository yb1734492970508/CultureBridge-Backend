/**
 * 高级NFT合约升级模块
 * 
 * 该模块实现了高级NFT合约的升级功能，包括:
 * - 支持多层级版税分配
 * - 艺术品历史溯源记录
 * - 分数化所有权支持
 * - 高级访问控制机制
 * 
 * @module services/nftArtMarket/advancedNFTContract
 */

const ethers = require('ethers');
const { Contract } = require('ethers');
const mongoose = require('mongoose');
const NFT = require('../../models/nft.model');
const User = require('../../models/user.model');
const logger = require('../../utils/logger');
const config = require('../../config');
const ipfsService = require('../../utils/ipfs');

// 高级NFT合约配置
const ADVANCED_NFT_CONFIG = {
  // 版税设置
  royalty: {
    maxTiers: 5,                // 最大层级数
    maxTotalPercentage: 15,     // 最大总版税百分比
    minPerTier: 0.5,            // 每层最小百分比
    defaultCreatorPercentage: 10 // 默认创作者版税百分比
  },
  
  // 分数化所有权设置
  fractionalization: {
    minFractions: 2,            // 最小分数数量
    maxFractions: 10000,        // 最大分数数量
    defaultFractions: 100       // 默认分数数量
  },
  
  // 访问控制设置
  accessControl: {
    roles: {
      ADMIN: 'ADMIN',           // 管理员角色
      CREATOR: 'CREATOR',       // 创作者角色
      CURATOR: 'CURATOR',       // 策展人角色
      OWNER: 'OWNER',           // 所有者角色
      VIEWER: 'VIEWER'          // 查看者角色
    },
    defaultPublic: true         // 默认公开访问
  },
  
  // 溯源记录设置
  provenance: {
    maxHistoryEntries: 1000,    // 最大历史记录条目
    requiredFields: [           // 必填字段
      'timestamp',
      'action',
      'actor',
      'details'
    ]
  },
  
  // 合约地址
  contractAddresses: {
    mainnet: '0x...',           // 主网合约地址
    testnet: '0x...',           // 测试网合约地址
    local: '0x...'              // 本地开发合约地址
  },
  
  // 网络设置
  network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'
};

/**
 * 高级NFT合约管理器
 * 管理高级NFT合约相关功能
 */
class AdvancedNFTContractManager {
  constructor() {
    // 初始化合约连接
    this.initializeContract();
    
    logger.info('高级NFT合约管理器已初始化');
  }

  /**
   * 初始化合约连接
   */
  async initializeContract() {
    try {
      // 获取合约地址
      const contractAddress = ADVANCED_NFT_CONFIG.contractAddresses[ADVANCED_NFT_CONFIG.network];
      
      // 获取合约ABI
      const contractABI = require('../../contracts/abis/AdvancedNFT.json');
      
      // 创建提供者
      const provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
      
      // 创建签名者
      const privateKey = config.blockchain.privateKey;
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // 创建合约实例
      this.contract = new Contract(contractAddress, contractABI, wallet);
      
      logger.info(`高级NFT合约已连接: ${contractAddress}`);
    } catch (error) {
      logger.error(`初始化高级NFT合约失败: ${error.message}`);
      throw new Error(`初始化高级NFT合约失败: ${error.message}`);
    }
  }

  /**
   * 铸造高级NFT
   * @param {Object} nftData - NFT数据
   * @param {string} creatorId - 创作者ID
   * @returns {Promise<Object>} 铸造结果
   */
  async mintAdvancedNFT(nftData, creatorId) {
    try {
      // 验证NFT数据
      this.validateNFTData(nftData);
      
      // 获取创作者
      const creator = await User.findById(creatorId);
      if (!creator) {
        throw new Error(`创作者不存在: ${creatorId}`);
      }
      
      // 获取创作者钱包地址
      const creatorAddress = creator.walletAddress;
      if (!creatorAddress) {
        throw new Error(`创作者没有关联钱包地址: ${creatorId}`);
      }
      
      // 处理版税设置
      const royaltyRecipients = this.processRoyaltySettings(nftData.royaltySettings, creatorAddress);
      
      // 处理访问控制设置
      const accessControlSettings = this.processAccessControlSettings(nftData.accessControlSettings, creatorId);
      
      // 上传元数据到IPFS
      const metadata = {
        name: nftData.name,
        description: nftData.description,
        image: nftData.imageUrl,
        attributes: nftData.attributes || [],
        creator: creatorId,
        creationDate: new Date().toISOString(),
        royalty: royaltyRecipients,
        accessControl: accessControlSettings,
        additionalData: nftData.additionalData || {}
      };
      
      const metadataUri = await ipfsService.uploadJSON(metadata);
      
      // 调用合约铸造NFT
      const tx = await this.contract.mintAdvancedNFT(
        creatorAddress,
        metadataUri,
        royaltyRecipients.map(r => r.address),
        royaltyRecipients.map(r => r.percentage * 100), // 转换为基点 (1% = 100)
        nftData.fractionalize ? true : false,
        nftData.fractionalize ? (nftData.fractions || ADVANCED_NFT_CONFIG.fractionalization.defaultFractions) : 0,
        { gasLimit: 3000000 }
      );
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 获取铸造的NFT ID
      const mintEvent = receipt.events.find(event => event.event === 'AdvancedNFTMinted');
      const tokenId = mintEvent.args.tokenId.toString();
      
      // 创建NFT记录
      const nft = new NFT({
        tokenId,
        name: nftData.name,
        description: nftData.description,
        creator: creatorId,
        owner: creatorId,
        imageUrl: nftData.imageUrl,
        metadataUri,
        contractAddress: this.contract.address,
        mintTxHash: receipt.transactionHash,
        royaltySettings: royaltyRecipients,
        accessControlSettings: accessControlSettings,
        fractionalized: nftData.fractionalize ? true : false,
        fractions: nftData.fractionalize ? (nftData.fractions || ADVANCED_NFT_CONFIG.fractionalization.defaultFractions) : 0,
        status: 'minted',
        attributes: nftData.attributes || [],
        category: nftData.category || 'art',
        tags: nftData.tags || [],
        provenance: [
          {
            timestamp: new Date(),
            action: 'mint',
            actor: creatorId,
            details: {
              txHash: receipt.transactionHash,
              blockNumber: receipt.blockNumber
            }
          }
        ]
      });
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`高级NFT铸造成功: ${tokenId}`);
      return {
        success: true,
        tokenId,
        txHash: receipt.transactionHash,
        nft
      };
    } catch (error) {
      logger.error(`铸造高级NFT失败: ${error.message}`);
      throw new Error(`铸造高级NFT失败: ${error.message}`);
    }
  }

  /**
   * 验证NFT数据
   * @param {Object} nftData - NFT数据
   */
  validateNFTData(nftData) {
    // 检查必要字段
    if (!nftData.name) {
      throw new Error('NFT名称不能为空');
    }
    
    if (!nftData.description) {
      throw new Error('NFT描述不能为空');
    }
    
    if (!nftData.imageUrl) {
      throw new Error('NFT图像URL不能为空');
    }
    
    // 检查版税设置
    if (nftData.royaltySettings) {
      if (Array.isArray(nftData.royaltySettings)) {
        // 检查层级数量
        if (nftData.royaltySettings.length > ADVANCED_NFT_CONFIG.royalty.maxTiers) {
          throw new Error(`版税层级不能超过${ADVANCED_NFT_CONFIG.royalty.maxTiers}层`);
        }
        
        // 计算总版税百分比
        const totalPercentage = nftData.royaltySettings.reduce((sum, tier) => sum + (tier.percentage || 0), 0);
        if (totalPercentage > ADVANCED_NFT_CONFIG.royalty.maxTotalPercentage) {
          throw new Error(`总版税百分比不能超过${ADVANCED_NFT_CONFIG.royalty.maxTotalPercentage}%`);
        }
        
        // 检查每层版税
        nftData.royaltySettings.forEach((tier, index) => {
          if (!tier.address && !tier.userId) {
            throw new Error(`第${index + 1}层版税接收者地址或用户ID不能为空`);
          }
          
          if (!tier.percentage || tier.percentage < ADVANCED_NFT_CONFIG.royalty.minPerTier) {
            throw new Error(`第${index + 1}层版税百分比不能小于${ADVANCED_NFT_CONFIG.royalty.minPerTier}%`);
          }
        });
      }
    }
    
    // 检查分数化设置
    if (nftData.fractionalize) {
      if (nftData.fractions) {
        if (nftData.fractions < ADVANCED_NFT_CONFIG.fractionalization.minFractions) {
          throw new Error(`分数数量不能小于${ADVANCED_NFT_CONFIG.fractionalization.minFractions}`);
        }
        
        if (nftData.fractions > ADVANCED_NFT_CONFIG.fractionalization.maxFractions) {
          throw new Error(`分数数量不能大于${ADVANCED_NFT_CONFIG.fractionalization.maxFractions}`);
        }
      }
    }
  }

  /**
   * 处理版税设置
   * @param {Array<Object>} royaltySettings - 版税设置
   * @param {string} creatorAddress - 创作者地址
   * @returns {Array<Object>} 处理后的版税设置
   */
  processRoyaltySettings(royaltySettings, creatorAddress) {
    // 如果没有提供版税设置，使用默认设置
    if (!royaltySettings || !Array.isArray(royaltySettings) || royaltySettings.length === 0) {
      return [
        {
          address: creatorAddress,
          percentage: ADVANCED_NFT_CONFIG.royalty.defaultCreatorPercentage,
          role: 'creator'
        }
      ];
    }
    
    // 处理提供的版税设置
    return royaltySettings.map(tier => ({
      address: tier.address,
      percentage: tier.percentage,
      role: tier.role || 'contributor'
    }));
  }

  /**
   * 处理访问控制设置
   * @param {Object} accessControlSettings - 访问控制设置
   * @param {string} creatorId - 创作者ID
   * @returns {Object} 处理后的访问控制设置
   */
  processAccessControlSettings(accessControlSettings, creatorId) {
    // 如果没有提供访问控制设置，使用默认设置
    if (!accessControlSettings) {
      return {
        isPublic: ADVANCED_NFT_CONFIG.accessControl.defaultPublic,
        roles: {
          [ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN]: [creatorId],
          [ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR]: [creatorId]
        }
      };
    }
    
    // 确保创作者始终是管理员和创作者
    const roles = accessControlSettings.roles || {};
    
    roles[ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN] = roles[ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN] || [];
    if (!roles[ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN].includes(creatorId)) {
      roles[ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN].push(creatorId);
    }
    
    roles[ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR] = roles[ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR] || [];
    if (!roles[ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR].includes(creatorId)) {
      roles[ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR].push(creatorId);
    }
    
    return {
      isPublic: accessControlSettings.isPublic !== undefined ? accessControlSettings.isPublic : ADVANCED_NFT_CONFIG.accessControl.defaultPublic,
      roles
    };
  }

  /**
   * 更新NFT元数据
   * @param {string} tokenId - NFT令牌ID
   * @param {Object} updateData - 更新数据
   * @param {string} actorId - 操作者ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateNFTMetadata(tokenId, updateData, actorId) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId });
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查权限
      await this.checkPermission(nft, actorId, [
        ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN,
        ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR
      ]);
      
      // 更新元数据
      const updatedMetadata = {
        name: updateData.name || nft.name,
        description: updateData.description || nft.description,
        image: updateData.imageUrl || nft.imageUrl,
        attributes: updateData.attributes || nft.attributes,
        creator: nft.creator,
        creationDate: nft.createdAt.toISOString(),
        royalty: nft.royaltySettings,
        accessControl: nft.accessControlSettings,
        additionalData: updateData.additionalData || nft.additionalData || {}
      };
      
      // 上传更新后的元数据到IPFS
      const metadataUri = await ipfsService.uploadJSON(updatedMetadata);
      
      // 调用合约更新元数据
      const tx = await this.contract.updateTokenURI(tokenId, metadataUri, { gasLimit: 200000 });
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 更新NFT记录
      nft.name = updateData.name || nft.name;
      nft.description = updateData.description || nft.description;
      nft.imageUrl = updateData.imageUrl || nft.imageUrl;
      nft.metadataUri = metadataUri;
      nft.attributes = updateData.attributes || nft.attributes;
      nft.additionalData = updateData.additionalData || nft.additionalData;
      
      // 添加溯源记录
      nft.provenance.push({
        timestamp: new Date(),
        action: 'update_metadata',
        actor: actorId,
        details: {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          updatedFields: Object.keys(updateData)
        }
      });
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`NFT元数据更新成功: ${tokenId}`);
      return {
        success: true,
        tokenId,
        txHash: receipt.transactionHash,
        nft
      };
    } catch (error) {
      logger.error(`更新NFT元数据失败: ${error.message}`);
      throw new Error(`更新NFT元数据失败: ${error.message}`);
    }
  }

  /**
   * 转移NFT所有权
   * @param {string} tokenId - NFT令牌ID
   * @param {string} fromUserId - 发送者用户ID
   * @param {string} toUserId - 接收者用户ID
   * @param {Object} transferData - 转移数据
   * @returns {Promise<Object>} 转移结果
   */
  async transferNFT(tokenId, fromUserId, toUserId, transferData = {}) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId });
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查所有权
      if (nft.owner.toString() !== fromUserId) {
        throw new Error(`用户不是NFT所有者: ${fromUserId}`);
      }
      
      // 获取发送者和接收者
      const fromUser = await User.findById(fromUserId);
      const toUser = await User.findById(toUserId);
      
      if (!fromUser || !fromUser.walletAddress) {
        throw new Error(`发送者不存在或没有关联钱包地址: ${fromUserId}`);
      }
      
      if (!toUser || !toUser.walletAddress) {
        throw new Error(`接收者不存在或没有关联钱包地址: ${toUserId}`);
      }
      
      // 检查是否为分数化NFT
      if (nft.fractionalized) {
        // 处理分数化NFT转移
        return await this.transferFractionalizedNFT(nft, fromUser, toUser, transferData);
      } else {
        // 处理普通NFT转移
        return await this.transferWholeNFT(nft, fromUser, toUser, transferData);
      }
    } catch (error) {
      logger.error(`转移NFT失败: ${error.message}`);
      throw new Error(`转移NFT失败: ${error.message}`);
    }
  }

  /**
   * 转移整体NFT
   * @param {Object} nft - NFT对象
   * @param {Object} fromUser - 发送者用户
   * @param {Object} toUser - 接收者用户
   * @param {Object} transferData - 转移数据
   * @returns {Promise<Object>} 转移结果
   */
  async transferWholeNFT(nft, fromUser, toUser, transferData) {
    try {
      // 调用合约转移NFT
      const tx = await this.contract.transferFrom(
        fromUser.walletAddress,
        toUser.walletAddress,
        nft.tokenId,
        { gasLimit: 200000 }
      );
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 更新NFT记录
      nft.owner = toUser._id;
      
      // 添加溯源记录
      nft.provenance.push({
        timestamp: new Date(),
        action: 'transfer',
        actor: fromUser._id,
        details: {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          from: fromUser._id,
          to: toUser._id,
          price: transferData.price || 0,
          currency: transferData.currency || 'ETH'
        }
      });
      
      // 更新访问控制
      if (nft.accessControlSettings && nft.accessControlSettings.roles) {
        // 添加新所有者到OWNER角色
        const ownerRole = ADVANCED_NFT_CONFIG.accessControl.roles.OWNER;
        nft.accessControlSettings.roles[ownerRole] = nft.accessControlSettings.roles[ownerRole] || [];
        
        // 移除旧所有者
        nft.accessControlSettings.roles[ownerRole] = nft.accessControlSettings.roles[ownerRole]
          .filter(id => id.toString() !== fromUser._id.toString());
        
        // 添加新所有者
        if (!nft.accessControlSettings.roles[ownerRole].includes(toUser._id)) {
          nft.accessControlSettings.roles[ownerRole].push(toUser._id);
        }
      }
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`NFT转移成功: ${nft.tokenId} 从 ${fromUser._id} 到 ${toUser._id}`);
      return {
        success: true,
        tokenId: nft.tokenId,
        txHash: receipt.transactionHash,
        nft
      };
    } catch (error) {
      logger.error(`转移整体NFT失败: ${error.message}`);
      throw new Error(`转移整体NFT失败: ${error.message}`);
    }
  }

  /**
   * 转移分数化NFT
   * @param {Object} nft - NFT对象
   * @param {Object} fromUser - 发送者用户
   * @param {Object} toUser - 接收者用户
   * @param {Object} transferData - 转移数据
   * @returns {Promise<Object>} 转移结果
   */
  async transferFractionalizedNFT(nft, fromUser, toUser, transferData) {
    try {
      // 检查分数数量
      const fractionAmount = transferData.fractionAmount;
      if (!fractionAmount || fractionAmount <= 0) {
        throw new Error('分数数量必须大于0');
      }
      
      // 获取发送者的分数余额
      const fromBalance = await this.contract.fractionBalanceOf(nft.tokenId, fromUser.walletAddress);
      
      if (fromBalance.lt(fractionAmount)) {
        throw new Error(`发送者没有足够的分数: 需要 ${fractionAmount}，拥有 ${fromBalance}`);
      }
      
      // 调用合约转移分数
      const tx = await this.contract.transferFractions(
        nft.tokenId,
        toUser.walletAddress,
        fractionAmount,
        { gasLimit: 200000 }
      );
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 获取转移后的余额
      const newFromBalance = await this.contract.fractionBalanceOf(nft.tokenId, fromUser.walletAddress);
      const newToBalance = await this.contract.fractionBalanceOf(nft.tokenId, toUser.walletAddress);
      
      // 更新NFT记录中的分数所有权
      if (!nft.fractionOwners) {
        nft.fractionOwners = {};
      }
      
      nft.fractionOwners[fromUser._id] = parseInt(newFromBalance.toString());
      nft.fractionOwners[toUser._id] = parseInt(newToBalance.toString());
      
      // 如果接收者现在拥有多数分数，更新主要所有者
      const totalFractions = nft.fractions;
      if (newToBalance.gt(totalFractions / 2)) {
        nft.owner = toUser._id;
      }
      
      // 添加溯源记录
      nft.provenance.push({
        timestamp: new Date(),
        action: 'transfer_fractions',
        actor: fromUser._id,
        details: {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          from: fromUser._id,
          to: toUser._id,
          fractionAmount,
          price: transferData.price || 0,
          currency: transferData.currency || 'ETH'
        }
      });
      
      // 更新访问控制
      if (nft.accessControlSettings && nft.accessControlSettings.roles) {
        // 添加新所有者到OWNER角色
        const ownerRole = ADVANCED_NFT_CONFIG.accessControl.roles.OWNER;
        nft.accessControlSettings.roles[ownerRole] = nft.accessControlSettings.roles[ownerRole] || [];
        
        // 添加新所有者
        if (!nft.accessControlSettings.roles[ownerRole].includes(toUser._id)) {
          nft.accessControlSettings.roles[ownerRole].push(toUser._id);
        }
      }
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`分数化NFT转移成功: ${nft.tokenId} 从 ${fromUser._id} 到 ${toUser._id}，分数: ${fractionAmount}`);
      return {
        success: true,
        tokenId: nft.tokenId,
        txHash: receipt.transactionHash,
        fractionAmount,
        fromBalance: parseInt(newFromBalance.toString()),
        toBalance: parseInt(newToBalance.toString()),
        nft
      };
    } catch (error) {
      logger.error(`转移分数化NFT失败: ${error.message}`);
      throw new Error(`转移分数化NFT失败: ${error.message}`);
    }
  }

  /**
   * 分数化现有NFT
   * @param {string} tokenId - NFT令牌ID
   * @param {number} fractions - 分数数量
   * @param {string} ownerId - 所有者ID
   * @returns {Promise<Object>} 分数化结果
   */
  async fractionalizeNFT(tokenId, fractions, ownerId) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId });
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查所有权
      if (nft.owner.toString() !== ownerId) {
        throw new Error(`用户不是NFT所有者: ${ownerId}`);
      }
      
      // 检查是否已经分数化
      if (nft.fractionalized) {
        throw new Error(`NFT已经分数化: ${tokenId}`);
      }
      
      // 验证分数数量
      if (fractions < ADVANCED_NFT_CONFIG.fractionalization.minFractions) {
        throw new Error(`分数数量不能小于${ADVANCED_NFT_CONFIG.fractionalization.minFractions}`);
      }
      
      if (fractions > ADVANCED_NFT_CONFIG.fractionalization.maxFractions) {
        throw new Error(`分数数量不能大于${ADVANCED_NFT_CONFIG.fractionalization.maxFractions}`);
      }
      
      // 获取所有者
      const owner = await User.findById(ownerId);
      if (!owner || !owner.walletAddress) {
        throw new Error(`所有者不存在或没有关联钱包地址: ${ownerId}`);
      }
      
      // 调用合约分数化NFT
      const tx = await this.contract.fractionalizeToken(tokenId, fractions, { gasLimit: 300000 });
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 更新NFT记录
      nft.fractionalized = true;
      nft.fractions = fractions;
      nft.fractionOwners = {
        [ownerId]: fractions
      };
      
      // 添加溯源记录
      nft.provenance.push({
        timestamp: new Date(),
        action: 'fractionalize',
        actor: ownerId,
        details: {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          fractions
        }
      });
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`NFT分数化成功: ${tokenId}，分数: ${fractions}`);
      return {
        success: true,
        tokenId,
        txHash: receipt.transactionHash,
        fractions,
        nft
      };
    } catch (error) {
      logger.error(`分数化NFT失败: ${error.message}`);
      throw new Error(`分数化NFT失败: ${error.message}`);
    }
  }

  /**
   * 添加NFT溯源记录
   * @param {string} tokenId - NFT令牌ID
   * @param {Object} provenanceData - 溯源数据
   * @param {string} actorId - 操作者ID
   * @returns {Promise<Object>} 添加结果
   */
  async addProvenanceRecord(tokenId, provenanceData, actorId) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId });
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查权限
      await this.checkPermission(nft, actorId, [
        ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN,
        ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR,
        ADVANCED_NFT_CONFIG.accessControl.roles.CURATOR
      ]);
      
      // 验证溯源数据
      this.validateProvenanceData(provenanceData);
      
      // 创建溯源记录
      const provenanceRecord = {
        timestamp: new Date(),
        action: provenanceData.action,
        actor: actorId,
        details: provenanceData.details || {}
      };
      
      // 添加溯源记录
      nft.provenance.push(provenanceRecord);
      
      // 检查溯源记录数量限制
      if (nft.provenance.length > ADVANCED_NFT_CONFIG.provenance.maxHistoryEntries) {
        // 移除最旧的非关键记录
        const criticalActions = ['mint', 'transfer', 'fractionalize', 'burn'];
        const nonCriticalRecords = nft.provenance
          .filter(record => !criticalActions.includes(record.action))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        if (nonCriticalRecords.length > 0) {
          const oldestNonCritical = nonCriticalRecords[0];
          nft.provenance = nft.provenance.filter(record => record !== oldestNonCritical);
        }
      }
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`NFT溯源记录添加成功: ${tokenId}, 操作: ${provenanceData.action}`);
      return {
        success: true,
        tokenId,
        provenanceRecord,
        nft
      };
    } catch (error) {
      logger.error(`添加NFT溯源记录失败: ${error.message}`);
      throw new Error(`添加NFT溯源记录失败: ${error.message}`);
    }
  }

  /**
   * 验证溯源数据
   * @param {Object} provenanceData - 溯源数据
   */
  validateProvenanceData(provenanceData) {
    // 检查必要字段
    if (!provenanceData.action) {
      throw new Error('溯源记录操作不能为空');
    }
    
    // 检查详情字段
    if (!provenanceData.details || typeof provenanceData.details !== 'object') {
      throw new Error('溯源记录详情必须是一个对象');
    }
  }

  /**
   * 更新NFT访问控制
   * @param {string} tokenId - NFT令牌ID
   * @param {Object} accessControlData - 访问控制数据
   * @param {string} actorId - 操作者ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateAccessControl(tokenId, accessControlData, actorId) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId });
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查权限
      await this.checkPermission(nft, actorId, [
        ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN
      ]);
      
      // 更新访问控制设置
      const currentSettings = nft.accessControlSettings || {
        isPublic: ADVANCED_NFT_CONFIG.accessControl.defaultPublic,
        roles: {}
      };
      
      // 更新公开状态
      if (accessControlData.isPublic !== undefined) {
        currentSettings.isPublic = accessControlData.isPublic;
      }
      
      // 更新角色
      if (accessControlData.roles) {
        for (const [role, userIds] of Object.entries(accessControlData.roles)) {
          // 确保角色有效
          if (!Object.values(ADVANCED_NFT_CONFIG.accessControl.roles).includes(role)) {
            continue;
          }
          
          // 更新角色用户列表
          currentSettings.roles[role] = userIds;
          
          // 确保创作者始终是管理员和创作者
          if (role === ADVANCED_NFT_CONFIG.accessControl.roles.ADMIN || 
              role === ADVANCED_NFT_CONFIG.accessControl.roles.CREATOR) {
            if (!currentSettings.roles[role].includes(nft.creator.toString())) {
              currentSettings.roles[role].push(nft.creator.toString());
            }
          }
        }
      }
      
      // 更新NFT记录
      nft.accessControlSettings = currentSettings;
      
      // 添加溯源记录
      nft.provenance.push({
        timestamp: new Date(),
        action: 'update_access_control',
        actor: actorId,
        details: {
          isPublic: currentSettings.isPublic,
          updatedRoles: accessControlData.roles ? Object.keys(accessControlData.roles) : []
        }
      });
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`NFT访问控制更新成功: ${tokenId}`);
      return {
        success: true,
        tokenId,
        accessControlSettings: currentSettings,
        nft
      };
    } catch (error) {
      logger.error(`更新NFT访问控制失败: ${error.message}`);
      throw new Error(`更新NFT访问控制失败: ${error.message}`);
    }
  }

  /**
   * 检查用户对NFT的权限
   * @param {Object} nft - NFT对象
   * @param {string} userId - 用户ID
   * @param {Array<string>} requiredRoles - 所需角色
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkPermission(nft, userId, requiredRoles) {
    // 检查是否是创作者
    if (nft.creator.toString() === userId) {
      return true;
    }
    
    // 检查是否是所有者
    if (nft.owner.toString() === userId) {
      return true;
    }
    
    // 检查访问控制设置
    if (nft.accessControlSettings && nft.accessControlSettings.roles) {
      for (const role of requiredRoles) {
        const roleUsers = nft.accessControlSettings.roles[role] || [];
        if (roleUsers.includes(userId)) {
          return true;
        }
      }
    }
    
    // 没有权限
    throw new Error(`用户没有足够的权限: ${userId}`);
  }

  /**
   * 获取NFT详情
   * @param {string} tokenId - NFT令牌ID
   * @param {string} userId - 请求用户ID
   * @returns {Promise<Object>} NFT详情
   */
  async getNFTDetails(tokenId, userId) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId })
        .populate('creator', 'username profileImage')
        .populate('owner', 'username profileImage');
      
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查访问权限
      const hasAccess = await this.checkNFTAccess(nft, userId);
      if (!hasAccess) {
        throw new Error(`用户没有访问权限: ${userId}`);
      }
      
      // 获取链上数据
      let onchainData = {};
      
      try {
        // 获取当前所有者
        const currentOwner = await this.contract.ownerOf(tokenId);
        
        // 获取版税信息
        const royaltyInfo = await this.contract.getRoyaltyInfo(tokenId, 10000); // 假设售价10000
        
        // 获取分数化信息
        const isFractionalized = await this.contract.isFractionalized(tokenId);
        
        onchainData = {
          currentOwner,
          royaltyInfo: {
            recipients: royaltyInfo[0],
            amounts: royaltyInfo[1].map(amount => amount.toString())
          },
          isFractionalized
        };
        
        // 如果是分数化NFT，获取分数信息
        if (isFractionalized) {
          const totalFractions = await this.contract.totalFractions(tokenId);
          onchainData.fractionInfo = {
            totalFractions: totalFractions.toString()
          };
          
          // 如果提供了用户ID，获取用户的分数余额
          if (userId) {
            const user = await User.findById(userId);
            if (user && user.walletAddress) {
              const userBalance = await this.contract.fractionBalanceOf(tokenId, user.walletAddress);
              onchainData.fractionInfo.userBalance = userBalance.toString();
            }
          }
        }
      } catch (error) {
        logger.warn(`获取NFT链上数据失败: ${error.message}`);
        onchainData = { error: '获取链上数据失败' };
      }
      
      // 格式化NFT详情
      const nftDetails = {
        tokenId: nft.tokenId,
        name: nft.name,
        description: nft.description,
        imageUrl: nft.imageUrl,
        creator: nft.creator,
        owner: nft.owner,
        createdAt: nft.createdAt,
        metadataUri: nft.metadataUri,
        contractAddress: nft.contractAddress,
        mintTxHash: nft.mintTxHash,
        status: nft.status,
        attributes: nft.attributes,
        category: nft.category,
        tags: nft.tags,
        fractionalized: nft.fractionalized,
        fractions: nft.fractions,
        fractionOwners: nft.fractionOwners,
        royaltySettings: nft.royaltySettings,
        accessControlSettings: nft.accessControlSettings,
        provenance: this.formatProvenanceRecords(nft.provenance),
        onchainData
      };
      
      return nftDetails;
    } catch (error) {
      logger.error(`获取NFT详情失败: ${error.message}`);
      throw new Error(`获取NFT详情失败: ${error.message}`);
    }
  }

  /**
   * 检查用户是否有权访问NFT
   * @param {Object} nft - NFT对象
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否有访问权限
   */
  async checkNFTAccess(nft, userId) {
    // 如果NFT是公开的，任何人都可以访问
    if (nft.accessControlSettings && nft.accessControlSettings.isPublic) {
      return true;
    }
    
    // 如果没有提供用户ID，且NFT不是公开的，则拒绝访问
    if (!userId) {
      return false;
    }
    
    // 检查是否是创作者或所有者
    if (nft.creator.toString() === userId || nft.owner.toString() === userId) {
      return true;
    }
    
    // 检查是否在任何角色中
    if (nft.accessControlSettings && nft.accessControlSettings.roles) {
      for (const roleUsers of Object.values(nft.accessControlSettings.roles)) {
        if (roleUsers.includes(userId)) {
          return true;
        }
      }
    }
    
    // 默认拒绝访问
    return false;
  }

  /**
   * 格式化溯源记录
   * @param {Array<Object>} provenanceRecords - 溯源记录
   * @returns {Array<Object>} 格式化的溯源记录
   */
  formatProvenanceRecords(provenanceRecords) {
    return provenanceRecords.map(record => ({
      timestamp: record.timestamp,
      action: record.action,
      actor: record.actor,
      details: record.details
    })).sort((a, b) => b.timestamp - a.timestamp); // 按时间倒序排序
  }

  /**
   * 销毁NFT
   * @param {string} tokenId - NFT令牌ID
   * @param {string} ownerId - 所有者ID
   * @returns {Promise<Object>} 销毁结果
   */
  async burnNFT(tokenId, ownerId) {
    try {
      // 获取NFT
      const nft = await NFT.findOne({ tokenId });
      if (!nft) {
        throw new Error(`NFT不存在: ${tokenId}`);
      }
      
      // 检查所有权
      if (nft.owner.toString() !== ownerId) {
        throw new Error(`用户不是NFT所有者: ${ownerId}`);
      }
      
      // 检查是否为分数化NFT
      if (nft.fractionalized) {
        // 检查是否拥有所有分数
        const owner = await User.findById(ownerId);
        if (!owner || !owner.walletAddress) {
          throw new Error(`所有者不存在或没有关联钱包地址: ${ownerId}`);
        }
        
        const ownerBalance = await this.contract.fractionBalanceOf(tokenId, owner.walletAddress);
        const totalFractions = nft.fractions;
        
        if (ownerBalance.lt(totalFractions)) {
          throw new Error(`所有者没有所有分数，无法销毁NFT: 拥有 ${ownerBalance}，总计 ${totalFractions}`);
        }
      }
      
      // 调用合约销毁NFT
      const tx = await this.contract.burn(tokenId, { gasLimit: 200000 });
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 更新NFT记录
      nft.status = 'burned';
      
      // 添加溯源记录
      nft.provenance.push({
        timestamp: new Date(),
        action: 'burn',
        actor: ownerId,
        details: {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        }
      });
      
      // 保存NFT记录
      await nft.save();
      
      logger.info(`NFT销毁成功: ${tokenId}`);
      return {
        success: true,
        tokenId,
        txHash: receipt.transactionHash,
        nft
      };
    } catch (error) {
      logger.error(`销毁NFT失败: ${error.message}`);
      throw new Error(`销毁NFT失败: ${error.message}`);
    }
  }
}

// 创建高级NFT合约管理器实例
const advancedNFTContractManager = new AdvancedNFTContractManager();

// 导出模块
module.exports = {
  advancedNFTContractManager,
  ADVANCED_NFT_CONFIG
};
