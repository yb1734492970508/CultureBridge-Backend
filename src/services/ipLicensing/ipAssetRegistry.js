/**
 * IP资产登记系统
 * 
 * 该模块实现了文化IP资产的登记、验证和管理功能，包括：
 * - 多类型文化IP登记
 * - 所有权证明验证
 * - IP资产分类与标签
 * - 版权状态追踪
 * 
 * @module services/ipLicensing/ipAssetRegistry
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { ethers } = require('ethers');
const IPAsset = require('../../models/ipAsset.model');
const User = require('../../models/user.model');
const logger = require('../../utils/logger');
const ipfsService = require('../../utils/ipfs');
const blockchainService = require('../../blockchain/service');

// IP资产登记系统配置
const IP_ASSET_REGISTRY_CONFIG = {
  // IP类型配置
  assetTypes: {
    VISUAL_ART: 'visual_art',       // 视觉艺术（绘画、摄影等）
    MUSIC: 'music',                 // 音乐作品
    LITERATURE: 'literature',       // 文学作品
    PERFORMANCE: 'performance',     // 表演艺术
    TRADITIONAL_CULTURE: 'traditional_culture', // 传统文化
    DIGITAL_MEDIA: 'digital_media', // 数字媒体
    BRAND: 'brand',                 // 品牌
    HISTORICAL_HERITAGE: 'historical_heritage' // 历史文化遗产
  },
  
  // 版权状态配置
  copyrightStatus: {
    REGISTERED: 'registered',       // 已注册
    PENDING: 'pending',             // 待审核
    VERIFIED: 'verified',           // 已验证
    DISPUTED: 'disputed',           // 存在争议
    PUBLIC_DOMAIN: 'public_domain'  // 公共领域
  },
  
  // 验证级别配置
  verificationLevels: {
    SELF_DECLARED: 1,               // 自我声明
    DOCUMENT_VERIFIED: 2,           // 文档验证
    THIRD_PARTY_VERIFIED: 3,        // 第三方验证
    OFFICIALLY_REGISTERED: 4,       // 官方注册
    BLOCKCHAIN_VERIFIED: 5          // 区块链验证
  },
  
  // 文件类型配置
  fileTypes: {
    IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
    AUDIO: ['mp3', 'wav', 'ogg', 'flac'],
    VIDEO: ['mp4', 'webm', 'avi', 'mov'],
    DOCUMENT: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    MODEL: ['obj', 'fbx', 'glb', 'gltf']
  },
  
  // 存储配置
  storage: {
    maxFileSize: 100 * 1024 * 1024, // 最大文件大小（100MB）
    allowedMimeTypes: [
      'image/*', 
      'audio/*', 
      'video/*', 
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  },
  
  // 区块链存证配置
  blockchain: {
    network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet',
    contractAddresses: {
      mainnet: '0x...',
      testnet: '0x...',
      local: '0x...'
    }
  }
};

/**
 * IP资产登记管理器
 * 管理IP资产登记相关功能
 */
class IPAssetRegistryManager {
  constructor() {
    logger.info('IP资产登记管理器已初始化');
  }

