// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CultureBridgeIdentity.sol";
import "./CultureBridgeAsset.sol";

/**
 * @title CultureBridgeExchange
 * @dev 管理文化交流活动和互动的智能合约
 */
contract CultureBridgeExchange is Ownable {
    uint256 private _exchangeIdCounter;
    
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
        string category;
        string[] tags;
    }
    
    // 交流ID到交流详情的映射
    mapping(uint256 => CulturalExchange) private exchanges;
    
    // 类别到交流ID列表的映射
    mapping(string => uint256[]) private categoryToExchanges;
    
    // 标签到交流ID列表的映射
    mapping(string => uint256[]) private tagToExchanges;
    
    // 用户地址到参与的交流ID列表的映射
    mapping(address => uint256[]) private userToExchanges;
    
    event ExchangeCreated(uint256 indexed exchangeId, address indexed organizer, string title);
    event ParticipantJoined(uint256 indexed exchangeId, address indexed participant);
    event AssetAddedToExchange(uint256 indexed exchangeId, uint256 indexed assetId);
    event ExchangeStatusChanged(uint256 indexed exchangeId, bool isActive);
    event ExchangeUpdated(uint256 indexed exchangeId);
    
    /**
     * @dev 构造函数
     * @param initialOwner 初始所有者地址
     * @param _identityContractAddress 身份合约地址
     * @param _assetContractAddress 资产合约地址
     */
    constructor(
        address initialOwner,
        address _identityContractAddress, 
        address _assetContractAddress
    ) Ownable(initialOwner) {
        identityContract = CultureBridgeIdentity(_identityContractAddress);
        assetContract = CultureBridgeAsset(_assetContractAddress);
    }
    
    /**
     * @dev 创建新的文化交流
     * @param _title 标题
     * @param _description 描述
     * @param _startTime 开始时间
     * @param _endTime 结束时间
     * @param _category 类别
     * @param _tags 标签数组
     * @return 新交流的ID
     */
    function createExchange(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        string memory _category,
        string[] memory _tags
    ) public returns (uint256) {
        // 检查用户是否已注册并验证
        (uint256 userId,,,,bool isVerified) = identityContract.getUserInfo(msg.sender);
        require(userId != 0, "User not registered");
        require(isVerified, "User must be verified to create exchanges");
        
        require(_startTime >= block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        
        _exchangeIdCounter++;
        uint256 newExchangeId = _exchangeIdCounter;
        
        exchanges[newExchangeId].id = newExchangeId;
        exchanges[newExchangeId].title = _title;
        exchanges[newExchangeId].description = _description;
        exchanges[newExchangeId].organizer = msg.sender;
        exchanges[newExchangeId].startTime = _startTime;
        exchanges[newExchangeId].endTime = _endTime;
        exchanges[newExchangeId].isActive = true;
        exchanges[newExchangeId].category = _category;
        exchanges[newExchangeId].tags = _tags;
        
        // 添加组织者作为第一个参与者
        exchanges[newExchangeId].participants.push(msg.sender);
        
        // 更新索引映射
        categoryToExchanges[_category].push(newExchangeId);
        for (uint256 i = 0; i < _tags.length; i++) {
            tagToExchanges[_tags[i]].push(newExchangeId);
        }
        userToExchanges[msg.sender].push(newExchangeId);
        
        emit ExchangeCreated(newExchangeId, msg.sender, _title);
        
        return newExchangeId;
    }
    
    /**
     * @dev 加入文化交流
     * @param _exchangeId 交流ID
     */
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
        userToExchanges[msg.sender].push(_exchangeId);
        
        emit ParticipantJoined(_exchangeId, msg.sender);
    }
    
    /**
     * @dev 向交流添加资产
     * @param _exchangeId 交流ID
     * @param _assetId 资产ID
     */
    function addAssetToExchange(uint256 _exchangeId, uint256 _assetId) public {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        require(exchanges[_exchangeId].isActive, "Exchange is not active");
        
        // 检查资产是否存在
        require(assetContract.assetExists(_assetId), "Asset does not exist");
        
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
        
        // 检查资产是否已经添加到交流中
        bool assetAlreadyAdded = false;
        for (uint256 i = 0; i < exchanges[_exchangeId].involvedAssets.length; i++) {
            if (exchanges[_exchangeId].involvedAssets[i] == _assetId) {
                assetAlreadyAdded = true;
                break;
            }
        }
        require(!assetAlreadyAdded, "Asset already added to exchange");
        
        exchanges[_exchangeId].involvedAssets.push(_assetId);
        
        emit AssetAddedToExchange(_exchangeId, _assetId);
    }
    
    /**
     * @dev 设置交流状态
     * @param _exchangeId 交流ID
     * @param _isActive 是否活跃
     */
    function setExchangeStatus(uint256 _exchangeId, bool _isActive) public {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        require(exchanges[_exchangeId].organizer == msg.sender || owner() == msg.sender, "Only organizer or owner can change status");
        
        exchanges[_exchangeId].isActive = _isActive;
        
        emit ExchangeStatusChanged(_exchangeId, _isActive);
    }
    
    /**
     * @dev 更新交流信息
     * @param _exchangeId 交流ID
     * @param _title 新标题
     * @param _description 新描述
     * @param _startTime 新开始时间
     * @param _endTime 新结束时间
     * @param _category 新类别
     * @param _tags 新标签数组
     */
    function updateExchange(
        uint256 _exchangeId,
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        string memory _category,
        string[] memory _tags
    ) public {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        require(exchanges[_exchangeId].organizer == msg.sender || owner() == msg.sender, "Only organizer or owner can update exchange");
        
        if (_startTime > 0) {
            require(_startTime >= block.timestamp, "Start time must be in the future");
            exchanges[_exchangeId].startTime = _startTime;
        }
        
        if (_endTime > 0) {
            require(_endTime > exchanges[_exchangeId].startTime, "End time must be after start time");
            exchanges[_exchangeId].endTime = _endTime;
        }
        
        if (bytes(_title).length > 0) {
            exchanges[_exchangeId].title = _title;
        }
        
        if (bytes(_description).length > 0) {
            exchanges[_exchangeId].description = _description;
        }
        
        if (bytes(_category).length > 0 && keccak256(bytes(_category)) != keccak256(bytes(exchanges[_exchangeId].category))) {
            // 从旧类别中移除
            uint256[] storage oldCategoryExchanges = categoryToExchanges[exchanges[_exchangeId].category];
            for (uint256 i = 0; i < oldCategoryExchanges.length; i++) {
                if (oldCategoryExchanges[i] == _exchangeId) {
                    oldCategoryExchanges[i] = oldCategoryExchanges[oldCategoryExchanges.length - 1];
                    oldCategoryExchanges.pop();
                    break;
                }
            }
            
            // 添加到新类别
            exchanges[_exchangeId].category = _category;
            categoryToExchanges[_category].push(_exchangeId);
        }
        
        if (_tags.length > 0) {
            // 清除旧标签
            for (uint256 i = 0; i < exchanges[_exchangeId].tags.length; i++) {
                string memory oldTag = exchanges[_exchangeId].tags[i];
                uint256[] storage oldTagExchanges = tagToExchanges[oldTag];
                for (uint256 j = 0; j < oldTagExchanges.length; j++) {
                    if (oldTagExchanges[j] == _exchangeId) {
                        oldTagExchanges[j] = oldTagExchanges[oldTagExchanges.length - 1];
                        oldTagExchanges.pop();
                        break;
                    }
                }
            }
            
            // 添加新标签
            exchanges[_exchangeId].tags = _tags;
            for (uint256 i = 0; i < _tags.length; i++) {
                tagToExchanges[_tags[i]].push(_exchangeId);
            }
        }
        
        emit ExchangeUpdated(_exchangeId);
    }
    
    /**
     * @dev 获取交流信息
     * @param _exchangeId 交流ID
     * @return id 交流ID
     * @return title 标题
     * @return description 描述
     * @return organizer 组织者地址
     * @return startTime 开始时间
     * @return endTime 结束时间
     * @return isActive 是否活跃
     * @return participantCount 参与者数量
     * @return assetCount 资产数量
     * @return category 类别
     */
    function getExchangeInfo(uint256 _exchangeId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        address organizer,
        uint256 startTime,
        uint256 endTime,
        bool isActive,
        uint256 participantCount,
        uint256 assetCount,
        string memory category
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
            exchange.involvedAssets.length,
            exchange.category
        );
    }
    
    /**
     * @dev 获取交流标签
     * @param _exchangeId 交流ID
     * @return 标签数组
     */
    function getExchangeTags(uint256 _exchangeId) public view returns (string[] memory) {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        return exchanges[_exchangeId].tags;
    }
    
    /**
     * @dev 获取交流参与者
     * @param _exchangeId 交流ID
     * @return 参与者地址数组
     */
    function getExchangeParticipants(uint256 _exchangeId) public view returns (address[] memory) {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        return exchanges[_exchangeId].participants;
    }
    
    /**
     * @dev 获取交流资产
     * @param _exchangeId 交流ID
     * @return 资产ID数组
     */
    function getExchangeAssets(uint256 _exchangeId) public view returns (uint256[] memory) {
        require(exchanges[_exchangeId].id != 0, "Exchange does not exist");
        return exchanges[_exchangeId].involvedAssets;
    }
    
    /**
     * @dev 获取活跃的交流
     * @return 交流ID数组
     */
    function getActiveExchanges() public view returns (uint256[] memory) {
        uint256 totalExchanges = _exchangeIdCounter;
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
    
    /**
     * @dev 获取指定类别的交流
     * @param _category 类别
     * @return 交流ID数组
     */
    function getExchangesByCategory(string memory _category) public view returns (uint256[] memory) {
        return categoryToExchanges[_category];
    }
    
    /**
     * @dev 获取包含指定标签的交流
     * @param _tag 标签
     * @return 交流ID数组
     */
    function getExchangesByTag(string memory _tag) public view returns (uint256[] memory) {
        return tagToExchanges[_tag];
    }
    
    /**
     * @dev 获取用户参与的交流
     * @param _user 用户地址
     * @return 交流ID数组
     */
    function getExchangesByUser(address _user) public view returns (uint256[] memory) {
        return userToExchanges[_user];
    }
    
    /**
     * @dev 获取交流总数
     * @return 交流总数
     */
    function getTotalExchanges() public view returns (uint256) {
        return _exchangeIdCounter;
    }
}
