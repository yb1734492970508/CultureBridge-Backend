// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CultureBridgeIdentity.sol";

/**
 * @title CultureBridgeToken
 * @dev 管理平台代币和跨文化交易的智能合约
 */
contract CultureBridgeToken is ERC20, Ownable {
    CultureBridgeIdentity private identityContract;
    
    struct Transaction {
        uint256 id;
        address from;
        address to;
        uint256 amount;
        string purpose;
        uint256 timestamp;
        string category;
        string[] tags;
    }
    
    // 交易ID到交易详情的映射
    mapping(uint256 => Transaction) private transactions;
    uint256 private transactionCount;
    
    // 用户地址到交易ID列表的映射
    mapping(address => uint256[]) private userToTransactions;
    
    // 交易类别到交易ID列表的映射
    mapping(string => uint256[]) private categoryToTransactions;
    
    // 交易标签到交易ID列表的映射
    mapping(string => uint256[]) private tagToTransactions;
    
    // 用户地址到奖励历史的映射
    struct RewardHistory {
        uint256 timestamp;
        uint256 amount;
        string reason;
    }
    mapping(address => RewardHistory[]) private rewardHistories;
    
    // 通胀控制参数
    uint256 public maxSupply = 1000000000 * 10**decimals(); // 10亿代币上限
    uint256 public initialSupply = 100000000 * 10**decimals(); // 1亿初始供应量
    uint256 public annualInflationRate = 5; // 5%年通胀率
    uint256 public lastInflationUpdate;
    
    event CulturalTransaction(uint256 indexed id, address indexed from, address indexed to, uint256 amount, string purpose);
    event TokensAwarded(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount);
    event InflationApplied(uint256 amount, uint256 timestamp);
    
    /**
     * @dev 构造函数
     * @param _identityContractAddress 身份合约地址
     */
    constructor(address _identityContractAddress) ERC20("CultureBridge Token", "CBT") {
        identityContract = CultureBridgeIdentity(_identityContractAddress);
        
        // 初始铸造代币给合约所有者
        _mint(msg.sender, initialSupply);
        lastInflationUpdate = block.timestamp;
    }
    
    /**
     * @dev 奖励代币给用户
     * @param _to 接收者地址
     * @param _amount 代币数量
     * @param _reason 奖励原因
     */
    function awardTokens(address _to, uint256 _amount, string memory _reason) public onlyOwner {
        // 检查用户是否已注册
        (uint256 userId,,,,) = identityContract.getUserInfo(_to);
        require(userId != 0, "User not registered");
        
        // 检查总供应量不超过上限
        require(totalSupply() + _amount <= maxSupply, "Exceeds max supply");
        
        _mint(_to, _amount);
        
        // 记录奖励历史
        rewardHistories[_to].push(RewardHistory({
            timestamp: block.timestamp,
            amount: _amount,
            reason: _reason
        }));
        
        emit TokensAwarded(_to, _amount, _reason);
    }
    
    /**
     * @dev 带有目的的代币转账
     * @param _to 接收者地址
     * @param _amount 代币数量
     * @param _purpose 转账目的
     * @param _category 交易类别
     * @param _tags 交易标签数组
     * @return 交易ID
     */
    function transferWithPurpose(
        address _to,
        uint256 _amount,
        string memory _purpose,
        string memory _category,
        string[] memory _tags
    ) public returns (uint256) {
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
            timestamp: block.timestamp,
            category: _category,
            tags: _tags
        });
        
        // 更新索引映射
        userToTransactions[msg.sender].push(transactionCount);
        userToTransactions[_to].push(transactionCount);
        categoryToTransactions[_category].push(transactionCount);
        for (uint256 i = 0; i < _tags.length; i++) {
            tagToTransactions[_tags[i]].push(transactionCount);
        }
        
        emit CulturalTransaction(transactionCount, msg.sender, _to, _amount, _purpose);
        
        return transactionCount;
    }
    
    /**
     * @dev 批量转账代币
     * @param _recipients 接收者地址数组
     * @param _amounts 代币数量数组
     * @param _purpose 转账目的
     * @param _category 交易类别
     * @param _tags 交易标签数组
     * @return 交易ID数组
     */
    function batchTransfer(
        address[] memory _recipients,
        uint256[] memory _amounts,
        string memory _purpose,
        string memory _category,
        string[] memory _tags
    ) public returns (uint256[] memory) {
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        
        uint256[] memory txIds = new uint256[](_recipients.length);
        
        for (uint256 i = 0; i < _recipients.length; i++) {
            txIds[i] = transferWithPurpose(_recipients[i], _amounts[i], _purpose, _category, _tags);
        }
        
        return txIds;
    }
    
    /**
     * @dev 燃烧代币
     * @param _amount 代币数量
     */
    function burn(uint256 _amount) public {
        _burn(msg.sender, _amount);
        emit TokensBurned(msg.sender, _amount);
    }
    
    /**
     * @dev 应用通胀
     */
    function applyInflation() public onlyOwner {
        // 确保至少过去了一年
        require(block.timestamp >= lastInflationUpdate + 365 days, "Inflation can only be applied annually");
        
        uint256 currentSupply = totalSupply();
        uint256 inflationAmount = (currentSupply * annualInflationRate) / 100;
        
        // 确保不超过最大供应量
        if (currentSupply + inflationAmount > maxSupply) {
            inflationAmount = maxSupply - currentSupply;
        }
        
        if (inflationAmount > 0) {
            _mint(owner(), inflationAmount);
            lastInflationUpdate = block.timestamp;
            emit InflationApplied(inflationAmount, block.timestamp);
        }
    }
    
    /**
     * @dev 设置年通胀率
     * @param _rate 新的通胀率
     */
    function setInflationRate(uint256 _rate) public onlyOwner {
        require(_rate <= 10, "Inflation rate cannot exceed 10%");
        annualInflationRate = _rate;
    }
    
    /**
     * @dev 获取交易信息
     * @param _id 交易ID
     * @return id 交易ID
     * @return from 发送者地址
     * @return to 接收者地址
     * @return amount 代币数量
     * @return purpose 转账目的
     * @return timestamp 时间戳
     * @return category 交易类别
     */
    function getTransaction(uint256 _id) public view returns (
        uint256 id,
        address from,
        address to,
        uint256 amount,
        string memory purpose,
        uint256 timestamp,
        string memory category
    ) {
        require(_id > 0 && _id <= transactionCount, "Transaction does not exist");
        Transaction storage txn = transactions[_id];
        return (
            txn.id,
            txn.from,
            txn.to,
            txn.amount,
            txn.purpose,
            txn.timestamp,
            txn.category
        );
    }
    
    /**
     * @dev 获取交易标签
     * @param _id 交易ID
     * @return 标签数组
     */
    function getTransactionTags(uint256 _id) public view returns (string[] memory) {
        require(_id > 0 && _id <= transactionCount, "Transaction does not exist");
        return transactions[_id].tags;
    }
    
    /**
     * @dev 获取用户的交易
     * @param _user 用户地址
     * @return 交易ID数组
     */
    function getUserTransactions(address _user) public view returns (uint256[] memory) {
        return userToTransactions[_user];
    }
    
    /**
     * @dev 获取指定类别的交易
     * @param _category 交易类别
     * @return 交易ID数组
     */
    function getTransactionsByCategory(string memory _category) public view returns (uint256[] memory) {
        return categoryToTransactions[_category];
    }
    
    /**
     * @dev 获取包含指定标签的交易
     * @param _tag 交易标签
     * @return 交易ID数组
     */
    function getTransactionsByTag(string memory _tag) public view returns (uint256[] memory) {
        return tagToTransactions[_tag];
    }
    
    /**
     * @dev 获取用户的奖励历史
     * @param _user 用户地址
     * @return timestamps 时间戳数组
     * @return amounts 代币数量数组
     * @return reasons 奖励原因数组
     */
    function getUserRewardHistory(address _user) public view returns (
        uint256[] memory timestamps,
        uint256[] memory amounts,
        string[] memory reasons
    ) {
        RewardHistory[] storage history = rewardHistories[_user];
        uint256 length = history.length;
        
        timestamps = new uint256[](length);
        amounts = new uint256[](length);
        reasons = new string[](length);
        
        for (uint256 i = 0; i < length; i++) {
            timestamps[i] = history[i].timestamp;
            amounts[i] = history[i].amount;
            reasons[i] = history[i].reason;
        }
        
        return (timestamps, amounts, reasons);
    }
    
    /**
     * @dev 获取交易总数
     * @return 交易总数
     */
    function getTotalTransactions() public view returns (uint256) {
        return transactionCount;
    }
    
    /**
     * @dev 获取下一次通胀更新时间
     * @return 下一次通胀更新时间
     */
    function getNextInflationUpdate() public view returns (uint256) {
        return lastInflationUpdate + 365 days;
    }
}
