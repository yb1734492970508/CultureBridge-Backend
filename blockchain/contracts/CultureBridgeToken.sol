// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CultureBridge Token (CBT)
 * @dev ERC20代币合约，用于CultureBridge平台的文化交流和语言学习激励
 */
contract CultureBridgeToken is ERC20, ERC20Burnable, Pausable, Ownable, ReentrancyGuard {
    
    // 代币基本信息
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**18; // 10亿CBT
    uint256 public constant MAX_SUPPLY = 10000000000 * 10**18; // 最大供应量100亿CBT
    
    // 交易计数器
    uint256 private _transactionCounter;
    
    // 交易结构体
    struct CulturalTransaction {
        uint256 id;
        address from;
        address to;
        uint256 amount;
        string purpose;
        string category;
        string[] tags;
        uint256 timestamp;
        bool isReward;
    }
    
    // 用户奖励历史
    struct UserReward {
        uint256 amount;
        string reason;
        string category;
        uint256 timestamp;
        uint256 transactionId;
    }
    
    // 存储所有交易
    mapping(uint256 => CulturalTransaction) public transactions;
    
    // 用户交易历史
    mapping(address => uint256[]) public userTransactions;
    
    // 用户奖励历史
    mapping(address => UserReward[]) public userRewards;
    
    // 类别统计
    mapping(string => uint256) public categoryTotals;
    
    // 每日奖励限制
    mapping(address => mapping(uint256 => uint256)) public dailyRewards;
    uint256 public constant DAILY_REWARD_LIMIT = 100 * 10**18; // 每日最多奖励100 CBT
    
    // 管理员地址
    mapping(address => bool) public administrators;
    
    // 事件定义
    event CulturalTransaction(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        uint256 amount,
        string purpose,
        string category
    );
    
    event TokensAwarded(
        address indexed recipient,
        uint256 amount,
        string reason,
        string category
    );
    
    event AdministratorAdded(address indexed admin);
    event AdministratorRemoved(address indexed admin);
    
    // 修饰符
    modifier onlyAdmin() {
        require(administrators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address");
        _;
    }
    
    constructor() ERC20("CultureBridge Token", "CBT") {
        _mint(msg.sender, INITIAL_SUPPLY);
        administrators[msg.sender] = true;
        _transactionCounter = 0;
    }
    
    /**
     * @dev 添加管理员
     */
    function addAdministrator(address _admin) external onlyOwner validAddress(_admin) {
        administrators[_admin] = true;
        emit AdministratorAdded(_admin);
    }
    
    /**
     * @dev 移除管理员
     */
    function removeAdministrator(address _admin) external onlyOwner validAddress(_admin) {
        administrators[_admin] = false;
        emit AdministratorRemoved(_admin);
    }
    
    /**
     * @dev 带目的的代币转账
     */
    function transferWithPurpose(
        address _to,
        uint256 _amount,
        string memory _purpose,
        string memory _category,
        string[] memory _tags
    ) external whenNotPaused nonReentrant validAddress(_to) returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(bytes(_purpose).length > 0, "Purpose cannot be empty");
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
        
        // 执行转账
        _transfer(msg.sender, _to, _amount);
        
        // 记录交易
        _transactionCounter++;
        uint256 transactionId = _transactionCounter;
        
        transactions[transactionId] = CulturalTransaction({
            id: transactionId,
            from: msg.sender,
            to: _to,
            amount: _amount,
            purpose: _purpose,
            category: _category,
            tags: _tags,
            timestamp: block.timestamp,
            isReward: false
        });
        
        // 更新用户交易历史
        userTransactions[msg.sender].push(transactionId);
        userTransactions[_to].push(transactionId);
        
        // 更新类别统计
        categoryTotals[_category] += _amount;
        
        emit CulturalTransaction(transactionId, msg.sender, _to, _amount, _purpose, _category);
        
        return transactionId;
    }
    
    /**
     * @dev 奖励代币给用户
     */
    function awardTokens(
        address _to,
        uint256 _amount,
        string memory _reason,
        string memory _category
    ) external onlyAdmin whenNotPaused nonReentrant validAddress(_to) {
        require(_amount > 0, "Amount must be greater than 0");
        require(bytes(_reason).length > 0, "Reason cannot be empty");
        
        // 检查每日奖励限制
        uint256 today = block.timestamp / 86400; // 获取当前日期
        require(
            dailyRewards[_to][today] + _amount <= DAILY_REWARD_LIMIT,
            "Daily reward limit exceeded"
        );
        
        // 检查最大供应量
        require(totalSupply() + _amount <= MAX_SUPPLY, "Max supply exceeded");
        
        // 铸造代币
        _mint(_to, _amount);
        
        // 更新每日奖励记录
        dailyRewards[_to][today] += _amount;
        
        // 记录交易
        _transactionCounter++;
        uint256 transactionId = _transactionCounter;
        
        transactions[transactionId] = CulturalTransaction({
            id: transactionId,
            from: address(0),
            to: _to,
            amount: _amount,
            purpose: _reason,
            category: _category,
            tags: new string[](0),
            timestamp: block.timestamp,
            isReward: true
        });
        
        // 记录用户奖励历史
        userRewards[_to].push(UserReward({
            amount: _amount,
            reason: _reason,
            category: _category,
            timestamp: block.timestamp,
            transactionId: transactionId
        }));
        
        // 更新用户交易历史
        userTransactions[_to].push(transactionId);
        
        // 更新类别统计
        categoryTotals[_category] += _amount;
        
        emit TokensAwarded(_to, _amount, _reason, _category);
        emit CulturalTransaction(transactionId, address(0), _to, _amount, _reason, _category);
    }
    
    /**
     * @dev 获取交易详情
     */
    function getTransaction(uint256 _id) external view returns (
        uint256 id,
        address from,
        address to,
        uint256 amount,
        string memory purpose,
        uint256 timestamp,
        string memory category,
        string[] memory tags,
        bool isReward
    ) {
        CulturalTransaction memory txn = transactions[_id];
        return (
            txn.id,
            txn.from,
            txn.to,
            txn.amount,
            txn.purpose,
            txn.timestamp,
            txn.category,
            txn.tags,
            txn.isReward
        );
    }
    
    /**
     * @dev 获取用户交易历史
     */
    function getUserTransactions(address _user) external view returns (uint256[] memory) {
        return userTransactions[_user];
    }
    
    /**
     * @dev 获取用户奖励历史
     */
    function getUserRewards(address _user) external view returns (UserReward[] memory) {
        return userRewards[_user];
    }
    
    /**
     * @dev 获取用户今日已获得奖励
     */
    function getTodayRewards(address _user) external view returns (uint256) {
        uint256 today = block.timestamp / 86400;
        return dailyRewards[_user][today];
    }
    
    /**
     * @dev 获取类别总量
     */
    function getCategoryTotal(string memory _category) external view returns (uint256) {
        return categoryTotals[_category];
    }
    
    /**
     * @dev 获取交易总数
     */
    function getTransactionCount() external view returns (uint256) {
        return _transactionCounter;
    }
    
    /**
     * @dev 批量奖励代币
     */
    function batchAwardTokens(
        address[] memory _recipients,
        uint256[] memory _amounts,
        string[] memory _reasons,
        string memory _category
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        require(_recipients.length == _reasons.length, "Arrays length mismatch");
        require(_recipients.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < _recipients.length; i++) {
            if (_recipients[i] != address(0) && _amounts[i] > 0) {
                // 检查每日奖励限制
                uint256 today = block.timestamp / 86400;
                if (dailyRewards[_recipients[i]][today] + _amounts[i] <= DAILY_REWARD_LIMIT) {
                    // 检查最大供应量
                    if (totalSupply() + _amounts[i] <= MAX_SUPPLY) {
                        _mint(_recipients[i], _amounts[i]);
                        dailyRewards[_recipients[i]][today] += _amounts[i];
                        
                        // 记录奖励历史
                        userRewards[_recipients[i]].push(UserReward({
                            amount: _amounts[i],
                            reason: _reasons[i],
                            category: _category,
                            timestamp: block.timestamp,
                            transactionId: _transactionCounter + 1
                        }));
                        
                        emit TokensAwarded(_recipients[i], _amounts[i], _reasons[i], _category);
                    }
                }
            }
        }
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 紧急提取BNB
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev 接收BNB
     */
    receive() external payable {}
}

