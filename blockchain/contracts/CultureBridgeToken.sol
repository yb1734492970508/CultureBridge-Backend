// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title CultureBridgeToken (CBT)
 * @dev 文化桥梁代币 - 支持文化交流激励的ERC20代币
 * @author CultureBridge Team
 */
contract CultureBridgeToken is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    // 常量
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 10亿代币
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 1亿初始供应量
    
    // 交易类别枚举
    enum TransactionCategory {
        GENERAL,
        LEARNING_REWARD,
        CULTURAL_EXCHANGE,
        CONTENT_CREATION,
        COMMUNITY_CONTRIBUTION,
        MARKETPLACE_PURCHASE,
        GOVERNANCE_PARTICIPATION
    }

    // 文化交流交易结构
    struct CulturalTransaction {
        uint256 id;
        address from;
        address to;
        uint256 amount;
        TransactionCategory category;
        string description;
        uint256 timestamp;
        bool isReward;
    }

    // 用户统计结构
    struct UserStats {
        uint256 totalEarned;
        uint256 totalSpent;
        uint256 transactionCount;
        uint256 lastActivityTime;
        mapping(TransactionCategory => uint256) categoryEarnings;
    }

    // 状态变量
    mapping(address => UserStats) public userStats;
    mapping(uint256 => CulturalTransaction) public transactions;
    uint256 public transactionCounter;
    uint256 public totalRewardsDistributed;
    
    // 奖励配置
    mapping(TransactionCategory => uint256) public rewardRates;
    mapping(address => uint256) public dailyRewardClaimed;
    mapping(address => uint256) public lastClaimTime;
    
    // 事件定义
    event RewardDistributed(address indexed recipient, uint256 amount, TransactionCategory category, string description);
    event CulturalTransactionRecorded(uint256 indexed transactionId, address indexed from, address indexed to, uint256 amount, TransactionCategory category);
    event RewardRateUpdated(TransactionCategory category, uint256 oldRate, uint256 newRate);
    event UserStatsUpdated(address indexed user, uint256 totalEarned, uint256 totalSpent);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化合约
     */
    function initialize(
        string memory name,
        string memory symbol,
        address admin
    ) public initializer {
        __ERC20_init(name, symbol);
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        // 设置角色
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, admin);

        // 初始化奖励费率
        _initializeRewardRates();

        // 铸造初始供应量
        _mint(admin, INITIAL_SUPPLY);
    }

    /**
     * @dev 初始化奖励费率
     */
    function _initializeRewardRates() internal {
        rewardRates[TransactionCategory.LEARNING_REWARD] = 2 * 10**18; // 2 CBT
        rewardRates[TransactionCategory.CULTURAL_EXCHANGE] = 3 * 10**18; // 3 CBT
        rewardRates[TransactionCategory.CONTENT_CREATION] = 5 * 10**18; // 5 CBT
        rewardRates[TransactionCategory.COMMUNITY_CONTRIBUTION] = 1 * 10**18; // 1 CBT
        rewardRates[TransactionCategory.GOVERNANCE_PARTICIPATION] = 10 * 10**18; // 10 CBT
    }

    /**
     * @dev 分发奖励
     */
    function distributeReward(
        address recipient,
        TransactionCategory category,
        string memory description
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant {
        _distributeReward(recipient, category, description);
    }

    /**
     * @dev 批量分发奖励
     */
    function batchDistributeRewards(
        address[] memory recipients,
        TransactionCategory[] memory categories,
        string[] memory descriptions
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) {
        require(recipients.length == categories.length && categories.length == descriptions.length, "Array length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _distributeReward(recipients[i], categories[i], descriptions[i]);
        }
    }

    /**
     * @dev 内部分发奖励函数
     */
    function _distributeReward(
        address recipient,
        TransactionCategory category,
        string memory description
    ) internal {
        require(recipient != address(0), "Invalid recipient");
        
        uint256 rewardAmount = rewardRates[category];
        require(rewardAmount > 0, "Invalid reward category");
        require(totalSupply() + rewardAmount <= MAX_SUPPLY, "Exceeds max supply");

        // 铸造奖励代币
        _mint(recipient, rewardAmount);

        // 更新统计
        _updateUserStats(recipient, rewardAmount, 0, category);
        totalRewardsDistributed += rewardAmount;

        // 记录交易
        _recordTransaction(address(0), recipient, rewardAmount, category, description, true);

        emit RewardDistributed(recipient, rewardAmount, category, description);
    }

    /**
     * @dev 每日登录奖励
     */
    function claimDailyReward() external nonReentrant {
        require(block.timestamp >= lastClaimTime[msg.sender] + 1 days, "Already claimed today");
        
        uint256 dailyReward = 1 * 10**18; // 1 CBT
        require(totalSupply() + dailyReward <= MAX_SUPPLY, "Exceeds max supply");

        lastClaimTime[msg.sender] = block.timestamp;
        dailyRewardClaimed[msg.sender] += dailyReward;

        _mint(msg.sender, dailyReward);
        _updateUserStats(msg.sender, dailyReward, 0, TransactionCategory.GENERAL);
        totalRewardsDistributed += dailyReward;

        emit RewardDistributed(msg.sender, dailyReward, TransactionCategory.GENERAL, "Daily login reward");
    }

    /**
     * @dev 文化交流转账
     */
    function culturalTransfer(
        address to,
        uint256 amount,
        TransactionCategory category,
        string memory description
    ) external nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _transfer(msg.sender, to, amount);
        
        // 更新统计
        _updateUserStats(msg.sender, 0, amount, category);
        _updateUserStats(to, amount, 0, category);

        // 记录交易
        _recordTransaction(msg.sender, to, amount, category, description, false);

        emit CulturalTransactionRecorded(transactionCounter - 1, msg.sender, to, amount, category);
    }

    /**
     * @dev 更新用户统计
     */
    function _updateUserStats(
        address user,
        uint256 earned,
        uint256 spent,
        TransactionCategory category
    ) internal {
        UserStats storage stats = userStats[user];
        stats.totalEarned += earned;
        stats.totalSpent += spent;
        stats.transactionCount += 1;
        stats.lastActivityTime = block.timestamp;
        stats.categoryEarnings[category] += earned;

        emit UserStatsUpdated(user, stats.totalEarned, stats.totalSpent);
    }

    /**
     * @dev 记录交易
     */
    function _recordTransaction(
        address from,
        address to,
        uint256 amount,
        TransactionCategory category,
        string memory description,
        bool isReward
    ) internal {
        transactionCounter++;
        transactions[transactionCounter] = CulturalTransaction({
            id: transactionCounter,
            from: from,
            to: to,
            amount: amount,
            category: category,
            description: description,
            timestamp: block.timestamp,
            isReward: isReward
        });
    }

    /**
     * @dev 设置奖励费率
     */
    function setRewardRate(
        TransactionCategory category,
        uint256 newRate
    ) external onlyRole(ADMIN_ROLE) {
        uint256 oldRate = rewardRates[category];
        rewardRates[category] = newRate;
        emit RewardRateUpdated(category, oldRate, newRate);
    }

    /**
     * @dev 获取用户类别收益
     */
    function getUserCategoryEarnings(
        address user,
        TransactionCategory category
    ) external view returns (uint256) {
        return userStats[user].categoryEarnings[category];
    }

    /**
     * @dev 获取交易详情
     */
    function getTransaction(uint256 transactionId) external view returns (CulturalTransaction memory) {
        return transactions[transactionId];
    }

    /**
     * @dev 暂停合约
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev 铸造代币
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev 重写 _update 函数以支持暂停功能
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }

    /**
     * @dev 授权升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @dev 获取合约版本
     */
    function version() public pure returns (string memory) {
        return "2.0.0";
    }

    /**
     * @dev 支持接口检查
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

