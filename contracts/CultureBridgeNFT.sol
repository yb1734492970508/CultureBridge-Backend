// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CultureBridgeNFT
 * @dev 管理文化资产NFT的创建、转让和销毁
 */
contract CultureBridgeNFT is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl, Pausable {
    using Counters for Counters.Counter;
    
    // 代币ID计数器
    Counters.Counter private _tokenIdCounter;
    
    // 角色定义
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ACTIVITY_ROLE = keccak256("ACTIVITY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // 资产类型枚举
    enum AssetType {
        ARTWORK,       // 艺术品
        CERTIFICATE,   // 证书
        COLLECTIBLE,   // 收藏品
        SOUVENIR,      // 纪念品
        HERITAGE       // 文化遗产
    }
    
    // 认证状态枚举
    enum VerificationStatus {
        PENDING,       // 待认证
        VERIFIED,      // 已认证
        REJECTED       // 已拒绝
    }
    
    // 资产结构体
    struct Asset {
        uint256 tokenId;                // 代币ID
        string name;                    // 资产名称
        string description;             // 资产描述
        AssetType assetType;            // 资产类型
        address creator;                // 创建者地址
        uint256 createdAt;              // 创建时间
        string[] culturalTags;          // 文化标签
        uint256 rarity;                 // 稀有度（如限量发行数量）
        VerificationStatus verificationStatus; // 认证状态
        address verifier;               // 认证人地址
        uint256 activityId;             // 关联活动ID（如有）
        bool isDestroyed;               // 是否已销毁
    }
    
    // 存储所有资产信息
    mapping(uint256 => Asset) private _assets;
    
    // 存储创建者的资产列表
    mapping(address => uint256[]) private _creatorAssets;
    
    // 存储活动关联的资产列表
    mapping(uint256 => uint256[]) private _activityAssets;
    
    // 存储文化标签到资产的映射
    mapping(string => uint256[]) private _tagAssets;
    
    // 事件
    event AssetCreated(uint256 indexed tokenId, address indexed creator, string name, AssetType assetType);
    event AssetVerified(uint256 indexed tokenId, address indexed verifier, VerificationStatus status);
    event AssetLinkedToActivity(uint256 indexed tokenId, uint256 indexed activityId);
    event AssetDestroyed(uint256 indexed tokenId, address indexed owner);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event ActivityRoleGranted(address indexed account);
    event ActivityRoleRevoked(address indexed account);
    
    /**
     * @dev 构造函数
     */
    constructor() ERC721("CultureBridge Asset", "CBA") {
        // 设置合约部署者为管理员和铸造者
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }
    
    /**
     * @dev 暂停合约（紧急情况使用）
     */
    function pause() public onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev 添加铸造者角色
     * @param minter 铸造者地址
     */
    function addMinter(address minter) public onlyRole(ADMIN_ROLE) {
        grantRole(MINTER_ROLE, minter);
        emit MinterAdded(minter);
    }
    
    /**
     * @dev 移除铸造者角色
     * @param minter 铸造者地址
     */
    function removeMinter(address minter) public onlyRole(ADMIN_ROLE) {
        revokeRole(MINTER_ROLE, minter);
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev 授予活动角色
     * @param account 账户地址
     */
    function grantActivityRole(address account) public onlyRole(ADMIN_ROLE) {
        grantRole(ACTIVITY_ROLE, account);
        emit ActivityRoleGranted(account);
    }
    
    /**
     * @dev 撤销活动角色
     * @param account 账户地址
     */
    function revokeActivityRole(address account) public onlyRole(ADMIN_ROLE) {
        revokeRole(ACTIVITY_ROLE, account);
        emit ActivityRoleRevoked(account);
    }
    
    /**
     * @dev 铸造新的文化资产NFT
     * @param to 接收者地址
     * @param name 资产名称
     * @param description 资产描述
     * @param assetType 资产类型
     * @param uri 元数据URI
     * @param culturalTags 文化标签数组
     * @param rarity 稀有度
     * @return 新铸造的代币ID
     */
    function mint(
        address to,
        string memory name,
        string memory description,
        AssetType assetType,
        string memory uri,
        string[] memory culturalTags,
        uint256 rarity
    ) public whenNotPaused onlyRole(MINTER_ROLE) returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(uri).length > 0, "URI cannot be empty");
        
        // 增加代币ID计数
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        // 铸造NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // 创建资产信息
        Asset storage newAsset = _assets[tokenId];
        newAsset.tokenId = tokenId;
        newAsset.name = name;
        newAsset.description = description;
        newAsset.assetType = assetType;
        newAsset.creator = msg.sender;
        newAsset.createdAt = block.timestamp;
        newAsset.culturalTags = culturalTags;
        newAsset.rarity = rarity;
        newAsset.verificationStatus = VerificationStatus.PENDING;
        newAsset.isDestroyed = false;
        
        // 更新创建者资产列表
        _creatorAssets[msg.sender].push(tokenId);
        
        // 更新标签到资产的映射
        for (uint i = 0; i < culturalTags.length; i++) {
            _tagAssets[culturalTags[i]].push(tokenId);
        }
        
        // 触发资产创建事件
        emit AssetCreated(tokenId, msg.sender, name, assetType);
        
        return tokenId;
    }
    
    /**
     * @dev 为活动铸造NFT（如参与证明、纪念品）
     * @param to 接收者地址
     * @param name 资产名称
     * @param description 资产描述
     * @param assetType 资产类型
     * @param uri 元数据URI
     * @param culturalTags 文化标签数组
     * @param rarity 稀有度
     * @param activityId 关联活动ID
     * @return 新铸造的代币ID
     */
    function mintForActivity(
        address to,
        string memory name,
        string memory description,
        AssetType assetType,
        string memory uri,
        string[] memory culturalTags,
        uint256 rarity,
        uint256 activityId
    ) public whenNotPaused onlyRole(ACTIVITY_ROLE) returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(uri).length > 0, "URI cannot be empty");
        require(activityId > 0, "Activity ID must be greater than 0");
        
        // 增加代币ID计数
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        // 铸造NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // 创建资产信息
        Asset storage newAsset = _assets[tokenId];
        newAsset.tokenId = tokenId;
        newAsset.name = name;
        newAsset.description = description;
        newAsset.assetType = assetType;
        newAsset.creator = msg.sender;
        newAsset.createdAt = block.timestamp;
        newAsset.culturalTags = culturalTags;
        newAsset.rarity = rarity;
        newAsset.verificationStatus = VerificationStatus.PENDING;
        newAsset.activityId = activityId;
        newAsset.isDestroyed = false;
        
        // 更新创建者资产列表
        _creatorAssets[msg.sender].push(tokenId);
        
        // 更新活动资产列表
        _activityAssets[activityId].push(tokenId);
        
        // 更新标签到资产的映射
        for (uint i = 0; i < culturalTags.length; i++) {
            _tagAssets[culturalTags[i]].push(tokenId);
        }
        
        // 触发事件
        emit AssetCreated(tokenId, msg.sender, name, assetType);
        emit AssetLinkedToActivity(tokenId, activityId);
        
        return tokenId;
    }
    
    /**
     * @dev 批量铸造NFT
     * @param to 接收者地址数组
     * @param names 资产名称数组
     * @param descriptions 资产描述数组
     * @param assetTypes 资产类型数组
     * @param uris 元数据URI数组
     * @param culturalTagsArray 文化标签数组的数组
     * @param rarities 稀有度数组
     * @return 新铸造的代币ID数组
     */
    function batchMint(
        address[] memory to,
        string[] memory names,
        string[] memory descriptions,
        AssetType[] memory assetTypes,
        string[] memory uris,
        string[][] memory culturalTagsArray,
        uint256[] memory rarities
    ) public whenNotPaused onlyRole(MINTER_ROLE) returns (uint256[] memory) {
        require(
            to.length == names.length &&
            names.length == descriptions.length &&
            descriptions.length == assetTypes.length &&
            assetTypes.length == uris.length &&
            uris.length == culturalTagsArray.length &&
            culturalTagsArray.length == rarities.length,
            "Input arrays must have the same length"
        );
        
        uint256[] memory tokenIds = new uint256[](to.length);
        
        for (uint i = 0; i < to.length; i++) {
            tokenIds[i] = mint(
                to[i],
                names[i],
                descriptions[i],
                assetTypes[i],
                uris[i],
                culturalTagsArray[i],
                rarities[i]
            );
        }
        
        return tokenIds;
    }
    
    /**
     * @dev 验证资产
     * @param tokenId 代币ID
     * @param status 验证状态
     */
    function verifyAsset(uint256 tokenId, VerificationStatus status) public whenNotPaused onlyRole(ADMIN_ROLE) {
        require(_exists(tokenId), "Asset does not exist");
        require(!_assets[tokenId].isDestroyed, "Asset is destroyed");
        
        // 更新资产验证状态
        _assets[tokenId].verificationStatus = status;
        _assets[tokenId].verifier = msg.sender;
        
        // 触发资产验证事件
        emit AssetVerified(tokenId, msg.sender, status);
    }
    
    /**
     * @dev 将资产关联到活动
     * @param tokenId 代币ID
     * @param activityId 活动ID
     */
    function linkToActivity(uint256 tokenId, uint256 activityId) public whenNotPaused {
        require(_exists(tokenId), "Asset does not exist");
        require(!_assets[tokenId].isDestroyed, "Asset is destroyed");
        require(activityId > 0, "Activity ID must be greater than 0");
        
        // 检查调用者是否为资产所有者或管理员
        require(
            ownerOf(tokenId) == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Only owner or admin can link asset to activity"
        );
        
        // 更新资产关联活动
        _assets[tokenId].activityId = activityId;
        
        // 更新活动资产列表
        _activityAssets[activityId].push(tokenId);
        
        // 触发资产关联活动事件
        emit AssetLinkedToActivity(tokenId, activityId);
    }
    
    /**
     * @dev 销毁资产
     * @param tokenId 代币ID
     */
    function destroyAsset(uint256 tokenId) public whenNotPaused {
        require(_exists(tokenId), "Asset does not exist");
        require(!_assets[tokenId].isDestroyed, "Asset already destroyed");
        
        // 检查调用者是否为资产所有者或管理员
        require(
            ownerOf(tokenId) == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Only owner or admin can destroy asset"
        );
        
        // 标记资产为已销毁
        _assets[tokenId].isDestroyed = true;
        
        // 触发资产销毁事件
        emit AssetDestroyed(tokenId, msg.sender);
        
        // 销毁NFT
        _burn(tokenId);
    }
    
    /**
     * @dev 获取资产信息
     * @param tokenId 代币ID
     * @return 资产信息
     */
    function getAsset(uint256 tokenId) public view returns (
        string memory name,
        string memory description,
        AssetType assetType,
        address creator,
        uint256 createdAt,
        uint256 rarity,
        VerificationStatus verificationStatus,
        address verifier,
        uint256 activityId,
        bool isDestroyed
    ) {
        require(_exists(tokenId), "Asset does not exist");
        
        Asset storage asset = _assets[tokenId];
        
        return (
            asset.name,
            asset.description,
            asset.assetType,
            asset.creator,
            asset.createdAt,
            asset.rarity,
            asset.verificationStatus,
            asset.verifier,
            asset.activityId,
            asset.isDestroyed
        );
    }
    
    /**
     * @dev 获取资产文化标签
     * @param tokenId 代币ID
     * @return 文化标签数组
     */
    function getAssetTags(uint256 tokenId) public view returns (string[] memory) {
        require(_exists(tokenId), "Asset does not exist");
        
        return _assets[tokenId].culturalTags;
    }
    
    /**
     * @dev 获取创建者的资产列表
     * @param creator 创建者地址
     * @return 代币ID数组
     */
    function getCreatorAssets(address creator) public view returns (uint256[] memory) {
        return _creatorAssets[creator];
    }
    
    /**
     * @dev 获取活动关联的资产列表
     * @param activityId 活动ID
     * @return 代币ID数组
     */
    function getActivityAssets(uint256 activityId) public view returns (uint256[] memory) {
        return _activityAssets[activityId];
    }
    
    /**
     * @dev 获取特定标签的资产列表
     * @param tag 文化标签
     * @return 代币ID数组
     */
    function getAssetsByTag(string memory tag) public view returns (uint256[] memory) {
        return _tagAssets[tag];
    }
    
    /**
     * @dev 获取资产总数
     * @return 资产总数
     */
    function getAssetCount() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev 检查地址是否为铸造者
     * @param account 账户地址
     * @return 是否为铸造者
     */
    function isMinter(address account) public view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }
    
    /**
     * @dev 检查地址是否有活动角色
     * @param account 账户地址
     * @return 是否有活动角色
     */
    function hasActivityRole(address account) public view returns (bool) {
        return hasRole(ACTIVITY_ROLE, account);
    }
    
    // 以下是重写的ERC721相关函数
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
