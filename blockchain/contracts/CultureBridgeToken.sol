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
        string purpose;
        TransactionCategory category;
        string[] tags;
        uint256 timestamp;
        bool isReward;
    }

    // 用户统计结构
    struct UserStats {
        uint256 totalEarned;
        uint256 totalSpent;
        uint256 totalTransactions;
        uint256 lastActivityTime;
        mapping(TransactionCategory => uint256) categoryStats;
    }

    // 奖励配置结构
    struct RewardConfig {
        uint256 dailyLearningReward;
        uint256 contentCreationReward;
        uint256 culturalExchangeReward;
        uint256 communityContributionReward;
        uint256 referralReward;
        bool isActive;
    }

    // 状态变量
    uint256 private _transactionCounter;
    mapping(uint256 => CulturalTransaction) public transactions;
    mapping(address => uint256[]) public userTransactions;
    mapping(address => UserStats) public userStats;
    mapping(address => bool) public verifiedUsers;
    mapping(address => uint256) public lastRewardTime;
    
    RewardConfig public rewardConfig;
    uint256 public totalRewardsDistributed;
    uint256 public burnedTokens;
    
    // 每日奖励限制
    mapping(address => mapping(uint256 => uint256)) public dailyRewards; // user => day => amount
    uint256 public constant MAX_DAILY_REWARD = 100 * 10**18; // 每日最大奖励100 CBT

    // 事件定义
    event CulturalTransactionCreated(
        uint256 indexed transactionId,
        address indexed from,
        address indexed to,
        uint256 amount,
        string purpose,
        TransactionCategory category
    );
    
    event RewardDistributed(
        address indexed recipient,
        uint256 amount,
        string reason,
        TransactionCategory category
    );
    
    event UserVerified(address indexed user, uint256 timestamp);
    event RewardConfigUpdated(RewardConfig newConfig);
    event TokensBurned(address indexed burner, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 初始化合约
     */
    function initialize(address admin) public initializer {
        __ERC20_init("CultureBridge Token", "CBT");
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

        // 铸造初始供应量
        _mint(admin, INITIAL_SUPPLY);

        // 初始化奖励配置
        rewardConfig = RewardConfig({
            dailyLearningReward: 5 * 10**18,
            contentCreationReward: 10 * 10**18,
            culturalExchangeReward: 3 * 10**18,
            communityContributionReward: 2 * 10**18,
            referralReward: 5 * 10**18,
            isActive: true
        });
    }

    /**
     * @dev 带目的的代币转账
     */
    function transferWithPurpose(
        address to,
        uint256 amount,
        string memory purpose,
        TransactionCategory category,
        string[] memory tags
    ) public nonReentrant returns (uint256) {
        require(to != address(0), "CBT: transfer to zero address");
        require(amount > 0, "CBT: amount must be greater than 0");
        require(bytes(purpose).length > 0, "CBT: purpose cannot be empty");

        // 执行转账
        _transfer(_msgSender(), to, amount);

        // 记录文化交流交易
        uint256 transactionId = _createCulturalTransaction(
            _msgSender(),
            to,
            amount,
            purpose,
            category,
            tags,
            false
        );

        // 更新用户统计
        _updateUserStats(_msgSender(), amount, true, category);
        _updateUserStats(to, amount, false, category);

        return transactionId;
    }

    /**
     * @dev 分发奖励代币
     */
    function distributeReward(
        address recipient,
        uint256 amount,
        string memory reason,
        TransactionCategory category
    ) public onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant {
        require(recipient != address(0), "CBT: reward to zero address");
        require(amount > 0, "CBT: reward amount must be greater than 0");
        require(rewardConfig.isActive, "CBT: rewards are not active");

        // 检查每日奖励限制
        uint256 today = block.timestamp / 86400; // 当前天数
        require(
            dailyRewards[recipient][today] + amount <= MAX_DAILY_REWARD,
            "CBT: daily reward limit exceeded"
        );

        // 检查供应量限制
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "CBT: would exceed max supply"
        );

        // 铸造奖励代币
        _mint(recipient, amount);

        // 更新每日奖励记录
        dailyRewards[recipient][today] += amount;
        totalRewardsDistributed += amount;

        // 记录奖励交易
        uint256 transactionId = _createCulturalTransaction(
            address(0),
            recipient,
            amount,
            reason,
            category,
            new string[](0),
            true
        );

        // 更新用户统计
        _updateUserStats(recipient, amount, false, category);

        emit RewardDistributed(recipient, amount, reason, category);
    }

    /**
     * @dev 批量分发奖励
     */
    function batchDistributeRewards(
        address[] memory recipients,
        uint256[] memory amounts,
        string[] memory reasons,
        TransactionCategory category
    ) public onlyRole(REWARD_DISTRIBUTOR_ROLE) {
        require(
            recipients.length == amounts.length && amounts.length == reasons.length,
            "CBT: arrays length mismatch"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            distributeReward(recipients[i], amounts[i], reasons[i], category);
        }
    }

    /**
     * @dev 验证用户身份
     */
    function verifyUser(address user) public onlyRole(ADMIN_ROLE) {
        require(!verifiedUsers[user], "CBT: user already verified");
        verifiedUsers[user] = true;
        emit UserVerified(user, block.timestamp);
    }

    /**
     * @dev 更新奖励配置
     */
    function updateRewardConfig(RewardConfig memory newConfig) public onlyRole(ADMIN_ROLE) {
        rewardConfig = newConfig;
        emit RewardConfigUpdated(newConfig);
    }

    /**
     * @dev 获取用户交易历史
     */
    function getUserTransactions(address user) public view returns (uint256[] memory) {
        return userTransactions[user];
    }

    /**
     * @dev 获取交易详情
     */
    function getTransaction(uint256 transactionId) public view returns (CulturalTransaction memory) {
        require(transactionId <= _transactionCounter, "CBT: transaction does not exist");
        return transactions[transactionId];
    }

    /**
     * @dev 获取用户统计信息
     */
    function getUserStats(address user) public view returns (
        uint256 totalEarned,
        uint256 totalSpent,
        uint256 totalTransactions,
        uint256 lastActivityTime
    ) {
        UserStats storage stats = userStats[user];
        return (
            stats.totalEarned,
            stats.totalSpent,
            stats.totalTransactions,
            stats.lastActivityTime
        );
    }

    /**
     * @dev 获取用户分类统计
     */
    function getUserCategoryStats(address user, TransactionCategory category) public view returns (uint256) {
        return userStats[user].categoryStats[category];
    }

    /**
     * @dev 获取用户今日已获得奖励
     */
    function getTodayRewards(address user) public view returns (uint256) {
        uint256 today = block.timestamp / 86400;
        return dailyRewards[user][today];
    }

    /**
     * @dev 销毁代币并记录
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        burnedTokens += amount;
        emit TokensBurned(_msgSender(), amount);
    }

    /**
     * @dev 暂停合约
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev 创建文化交流交易记录
     */
    function _createCulturalTransaction(
        address from,
        address to,
        uint256 amount,
        string memory purpose,
        TransactionCategory category,
        string[] memory tags,
        bool isReward
    ) internal returns (uint256) {
        _transactionCounter++;
        
        transactions[_transactionCounter] = CulturalTransaction({
            id: _transactionCounter,
            from: from,
            to: to,
            amount: amount,
            purpose: purpose,
            category: category,
            tags: tags,
            timestamp: block.timestamp,
            isReward: isReward
        });

        if (from != address(0)) {
            userTransactions[from].push(_transactionCounter);
        }
        userTransactions[to].push(_transactionCounter);

        emit CulturalTransactionCreated(
            _transactionCounter,
            from,
            to,
            amount,
            purpose,
            category
        );

        return _transactionCounter;
    }

    /**
     * @dev 更新用户统计信息
     */
    function _updateUserStats(
        address user,
        uint256 amount,
        bool isSpending,
        TransactionCategory category
    ) internal {
        UserStats storage stats = userStats[user];
        
        if (isSpending) {
            stats.totalSpent += amount;
        } else {
            stats.totalEarned += amount;
        }
        
        stats.totalTransactions++;
        stats.lastActivityTime = block.timestamp;
        stats.categoryStats[category] += amount;
    }

    /**
     * @dev 重写转账前检查
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev 授权升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @dev 获取合约版本
     */
    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}

