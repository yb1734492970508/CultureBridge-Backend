// src/controllers/nft.controller.js
const NFTAsset = require('../models/nft.model');
const User = require('../models/user.model');
const Activity = require('../models/activity.model');
const blockchainService = require('../blockchain/service');
const { uploadToIPFS } = require('../utils/ipfs');
const { createHash } = require('crypto');

// NFT资产类型映射
const assetTypeMap = {
  'ARTWORK': 0,
  'CERTIFICATE': 1,
  'COLLECTIBLE': 2,
  'SOUVENIR': 3,
  'HERITAGE': 4
};

// 验证状态映射
const verificationStatusMap = {
  'PENDING': 0,
  'VERIFIED': 1,
  'REJECTED': 2
};

/**
 * 铸造新NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.mintNFT = async (req, res) => {
  try {
    const { name, description, assetType, culturalTags, rarity, mediaUrl, thumbnailUrl, mediaType } = req.body;
    const creator = req.user.walletAddress;
    
    // 参数验证
    if (!name || !description || !assetType || !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 验证资产类型
    if (!Object.keys(assetTypeMap).includes(assetType)) {
      return res.status(400).json({
        success: false,
        message: '无效的资产类型'
      });
    }
    
    // 准备元数据
    const metadata = {
      name,
      description,
      image: mediaUrl,
      external_url: `${process.env.API_BASE_URL}/api/nft/token/${Date.now()}`, // 临时ID，后续更新
      attributes: [
        {
          trait_type: 'Asset Type',
          value: assetType
        },
        {
          trait_type: 'Creator',
          value: creator
        },
        {
          trait_type: 'Rarity',
          value: rarity || 0
        }
      ]
    };
    
    // 添加文化标签
    if (culturalTags && culturalTags.length > 0) {
      metadata.attributes.push({
        trait_type: 'Cultural Tags',
        value: culturalTags.join(', ')
      });
    }
    
    // 上传元数据到IPFS
    const metadataURI = await uploadToIPFS(JSON.stringify(metadata));
    
    // 调用区块链服务铸造NFT
    const result = await blockchainService.mintNFT(
      creator, // 接收者地址
      name,
      description,
      assetTypeMap[assetType],
      metadataURI,
      culturalTags || [],
      rarity || 0
    );
    
    // 创建NFT资产记录
    const nftAsset = new NFTAsset({
      tokenId: result.tokenId,
      name,
      description,
      assetType,
      creator,
      owner: creator,
      mintedAt: new Date(),
      contractAddress: blockchainService.getContractAddress('nft'),
      mintTxHash: result.txHash,
      tokenURI: metadataURI,
      culturalTags: culturalTags || [],
      rarity: rarity || 0,
      mediaType: mediaType || 'IMAGE',
      mediaUrl,
      thumbnailUrl: thumbnailUrl || mediaUrl
    });
    
    // 保存NFT资产记录
    await nftAsset.save();
    
    // 更新元数据中的external_url
    metadata.external_url = `${process.env.API_BASE_URL}/api/nft/token/${result.tokenId}`;
    await uploadToIPFS(JSON.stringify(metadata), metadataURI);
    
    return res.status(201).json({
      success: true,
      message: 'NFT铸造成功',
      data: {
        tokenId: result.tokenId,
        txHash: result.txHash,
        metadataURI,
        asset: nftAsset
      }
    });
  } catch (error) {
    console.error('铸造NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '铸造NFT失败',
      error: error.message
    });
  }
};

/**
 * 为活动铸造NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.mintNFTForActivity = async (req, res) => {
  try {
    const { name, description, assetType, culturalTags, rarity, mediaUrl, thumbnailUrl, mediaType, activityId, recipientAddress } = req.body;
    const creator = req.user.walletAddress;
    
    // 参数验证
    if (!name || !description || !assetType || !mediaUrl || !activityId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 验证资产类型
    if (!Object.keys(assetTypeMap).includes(assetType)) {
      return res.status(400).json({
        success: false,
        message: '无效的资产类型'
      });
    }
    
    // 验证活动存在
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 验证用户有权限为此活动铸造NFT
    if (activity.organizer.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权为此活动铸造NFT'
      });
    }
    
    // 确定接收者地址
    const recipient = recipientAddress || creator;
    
    // 准备元数据
    const metadata = {
      name,
      description,
      image: mediaUrl,
      external_url: `${process.env.API_BASE_URL}/api/nft/token/${Date.now()}`, // 临时ID，后续更新
      attributes: [
        {
          trait_type: 'Asset Type',
          value: assetType
        },
        {
          trait_type: 'Creator',
          value: creator
        },
        {
          trait_type: 'Activity',
          value: activity.title
        },
        {
          trait_type: 'Rarity',
          value: rarity || 0
        }
      ]
    };
    
    // 添加文化标签
    if (culturalTags && culturalTags.length > 0) {
      metadata.attributes.push({
        trait_type: 'Cultural Tags',
        value: culturalTags.join(', ')
      });
    }
    
    // 上传元数据到IPFS
    const metadataURI = await uploadToIPFS(JSON.stringify(metadata));
    
    // 调用区块链服务铸造NFT
    const result = await blockchainService.mintNFTForActivity(
      recipient,
      name,
      description,
      assetTypeMap[assetType],
      metadataURI,
      culturalTags || [],
      rarity || 0,
      activity.activityId // 链上活动ID
    );
    
    // 创建NFT资产记录
    const nftAsset = new NFTAsset({
      tokenId: result.tokenId,
      name,
      description,
      assetType,
      creator,
      owner: recipient,
      mintedAt: new Date(),
      contractAddress: blockchainService.getContractAddress('nft'),
      mintTxHash: result.txHash,
      tokenURI: metadataURI,
      culturalTags: culturalTags || [],
      rarity: rarity || 0,
      activityId: activity._id,
      mediaType: mediaType || 'IMAGE',
      mediaUrl,
      thumbnailUrl: thumbnailUrl || mediaUrl
    });
    
    // 保存NFT资产记录
    await nftAsset.save();
    
    // 更新元数据中的external_url
    metadata.external_url = `${process.env.API_BASE_URL}/api/nft/token/${result.tokenId}`;
    await uploadToIPFS(JSON.stringify(metadata), metadataURI);
    
    return res.status(201).json({
      success: true,
      message: '活动NFT铸造成功',
      data: {
        tokenId: result.tokenId,
        txHash: result.txHash,
        metadataURI,
        asset: nftAsset
      }
    });
  } catch (error) {
    console.error('铸造活动NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '铸造活动NFT失败',
      error: error.message
    });
  }
};

/**
 * 批量铸造NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.batchMintNFT = async (req, res) => {
  try {
    const { assets } = req.body;
    const creator = req.user.walletAddress;
    
    // 参数验证
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少有效的资产数组'
      });
    }
    
    // 准备批量铸造参数
    const recipients = [];
    const names = [];
    const descriptions = [];
    const assetTypes = [];
    const uris = [];
    const culturalTagsArray = [];
    const rarities = [];
    
    // 准备元数据和参数
    const metadataPromises = assets.map(async (asset) => {
      const { name, description, assetType, culturalTags, rarity, mediaUrl, recipientAddress } = asset;
      
      // 验证必要参数
      if (!name || !description || !assetType || !mediaUrl) {
        throw new Error(`资产 "${name}" 缺少必要参数`);
      }
      
      // 验证资产类型
      if (!Object.keys(assetTypeMap).includes(assetType)) {
        throw new Error(`资产 "${name}" 的资产类型无效`);
      }
      
      // 准备元数据
      const metadata = {
        name,
        description,
        image: mediaUrl,
        external_url: `${process.env.API_BASE_URL}/api/nft/token/${Date.now()}`, // 临时ID，后续更新
        attributes: [
          {
            trait_type: 'Asset Type',
            value: assetType
          },
          {
            trait_type: 'Creator',
            value: creator
          },
          {
            trait_type: 'Rarity',
            value: rarity || 0
          }
        ]
      };
      
      // 添加文化标签
      if (culturalTags && culturalTags.length > 0) {
        metadata.attributes.push({
          trait_type: 'Cultural Tags',
          value: culturalTags.join(', ')
        });
      }
      
      // 上传元数据到IPFS
      const metadataURI = await uploadToIPFS(JSON.stringify(metadata));
      
      // 添加到批量参数
      recipients.push(recipientAddress || creator);
      names.push(name);
      descriptions.push(description);
      assetTypes.push(assetTypeMap[assetType]);
      uris.push(metadataURI);
      culturalTagsArray.push(culturalTags || []);
      rarities.push(rarity || 0);
      
      return {
        metadata,
        metadataURI,
        asset
      };
    });
    
    // 等待所有元数据处理完成
    const metadataResults = await Promise.all(metadataPromises);
    
    // 调用区块链服务批量铸造NFT
    const result = await blockchainService.batchMintNFT(
      recipients,
      names,
      descriptions,
      assetTypes,
      uris,
      culturalTagsArray,
      rarities
    );
    
    // 解析事件获取代币ID
    const tokenIds = result.events
      .filter(event => event.event === 'AssetCreated')
      .map(event => event.args.tokenId.toString());
    
    // 创建NFT资产记录
    const nftAssets = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const { asset, metadataURI } = metadataResults[i];
      
      const nftAsset = new NFTAsset({
        tokenId: tokenIds[i],
        name: asset.name,
        description: asset.description,
        assetType: asset.assetType,
        creator,
        owner: recipients[i],
        mintedAt: new Date(),
        contractAddress: blockchainService.getContractAddress('nft'),
        mintTxHash: result.txHash,
        tokenURI: metadataURI,
        culturalTags: asset.culturalTags || [],
        rarity: asset.rarity || 0,
        mediaType: asset.mediaType || 'IMAGE',
        mediaUrl: asset.mediaUrl,
        thumbnailUrl: asset.thumbnailUrl || asset.mediaUrl
      });
      
      // 如果有活动ID，关联活动
      if (asset.activityId) {
        nftAsset.activityId = asset.activityId;
      }
      
      await nftAsset.save();
      nftAssets.push(nftAsset);
      
      // 更新元数据中的external_url
      const { metadata } = metadataResults[i];
      metadata.external_url = `${process.env.API_BASE_URL}/api/nft/token/${tokenIds[i]}`;
      await uploadToIPFS(JSON.stringify(metadata), metadataURI);
    }
    
    return res.status(201).json({
      success: true,
      message: '批量铸造NFT成功',
      data: {
        tokenIds,
        txHash: result.txHash,
        assets: nftAssets
      }
    });
  } catch (error) {
    console.error('批量铸造NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '批量铸造NFT失败',
      error: error.message
    });
  }
};

/**
 * 获取NFT详情
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getNFT = async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // 从数据库获取NFT资产
    const nftAsset = await NFTAsset.findOne({ tokenId });
    if (!nftAsset) {
      return res.status(404).json({
        success: false,
        message: 'NFT资产不存在'
      });
    }
    
    // 获取链上最新数据
    let onchainData = null;
    try {
      onchainData = await blockchainService.getNFT(tokenId);
    } catch (error) {
      console.warn(`获取链上NFT数据失败: ${error.message}`);
    }
    
    // 如果链上数据存在，检查是否需要更新数据库
    if (onchainData) {
      let needsUpdate = false;
      
      // 检查所有者是否变更
      if (onchainData.owner.toLowerCase() !== nftAsset.owner.toLowerCase()) {
        nftAsset.owner = onchainData.owner;
        needsUpdate = true;
      }
      
      // 检查验证状态是否变更
      const onchainStatus = ['PENDING', 'VERIFIED', 'REJECTED'][onchainData.verificationStatus];
      if (onchainStatus !== nftAsset.verificationStatus) {
        nftAsset.verificationStatus = onchainStatus;
        nftAsset.verifier = onchainData.verifier;
        needsUpdate = true;
      }
      
      // 检查是否已销毁
      if (onchainData.isDestroyed !== nftAsset.isDestroyed) {
        nftAsset.isDestroyed = onchainData.isDestroyed;
        if (nftAsset.isDestroyed) {
          nftAsset.destroyedAt = new Date();
        }
        needsUpdate = true;
      }
      
      // 更新数据库
      if (needsUpdate) {
        nftAsset.lastSyncedAt = new Date();
        await nftAsset.save();
      }
    }
    
    // 获取创建者和所有者信息
    const creator = await User.findOne({ walletAddress: nftAsset.creator });
    const owner = await User.findOne({ walletAddress: nftAsset.owner });
    
    // 获取关联活动信息
    let activity = null;
    if (nftAsset.activityId) {
      activity = await Activity.findById(nftAsset.activityId);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        ...nftAsset.toObject(),
        creatorInfo: creator ? {
          id: creator._id,
          username: creator.username,
          avatar: creator.avatar
        } : null,
        ownerInfo: owner ? {
          id: owner._id,
          username: owner.username,
          avatar: owner.avatar
        } : null,
        activityInfo: activity ? {
          id: activity._id,
          title: activity.title,
          date: activity.date,
          location: activity.location
        } : null,
        onchainData
      }
    });
  } catch (error) {
    console.error('获取NFT详情失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取NFT详情失败',
      error: error.message
    });
  }
};

/**
 * 获取NFT列表
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getNFTs = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc', assetType, tag, verified, listed } = req.query;
    
    // 构建查询条件
    const query = {};
    
    // 资产类型过滤
    if (assetType) {
      query.assetType = assetType;
    }
    
    // 文化标签过滤
    if (tag) {
      query.culturalTags = tag;
    }
    
    // 验证状态过滤
    if (verified === 'true') {
      query.verificationStatus = 'VERIFIED';
    } else if (verified === 'false') {
      query.verificationStatus = { $ne: 'VERIFIED' };
    }
    
    // 上架状态过滤
    if (listed === 'true') {
      query.isListed = true;
    } else if (listed === 'false') {
      query.isListed = false;
    }
    
    // 排除已销毁的资产
    query.isDestroyed = false;
    
    // 构建排序条件
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;
    
    // 分页查询
    const skip = (page - 1) * limit;
    
    // 执行查询
    const nftAssets = await NFTAsset.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总数
    const total = await NFTAsset.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: {
        assets: nftAssets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取NFT列表失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取NFT列表失败',
      error: error.message
    });
  }
};

/**
 * 获取用户创建的NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getUserCreatedNFTs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // 获取用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 构建查询条件
    const query = {
      creator: user.walletAddress,
      isDestroyed: false
    };
    
    // 分页查询
    const skip = (page - 1) * limit;
    
    // 执行查询
    const nftAssets = await NFTAsset.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总数
    const total = await NFTAsset.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: {
        assets: nftAssets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取用户创建的NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户创建的NFT失败',
      error: error.message
    });
  }
};

/**
 * 获取用户拥有的NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getUserOwnedNFTs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // 获取用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 构建查询条件
    const query = {
      owner: user.walletAddress,
      isDestroyed: false
    };
    
    // 分页查询
    const skip = (page - 1) * limit;
    
    // 执行查询
    const nftAssets = await NFTAsset.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总数
    const total = await NFTAsset.countDocuments(query);
    
    // 同步链上数据
    try {
      const onchainTokenIds = await blockchainService.getOwnerNFTs(user.walletAddress);
      
      // 检查是否有链上拥有但数据库中未记录的NFT
      const dbTokenIds = nftAssets.map(asset => asset.tokenId.toString());
      const missingTokenIds = onchainTokenIds.filter(id => !dbTokenIds.includes(id));
      
      if (missingTokenIds.length > 0) {
        console.log(`发现 ${missingTokenIds.length} 个链上拥有但数据库中未记录的NFT，正在同步...`);
        
        // 同步缺失的NFT数据
        for (const tokenId of missingTokenIds) {
          const onchainData = await blockchainService.getNFT(tokenId);
          
          // 检查数据库中是否存在此NFT
          let nftAsset = await NFTAsset.findOne({ tokenId });
          
          if (nftAsset) {
            // 更新所有者
            nftAsset.owner = onchainData.owner;
            nftAsset.lastSyncedAt = new Date();
            await nftAsset.save();
          } else {
            // 创建新的NFT记录
            nftAsset = new NFTAsset({
              tokenId,
              name: onchainData.name,
              description: onchainData.description,
              assetType: ['ARTWORK', 'CERTIFICATE', 'COLLECTIBLE', 'SOUVENIR', 'HERITAGE'][onchainData.assetType],
              creator: onchainData.creator,
              owner: onchainData.owner,
              mintedAt: onchainData.createdAt,
              contractAddress: blockchainService.getContractAddress('nft'),
              tokenURI: onchainData.tokenURI,
              culturalTags: onchainData.culturalTags || [],
              rarity: onchainData.rarity,
              verificationStatus: ['PENDING', 'VERIFIED', 'REJECTED'][onchainData.verificationStatus],
              verifier: onchainData.verifier,
              isDestroyed: onchainData.isDestroyed
            });
            
            if (onchainData.activityId && onchainData.activityId !== '0') {
              // 查找对应的活动
              const activity = await Activity.findOne({ activityId: onchainData.activityId });
              if (activity) {
                nftAsset.activityId = activity._id;
              }
            }
            
            await nftAsset.save();
          }
        }
      }
    } catch (error) {
      console.warn(`同步链上NFT数据失败: ${error.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        assets: nftAssets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取用户拥有的NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户拥有的NFT失败',
      error: error.message
    });
  }
};

/**
 * 获取活动关联的NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getActivityNFTs = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // 获取活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 构建查询条件
    const query = {
      activityId: activity._id,
      isDestroyed: false
    };
    
    // 分页查询
    const skip = (page - 1) * limit;
    
    // 执行查询
    const nftAssets = await NFTAsset.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总数
    const total = await NFTAsset.countDocuments(query);
    
    // 同步链上数据
    try {
      if (activity.activityId) {
        const onchainTokenIds = await blockchainService.getActivityNFTs(activity.activityId);
        
        // 检查是否有链上关联但数据库中未记录的NFT
        const dbTokenIds = nftAssets.map(asset => asset.tokenId.toString());
        const missingTokenIds = onchainTokenIds.filter(id => !dbTokenIds.includes(id));
        
        if (missingTokenIds.length > 0) {
          console.log(`发现 ${missingTokenIds.length} 个链上关联但数据库中未记录的NFT，正在同步...`);
          
          // 同步缺失的NFT数据
          for (const tokenId of missingTokenIds) {
            const onchainData = await blockchainService.getNFT(tokenId);
            
            // 检查数据库中是否存在此NFT
            let nftAsset = await NFTAsset.findOne({ tokenId });
            
            if (nftAsset) {
              // 更新活动关联
              nftAsset.activityId = activity._id;
              nftAsset.lastSyncedAt = new Date();
              await nftAsset.save();
            } else {
              // 创建新的NFT记录
              nftAsset = new NFTAsset({
                tokenId,
                name: onchainData.name,
                description: onchainData.description,
                assetType: ['ARTWORK', 'CERTIFICATE', 'COLLECTIBLE', 'SOUVENIR', 'HERITAGE'][onchainData.assetType],
                creator: onchainData.creator,
                owner: onchainData.owner,
                mintedAt: onchainData.createdAt,
                contractAddress: blockchainService.getContractAddress('nft'),
                tokenURI: onchainData.tokenURI,
                culturalTags: onchainData.culturalTags || [],
                rarity: onchainData.rarity,
                verificationStatus: ['PENDING', 'VERIFIED', 'REJECTED'][onchainData.verificationStatus],
                verifier: onchainData.verifier,
                activityId: activity._id,
                isDestroyed: onchainData.isDestroyed
              });
              
              await nftAsset.save();
            }
          }
        }
      }
    } catch (error) {
      console.warn(`同步链上NFT数据失败: ${error.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        assets: nftAssets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取活动关联的NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取活动关联的NFT失败',
      error: error.message
    });
  }
};

/**
 * 验证NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.verifyNFT = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { status } = req.body;
    
    // 参数验证
    if (!status || !['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的验证状态'
      });
    }
    
    // 验证用户权限
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权验证NFT'
      });
    }
    
    // 获取NFT资产
    const nftAsset = await NFTAsset.findOne({ tokenId });
    if (!nftAsset) {
      return res.status(404).json({
        success: false,
        message: 'NFT资产不存在'
      });
    }
    
    // 调用区块链服务验证NFT
    const result = await blockchainService.verifyNFT(
      tokenId,
      verificationStatusMap[status]
    );
    
    // 更新数据库
    nftAsset.verificationStatus = status;
    nftAsset.verifier = req.user.walletAddress;
    nftAsset.verifiedAt = new Date();
    nftAsset.lastSyncedAt = new Date();
    await nftAsset.save();
    
    return res.status(200).json({
      success: true,
      message: 'NFT验证成功',
      data: {
        tokenId,
        txHash: result.txHash,
        status,
        verifier: req.user.walletAddress
      }
    });
  } catch (error) {
    console.error('验证NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '验证NFT失败',
      error: error.message
    });
  }
};

/**
 * 将NFT关联到活动
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.linkNFTToActivity = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { activityId } = req.body;
    
    // 参数验证
    if (!activityId) {
      return res.status(400).json({
        success: false,
        message: '缺少活动ID'
      });
    }
    
    // 获取NFT资产
    const nftAsset = await NFTAsset.findOne({ tokenId });
    if (!nftAsset) {
      return res.status(404).json({
        success: false,
        message: 'NFT资产不存在'
      });
    }
    
    // 验证用户权限
    if (nftAsset.owner.toLowerCase() !== req.user.walletAddress.toLowerCase() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权关联此NFT'
      });
    }
    
    // 获取活动
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }
    
    // 调用区块链服务关联NFT到活动
    const result = await blockchainService.linkNFTToActivity(
      tokenId,
      activity.activityId
    );
    
    // 更新数据库
    nftAsset.activityId = activity._id;
    nftAsset.lastSyncedAt = new Date();
    await nftAsset.save();
    
    return res.status(200).json({
      success: true,
      message: 'NFT关联到活动成功',
      data: {
        tokenId,
        txHash: result.txHash,
        activityId: activity._id,
        activityTitle: activity.title
      }
    });
  } catch (error) {
    console.error('关联NFT到活动失败:', error);
    return res.status(500).json({
      success: false,
      message: '关联NFT到活动失败',
      error: error.message
    });
  }
};

/**
 * 销毁NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.destroyNFT = async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // 获取NFT资产
    const nftAsset = await NFTAsset.findOne({ tokenId });
    if (!nftAsset) {
      return res.status(404).json({
        success: false,
        message: 'NFT资产不存在'
      });
    }
    
    // 验证用户权限
    if (nftAsset.owner.toLowerCase() !== req.user.walletAddress.toLowerCase() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权销毁此NFT'
      });
    }
    
    // 检查NFT是否已销毁
    if (nftAsset.isDestroyed) {
      return res.status(400).json({
        success: false,
        message: 'NFT已销毁'
      });
    }
    
    // 调用区块链服务销毁NFT
    const result = await blockchainService.destroyNFT(tokenId);
    
    // 更新数据库
    nftAsset.isDestroyed = true;
    nftAsset.destroyedAt = new Date();
    nftAsset.destroyTxHash = result.txHash;
    nftAsset.lastSyncedAt = new Date();
    await nftAsset.save();
    
    return res.status(200).json({
      success: true,
      message: 'NFT销毁成功',
      data: {
        tokenId,
        txHash: result.txHash,
        destroyedAt: nftAsset.destroyedAt
      }
    });
  } catch (error) {
    console.error('销毁NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '销毁NFT失败',
      error: error.message
    });
  }
};

/**
 * 上架NFT到市场
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.listNFTOnMarket = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { price, currency = 'MATIC' } = req.body;
    
    // 参数验证
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的价格'
      });
    }
    
    // 获取NFT资产
    const nftAsset = await NFTAsset.findOne({ tokenId });
    if (!nftAsset) {
      return res.status(404).json({
        success: false,
        message: 'NFT资产不存在'
      });
    }
    
    // 验证用户权限
    if (nftAsset.owner.toLowerCase() !== req.user.walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: '无权上架此NFT'
      });
    }
    
    // 检查NFT是否已销毁
    if (nftAsset.isDestroyed) {
      return res.status(400).json({
        success: false,
        message: 'NFT已销毁'
      });
    }
    
    // 上架NFT
    await nftAsset.listOnMarket(parseFloat(price), currency);
    
    return res.status(200).json({
      success: true,
      message: 'NFT上架成功',
      data: {
        tokenId,
        price: parseFloat(price),
        currency,
        listedAt: new Date()
      }
    });
  } catch (error) {
    console.error('上架NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '上架NFT失败',
      error: error.message
    });
  }
};

/**
 * 从市场下架NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.delistNFTFromMarket = async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // 获取NFT资产
    const nftAsset = await NFTAsset.findOne({ tokenId });
    if (!nftAsset) {
      return res.status(404).json({
        success: false,
        message: 'NFT资产不存在'
      });
    }
    
    // 验证用户权限
    if (nftAsset.owner.toLowerCase() !== req.user.walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: '无权下架此NFT'
      });
    }
    
    // 检查NFT是否已上架
    if (!nftAsset.isListed) {
      return res.status(400).json({
        success: false,
        message: 'NFT未上架'
      });
    }
    
    // 下架NFT
    await nftAsset.delistFromMarket();
    
    return res.status(200).json({
      success: true,
      message: 'NFT下架成功',
      data: {
        tokenId,
        delistedAt: new Date()
      }
    });
  } catch (error) {
    console.error('下架NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '下架NFT失败',
      error: error.message
    });
  }
};

/**
 * 获取市场上的NFT
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getMarketNFTs = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'listingPrice', order = 'asc', assetType, minPrice, maxPrice, tags } = req.query;
    
    // 构建查询选项
    const options = {
      assetType,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      tags: tags ? tags.split(',') : undefined,
      sortBy: sort,
      sortOrder: order
    };
    
    // 查询市场上的NFT
    const nftAssets = await NFTAsset.findMarketListings(options);
    
    // 分页处理
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedAssets = nftAssets.slice(startIndex, endIndex);
    
    return res.status(200).json({
      success: true,
      data: {
        assets: paginatedAssets,
        pagination: {
          total: nftAssets.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(nftAssets.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取市场NFT失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取市场NFT失败',
      error: error.message
    });
  }
};

/**
 * 获取NFT统计信息
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getNFTStats = async (req, res) => {
  try {
    // 获取总NFT数量
    const totalNFTs = await NFTAsset.countDocuments({ isDestroyed: false });
    
    // 获取已验证NFT数量
    const verifiedNFTs = await NFTAsset.countDocuments({ verificationStatus: 'VERIFIED', isDestroyed: false });
    
    // 获取市场上架NFT数量
    const listedNFTs = await NFTAsset.countDocuments({ isListed: true, isDestroyed: false });
    
    // 获取各类型NFT数量
    const assetTypeCounts = await NFTAsset.aggregate([
      { $match: { isDestroyed: false } },
      { $group: { _id: '$assetType', count: { $sum: 1 } } }
    ]);
    
    // 获取最受欢迎的文化标签
    const popularTags = await NFTAsset.aggregate([
      { $match: { isDestroyed: false } },
      { $unwind: '$culturalTags' },
      { $group: { _id: '$culturalTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // 获取最近铸造的NFT
    const recentNFTs = await NFTAsset.find({ isDestroyed: false })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // 获取最高价值的NFT
    const valuableNFTs = await NFTAsset.find({ isListed: true, isDestroyed: false })
      .sort({ listingPrice: -1 })
      .limit(5);
    
    return res.status(200).json({
      success: true,
      data: {
        totalNFTs,
        verifiedNFTs,
        listedNFTs,
        assetTypeCounts: assetTypeCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        popularTags: popularTags.map(tag => ({
          tag: tag._id,
          count: tag.count
        })),
        recentNFTs,
        valuableNFTs
      }
    });
  } catch (error) {
    console.error('获取NFT统计信息失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取NFT统计信息失败',
      error: error.message
    });
  }
};
