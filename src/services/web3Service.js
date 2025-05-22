const Web3 = require('web3');
const CultureBridgeIdentity = require('../blockchain/artifacts/contracts/CultureBridgeIdentity.sol/CultureBridgeIdentity.json');
const CultureBridgeAsset = require('../blockchain/artifacts/contracts/CultureBridgeAsset.sol/CultureBridgeAsset.json');
const CultureBridgeExchange = require('../blockchain/artifacts/contracts/CultureBridgeExchange.sol/CultureBridgeExchange.json');
const CultureBridgeToken = require('../blockchain/artifacts/contracts/CultureBridgeToken.sol/CultureBridgeToken.json');
const CultureBridgeMarketplace = require('../blockchain/artifacts/contracts/CultureBridgeMarketplace.sol/CultureBridgeMarketplace.json');

/**
 * Web3服务类，提供与区块链交互的接口
 */
class Web3Service {
  constructor(providerUrl, contractAddresses) {
    this.web3 = new Web3(providerUrl);
    this.contractAddresses = contractAddresses;
    this.initContracts();
  }

  /**
   * 初始化智能合约实例
   */
  initContracts() {
    this.identityContract = new this.web3.eth.Contract(
      CultureBridgeIdentity.abi,
      this.contractAddresses.identity
    );

    this.assetContract = new this.web3.eth.Contract(
      CultureBridgeAsset.abi,
      this.contractAddresses.asset
    );

    this.exchangeContract = new this.web3.eth.Contract(
      CultureBridgeExchange.abi,
      this.contractAddresses.exchange
    );

    this.tokenContract = new this.web3.eth.Contract(
      CultureBridgeToken.abi,
      this.contractAddresses.token
    );

    this.marketplaceContract = new this.web3.eth.Contract(
      CultureBridgeMarketplace.abi,
      this.contractAddresses.marketplace
    );
  }

  /**
   * 设置当前用户账户
   * @param {string} account - 用户钱包地址
   */
  setAccount(account) {
    this.account = account;
  }

  /**
   * 获取当前用户账户
   * @returns {string} 用户钱包地址
   */
  getAccount() {
    return this.account;
  }

  /**
   * 获取当前网络ID
   * @returns {Promise<number>} 网络ID
   */
  async getNetworkId() {
    return await this.web3.eth.net.getId();
  }