  /**
   * 注册新的IP资产
   * @param {Object} assetData - IP资产数据
   * @param {string} ownerId - 所有者ID
   * @returns {Promise<Object>} 注册结果
   */
  async registerIPAsset(assetData, ownerId) {
    try {
      // 验证IP资产数据
      this.validateIPAssetData(assetData);
      
      // 获取所有者
      const owner = await User.findById(ownerId);
      if (!owner) {
        throw new Error(`所有者不存在: ${ownerId}`);
      }
      
      // 检查是否存在重复资产
      const existingAsset = await IPAsset.findOne({
        title: assetData.title,
        assetType: assetData.assetType,
        owner: ownerId
      });
      
      if (existingAsset) {
        throw new Error(`已存在同名同类型的IP资产: ${assetData.title}`);
      }
      
      // 处理资产文件
      let assetFiles = [];
      if (assetData.files && assetData.files.length > 0) {
        assetFiles = await this.processAssetFiles(assetData.files);
      }
      
      // 生成资产指纹
      const assetFingerprint = this.generateAssetFingerprint(assetData, assetFiles);
      
      // 创建IP资产记录
      const ipAsset = new IPAsset({
        title: assetData.title,
        description: assetData.description,
        assetType: assetData.assetType,
        owner: ownerId,
        creators: assetData.creators || [{ userId: ownerId, role: 'primary', share: 100 }],
        creationDate: assetData.creationDate || new Date(),
        registrationDate: new Date(),
        files: assetFiles,
        thumbnailUrl: assetData.thumbnailUrl || (assetFiles.length > 0 ? assetFiles[0].url : null),
        copyrightStatus: assetData.copyrightStatus || IP_ASSET_REGISTRY_CONFIG.copyrightStatus.PENDING,
        verificationLevel: assetData.verificationLevel || IP_ASSET_REGISTRY_CONFIG.verificationLevels.SELF_DECLARED,
        verificationDocuments: assetData.verificationDocuments || [],
        categories: assetData.categories || [],
        tags: assetData.tags || [],
        fingerprint: assetFingerprint,
        metadata: assetData.metadata || {},
        status: 'active'
      });
      
      // 保存IP资产记录
      await ipAsset.save();
      
      // 创建区块链存证
      const blockchainRecord = await this.createBlockchainRecord(ipAsset);
      
      // 更新IP资产记录
      ipAsset.blockchainRecords = [blockchainRecord];
      await ipAsset.save();
      
      logger.info(`IP资产注册成功: ${ipAsset._id}`);
      return {
        success: true,
        assetId: ipAsset._id,
        asset: ipAsset,
        blockchainRecord
      };
    } catch (error) {
      logger.error(`注册IP资产失败: ${error.message}`);
      throw new Error(`注册IP资产失败: ${error.message}`);
    }
  }

  /**
   * 验证IP资产数据
   * @param {Object} assetData - IP资产数据
   */
  validateIPAssetData(assetData) {
    // 检查必要字段
    if (!assetData.title) {
      throw new Error('IP资产标题不能为空');
    }
    
    if (!assetData.description) {
      throw new Error('IP资产描述不能为空');
    }
    
    if (!assetData.assetType) {
      throw new Error('IP资产类型不能为空');
    }
    
    // 检查资产类型是否有效
    const validAssetTypes = Object.values(IP_ASSET_REGISTRY_CONFIG.assetTypes);
    if (!validAssetTypes.includes(assetData.assetType)) {
      throw new Error(`无效的IP资产类型: ${assetData.assetType}`);
    }
    
    // 检查版权状态是否有效
    if (assetData.copyrightStatus) {
      const validCopyrightStatus = Object.values(IP_ASSET_REGISTRY_CONFIG.copyrightStatus);
      if (!validCopyrightStatus.includes(assetData.copyrightStatus)) {
        throw new Error(`无效的版权状态: ${assetData.copyrightStatus}`);
      }
    }
    
    // 检查验证级别是否有效
    if (assetData.verificationLevel) {
      const validVerificationLevels = Object.values(IP_ASSET_REGISTRY_CONFIG.verificationLevels);
      if (!validVerificationLevels.includes(assetData.verificationLevel)) {
        throw new Error(`无效的验证级别: ${assetData.verificationLevel}`);
      }
    }
    
    // 检查创作者信息
    if (assetData.creators && Array.isArray(assetData.creators)) {
      // 检查创作者份额总和是否为100%
      const totalShare = assetData.creators.reduce((sum, creator) => sum + (creator.share || 0), 0);
      if (totalShare !== 100) {
        throw new Error(`创作者份额总和必须为100%，当前为${totalShare}%`);
      }
      
      // 检查每个创作者是否有有效的userId或name
      assetData.creators.forEach((creator, index) => {
        if (!creator.userId && !creator.name) {
          throw new Error(`第${index + 1}个创作者必须有userId或name`);
        }
      });
    }
  }

