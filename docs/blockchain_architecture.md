# CultureBridge 区块链架构设计

## 1. 概述

本文档详细描述了CultureBridge平台的区块链架构设计，基于BNB Chain（币安智能链）实现。该架构旨在支持跨文化交流平台的核心功能，包括用户身份验证、文化资源数字资产化、智能合约管理文化交流以及跨文化交易系统。

## 2. 系统架构

CultureBridge区块链系统采用分层架构设计：

### 2.1 基础层
- **BNB Chain**：提供底层区块链基础设施
- **智能合约**：使用Solidity语言开发，部署在BNB Chain上
- **IPFS存储**：用于存储文化资源的元数据和内容

### 2.2 合约层
- **身份合约**：管理用户身份和权限
- **资产合约**：管理文化资源的数字资产化
- **交流合约**：管理文化交流活动和互动
- **交易合约**：管理跨文化交易和积分系统

### 2.3 接口层
- **Web3接口**：连接前端应用与区块链
- **API网关**：提供RESTful API接口，连接传统后端与区块链

### 2.4 应用层
- **前端应用**：用户界面和交互
- **传统后端**：处理非区块链相关的业务逻辑

## 3. 智能合约设计

### 3.1 CultureBridgeIdentity合约

管理用户身份和权限的智能合约。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract CultureBridgeIdentity is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _userIds;
    
    struct User {
        uint256 id;
        string username;
        string culturalBackground;
        uint256 reputationScore;
        bool isVerified;
        mapping(string => bool) credentials;
    }
    
    mapping(address => User) private users;
    mapping(string => address) private usernameToAddress;
    
    event UserRegistered(address indexed userAddress, uint256 id, string username);
    event UserVerified(address indexed userAddress);
    event CredentialAdded(address indexed userAddress, string credentialType);
    
    function registerUser(string memory _username, string memory _culturalBackground) public {
        require(users[msg.sender].id == 0, "User already registered");
        require(usernameToAddress[_username] == address(0), "Username already taken");
        
        _userIds.increment();
        uint256 newUserId = _userIds.current();
        
        User storage newUser = users[msg.sender];
        newUser.id = newUserId;
        newUser.username = _username;
        newUser.culturalBackground = _culturalBackground;
        newUser.reputationScore = 0;
        newUser.isVerified = false;
        
        usernameToAddress[_username] = msg.sender;
        
        emit UserRegistered(msg.sender, newUserId, _username);
    }
    
    function verifyUser(address _userAddress) public onlyOwner {
        require(users[_userAddress].id != 0, "User not registered");
        users[_userAddress].isVerified = true;
        emit UserVerified(_userAddress);
    }
    
    function addCredential(address _userAddress, string memory _credentialType) public onlyOwner {
        require(users[_userAddress].id != 0, "User not registered");
        users[_userAddress].credentials[_credentialType] = true;
        emit CredentialAdded(_userAddress, _credentialType);
    }
    
    function updateReputationScore(address _userAddress, uint256 _score) public onlyOwner {
        require(users[_userAddress].id != 0, "User not registered");
        users[_userAddress].reputationScore = _score;
    }
    
    function getUserInfo(address _userAddress) public view returns (
        uint256 id,
        string memory username,
        string memory culturalBackground,
        uint256 reputationScore,
        bool isVerified
    ) {
        User storage user = users[_userAddress];
        return (
            user.id,
            user.username,
            user.culturalBackground,
            user.reputationScore,
            user.isVerified
        );
    }
    
    function checkCredential(address _userAddress, string memory _credentialType) public view returns (bool) {
        return users[_userAddress].credentials[_credentialType];
    }
    
    function getAddressByUsername(string memory _username) public view returns (address) {
        return usernameToAddress[_username];
    }
}
```

### 3.2 CultureBridgeAsset合约

管理文化资源数字资产化的智能合约。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./CultureBridgeIdentity.sol";

contract CultureBridgeAsset is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    CultureBridgeIdentity private identityContract;
    
    struct CulturalAsset {
        uint256 id;
        string assetType; // 文章、视频、音频、艺术品等
        string culturalOrigin;
        address creator;
        uint256 creationTime;
        bool isVerified;
    }
    
    mapping(uint256 => CulturalAsset) private assets;
    
    event AssetCreated(uint256 indexed tokenId, address indexed creator, string assetType);
    event AssetVerified(uint256 indexed tokenId);
    
    constructor(address _identityContractAddress) ERC721("CultureBridge Asset", "CBA") {
        identityContract = CultureBridgeIdentity(_identityContractAddress);
    }
    
    function createAsset(
        string memory _assetType,
        string memory _culturalOrigin,
        string memory _tokenURI
    ) public returns (uint256) {
        // 检查用户是否已注册并验证
        (,,,,bool isVerified) = identityContract.getUserInfo(msg.sender);
        require(isVerified, "User must be verified to create assets");
        
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        
        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, _tokenURI);
        
        assets[newItemId] = CulturalAsset({
            id: newItemId,
            assetType: _assetType,
            culturalOrigin: _culturalOrigin,
            creator: msg.sender,
            creationTime: block.timestamp,
            isVerified: false
        });
        
        emit AssetCreated(newItemId, msg.sender, _assetType);
        
        return newItemId;
    }
    
    function verifyAsset(uint256 _tokenId) public onlyOwner {
        require(_exists(_tokenId), "Asset does not exist");
        assets[_tokenId].isVerified = true;
        emit AssetVerified(_tokenId);
    }
    
    function getAssetInfo(uint256 _tokenId) public view returns (
        uint256 id,
        string memory assetType,
        string memory culturalOrigin,
        address creator,
        uint256 creationTime,
        bool isVerified
    ) {
        require(_exists(_tokenId), "Asset does not exist");
        CulturalAsset storage asset = assets[_tokenId];
        return (
            asset.id,
            asset.assetType,
            asset.culturalOrigin,
            asset.creator,
            asset.creationTime,
            asset.isVerified
        );
    }
    
    function getAssetsByCreator(address _creator) public view returns (uint256[] memory) {
        uint256 totalAssets = _tokenIds.current();
        uint256 creatorAssetCount = 0;
        
        // 计算创建者拥有的资产数量
        for (uint256 i = 1; i <= totalAssets; i++) {
            if (assets[i].creator == _creator) {
                creatorAssetCount++;
            }
        }
        
        // 创建结果数组
        uint256[] memory result = new uint256[](creatorAssetCount);
        uint256 resultIndex = 0;
        
        // 填充结果数组
        for (uint256 i = 1; i <= totalAssets; i++) {
            if (assets[i].creator == _creator) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
    
    function getAssetsByType(string memory _assetType) public view returns (uint256[] memory) {
        uint256 totalAssets = _tokenIds.current();
        uint256 typeAssetCount = 0;
        
        // 计算指定类型的资产数量
        for (uint256 i = 1; i <= totalAssets; i++) {
            if (keccak256(bytes(assets[i].assetType)) == keccak256(bytes(_assetType))) {
                typeAssetCount++;
            }
        }
        
        // 创建结果数组
        uint256[] memory result = new uint256[](typeAssetCount);
        uint256 resultIndex = 0;
        
        // 填充结果数组
        for (uint256 i = 1; i <= totalAssets; i++) {
            if (keccak256(bytes(assets[i].assetType)) == keccak256(bytes(_assetType))) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
}
```

