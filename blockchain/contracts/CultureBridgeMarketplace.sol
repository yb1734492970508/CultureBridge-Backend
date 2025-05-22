// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CultureBridgeAsset.sol";
import "./CultureBridgeToken.sol";
import "./CultureBridgeIdentity.sol";

/**
 * @title CultureBridgeMarketplace
 * @dev 文化资产交易市场合约
 */
contract CultureBridgeMarketplace {
    CultureBridgeAsset private assetContract;
    CultureBridgeToken private tokenContract;
    CultureBridgeIdentity private identityContract;
    
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
        uint256 listedAt;
        string description;
    }
    
    // 资产ID到挂单信息的映射
    mapping(uint256 => Listing) private listings;
    
    // 卖家地址到其挂单资产ID的映射
    mapping(address => uint256[]) private sellerListings;
    
    // 交易历史记录
    struct Transaction {
        uint256 tokenId;
        address seller;
        address buyer;
        uint256 price;
        uint256 timestamp;
    }
    
    Transaction[] private transactions;
    
    // 事件
    event AssetListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event AssetSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event PriceChanged(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
    
    /**
     * @dev 构造函数
     * @param _assetContractAddress 资产合约地址
     * @param _tokenContractAddress 代币合约地址
     * @param _identityContractAddress 身份合约地址
     */
    constructor(
        address _assetContractAddress,
        address _tokenContractAddress,
        address _identityContractAddress
    ) {
        assetContract = CultureBridgeAsset(_assetContractAddress);
        tokenContract = CultureBridgeToken(_tokenContractAddress);
        identityContract = CultureBridgeIdentity(_identityContractAddress);
    }
    
    /**
     * @dev 挂单出售资产
     * @param _tokenId 资产ID
     * @param _price 价格
     * @param _description 描述
     */
    function listAsset(uint256 _tokenId, uint256 _price, string memory _description) public {
        // 检查用户是否已注册并验证
        (uint256 userId,,,,bool isVerified) = identityContract.getUserInfo(msg.sender);
        require(userId != 0, "User not registered");
        require(isVerified, "User must be verified to list assets");
        
        // 检查资产是否存在
        require(assetContract.assetExists(_tokenId), "Asset does not exist");
        
        // 检查卖家是否是资产的所有者
        require(assetContract.ownerOf(_tokenId) == msg.sender, "Only asset owner can list asset");
        
        // 检查资产是否已经挂单
        require(!listings[_tokenId].isActive, "Asset already listed");
        
        // 检查价格是否大于0
        require(_price > 0, "Price must be greater than 0");
        
        // 创建挂单
        listings[_tokenId] = Listing({
            tokenId: _tokenId,
            seller: msg.sender,
            price: _price,
            isActive: true,
            listedAt: block.timestamp,
            description: _description
        });
        
        // 更新卖家挂单列表
        sellerListings[msg.sender].push(_tokenId);
        
        // 授权市场合约转移资产
        assetContract.approve(address(this), _tokenId);
        
        emit AssetListed(_tokenId, msg.sender, _price);
    }
    
    /**
     * @dev 取消挂单
     * @param _tokenId 资产ID
     */
    function cancelListing(uint256 _tokenId) public {
        // 检查挂单是否存在且活跃
        require(listings[_tokenId].isActive, "Listing not active");
        
        // 检查调用者是否是卖家
        require(listings[_tokenId].seller == msg.sender, "Only seller can cancel listing");
        
        // 取消挂单
        listings[_tokenId].isActive = false;
        
        // 取消授权
        assetContract.approve(address(0), _tokenId);
        
        emit ListingCancelled(_tokenId, msg.sender);
    }
    
    /**
     * @dev 购买资产
     * @param _tokenId 资产ID
     */
    function buyAsset(uint256 _tokenId) public {
        // 检查用户是否已注册
        (uint256 userId,,,,) = identityContract.getUserInfo(msg.sender);
        require(userId != 0, "User not registered");
        
        // 检查挂单是否存在且活跃
        require(listings[_tokenId].isActive, "Listing not active");
        
        // 获取挂单信息
        Listing storage listing = listings[_tokenId];
        
        // 检查买家不是卖家
        require(msg.sender != listing.seller, "Seller cannot buy own asset");
        
        // 检查买家是否有足够的代币
        require(tokenContract.balanceOf(msg.sender) >= listing.price, "Insufficient token balance");
        
        // 转移代币
        tokenContract.transferFrom(msg.sender, listing.seller, listing.price);
        
        // 转移资产
        assetContract.transferFrom(listing.seller, msg.sender, _tokenId);
        
        // 记录交易
        transactions.push(Transaction({
            tokenId: _tokenId,
            seller: listing.seller,
            buyer: msg.sender,
            price: listing.price,
            timestamp: block.timestamp
        }));
        
        // 取消挂单
        listing.isActive = false;
        
        emit AssetSold(_tokenId, listing.seller, msg.sender, listing.price);
    }
    
    /**
     * @dev 更改挂单价格
     * @param _tokenId 资产ID
     * @param _newPrice 新价格
     */
    function changePrice(uint256 _tokenId, uint256 _newPrice) public {
        // 检查挂单是否存在且活跃
        require(listings[_tokenId].isActive, "Listing not active");
        
        // 检查调用者是否是卖家
        require(listings[_tokenId].seller == msg.sender, "Only seller can change price");
        
        // 检查新价格是否大于0
        require(_newPrice > 0, "Price must be greater than 0");
        
        // 记录旧价格
        uint256 oldPrice = listings[_tokenId].price;
        
        // 更新价格
        listings[_tokenId].price = _newPrice;
        
        emit PriceChanged(_tokenId, oldPrice, _newPrice);
    }
    
    /**
     * @dev 获取挂单信息
     * @param _tokenId 资产ID
     * @return tokenId 资产ID
     * @return seller 卖家地址
     * @return price 价格
     * @return isActive 是否活跃
     * @return listedAt 挂单时间
     * @return description 描述
     */
    function getListing(uint256 _tokenId) public view returns (
        uint256 tokenId,
        address seller,
        uint256 price,
        bool isActive,
        uint256 listedAt,
        string memory description
    ) {
        Listing storage listing = listings[_tokenId];
        return (
            listing.tokenId,
            listing.seller,
            listing.price,
            listing.isActive,
            listing.listedAt,
            listing.description
        );
    }
    
    /**
     * @dev 获取卖家的所有挂单
     * @param _seller 卖家地址
     * @return 资产ID数组
     */
    function getSellerListings(address _seller) public view returns (uint256[] memory) {
        return sellerListings[_seller];
    }
    
    /**
     * @dev 获取所有活跃挂单
     * @param _start 起始索引
     * @param _limit 限制数量
     * @return tokenIds 资产ID数组
     * @return sellers 卖家地址数组
     * @return prices 价格数组
     */
    function getActiveListings(uint256 _start, uint256 _limit) public view returns (
        uint256[] memory tokenIds,
        address[] memory sellers,
        uint256[] memory prices
    ) {
        // 计算活跃挂单数量
        uint256 activeCount = 0;
        for (uint256 i = 0; i < assetContract.getTotalAssets(); i++) {
            if (listings[i + 1].isActive) {
                activeCount++;
            }
        }
        
        // 调整限制
        if (_start >= activeCount) {
            return (new uint256[](0), new address[](0), new uint256[](0));
        }
        
        uint256 end = _start + _limit;
        if (end > activeCount) {
            end = activeCount;
        }
        
        uint256 resultSize = end - _start;
        tokenIds = new uint256[](resultSize);
        sellers = new address[](resultSize);
        prices = new uint256[](resultSize);
        
        uint256 resultIndex = 0;
        uint256 activeIndex = 0;
        
        for (uint256 i = 0; i < assetContract.getTotalAssets() && resultIndex < resultSize; i++) {
            if (listings[i + 1].isActive) {
                if (activeIndex >= _start && activeIndex < end) {
                    tokenIds[resultIndex] = i + 1;
                    sellers[resultIndex] = listings[i + 1].seller;
                    prices[resultIndex] = listings[i + 1].price;
                    resultIndex++;
                }
                activeIndex++;
            }
        }
        
        return (tokenIds, sellers, prices);
    }
    
    /**
     * @dev 获取交易历史
     * @param _start 起始索引
     * @param _limit 限制数量
     * @return tokenIds 资产ID数组
     * @return sellers 卖家地址数组
     * @return buyers 买家地址数组
     * @return prices 价格数组
     * @return timestamps 时间戳数组
     */
    function getTransactionHistory(uint256 _start, uint256 _limit) public view returns (
        uint256[] memory tokenIds,
        address[] memory sellers,
        address[] memory buyers,
        uint256[] memory prices,
        uint256[] memory timestamps
    ) {
        uint256 txCount = transactions.length;
        
        // 调整限制
        if (_start >= txCount) {
            return (new uint256[](0), new address[](0), new address[](0), new uint256[](0), new uint256[](0));
        }
        
        uint256 end = _start + _limit;
        if (end > txCount) {
            end = txCount;
        }
        
        uint256 resultSize = end - _start;
        tokenIds = new uint256[](resultSize);
        sellers = new address[](resultSize);
        buyers = new address[](resultSize);
        prices = new uint256[](resultSize);
        timestamps = new uint256[](resultSize);
        
        for (uint256 i = 0; i < resultSize; i++) {
            uint256 index = txCount - 1 - (_start + i); // 倒序，最新的交易在前
            Transaction storage tx = transactions[index];
            tokenIds[i] = tx.tokenId;
            sellers[i] = tx.seller;
            buyers[i] = tx.buyer;
            prices[i] = tx.price;
            timestamps[i] = tx.timestamp;
        }
        
        return (tokenIds, sellers, buyers, prices, timestamps);
    }
    
    /**
     * @dev 获取用户的交易历史
     * @param _user 用户地址
     * @param _start 起始索引
     * @param _limit 限制数量
     * @return tokenIds 资产ID数组
     * @return counterparties 交易对手地址数组
     * @return prices 价格数组
     * @return timestamps 时间戳数组
     * @return isBuyer 是否为买家的布尔数组
     */
    function getUserTransactionHistory(address _user, uint256 _start, uint256 _limit) public view returns (
        uint256[] memory tokenIds,
        address[] memory counterparties,
        uint256[] memory prices,
        uint256[] memory timestamps,
        bool[] memory isBuyer
    ) {
        // 计算用户相关的交易数量
        uint256 userTxCount = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (transactions[i].seller == _user || transactions[i].buyer == _user) {
                userTxCount++;
            }
        }
        
        // 调整限制
        if (_start >= userTxCount) {
            return (new uint256[](0), new address[](0), new uint256[](0), new uint256[](0), new bool[](0));
        }
        
        uint256 end = _start + _limit;
        if (end > userTxCount) {
            end = userTxCount;
        }
        
        uint256 resultSize = end - _start;
        tokenIds = new uint256[](resultSize);
        counterparties = new address[](resultSize);
        prices = new uint256[](resultSize);
        timestamps = new uint256[](resultSize);
        isBuyer = new bool[](resultSize);
        
        uint256 resultIndex = 0;
        uint256 userTxIndex = 0;
        
        for (uint256 i = transactions.length; i > 0 && resultIndex < resultSize; i--) {
            Transaction storage tx = transactions[i - 1];
            if (tx.seller == _user || tx.buyer == _user) {
                if (userTxIndex >= _start && userTxIndex < end) {
                    tokenIds[resultIndex] = tx.tokenId;
                    prices[resultIndex] = tx.price;
                    timestamps[resultIndex] = tx.timestamp;
                    
                    if (tx.buyer == _user) {
                        counterparties[resultIndex] = tx.seller;
                        isBuyer[resultIndex] = true;
                    } else {
                        counterparties[resultIndex] = tx.buyer;
                        isBuyer[resultIndex] = false;
                    }
                    
                    resultIndex++;
                }
                userTxIndex++;
            }
        }
        
        return (tokenIds, counterparties, prices, timestamps, isBuyer);
    }
    
    /**
     * @dev 获取交易总数
     * @return 交易总数
     */
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }
    
    /**
     * @dev 获取活跃挂单数量
     * @return 活跃挂单数量
     */
    function getActiveListingCount() public view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < assetContract.getTotalAssets(); i++) {
            if (listings[i + 1].isActive) {
                activeCount++;
            }
        }
        return activeCount;
    }
}
