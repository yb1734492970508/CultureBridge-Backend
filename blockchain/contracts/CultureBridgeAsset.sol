// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./CultureBridgeIdentity.sol";

/**
 * @title CultureBridgeAsset
 * @dev 管理文化资源数字资产化的智能合约
 */
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
        string metadataHash; // IPFS哈希值
    }
    
    // 资产ID到资产详情的映射
    mapping(uint256 => CulturalAsset) private assets;
    
    // 文化起源到资产ID列表的映射
    mapping(string => uint256[]) private originToAssets;
    
    // 资产类型到资产ID列表的映射
    mapping(string => uint256[]) private typeToAssets;
    
    // 创建者地址到资产ID列表的映射
    mapping(address => uint256[]) private creatorToAssets;
    
    event AssetCreated(uint256 indexed tokenId, address indexed creator, string assetType, string culturalOrigin);
    event AssetVerified(uint256 indexed tokenId);
    event AssetMetadataUpdated(uint256 indexed tokenId, string newMetadataHash);
    
    /**
     * @dev 构造函数
     * @param _identityContractAddress 身份合约地址
     */
    constructor(address _identityContractAddress) ERC721("CultureBridge Asset", "CBA") {
        identityContract = CultureBridgeIdentity(_identityContractAddress);
    }
    
    /**
     * @dev 创建新的文化资产
     * @param _assetType 资产类型
     * @param _culturalOrigin 文化起源
     * @param _tokenURI 代币URI
     * @param _metadataHash IPFS元数据哈希
     * @return 新资产的代币ID
     */
    function createAsset(
        string memory _assetType,
        string memory _culturalOrigin,
        string memory _tokenURI,
        string memory _metadataHash
    ) public returns (uint256) {
        // 检查用户是否已注册并验证
        (uint256 userId,,,,bool isVerified) = identityContract.getUserInfo(msg.sender);
        require(userId != 0, "User not registered");
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
            isVerified: false,
            metadataHash: _metadataHash
        });
        
        // 更新索引映射
        originToAssets[_culturalOrigin].push(newItemId);
        typeToAssets[_assetType].push(newItemId);
        creatorToAssets[msg.sender].push(newItemId);
        
        emit AssetCreated(newItemId, msg.sender, _assetType, _culturalOrigin);
        
        return newItemId;
    }
    
    /**
     * @dev 验证资产
     * @param _tokenId 代币ID
     */
    function verifyAsset(uint256 _tokenId) public onlyOwner {
        require(_exists(_tokenId), "Asset does not exist");
        assets[_tokenId].isVerified = true;
        emit AssetVerified(_tokenId);
    }
    
    /**
     * @dev 更新资产元数据
     * @param _tokenId 代币ID
     * @param _newTokenURI 新的代币URI
     * @param _newMetadataHash 新的IPFS元数据哈希
     */
    function updateAssetMetadata(
        uint256 _tokenId,
        string memory _newTokenURI,
        string memory _newMetadataHash
    ) public {
        require(_exists(_tokenId), "Asset does not exist");
        require(ownerOf(_tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        
        _setTokenURI(_tokenId, _newTokenURI);
        assets[_tokenId].metadataHash = _newMetadataHash;
        
        emit AssetMetadataUpdated(_tokenId, _newMetadataHash);
    }
    
    /**
     * @dev 获取资产信息
     * @param _tokenId 代币ID
     * @return id 资产ID
     * @return assetType 资产类型
     * @return culturalOrigin 文化起源
     * @return creator 创建者地址
     * @return creationTime 创建时间
     * @return isVerified 是否已验证
     * @return metadataHash IPFS元数据哈希
     */
    function getAssetInfo(uint256 _tokenId) public view returns (
        uint256 id,
        string memory assetType,
        string memory culturalOrigin,
        address creator,
        uint256 creationTime,
        bool isVerified,
        string memory metadataHash
    ) {
        require(_exists(_tokenId), "Asset does not exist");
        CulturalAsset storage asset = assets[_tokenId];
        return (
            asset.id,
            asset.assetType,
            asset.culturalOrigin,
            asset.creator,
            asset.creationTime,
            asset.isVerified,
            asset.metadataHash
        );
    }
    
    /**
     * @dev 获取创建者的所有资产
     * @param _creator 创建者地址
     * @return 资产ID数组
     */
    function getAssetsByCreator(address _creator) public view returns (uint256[] memory) {
        return creatorToAssets[_creator];
    }
    
    /**
     * @dev 获取指定类型的所有资产
     * @param _assetType 资产类型
     * @return 资产ID数组
     */
    function getAssetsByType(string memory _assetType) public view returns (uint256[] memory) {
        return typeToAssets[_assetType];
    }
    
    /**
     * @dev 获取指定文化起源的所有资产
     * @param _culturalOrigin 文化起源
     * @return 资产ID数组
     */
    function getAssetsByOrigin(string memory _culturalOrigin) public view returns (uint256[] memory) {
        return originToAssets[_culturalOrigin];
    }
    
    /**
     * @dev 获取已验证的资产
     * @param _startIndex 起始索引
     * @param _count 数量
     * @return 资产ID数组
     */
    function getVerifiedAssets(uint256 _startIndex, uint256 _count) public view returns (uint256[] memory) {
        uint256 totalAssets = _tokenIds.current();
        require(_startIndex < totalAssets, "Start index out of bounds");
        
        uint256 endIndex = _startIndex + _count;
        if (endIndex > totalAssets) {
            endIndex = totalAssets;
        }
        
        uint256 resultCount = 0;
        for (uint256 i = _startIndex + 1; i <= endIndex; i++) {
            if (assets[i].isVerified) {
                resultCount++;
            }
        }
        
        uint256[] memory result = new uint256[](resultCount);
        uint256 resultIndex = 0;
        
        for (uint256 i = _startIndex + 1; i <= endIndex; i++) {
            if (assets[i].isVerified) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev 获取资产总数
     * @return 资产总数
     */
    function getTotalAssets() public view returns (uint256) {
        return _tokenIds.current();
    }
    
    /**
     * @dev 检查资产是否存在
     * @param _tokenId 代币ID
     * @return 是否存在
     */
    function assetExists(uint256 _tokenId) public view returns (bool) {
        return _exists(_tokenId);
    }
}