### 3.3 CultureBridgeExchange合约

管理文化交流活动和互动的智能合约。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./CultureBridgeIdentity.sol";
import "./CultureBridgeAsset.sol";

contract CultureBridgeExchange is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _exchangeIds;
    
    CultureBridgeIdentity private identityContract;
    CultureBridgeAsset private assetContract;
    
    struct CulturalExchange {
        uint256 id;
        string title;
        string description;
        address organizer;
        uint256[] involvedAssets;
        address[] participants;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }
    
    mapping(uint256 => CulturalExchange) private exchanges;
    
    event ExchangeCreated(uint256 indexed exchangeId, address indexed organizer);
    event ParticipantJoined(uint256 indexed exchangeId, address indexed participant);
    event AssetAddedToExchange(uint256 indexed exchangeId, uint256 indexed assetId);
    event ExchangeStatusChanged(uint256 indexed exchangeId, bool isActive);
    
    constructor(address _identityContractAddress, address _assetContractAddress) {
        identityContract = CultureBridgeIdentity(_identityContractAddress);
        assetContract = CultureBridgeAsset(_assetContractAddress);
    }
    
    function createExchange(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) public returns (uint256) {
        // 检查用户是否已注册并验证
        (,,,,bool isVerified) = identityContract.getUserInfo(msg.sender);
        require(isVerified, "User must be verified to create exchanges");
        
        require(_startTime >= block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        
        _exchangeIds.increment();
        uint256 newExchangeId = _exchangeIds.current();
        
        exchanges[newExchangeId].id = newExchangeId;
        exchanges[newExchangeId].title = _title;
        exchanges[newExchangeId].description = _description;
        exchanges[newExchangeId].organizer = msg.sender;
        exchanges[newExchangeId].startTime = _startTime;
        exchanges[newExchangeId].endTime = _endTime;
        exchanges[newExchangeId].isActive = true;
        
        // 添加组织者作为第一个参与者
        exchanges[newExchangeId].participants.push(msg.sender);
        
        emit ExchangeCreated(newExchangeId, msg.sender);
        
        return newExchangeId;
    }
    
    function joinExchange(uint256 _exchangeId) public {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        require(exchanges[_exchangeId].isActive, "Exchange is not active");
        require(block.timestamp < exchanges[_exchangeId].endTime, "Exchange has ended");
        
        // 检查用户是否已注册
        (uint256 userId,,,,) = identityContract.getUserInfo(msg.sender);
        require(userId != 0, "User not registered");
        
        // 检查用户是否已经是参与者
        bool isAlreadyParticipant = false;
        for (uint256 i = 0; i < exchanges[_exchangeId].participants.length; i++) {
            if (exchanges[_exchangeId].participants[i] == msg.sender) {
                isAlreadyParticipant = true;
                break;
            }
        }
        require(!isAlreadyParticipant, "User is already a participant");
        
        exchanges[_exchangeId].participants.push(msg.sender);
        
        emit ParticipantJoined(_exchangeId, msg.sender);
    }
    
    function addAssetToExchange(uint256 _exchangeId, uint256 _assetId) public {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        require(exchanges[_exchangeId].isActive, "Exchange is not active");
        
        // 检查资产是否存在
        (uint256 assetId,,,,, bool isVerified) = assetContract.getAssetInfo(_assetId);
        require(assetId != 0, "Asset does not exist");
        require(isVerified, "Asset must be verified");
        
        // 检查用户是否是资产的所有者
        require(assetContract.ownerOf(_assetId) == msg.sender, "Only asset owner can add asset to exchange");
        
        // 检查用户是否是交流的参与者
        bool isParticipant = false;
        for (uint256 i = 0; i < exchanges[_exchangeId].participants.length; i++) {
            if (exchanges[_exchangeId].participants[i] == msg.sender) {
                isParticipant = true;
                break;
            }
        }
        require(isParticipant, "User must be a participant of the exchange");
        
        exchanges[_exchangeId].involvedAssets.push(_assetId);
        
        emit AssetAddedToExchange(_exchangeId, _assetId);
    }
    
    function setExchangeStatus(uint256 _exchangeId, bool _isActive) public {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        require(exchanges[_exchangeId].organizer == msg.sender || owner() == msg.sender, "Only organizer or owner can change status");
        
        exchanges[_exchangeId].isActive = _isActive;
        
        emit ExchangeStatusChanged(_exchangeId, _isActive);
    }
    
    function getExchangeInfo(uint256 _exchangeId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        address organizer,
        uint256 startTime,
        uint256 endTime,
        bool isActive,
        uint256 participantCount,
        uint256 assetCount
    ) {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        CulturalExchange storage exchange = exchanges[_exchangeId];
        return (
            exchange.id,
            exchange.title,
            exchange.description,
            exchange.organizer,
            exchange.startTime,
            exchange.endTime,
            exchange.isActive,
            exchange.participants.length,
            exchange.involvedAssets.length
        );
    }
    
    function getExchangeParticipants(uint256 _exchangeId) public view returns (address[] memory) {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        return exchanges[_exchangeId].participants;
    }
    
    function getExchangeAssets(uint256 _exchangeId) public view returns (uint256[] memory) {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        return exchanges[_exchangeId].involvedAssets;
    }
    
    function getActiveExchanges() public view returns (uint256[] memory) {
        uint256 totalExchanges = _exchangeIds.current();
        uint256 activeCount = 0;
        
        // 计算活跃交流的数量
        for (uint256 i = 1; i <= totalExchanges; i++) {
            if (exchanges[i].isActive && block.timestamp < exchanges[i].endTime) {
                activeCount++;
            }
        }
        
        // 创建结果数组
        uint256[] memory result = new uint256[](activeCount);
        uint256 resultIndex = 0;
        
        // 填充结果数组
        for (uint256 i = 1; i <= totalExchanges; i++) {
            if (exchanges[i].isActive && block.timestamp < exchanges[i].endTime) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
}
```

### 3.4 CultureBridgeToken合约

管理平台代币和跨文化交易的智能合约。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CultureBridgeIdentity.sol";

contract CultureBridgeToken is ERC20, Ownable {
    CultureBridgeIdentity private identityContract;
    
    struct Transaction {
        uint256 id;
        address from;
        address to;
        uint256 amount;
        string purpose;
        uint256 timestamp;
    }
    
    mapping(uint256 => Transaction) private transactions;
    uint256 private transactionCount;
    
    event CulturalTransaction(uint256 indexed id, address indexed from, address indexed to, uint256 amount, string purpose);
    event TokensAwarded(address indexed to, uint256 amount, string reason);
    
    constructor(address _identityContractAddress) ERC20("CultureBridge Token", "CBT") {
        identityContract = CultureBridgeIdentity(_identityContractAddress);
        // 初始铸造一些代币给合约所有者
        _mint(msg.sender, 1000000 * 10**decimals());
    }
    
    function awardTokens(address _to, uint256 _amount, string memory _reason) public onlyOwner {
        // 检查用户是否已注册
        (uint256 userId,,,,) = identityContract.getUserInfo(_to);
        require(userId != 0, "User not registered");
        
        _mint(_to, _amount);
        emit TokensAwarded(_to, _amount, _reason);
    }
    
    function transferWithPurpose(address _to, uint256 _amount, string memory _purpose) public returns (uint256) {
        // 检查发送者和接收者是否已注册
        (uint256 fromId,,,,) = identityContract.getUserInfo(msg.sender);
        (uint256 toId,,,,) = identityContract.getUserInfo(_to);
        require(fromId != 0, "Sender not registered");
        require(toId != 0, "Recipient not registered");
        
        // 执行转账
        _transfer(msg.sender, _to, _amount);
        
        // 记录交易
        transactionCount++;
        transactions[transactionCount] = Transaction({
            id: transactionCount,
            from: msg.sender,
            to: _to,
            amount: _amount,
            purpose: _purpose,
            timestamp: block.timestamp
        });
        
        emit CulturalTransaction(transactionCount, msg.sender, _to, _amount, _purpose);
        
        return transactionCount;
    }
    
    function getTransaction(uint256 _id) public view returns (
        uint256 id,
        address from,
        address to,
        uint256 amount,
        string memory purpose,
        uint256 timestamp
    ) {
        require(_id > 0 && _id <= transactionCount, "Transaction does not exist");
        Transaction storage txn = transactions[_id];
        return (
            txn.id,
            txn.from,
            txn.to,
            txn.amount,
            txn.purpose,
            txn.timestamp
        );
    }
    
    function getUserTransactions(address _user) public view returns (uint256[] memory) {
        uint256 userTxCount = 0;
        
        // 计算用户相关交易的数量
        for (uint256 i = 1; i <= transactionCount; i++) {
            if (transactions[i].from == _user || transactions[i].to == _user) {
                userTxCount++;
            }
        }
        
        // 创建结果数组
        uint256[] memory result = new uint256[](userTxCount);
        uint256 resultIndex = 0;
        
        // 填充结果数组
        for (uint256 i = 1; i <= transactionCount; i++) {
            if (transactions[i].from == _user || transactions[i].to == _user) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
    
    function burn(uint256 _amount) public {
        _burn(msg.sender, _amount);
    }
}
```

### 3.5 CultureBridgeFactory合约

工厂合约，用于部署和管理所有CultureBridge合约。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CultureBridgeIdentity.sol";
import "./CultureBridgeAsset.sol";
import "./CultureBridgeExchange.sol";
import "./CultureBridgeToken.sol";

contract CultureBridgeFactory is Ownable {
    CultureBridgeIdentity public identityContract;
    CultureBridgeAsset public assetContract;
    CultureBridgeExchange public exchangeContract;
    CultureBridgeToken public tokenContract;
    
    event ContractsDeployed(
        address identityContract,
        address assetContract,
        address exchangeContract,
        address tokenContract
    );
    
    constructor() {
        // 部署身份合约
        identityContract = new CultureBridgeIdentity();
        
        // 部署资产合约
        assetContract = new CultureBridgeAsset(address(identityContract));
        
        // 部署交流合约
        exchangeContract = new CultureBridgeExchange(address(identityContract), address(assetContract));
        
        // 部署代币合约
        tokenContract = new CultureBridgeToken(address(identityContract));
        
        emit ContractsDeployed(
            address(identityContract),
            address(assetContract),
            address(exchangeContract),
            address(tokenContract)
        );
    }
    
    function transferOwnership(address _newOwner) public override onlyOwner {
        super.transferOwnership(_newOwner);
        identityContract.transferOwnership(_newOwner);
        assetContract.transferOwnership(_newOwner);
        exchangeContract.transferOwnership(_newOwner);
        tokenContract.transferOwnership(_newOwner);
    }
}
```

## 4. 区块链与后端集成

### 4.1 Web3接口

创建一个Web3服务，用于连接前端应用与区块链。

```javascript
// blockchain/src/services/web3Service.js

const { ethers } = require('ethers');
const CultureBridgeIdentityABI = require('../contracts/CultureBridgeIdentity.json').abi;
const CultureBridgeAssetABI = require('../contracts/CultureBridgeAsset.json').abi;
const CultureBridgeExchangeABI = require('../contracts/CultureBridgeExchange.json').abi;
const CultureBridgeTokenABI = require('../contracts/CultureBridgeToken.json').abi;

class Web3Service {
    constructor() {
        // 连接到BNB Chain
        this.provider = new ethers.providers.JsonRpcProvider(process.env.BNB_CHAIN_RPC_URL);
        
        // 合约地址
        this.contractAddresses = {
            identity: process.env.IDENTITY_CONTRACT_ADDRESS,
            asset: process.env.ASSET_CONTRACT_ADDRESS,
            exchange: process.env.EXCHANGE_CONTRACT_ADDRESS,
            token: process.env.TOKEN_CONTRACT_ADDRESS
        };
        
        // 初始化合约实例
        this.contracts = {
            identity: new ethers.Contract(
                this.contractAddresses.identity,
                CultureBridgeIdentityABI,
                this.provider
            ),
            asset: new ethers.Contract(
                this.contractAddresses.asset,
                CultureBridgeAssetABI,
                this.provider
            ),
            exchange: new ethers.Contract(
                this.contractAddresses.exchange,
                CultureBridgeExchangeABI,
                this.provider
            ),
            token: new ethers.Contract(
                this.contractAddresses.token,
                CultureBridgeTokenABI,
                this.provider
            )
        };
        
        // 管理员钱包
        if (process.env.ADMIN_PRIVATE_KEY) {
            this.adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);
            
            // 使用管理员钱包连接合约
            this.adminContracts = {
                identity: this.contracts.identity.connect(this.adminWallet),
                asset: this.contracts.asset.connect(this.adminWallet),
                exchange: this.contracts.exchange.connect(this.adminWallet),
                token: this.contracts.token.connect(this.adminWallet)
            };
        }
    }
    
    // 身份合约方法
    async registerUser(userAddress, username, culturalBackground) {
        const tx = await this.adminContracts.identity.registerUser(username, culturalBackground, { from: userAddress });
        return await tx.wait();
    }
    
    async verifyUser(userAddress) {
        const tx = await this.adminContracts.identity.verifyUser(userAddress);
        return await tx.wait();
    }
    
    async getUserInfo(userAddress) {
        return await this.contracts.identity.getUserInfo(userAddress);
    }
    
    // 资产合约方法
    async createAsset(userAddress, assetType, culturalOrigin, tokenURI) {
        const tx = await this.adminContracts.asset.createAsset(assetType, culturalOrigin, tokenURI, { from: userAddress });
        return await tx.wait();
    }
    
    async verifyAsset(tokenId) {
        const tx = await this.adminContracts.asset.verifyAsset(tokenId);
        return await tx.wait();
    }
    
    async getAssetInfo(tokenId) {
        return await this.contracts.asset.getAssetInfo(tokenId);
    }
    
    // 交流合约方法
    async createExchange(userAddress, title, description, startTime, endTime) {
        const tx = await this.adminContracts.exchange.createExchange(
            title, description, startTime, endTime, { from: userAddress }
        );
        return await tx.wait();
    }
    
    async joinExchange(userAddress, exchangeId) {
        const tx = await this.adminContracts.exchange.joinExchange(exchangeId, { from: userAddress });
        return await tx.wait();
    }
    
    async getExchangeInfo(exchangeId) {
        return await this.contracts.exchange.getExchangeInfo(exchangeId);
    }
    
    // 代币合约方法
    async awardTokens(userAddress, amount, reason) {
        const tx = await this.adminContracts.token.awardTokens(userAddress, amount, reason);
        return await tx.wait();
    }
    
    async transferTokens(fromAddress, toAddress, amount, purpose) {
        const tx = await this.adminContracts.token.transferWithPurpose(
            toAddress, amount, purpose, { from: fromAddress }
        );
        return await tx.wait();
    }
    
    async getTokenBalance(userAddress) {
        return await this.contracts.token.balanceOf(userAddress);
    }
}

module.exports = new Web3Service();
```

### 4.2 区块链控制器

创建控制器，将区块链功能暴露为RESTful API。

```javascript
// blockchain/src/controllers/blockchainController.js

const web3Service = require('../services/web3Service');
const ipfsService = require('../services/ipfsService');

// 用户身份控制器
exports.registerUser = async (req, res) => {
    try {
        const { userAddress, username, culturalBackground } = req.body;
        
        const result = await web3Service.registerUser(userAddress, username, culturalBackground);
        
        res.status(201).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                username,
                culturalBackground
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.verifyUser = async (req, res) => {
    try {
        const { userAddress } = req.body;
        
        const result = await web3Service.verifyUser(userAddress);
        
        res.status(200).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                userAddress
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getUserInfo = async (req, res) => {
    try {
        const { userAddress } = req.params;
        
        const userInfo = await web3Service.getUserInfo(userAddress);
        
        res.status(200).json({
            success: true,
            data: {
                id: userInfo.id.toString(),
                username: userInfo.username,
                culturalBackground: userInfo.culturalBackground,
                reputationScore: userInfo.reputationScore.toString(),
                isVerified: userInfo.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 文化资产控制器
exports.createAsset = async (req, res) => {
    try {
        const { userAddress, assetType, culturalOrigin, assetData } = req.body;
        
        // 上传资产数据到IPFS
        const ipfsHash = await ipfsService.uploadToIPFS(assetData);
        
        // 创建资产元数据
        const metadata = {
            name: assetData.name,
            description: assetData.description,
            image: `ipfs://${ipfsHash}`,
            attributes: [
                {
                    trait_type: "Asset Type",
                    value: assetType
                },
                {
                    trait_type: "Cultural Origin",
                    value: culturalOrigin
                },
                {
                    trait_type: "Creator",
                    value: userAddress
                }
            ]
        };
        
        // 上传元数据到IPFS
        const metadataHash = await ipfsService.uploadJSONToIPFS(metadata);
        const tokenURI = `ipfs://${metadataHash}`;
        
        // 在区块链上创建资产
        const result = await web3Service.createAsset(userAddress, assetType, culturalOrigin, tokenURI);
        
        res.status(201).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                tokenId: result.events[0].args.tokenId.toString(),
                tokenURI,
                ipfsHash,
                metadataHash
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 文化交流控制器
exports.createExchange = async (req, res) => {
    try {
        const { userAddress, title, description, startTime, endTime } = req.body;
        
        const result = await web3Service.createExchange(
            userAddress,
            title,
            description,
            Math.floor(new Date(startTime).getTime() / 1000),
            Math.floor(new Date(endTime).getTime() / 1000)
        );
        
        res.status(201).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                exchangeId: result.events[0].args.exchangeId.toString(),
                title,
                description
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 代币控制器
exports.awardTokens = async (req, res) => {
    try {
        const { userAddress, amount, reason } = req.body;
        
        const result = await web3Service.awardTokens(userAddress, amount, reason);
        
        res.status(200).json({
            success: true,
            data: {
                transactionHash: result.transactionHash,
                userAddress,
                amount,
                reason
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getTokenBalance = async (req, res) => {
    try {
        const { userAddress } = req.params;
        
        const balance = await web3Service.getTokenBalance(userAddress);
        
        res.status(200).json({
            success: true,
            data: {
                userAddress,
                balance: balance.toString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
```

### 4.3 区块链路由

创建路由，将区块链控制器暴露为API端点。

```javascript
// blockchain/src/routes/blockchainRoutes.js

const express = require('express');
const router = express.Router();
const blockchainController = require('../controllers/blockchainController');

// 用户身份路由
router.post('/users/register', blockchainController.registerUser);
router.post('/users/verify', blockchainController.verifyUser);
router.get('/users/:userAddress', blockchainController.getUserInfo);

// 文化资产路由
router.post('/assets', blockchainController.createAsset);
router.post('/assets/verify', blockchainController.verifyAsset);
router.get('/assets/:tokenId', blockchainController.getAssetInfo);
router.get('/assets/creator/:userAddress', blockchainController.getAssetsByCreator);

// 文化交流路由
router.post('/exchanges', blockchainController.createExchange);
router.post('/exchanges/join', blockchainController.joinExchange);
router.get('/exchanges/:exchangeId', blockchainController.getExchangeInfo);
router.get('/exchanges/active', blockchainController.getActiveExchanges);

// 代币路由
router.post('/tokens/award', blockchainController.awardTokens);
router.post('/tokens/transfer', blockchainController.transferTokens);
router.get('/tokens/balance/:userAddress', blockchainController.getTokenBalance);
router.get('/tokens/transactions/:userAddress', blockchainController.getUserTransactions);

module.exports = router;
```

## 5. 部署流程

### 5.1 合约部署

1. 使用Hardhat部署合约到BNB Chain测试网
2. 验证合约功能
3. 部署到BNB Chain主网

### 5.2 后端集成

1. 配置环境变量（合约地址、RPC URL等）
2. 集成Web3服务到现有后端
3. 测试API端点

## 6. 安全考虑

1. **访问控制**：使用OpenZeppelin的Ownable合约确保关键操作只能由管理员执行
2. **输入验证**：在合约中验证所有输入参数
3. **重入攻击防护**：使用OpenZeppelin的ReentrancyGuard
4. **Gas优化**：优化合约以减少gas消耗
5. **密钥管理**：安全存储私钥和助记词

## 7. 测试策略

1. **单元测试**：测试每个合约的独立功能
2. **集成测试**：测试合约之间的交互
3. **端到端测试**：测试从前端到区块链的完整流程

## 8. 未来扩展

1. **治理机制**：实现社区治理和投票系统
2. **跨链集成**：与其他区块链网络集成
3. **DeFi功能**：实现更复杂的金融功能，如质押和借贷
4. **NFT市场**：实现文化资产的交易市场

## 9. 结论

本架构设计提供了CultureBridge平台基于BNB Chain的区块链实现方案。通过智能合约，我们实现了用户身份验证、文化资源数字资产化、智能合约管理文化交流以及跨文化交易系统等核心功能。该架构具有可扩展性和安全性，能够满足平台的需求并支持未来的发展。