  /**
   * 处理资产文件
   * @param {Array<Object>} files - 文件数组
   * @returns {Promise<Array<Object>>} 处理后的文件数组
   */
  async processAssetFiles(files) {
    const processedFiles = [];
    
    for (const file of files) {
      // 检查文件是否有效
      if (!file.url && !file.data) {
        throw new Error('文件必须提供URL或数据');
      }
      
      let fileUrl = file.url;
      let fileHash = file.hash;
      
      // 如果提供了文件数据，上传到IPFS
      if (file.data) {
        // 检查文件大小
        if (file.data.length > IP_ASSET_REGISTRY_CONFIG.storage.maxFileSize) {
          throw new Error(`文件大小超过限制: ${file.name || 'unknown'}`);
        }
        
        // 上传到IPFS
        const ipfsResult = await ipfsService.uploadFile(file.data, file.name);
        fileUrl = ipfsResult.url;
        fileHash = ipfsResult.hash;
      }
      
      // 如果没有提供文件哈希，计算哈希
      if (!fileHash && fileUrl) {
        try {
          // 获取文件内容
          const response = await fetch(fileUrl);
          const buffer = await response.arrayBuffer();
          
          // 计算SHA-256哈希
          const hash = crypto.createHash('sha256');
          hash.update(Buffer.from(buffer));
          fileHash = hash.digest('hex');
        } catch (error) {
          logger.warn(`无法计算文件哈希: ${error.message}`);
          fileHash = 'unknown';
        }
      }
      
      // 确定文件类型
      let fileType = file.type || 'unknown';
      if (!file.type && file.name) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        for (const [type, extensions] of Object.entries(IP_ASSET_REGISTRY_CONFIG.fileTypes)) {
          if (extensions.includes(extension)) {
            fileType = type.toLowerCase();
            break;
          }
        }
      }
      
      // 添加处理后的文件
      processedFiles.push({
        name: file.name || 'unnamed',
        url: fileUrl,
        type: fileType,
        hash: fileHash,
        size: file.size || 0,
        mimeType: file.mimeType || 'application/octet-stream',
        uploadDate: new Date()
      });
    }
    
