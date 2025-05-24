// src/blockchain/service.js 更新版本 - 添加NFT合约支持

const { ethers } = require('ethers');
const CultureBridgeIdentityABI = require('../contracts/abis/CultureBridgeIdentity.json').abi;
const CultureBridgeActivityABI = require('../contracts/abis/CultureBridgeActivity.json').abi;
const CultureBridgeNFTABI = require('../contracts/abis/CultureBridgeNFT.json').abi;

// 合约地址配置
const contractAddresses = {
  identity: {
    mumbai: process.env.IDENTITY_CONTRACT_MUMBAI || '0x0000000000000000000000000000000000000000',
    polygon: process.env.IDENTITY_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000'
  },
  activity: {
    mumbai: process.env.ACTIVITY_CONTRACT_MUMBAI || '0x0000000000000000000000000000000000000000',
    polygon: process.env.ACTIVITY_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000'
  },
  nft: {
    mumbai: process.env.NFT_CONTRACT_MUMBAI || '0x0000000000000000000000000000000000000000',
    polygon: process.env.NFT_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000'
  }
};

// 网络配置
const networks = {
  mumbai: {
    name: 'Mumbai Testnet',
    chainId: 80001,
    rpcUrl: process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com'
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
  }
};

class BlockchainService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.identityContract = null;
    this.activityContract = null;
    this.nftContract = null;
    this.network = null;
    this.initialized = false;
  }

  /**
   * 初始化区块链服务
   * @param {string} networkName 网络名称 ('mumbai' 或 'polygon')
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize(networkName = 'mumbai') {
    try {
      // 验证网络名称
      if (!networks[networkName]) {
        throw new Error(`不支持的网络: ${networkName}`);
      }

      this.network = networkName;
      const network = networks[networkName];

      // 创建提供者
      this.provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);

      // 创建钱包
      const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('未配置区块链私钥');
      }
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // 初始化身份合约
      const identityAddress = contractAddresses.identity[networkName];
      this.identityContract = new ethers.Contract(
        identityAddress,
        CultureBridgeIdentityABI,
        this.wallet
      );

      // 初始化活动合约
      const activityAddress = contractAddresses.activity[networkName];
      this.activityContract = new ethers.Contract(
        activityAddress,
        CultureBridgeActivityABI,
        this.wallet
      );

      // 初始化NFT合约
      const nftAddress = contractAddresses.nft[networkName];
      this.nftContract = new ethers.Contract(
        nftAddress,
        CultureBridgeNFTABI,
        this.wallet
      );

      this.initialized = true;
      console.log(`区块链服务初始化成功，连接到 ${network.name}`);
      return true;
    } catch (error) {
      console.error('区块链服务初始化失败:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 检查服务是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 获取当前网络名称
   * @returns {string} 网络名称
   */
  getNetworkName() {
    return this.network;
  }

  /**
   * 获取当前钱包地址
   * @returns {string} 钱包地址
   */
  getWalletAddress() {
    return this.wallet ? this.wallet.address : null;
  }

  /**
   * 获取合约地址
   * @param {string} contractType 合约类型 ('identity', 'activity', 'nft')
   * @returns {string} 合约地址
   */
  getContractAddress(contractType) {
    if (!this.network) return null;
    return contractAddresses[contractType][this.network];
  }

  // ===== 身份合约方法 =====

  /**
   * 创建用户身份
   * @param {string} userAddress 用户钱包地址
   * @param {string} username 用户名
   * @param {string} metadataURI 元数据URI
   * @returns {Promise<Object>} 交易结果
   */
  async createIdentity(userAddress, username, metadataURI) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.identityContract.createIdentity(
        userAddress,
        username,
        metadataURI
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('创建身份失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户声誉分数
   * @param {string} userAddress 用户钱包地址
   * @param {number} reputationChange 声誉变化值
   * @returns {Promise<Object>} 交易结果
   */
  async updateReputation(userAddress, reputationChange) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.identityContract.updateReputation(
        userAddress,
        reputationChange
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('更新声誉失败:', error);
      throw error;
    }
  }

  /**
   * 记录用户贡献
   * @param {string} userAddress 用户钱包地址
   * @param {string} contributionType 贡献类型
   * @param {string} metadataURI 元数据URI
   * @returns {Promise<Object>} 交易结果
   */
  async recordContribution(userAddress, contributionType, metadataURI) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.identityContract.recordContribution(
        userAddress,
        contributionType,
        metadataURI
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('记录贡献失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户身份信息
   * @param {string} userAddress 用户钱包地址
   * @returns {Promise<Object>} 用户身份信息
   */
  async getIdentity(userAddress) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const identity = await this.identityContract.getIdentity(userAddress);
      
      return {
        identityId: identity.identityId.toString(),
        username: identity.username,
        metadataURI: identity.metadataURI,
        reputationScore: identity.reputationScore.toString(),
        contributionCount: identity.contributionCount.toString(),
        createdAt: new Date(identity.createdAt.toNumber() * 1000),
        exists: identity.exists
      };
    } catch (error) {
      console.error('获取身份失败:', error);
      throw error;
    }
  }

  // ===== 活动合约方法 =====

  /**
   * 创建文化活动
   * @param {string} organizerAddress 组织者钱包地址
   * @param {string} title 活动标题
   * @param {string} contentHash 内容哈希
   * @param {string} metadataURI 元数据URI
   * @returns {Promise<Object>} 交易结果
   */
  async createActivity(organizerAddress, title, contentHash, metadataURI) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.activityContract.createActivity(
        organizerAddress,
        title,
        contentHash,
        metadataURI
      );
      const receipt = await tx.wait();
      
      // 解析事件获取活动ID
      const event = receipt.events.find(e => e.event === 'ActivityCreated');
      const activityId = event.args.activityId.toString();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        activityId,
        events: receipt.events
      };
    } catch (error) {
      console.error('创建活动失败:', error);
      throw error;
    }
  }

  /**
   * 更新活动状态
   * @param {string} activityId 活动ID
   * @param {number} newStatus 新状态
   * @returns {Promise<Object>} 交易结果
   */
  async updateActivityStatus(activityId, newStatus) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.activityContract.updateActivityStatus(
        activityId,
        newStatus
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('更新活动状态失败:', error);
      throw error;
    }
  }

  /**
   * 验证活动
   * @param {string} activityId 活动ID
   * @param {boolean} isVerified 是否验证通过
   * @param {string} verifierAddress 验证人钱包地址
   * @returns {Promise<Object>} 交易结果
   */
  async verifyActivity(activityId, isVerified, verifierAddress) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.activityContract.verifyActivity(
        activityId,
        isVerified,
        verifierAddress
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('验证活动失败:', error);
      throw error;
    }
  }

  /**
   * 参与活动
   * @param {string} activityId 活动ID
   * @param {string} participantAddress 参与者钱包地址
   * @returns {Promise<Object>} 交易结果
   */
  async joinActivity(activityId, participantAddress) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.activityContract.joinActivity(
        activityId,
        participantAddress
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('参与活动失败:', error);
      throw error;
    }
  }

  /**
   * 获取活动信息
   * @param {string} activityId 活动ID
   * @returns {Promise<Object>} 活动信息
   */
  async getActivity(activityId) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const activity = await this.activityContract.getActivity(activityId);
      
      return {
        activityId: activity.activityId.toString(),
        organizer: activity.organizer,
        title: activity.title,
        contentHash: activity.contentHash,
        metadataURI: activity.metadataURI,
        status: activity.status,
        isVerified: activity.isVerified,
        verifier: activity.verifier,
        participantCount: activity.participantCount.toString(),
        createdAt: new Date(activity.createdAt.toNumber() * 1000),
        exists: activity.exists
      };
    } catch (error) {
      console.error('获取活动失败:', error);
      throw error;
    }
  }

  // ===== NFT合约方法 =====

  /**
   * 铸造NFT
   * @param {string} to 接收者钱包地址
   * @param {string} name 资产名称
   * @param {string} description 资产描述
   * @param {number} assetType 资产类型 (0-4)
   * @param {string} uri 元数据URI
   * @param {string[]} culturalTags 文化标签数组
   * @param {number} rarity 稀有度
   * @returns {Promise<Object>} 交易结果
   */
  async mintNFT(to, name, description, assetType, uri, culturalTags, rarity) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.nftContract.mint(
        to,
        name,
        description,
        assetType,
        uri,
        culturalTags,
        rarity
      );
      const receipt = await tx.wait();
      
      // 解析事件获取代币ID
      const event = receipt.events.find(e => e.event === 'AssetCreated');
      const tokenId = event.args.tokenId.toString();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        tokenId,
        events: receipt.events
      };
    } catch (error) {
      console.error('铸造NFT失败:', error);
      throw error;
    }
  }

  /**
   * 为活动铸造NFT
   * @param {string} to 接收者钱包地址
   * @param {string} name 资产名称
   * @param {string} description 资产描述
   * @param {number} assetType 资产类型 (0-4)
   * @param {string} uri 元数据URI
   * @param {string[]} culturalTags 文化标签数组
   * @param {number} rarity 稀有度
   * @param {string} activityId 活动ID
   * @returns {Promise<Object>} 交易结果
   */
  async mintNFTForActivity(to, name, description, assetType, uri, culturalTags, rarity, activityId) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.nftContract.mintForActivity(
        to,
        name,
        description,
        assetType,
        uri,
        culturalTags,
        rarity,
        activityId
      );
      const receipt = await tx.wait();
      
      // 解析事件获取代币ID
      const event = receipt.events.find(e => e.event === 'AssetCreated');
      const tokenId = event.args.tokenId.toString();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        tokenId,
        events: receipt.events
      };
    } catch (error) {
      console.error('为活动铸造NFT失败:', error);
      throw error;
    }
  }

  /**
   * 批量铸造NFT
   * @param {string[]} to 接收者钱包地址数组
   * @param {string[]} names 资产名称数组
   * @param {string[]} descriptions 资产描述数组
   * @param {number[]} assetTypes 资产类型数组
   * @param {string[]} uris 元数据URI数组
   * @param {string[][]} culturalTagsArray 文化标签数组的数组
   * @param {number[]} rarities 稀有度数组
   * @returns {Promise<Object>} 交易结果
   */
  async batchMintNFT(to, names, descriptions, assetTypes, uris, culturalTagsArray, rarities) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.nftContract.batchMint(
        to,
        names,
        descriptions,
        assetTypes,
        uris,
        culturalTagsArray,
        rarities
      );
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('批量铸造NFT失败:', error);
      throw error;
    }
  }

  /**
   * 验证NFT资产
   * @param {string} tokenId 代币ID
   * @param {number} status 验证状态 (0-2)
   * @returns {Promise<Object>} 交易结果
   */
  async verifyNFT(tokenId, status) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.nftContract.verifyAsset(tokenId, status);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('验证NFT失败:', error);
      throw error;
    }
  }

  /**
   * 将NFT关联到活动
   * @param {string} tokenId 代币ID
   * @param {string} activityId 活动ID
   * @returns {Promise<Object>} 交易结果
   */
  async linkNFTToActivity(tokenId, activityId) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.nftContract.linkToActivity(tokenId, activityId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('关联NFT到活动失败:', error);
      throw error;
    }
  }

  /**
   * 销毁NFT
   * @param {string} tokenId 代币ID
   * @returns {Promise<Object>} 交易结果
   */
  async destroyNFT(tokenId) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tx = await this.nftContract.destroyAsset(tokenId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        events: receipt.events
      };
    } catch (error) {
      console.error('销毁NFT失败:', error);
      throw error;
    }
  }

  /**
   * 获取NFT资产信息
   * @param {string} tokenId 代币ID
   * @returns {Promise<Object>} NFT资产信息
   */
  async getNFT(tokenId) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const asset = await this.nftContract.getAsset(tokenId);
      const tags = await this.nftContract.getAssetTags(tokenId);
      const owner = await this.nftContract.ownerOf(tokenId);
      const uri = await this.nftContract.tokenURI(tokenId);
      
      return {
        tokenId,
        name: asset.name,
        description: asset.description,
        assetType: asset.assetType,
        creator: asset.creator,
        owner,
        createdAt: new Date(asset.createdAt.toNumber() * 1000),
        rarity: asset.rarity.toString(),
        verificationStatus: asset.verificationStatus,
        verifier: asset.verifier,
        activityId: asset.activityId.toString(),
        isDestroyed: asset.isDestroyed,
        culturalTags: tags,
        tokenURI: uri
      };
    } catch (error) {
      console.error('获取NFT失败:', error);
      throw error;
    }
  }

  /**
   * 获取活动关联的NFT列表
   * @param {string} activityId 活动ID
   * @returns {Promise<Array>} NFT代币ID数组
   */
  async getActivityNFTs(activityId) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tokenIds = await this.nftContract.getActivityAssets(activityId);
      return tokenIds.map(id => id.toString());
    } catch (error) {
      console.error('获取活动NFT失败:', error);
      throw error;
    }
  }

  /**
   * 获取创建者的NFT列表
   * @param {string} creator 创建者钱包地址
   * @returns {Promise<Array>} NFT代币ID数组
   */
  async getCreatorNFTs(creator) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tokenIds = await this.nftContract.getCreatorAssets(creator);
      return tokenIds.map(id => id.toString());
    } catch (error) {
      console.error('获取创建者NFT失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定标签的NFT列表
   * @param {string} tag 文化标签
   * @returns {Promise<Array>} NFT代币ID数组
   */
  async getNFTsByTag(tag) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const tokenIds = await this.nftContract.getAssetsByTag(tag);
      return tokenIds.map(id => id.toString());
    } catch (error) {
      console.error('获取标签NFT失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户拥有的NFT列表
   * @param {string} owner 所有者钱包地址
   * @returns {Promise<Array>} NFT代币ID数组
   */
  async getOwnerNFTs(owner) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const balance = await this.nftContract.balanceOf(owner);
      const tokenIds = [];
      
      for (let i = 0; i < balance; i++) {
        const tokenId = await this.nftContract.tokenOfOwnerByIndex(owner, i);
        tokenIds.push(tokenId.toString());
      }
      
      return tokenIds;
    } catch (error) {
      console.error('获取所有者NFT失败:', error);
      throw error;
    }
  }

  /**
   * 获取NFT总数
   * @returns {Promise<string>} NFT总数
   */
  async getNFTCount() {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      const count = await this.nftContract.getAssetCount();
      return count.toString();
    } catch (error) {
      console.error('获取NFT总数失败:', error);
      throw error;
    }
  }

  /**
   * 检查地址是否为铸造者
   * @param {string} address 钱包地址
   * @returns {Promise<boolean>} 是否为铸造者
   */
  async isMinter(address) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      return await this.nftContract.isMinter(address);
    } catch (error) {
      console.error('检查铸造者失败:', error);
      throw error;
    }
  }

  /**
   * 检查地址是否有活动角色
   * @param {string} address 钱包地址
   * @returns {Promise<boolean>} 是否有活动角色
   */
  async hasActivityRole(address) {
    if (!this.initialized) throw new Error('区块链服务未初始化');
    
    try {
      return await this.nftContract.hasActivityRole(address);
    } catch (error) {
      console.error('检查活动角色失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const blockchainService = new BlockchainService();

module.exports = blockchainService;