  /**
   * 获取账户余额
   * @param {string} address - 钱包地址
   * @returns {Promise<string>} 余额（以ETH为单位）
   */
  async getBalance(address) {
    const balance = await this.web3.eth.getBalance(address || this.account);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  /**
   * 获取代币余额
   * @param {string} address - 钱包地址
   * @returns {Promise<string>} 代币余额
   */
  async getTokenBalance(address) {
    const balance = await this.tokenContract.methods.balanceOf(address || this.account).call();
    return this.web3.utils.fromWei(balance, 'ether');
  }

  // ===== 身份合约接口 =====

  /**
   * 注册用户
   * @param {string} name - 用户名
   * @param {string} email - 邮箱
   * @param {string} profileUri - 个人资料URI
   * @returns {Promise<object>} 交易收据
   */
  async registerUser(name, email, profileUri) {
    return await this.identityContract.methods
      .registerUser(name, email, profileUri)
      .send({ from: this.account });
  }

  /**
   * 获取用户信息
   * @param {string} address - 用户地址
   * @returns {Promise<object>} 用户信息
   */
  async getUserInfo(address) {
    const result = await this.identityContract.methods.getUserInfo(address || this.account).call();
    return {
      userId: result[0],
      name: result[1],
      email: result[2],
      profileUri: result[3],
      isVerified: result[4]
    };
  }

  /**
   * 更新用户资料
   * @param {string} name - 新用户名
   * @param {string} email - 新邮箱
   * @param {string} profileUri - 新个人资料URI
   * @returns {Promise<object>} 交易收据
   */
  async updateProfile(name, email, profileUri) {
    return await this.identityContract.methods
      .updateProfile(name, email, profileUri)
      .send({ from: this.account });
  }

  // ===== 资产合约接口 =====

  /**
   * 创建文化资产
   * @param {string} assetType - 资产类型
   * @param {string} culturalOrigin - 文化起源
   * @param {string} tokenUri - 代币URI
   * @param {string} metadataHash - 元数据哈希
   * @returns {Promise<object>} 交易收据
   */
  async createAsset(assetType, culturalOrigin, tokenUri, metadataHash) {
    return await this.assetContract.methods
      .createAsset(assetType, culturalOrigin, tokenUri, metadataHash)
      .send({ from: this.account });
  }

  /**
   * 获取资产信息
   * @param {number} tokenId - 资产ID
   * @returns {Promise<object>} 资产信息
   */
  async getAssetInfo(tokenId) {
    const result = await this.assetContract.methods.getAssetInfo(tokenId).call();
    return {
      id: result[0],
      assetType: result[1],
      culturalOrigin: result[2],
      creator: result[3],
      creationTime: result[4],
      isVerified: result[5],
      metadataHash: result[6]
    };
  }

  /**
   * 获取用户的资产
   * @param {string} address - 用户地址
   * @returns {Promise<number[]>} 资产ID数组
   */
  async getUserAssets(address) {
    return await this.assetContract.methods.getAssetsByCreator(address || this.account).call();
  }

  // ===== 交流合约接口 =====

  /**
   * 创建文化交流
   * @param {string} title - 标题
   * @param {string} description - 描述
   * @param {number} startTime - 开始时间
   * @param {number} endTime - 结束时间
   * @param {string} category - 类别
   * @param {string[]} tags - 标签数组
   * @returns {Promise<object>} 交易收据
   */
  async createExchange(title, description, startTime, endTime, category, tags) {
    return await this.exchangeContract.methods
      .createExchange(title, description, startTime, endTime, category, tags)
      .send({ from: this.account });
  }

  /**
   * 加入文化交流
   * @param {number} exchangeId - 交流ID
   * @returns {Promise<object>} 交易收据
   */
  async joinExchange(exchangeId) {
    return await this.exchangeContract.methods
      .joinExchange(exchangeId)
      .send({ from: this.account });
  }

  /**
   * 获取交流信息
   * @param {number} exchangeId - 交流ID
   * @returns {Promise<object>} 交流信息
   */
  async getExchangeInfo(exchangeId) {
    const result = await this.exchangeContract.methods.getExchangeInfo(exchangeId).call();
    return {
      id: result[0],
      title: result[1],
      description: result[2],
      organizer: result[3],
      startTime: result[4],
      endTime: result[5],
      isActive: result[6],
      participantCount: result[7],
      assetCount: result[8],
      category: result[9]
    };
  }

  /**
   * 获取活跃的交流
   * @returns {Promise<number[]>} 交流ID数组
   */
  async getActiveExchanges() {
    return await this.exchangeContract.methods.getActiveExchanges().call();
  }

  // ===== 代币合约接口 =====

  /**
   * 带有目的的代币转账
   * @param {string} to - 接收者地址
   * @param {string} amount - 代币数量
   * @param {string} purpose - 转账目的
   * @param {string} category - 交易类别
   * @param {string[]} tags - 交易标签数组
   * @returns {Promise<object>} 交易收据
   */
  async transferWithPurpose(to, amount, purpose, category, tags) {
    const amountWei = this.web3.utils.toWei(amount, 'ether');
    return await this.tokenContract.methods
      .transferWithPurpose(to, amountWei, purpose, category, tags)
      .send({ from: this.account });
  }

  /**
   * 获取用户的交易
   * @param {string} address - 用户地址
   * @returns {Promise<number[]>} 交易ID数组
   */
  async getUserTransactions(address) {
    return await this.tokenContract.methods.getUserTransactions(address || this.account).call();
  }

  /**
   * 获取交易信息
   * @param {number} id - 交易ID
   * @returns {Promise<object>} 交易信息
   */
  async getTransaction(id) {
    const result = await this.tokenContract.methods.getTransaction(id).call();
    return {
      id: result[0],
      from: result[1],
      to: result[2],
      amount: this.web3.utils.fromWei(result[3], 'ether'),
      purpose: result[4],
      timestamp: result[5],
      category: result[6]
    };
  }

  // ===== 市场合约接口 =====

  /**
   * 挂单出售资产
   * @param {number} tokenId - 资产ID
   * @param {string} price - 价格
   * @param {string} description - 描述
   * @returns {Promise<object>} 交易收据
   */
  async listAsset(tokenId, price, description) {
    const priceWei = this.web3.utils.toWei(price, 'ether');
    
    // 先授权市场合约操作资产
    await this.assetContract.methods
      .approve(this.contractAddresses.marketplace, tokenId)
      .send({ from: this.account });
    
    // 然后挂单
    return await this.marketplaceContract.methods
      .listAsset(tokenId, priceWei, description)
      .send({ from: this.account });
  }

  /**
   * 购买资产
   * @param {number} tokenId - 资产ID
   * @returns {Promise<object>} 交易收据
   */
  async buyAsset(tokenId) {
    // 获取挂单信息
    const listing = await this.marketplaceContract.methods.getListing(tokenId).call();
    
    // 先授权市场合约操作代币
    await this.tokenContract.methods
      .approve(this.contractAddresses.marketplace, listing.price)
      .send({ from: this.account });
    
    // 然后购买
    return await this.marketplaceContract.methods
      .buyAsset(tokenId)
      .send({ from: this.account });
  }

  /**
   * 获取活跃挂单
   * @param {number} start - 起始索引
   * @param {number} limit - 限制数量
   * @returns {Promise<object>} 挂单信息
   */
  async getActiveListings(start, limit) {
    const result = await this.marketplaceContract.methods.getActiveListings(start, limit).call();
    
    const listings = [];
    for (let i = 0; i < result[0].length; i++) {
      listings.push({
        tokenId: result[0][i],
        seller: result[1][i],
        price: this.web3.utils.fromWei(result[2][i], 'ether')
      });
    }
    
    return listings;
  }

  /**
   * 获取交易历史
   * @param {number} start - 起始索引
   * @param {number} limit - 限制数量
   * @returns {Promise<object[]>} 交易历史
   */
  async getTransactionHistory(start, limit) {
    const result = await this.marketplaceContract.methods.getTransactionHistory(start, limit).call();
    
    const history = [];
    for (let i = 0; i < result[0].length; i++) {
      history.push({
        tokenId: result[0][i],
        seller: result[1][i],
        buyer: result[2][i],
        price: this.web3.utils.fromWei(result[3][i], 'ether'),
        timestamp: result[4][i]
      });
    }
    
    return history;
  }
}

module.exports = Web3Service;