    return processedFiles;
  }

  /**
   * 生成资产指纹
   * @param {Object} assetData - IP资产数据
   * @param {Array<Object>} files - 文件数组
   * @returns {string} 资产指纹
   */
  generateAssetFingerprint(assetData, files) {
    // 创建指纹数据
    const fingerprintData = {
      title: assetData.title,
      description: assetData.description,
      assetType: assetData.assetType,
      creationDate: assetData.creationDate || new Date().toISOString(),
      files: files.map(file => ({
        name: file.name,
        hash: file.hash
      })),
      timestamp: new Date().toISOString()
    };
    
    // 计算SHA-256哈希
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(fingerprintData));
    return hash.digest('hex');
  }

  /**
   * 创建区块链存证记录
   * @param {Object} ipAsset - IP资产对象
   * @returns {Promise<Object>} 区块链存证记录
   */
  async createBlockchainRecord(ipAsset) {
    try {
      // 准备存证数据
      const evidenceData = {
        assetId: ipAsset._id.toString(),
        title: ipAsset.title,
        assetType: ipAsset.assetType,
        owner: ipAsset.owner.toString(),
        fingerprint: ipAsset.fingerprint,
        registrationDate: ipAsset.registrationDate.toISOString(),
        timestamp: new Date().toISOString()
      };
      
      // 将存证数据上传到IPFS
      const ipfsResult = await ipfsService.uploadJSON(evidenceData);
      
      // 调用区块链服务创建存证
      const contractAddress = IP_ASSET_REGISTRY_CONFIG.blockchain.contractAddresses[IP_ASSET_REGISTRY_CONFIG.blockchain.network];
      const result = await blockchainService.createIPEvidence(
        ipAsset._id.toString(),
        ipAsset.fingerprint,
        ipfsResult.hash,
        ipAsset.owner.toString(),
        contractAddress
      );
      
      // 创建区块链记录
      const blockchainRecord = {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        timestamp: new Date(),
        network: IP_ASSET_REGISTRY_CONFIG.blockchain.network,
        contractAddress,
        evidenceId: result.evidenceId,
        ipfsHash: ipfsResult.hash,
        ipfsUrl: ipfsResult.url,
        status: 'confirmed'
      };
      
      logger.info(`IP资产区块链存证创建成功: ${ipAsset._id}, 交易哈希: ${result.txHash}`);
      return blockchainRecord;
    } catch (error) {
      logger.error(`创建区块链存证记录失败: ${error.message}`);
      
      // 返回失败记录
      return {
        timestamp: new Date(),
        network: IP_ASSET_REGISTRY_CONFIG.blockchain.network,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * 更新IP资产信息
   * @param {string} assetId - IP资产ID
   * @param {Object} updateData - 更新数据
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateIPAsset(assetId, updateData, userId) {
    try {
      // 获取IP资产
      const ipAsset = await IPAsset.findById(assetId);
      if (!ipAsset) {
        throw new Error(`IP资产不存在: ${assetId}`);
      }
      
      // 检查权限
      await this.checkPermission(ipAsset, userId);
      
      // 不允许更新的字段
      const immutableFields = ['owner', 'fingerprint', 'registrationDate', 'blockchainRecords'];
      
      // 过滤掉不允许更新的字段
      const filteredUpdateData = Object.keys(updateData)
        .filter(key => !immutableFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});
      
      // 处理特殊字段
      if (filteredUpdateData.files) {
        // 处理新文件
        const newFiles = await this.processAssetFiles(filteredUpdateData.files);
        
        // 合并文件列表
        filteredUpdateData.files = [...ipAsset.files, ...newFiles];
      }
      
      // 更新IP资产
      Object.assign(ipAsset, filteredUpdateData);
      
      // 添加更新历史记录
      if (!ipAsset.updateHistory) {
        ipAsset.updateHistory = [];
      }
      
      ipAsset.updateHistory.push({
        timestamp: new Date(),
        updatedBy: userId,
        updatedFields: Object.keys(filteredUpdateData)
      });
      
      // 保存IP资产
      await ipAsset.save();
      
      // 如果更新了关键信息，创建新的区块链存证
      const criticalFields = ['title', 'description', 'assetType', 'files', 'creators'];
      const updatedCriticalFields = Object.keys(filteredUpdateData).filter(key => criticalFields.includes(key));
      
      if (updatedCriticalFields.length > 0) {
        const blockchainRecord = await this.createBlockchainRecord(ipAsset);
        
        // 添加新的区块链记录
        ipAsset.blockchainRecords.push(blockchainRecord);
        await ipAsset.save();
      }
      
      logger.info(`IP资产更新成功: ${assetId}`);
      return {
        success: true,
        assetId,
        asset: ipAsset
      };
    } catch (error) {
      logger.error(`更新IP资产失败: ${error.message}`);
      throw new Error(`更新IP资产失败: ${error.message}`);
    }
  }

  /**
   * 检查用户对IP资产的权限
   * @param {Object} ipAsset - IP资产对象
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkPermission(ipAsset, userId) {
    // 检查是否是所有者
    if (ipAsset.owner.toString() === userId) {
      return true;
    }
    
    // 检查是否是创作者
    if (ipAsset.creators && Array.isArray(ipAsset.creators)) {
      const isCreator = ipAsset.creators.some(creator => 
        creator.userId && creator.userId.toString() === userId
      );
      
      if (isCreator) {
        return true;
      }
    }
    
    // 检查是否是管理员
    const user = await User.findById(userId);
    if (user && user.roles && user.roles.includes('admin')) {
      return true;
    }
    
    // 没有权限
    throw new Error(`用户没有足够的权限: ${userId}`);
  }

  /**
   * 获取IP资产详情
   * @param {string} assetId - IP资产ID
   * @returns {Promise<Object>} IP资产详情
   */
  async getIPAssetDetails(assetId) {
    try {
      // 获取IP资产
      const ipAsset = await IPAsset.findById(assetId)
        .populate('owner', 'username profileImage')
        .populate('creators.userId', 'username profileImage');
      
      if (!ipAsset) {
        throw new Error(`IP资产不存在: ${assetId}`);
      }
      
      // 获取区块链存证状态
      const blockchainStatus = await this.getBlockchainEvidenceStatus(ipAsset);
      
      // 格式化IP资产详情
      const assetDetails = {
        id: ipAsset._id,
        title: ipAsset.title,
        description: ipAsset.description,
        assetType: ipAsset.assetType,
        owner: ipAsset.owner,
        creators: ipAsset.creators,
        creationDate: ipAsset.creationDate,
        registrationDate: ipAsset.registrationDate,
        files: ipAsset.files,
        thumbnailUrl: ipAsset.thumbnailUrl,
        copyrightStatus: ipAsset.copyrightStatus,
        verificationLevel: ipAsset.verificationLevel,
        verificationDocuments: ipAsset.verificationDocuments,
        categories: ipAsset.categories,
        tags: ipAsset.tags,
        fingerprint: ipAsset.fingerprint,
        metadata: ipAsset.metadata,
        status: ipAsset.status,
        blockchainStatus,
        updateHistory: ipAsset.updateHistory || []
      };
      
      return assetDetails;
    } catch (error) {
      logger.error(`获取IP资产详情失败: ${error.message}`);
      throw new Error(`获取IP资产详情失败: ${error.message}`);
    }
  }

  /**
   * 获取区块链存证状态
   * @param {Object} ipAsset - IP资产对象
   * @returns {Promise<Object>} 区块链存证状态
   */
  async getBlockchainEvidenceStatus(ipAsset) {
    try {
      // 如果没有区块链记录，返回未存证状态
      if (!ipAsset.blockchainRecords || ipAsset.blockchainRecords.length === 0) {
        return {
          status: 'not_registered',
          message: '未创建区块链存证'
        };
      }
      
      // 获取最新的区块链记录
      const latestRecord = ipAsset.blockchainRecords
        .filter(record => record.status === 'confirmed')
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      if (!latestRecord) {
        return {
          status: 'failed',
          message: '区块链存证创建失败'
        };
      }
      
      // 验证区块链存证
      const contractAddress = IP_ASSET_REGISTRY_CONFIG.blockchain.contractAddresses[IP_ASSET_REGISTRY_CONFIG.blockchain.network];
      const evidenceStatus = await blockchainService.verifyIPEvidence(
        ipAsset._id.toString(),
        ipAsset.fingerprint,
        latestRecord.evidenceId,
        contractAddress
      );
      
      return {
        status: evidenceStatus.verified ? 'verified' : 'invalid',
        message: evidenceStatus.verified ? '区块链存证有效' : '区块链存证无效',
        lastVerified: new Date(),
        blockchainRecord: {
          txHash: latestRecord.txHash,
          blockNumber: latestRecord.blockNumber,
          timestamp: latestRecord.timestamp,
          network: latestRecord.network,
          ipfsHash: latestRecord.ipfsHash,
          ipfsUrl: latestRecord.ipfsUrl
        }
      };
    } catch (error) {
      logger.warn(`获取区块链存证状态失败: ${error.message}`);
      return {
        status: 'unknown',
        message: `无法验证区块链存证: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 搜索IP资产
   * @param {Object} query - 查询条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 搜索结果
   */
  async searchIPAssets(query = {}, options = {}) {
    try {
      // 构建查询条件
      const searchQuery = {};
      
      // 标题搜索
      if (query.title) {
        searchQuery.title = { $regex: query.title, $options: 'i' };
      }
      
      // 资产类型过滤
      if (query.assetType) {
        searchQuery.assetType = query.assetType;
      }
      
      // 所有者过滤
      if (query.owner) {
        searchQuery.owner = query.owner;
      }
      
      // 创作者过滤
      if (query.creator) {
        searchQuery['creators.userId'] = query.creator;
      }
      
      // 版权状态过滤
      if (query.copyrightStatus) {
        searchQuery.copyrightStatus = query.copyrightStatus;
      }
      
      // 验证级别过滤
      if (query.verificationLevel) {
        searchQuery.verificationLevel = { $gte: parseInt(query.verificationLevel) };
      }
      
      // 类别过滤
      if (query.category) {
        searchQuery.categories = query.category;
      }
      
      // 标签过滤
      if (query.tag) {
        searchQuery.tags = query.tag;
      }
      
      // 状态过滤
      if (query.status) {
        searchQuery.status = query.status;
      } else {
        // 默认只返回活跃状态的资产
        searchQuery.status = 'active';
      }
      
      // 创建日期范围过滤
      if (query.createdAfter || query.createdBefore) {
        searchQuery.creationDate = {};
        
        if (query.createdAfter) {
          searchQuery.creationDate.$gte = new Date(query.createdAfter);
        }
        
        if (query.createdBefore) {
          searchQuery.creationDate.$lte = new Date(query.createdBefore);
        }
      }
      
      // 注册日期范围过滤
      if (query.registeredAfter || query.registeredBefore) {
        searchQuery.registrationDate = {};
        
        if (query.registeredAfter) {
          searchQuery.registrationDate.$gte = new Date(query.registeredAfter);
        }
        
        if (query.registeredBefore) {
          searchQuery.registrationDate.$lte = new Date(query.registeredBefore);
        }
      }
      
      // 分页选项
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // 排序选项
      const sortField = options.sortBy || 'registrationDate';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortField]: sortOrder };
      
      // 执行查询
      const assets = await IPAsset.find(searchQuery)
        .populate('owner', 'username profileImage')
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // 获取总数
      const total = await IPAsset.countDocuments(searchQuery);
      
      // 计算总页数
      const totalPages = Math.ceil(total / limit);
      
      return {
        assets,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      logger.error(`搜索IP资产失败: ${error.message}`);
      throw new Error(`搜索IP资产失败: ${error.message}`);
    }
  }

  /**
   * 更新IP资产版权状态
   * @param {string} assetId - IP资产ID
   * @param {string} copyrightStatus - 版权状态
   * @param {Object} statusData - 状态相关数据
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateCopyrightStatus(assetId, copyrightStatus, statusData = {}, userId) {
    try {
      // 获取IP资产
      const ipAsset = await IPAsset.findById(assetId);
      if (!ipAsset) {
        throw new Error(`IP资产不存在: ${assetId}`);
      }
      
      // 检查权限
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      // 只有所有者、管理员或验证者可以更新版权状态
      const isOwner = ipAsset.owner.toString() === userId;
      const isAdmin = user.roles && user.roles.includes('admin');
      const isVerifier = user.roles && user.roles.includes('verifier');
      
      if (!isOwner && !isAdmin && !isVerifier) {
        throw new Error(`用户没有足够的权限更新版权状态: ${userId}`);
      }
      
      // 检查版权状态是否有效
      const validCopyrightStatus = Object.values(IP_ASSET_REGISTRY_CONFIG.copyrightStatus);
      if (!validCopyrightStatus.includes(copyrightStatus)) {
        throw new Error(`无效的版权状态: ${copyrightStatus}`);
      }
      
      // 更新版权状态
      ipAsset.copyrightStatus = copyrightStatus;
      
      // 添加状态变更记录
      if (!ipAsset.statusHistory) {
        ipAsset.statusHistory = [];
      }
      
      ipAsset.statusHistory.push({
        timestamp: new Date(),
        status: copyrightStatus,
        updatedBy: userId,
        reason: statusData.reason || '',
        documents: statusData.documents || [],
        expiryDate: statusData.expiryDate || null
      });
      
      // 如果提供了验证文档，添加到验证文档列表
      if (statusData.documents && Array.isArray(statusData.documents) && statusData.documents.length > 0) {
        if (!ipAsset.verificationDocuments) {
          ipAsset.verificationDocuments = [];
        }
        
        ipAsset.verificationDocuments.push(...statusData.documents);
      }
      
      // 如果状态为已验证，更新验证级别
      if (copyrightStatus === IP_ASSET_REGISTRY_CONFIG.copyrightStatus.VERIFIED) {
        // 根据验证者角色设置验证级别
        if (isAdmin) {
          ipAsset.verificationLevel = IP_ASSET_REGISTRY_CONFIG.verificationLevels.OFFICIALLY_REGISTERED;
        } else if (isVerifier) {
          ipAsset.verificationLevel = IP_ASSET_REGISTRY_CONFIG.verificationLevels.THIRD_PARTY_VERIFIED;
        } else {
          ipAsset.verificationLevel = IP_ASSET_REGISTRY_CONFIG.verificationLevels.DOCUMENT_VERIFIED;
        }
      }
      
      // 保存IP资产
      await ipAsset.save();
      
      // 如果状态变为已验证或存在争议，创建新的区块链存证
      if (copyrightStatus === IP_ASSET_REGISTRY_CONFIG.copyrightStatus.VERIFIED || 
          copyrightStatus === IP_ASSET_REGISTRY_CONFIG.copyrightStatus.DISPUTED) {
        const blockchainRecord = await this.createBlockchainRecord(ipAsset);
        
        // 添加新的区块链记录
        ipAsset.blockchainRecords.push(blockchainRecord);
        await ipAsset.save();
      }
      
      logger.info(`IP资产版权状态更新成功: ${assetId}, 新状态: ${copyrightStatus}`);
      return {
        success: true,
        assetId,
        copyrightStatus,
        verificationLevel: ipAsset.verificationLevel,
        statusHistory: ipAsset.statusHistory
      };
    } catch (error) {
      logger.error(`更新IP资产版权状态失败: ${error.message}`);
      throw new Error(`更新IP资产版权状态失败: ${error.message}`);
    }
  }

  /**
   * 转移IP资产所有权
   * @param {string} assetId - IP资产ID
   * @param {string} currentOwnerId - 当前所有者ID
   * @param {string} newOwnerId - 新所有者ID
   * @param {Object} transferData - 转移相关数据
   * @returns {Promise<Object>} 转移结果
   */
  async transferOwnership(assetId, currentOwnerId, newOwnerId, transferData = {}) {
    try {
      // 获取IP资产
      const ipAsset = await IPAsset.findById(assetId);
      if (!ipAsset) {
        throw new Error(`IP资产不存在: ${assetId}`);
      }
      
      // 检查当前所有者
      if (ipAsset.owner.toString() !== currentOwnerId) {
        throw new Error(`用户不是IP资产所有者: ${currentOwnerId}`);
      }
      
      // 获取新所有者
      const newOwner = await User.findById(newOwnerId);
      if (!newOwner) {
        throw new Error(`新所有者不存在: ${newOwnerId}`);
      }
      
      // 保存旧所有者
      const previousOwner = ipAsset.owner;
      
      // 更新所有者
      ipAsset.owner = newOwnerId;
      
      // 添加所有权转移记录
      if (!ipAsset.ownershipHistory) {
        ipAsset.ownershipHistory = [];
      }
      
      ipAsset.ownershipHistory.push({
        timestamp: new Date(),
        previousOwner,
        newOwner: newOwnerId,
        transferType: transferData.transferType || 'direct',
        transferReason: transferData.transferReason || '',
        transferDocument: transferData.transferDocument || null,
        transferPrice: transferData.transferPrice || null,
        transferCurrency: transferData.transferCurrency || null
      });
      
      // 保存IP资产
      await ipAsset.save();
      
      // 创建新的区块链存证
      const blockchainRecord = await this.createBlockchainRecord(ipAsset);
      
      // 添加新的区块链记录
      ipAsset.blockchainRecords.push(blockchainRecord);
      await ipAsset.save();
      
      logger.info(`IP资产所有权转移成功: ${assetId}, 从 ${currentOwnerId} 到 ${newOwnerId}`);
      return {
        success: true,
        assetId,
        previousOwner,
        newOwner: newOwnerId,
        transferTimestamp: new Date(),
        blockchainRecord
      };
    } catch (error) {
      logger.error(`转移IP资产所有权失败: ${error.message}`);
      throw new Error(`转移IP资产所有权失败: ${error.message}`);
    }
  }

  /**
   * 删除IP资产
   * @param {string} assetId - IP资产ID
   * @param {string} userId - 用户ID
   * @param {Object} deleteData - 删除相关数据
   * @returns {Promise<Object>} 删除结果
   */
  async deleteIPAsset(assetId, userId, deleteData = {}) {
    try {
      // 获取IP资产
      const ipAsset = await IPAsset.findById(assetId);
      if (!ipAsset) {
        throw new Error(`IP资产不存在: ${assetId}`);
      }
      
      // 检查权限
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      // 只有所有者或管理员可以删除IP资产
      const isOwner = ipAsset.owner.toString() === userId;
      const isAdmin = user.roles && user.roles.includes('admin');
      
      if (!isOwner && !isAdmin) {
        throw new Error(`用户没有足够的权限删除IP资产: ${userId}`);
      }
      
      // 如果是硬删除，直接从数据库中删除
      if (deleteData.hardDelete && isAdmin) {
        await IPAsset.findByIdAndDelete(assetId);
        
        logger.info(`IP资产硬删除成功: ${assetId}`);
        return {
          success: true,
          assetId,
          deleteType: 'hard',
          deletedBy: userId
        };
      }
      
      // 否则，软删除（更新状态为已删除）
      ipAsset.status = 'deleted';
      ipAsset.deletedAt = new Date();
      ipAsset.deletedBy = userId;
      ipAsset.deletionReason = deleteData.reason || '';
      
      // 保存IP资产
      await ipAsset.save();
      
      logger.info(`IP资产软删除成功: ${assetId}`);
      return {
        success: true,
        assetId,
        deleteType: 'soft',
        deletedBy: userId,
        deletedAt: ipAsset.deletedAt
      };
    } catch (error) {
      logger.error(`删除IP资产失败: ${error.message}`);
      throw new Error(`删除IP资产失败: ${error.message}`);
    }
  }

  /**
   * 恢复已删除的IP资产
   * @param {string} assetId - IP资产ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 恢复结果
   */
  async restoreIPAsset(assetId, userId) {
    try {
      // 获取IP资产
      const ipAsset = await IPAsset.findById(assetId);
      if (!ipAsset) {
        throw new Error(`IP资产不存在: ${assetId}`);
      }
      
      // 检查资产是否已删除
      if (ipAsset.status !== 'deleted') {
        throw new Error(`IP资产未被删除: ${assetId}`);
      }
      
      // 检查权限
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      // 只有所有者或管理员可以恢复IP资产
      const isOwner = ipAsset.owner.toString() === userId;
      const isAdmin = user.roles && user.roles.includes('admin');
      
      if (!isOwner && !isAdmin) {
        throw new Error(`用户没有足够的权限恢复IP资产: ${userId}`);
      }
      
      // 恢复资产
      ipAsset.status = 'active';
      ipAsset.deletedAt = null;
      ipAsset.deletedBy = null;
      ipAsset.deletionReason = null;
      
      // 保存IP资产
      await ipAsset.save();
      
      logger.info(`IP资产恢复成功: ${assetId}`);
      return {
        success: true,
        assetId,
        status: 'active',
        restoredBy: userId,
        restoredAt: new Date()
      };
    } catch (error) {
      logger.error(`恢复IP资产失败: ${error.message}`);
      throw new Error(`恢复IP资产失败: ${error.message}`);
    }
  }

  /**
   * 批量导入IP资产
   * @param {Array<Object>} assetsData - IP资产数据数组
   * @param {string} ownerId - 所有者ID
   * @param {Object} importOptions - 导入选项
   * @returns {Promise<Object>} 导入结果
   */
  async bulkImportAssets(assetsData, ownerId, importOptions = {}) {
    try {
      // 检查数据是否为数组
      if (!Array.isArray(assetsData)) {
        throw new Error('资产数据必须是数组');
      }
      
      // 获取所有者
      const owner = await User.findById(ownerId);
      if (!owner) {
        throw new Error(`所有者不存在: ${ownerId}`);
      }
      
      // 导入结果
      const results = {
        total: assetsData.length,
        successful: 0,
        failed: 0,
        assets: [],
        errors: []
      };
      
      // 处理每个资产
      for (const assetData of assetsData) {
        try {
          // 注册IP资产
          const result = await this.registerIPAsset(assetData, ownerId);
          
          // 添加到成功列表
          results.successful++;
          results.assets.push({
            assetId: result.assetId,
            title: assetData.title,
            status: 'success'
          });
        } catch (error) {
          // 添加到失败列表
          results.failed++;
          results.errors.push({
            title: assetData.title || 'unknown',
            error: error.message
          });
        }
      }
      
      logger.info(`批量导入IP资产完成: 总数 ${results.total}, 成功 ${results.successful}, 失败 ${results.failed}`);
      return results;
    } catch (error) {
      logger.error(`批量导入IP资产失败: ${error.message}`);
      throw new Error(`批量导入IP资产失败: ${error.message}`);
    }
  }

  /**
   * 获取用户的IP资产统计
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 统计结果
   */
  async getUserAssetStatistics(userId) {
    try {
      // 获取用户
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      // 获取用户拥有的IP资产总数
      const totalAssets = await IPAsset.countDocuments({ owner: userId, status: 'active' });
      
      // 按资产类型统计
      const assetsByType = await IPAsset.aggregate([
        { $match: { owner: mongoose.Types.ObjectId(userId), status: 'active' } },
        { $group: { _id: '$assetType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // 按版权状态统计
      const assetsByCopyrightStatus = await IPAsset.aggregate([
        { $match: { owner: mongoose.Types.ObjectId(userId), status: 'active' } },
        { $group: { _id: '$copyrightStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // 按验证级别统计
      const assetsByVerificationLevel = await IPAsset.aggregate([
        { $match: { owner: mongoose.Types.ObjectId(userId), status: 'active' } },
        { $group: { _id: '$verificationLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      // 按创建时间统计
      const assetsByMonth = await IPAsset.aggregate([
        { $match: { owner: mongoose.Types.ObjectId(userId), status: 'active' } },
        {
          $group: {
            _id: {
              year: { $year: '$creationDate' },
              month: { $month: '$creationDate' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // 格式化统计结果
      const statistics = {
        totalAssets,
        assetsByType: assetsByType.map(item => ({
          type: item._id,
          count: item.count
        })),
        assetsByCopyrightStatus: assetsByCopyrightStatus.map(item => ({
          status: item._id,
          count: item.count
        })),
        assetsByVerificationLevel: assetsByVerificationLevel.map(item => ({
          level: item._id,
          count: item.count
        })),
        assetsByMonth: assetsByMonth.map(item => ({
          year: item._id.year,
          month: item._id.month,
          count: item.count
        }))
      };
      
      return statistics;
    } catch (error) {
      logger.error(`获取用户IP资产统计失败: ${error.message}`);
      throw new Error(`获取用户IP资产统计失败: ${error.message}`);
    }
  }
}

// 创建IP资产登记管理器实例
const ipAssetRegistryManager = new IPAssetRegistryManager();

// 导出模块
module.exports = {
  ipAssetRegistryManager,
  IP_ASSET_REGISTRY_CONFIG
};
