// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title CultureBridgeStaking
 * @dev CultureBridge质押合约，用于代币质押和奖励分配
 */
contract CultureBridgeStaking is AccessControl, ReentrancyGuard {
    using SafeMath for uint256;
    
    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    
    // 代币合约
    IERC20 public cbtToken;
    
    // 质押信息
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastRewardTime;
        uint256 accumulatedRewards;
    }
    
    // 用户质押信息
    mapping(address => StakeInfo) public stakes;
    
    // 总质押量
    uint256 public totalStaked;
    
    // 奖励参数
    uint256 public rewardRate = 5; // 基础年化奖励率，单位为千分之一（0.5%）
    uint256 public rewardInterval = 1 days; // 奖励计算间隔
    
    // 锁定期选项（以秒为单位）
    uint256[] public lockPeriods = [0, 30 days, 90 days, 180 days, 365 days];
    
    // 锁定期对应的奖励倍数（基础值为1000，表示1倍）
    uint256[] public lockMultipliers = [1000, 1200, 1500, 2000, 3000];
    
    // 用户锁定信息
    mapping(address => uint256) public userLockPeriod; // 用户选择的锁定期（索引）
    mapping(address => uint256) public userLockEndTime; // 用户锁定结束时间
    
    // 事件
    event Staked(address indexed user, uint256 amount, uint256 lockPeriodIndex);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);
    event LockPeriodSelected(address indexed user, uint256 periodIndex, uint256 endTime);
    
    /**
     * @dev 构造函数
     * @param _cbtToken CBT代币合约地址
     */
    constructor(address _cbtToken) {
        require(_cbtToken != address(0), "CultureBridgeStaking: token is zero address");
        
        cbtToken = IERC20(_cbtToken);
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(REWARD_DISTRIBUTOR_ROLE, msg.sender);
    }
    
    /**
     * @dev 质押代币
     * @param amount 质押数量
     * @param lockPeriodIndex 锁定期选项索引
     */
    function stake(uint256 amount, uint256 lockPeriodIndex) external nonReentrant {
        require(amount > 0, "CultureBridgeStaking: cannot stake 0");
        require(lockPeriodIndex < lockPeriods.length, "CultureBridgeStaking: invalid lock period");
        
        // 先计算并支付之前的奖励
        _updateReward(msg.sender);
        
        // 转移代币到合约
        require(cbtToken.transferFrom(msg.sender, address(this), amount), "CultureBridgeStaking: transfer failed");
        
        // 更新质押信息
        stakes[msg.sender].amount = stakes[msg.sender].amount.add(amount);
        totalStaked = totalStaked.add(amount);
        
        // 设置锁定期
        userLockPeriod[msg.sender] = lockPeriodIndex;
        if (lockPeriods[lockPeriodIndex] > 0) {
            userLockEndTime[msg.sender] = block.timestamp.add(lockPeriods[lockPeriodIndex]);
        } else {
            userLockEndTime[msg.sender] = 0; // 无锁定期
        }
        
        emit Staked(msg.sender, amount, lockPeriodIndex);
        emit LockPeriodSelected(msg.sender, lockPeriodIndex, userLockEndTime[msg.sender]);
    }
    
    /**
     * @dev 取消质押代币
     * @param amount 取消质押数量
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "CultureBridgeStaking: cannot unstake 0");
        require(stakes[msg.sender].amount >= amount, "CultureBridgeStaking: unstake amount exceeds balance");
        
        // 检查锁定期
        if (userLockEndTime[msg.sender] > 0) {
            require(block.timestamp >= userLockEndTime[msg.sender], "CultureBridgeStaking: tokens are still locked");
        }
        
        // 先计算并支付奖励
        _updateReward(msg.sender);
        
        // 更新质押信息
        stakes[msg.sender].amount = stakes[msg.sender].amount.sub(amount);
        totalStaked = totalStaked.sub(amount);
        
        // 如果全部取消质押，重置锁定信息
        if (stakes[msg.sender].amount == 0) {
            userLockPeriod[msg.sender] = 0;
            userLockEndTime[msg.sender] = 0;
        }
        
        // 转移代币回用户
        require(cbtToken.transfer(msg.sender, amount), "CultureBridgeStaking: transfer failed");
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev 领取奖励
     */
    function claimReward() external nonReentrant {
        _updateReward(msg.sender);
        uint256 reward = stakes[msg.sender].accumulatedRewards;
        
        if (reward > 0) {
            stakes[msg.sender].accumulatedRewards = 0;
            require(cbtToken.transfer(msg.sender, reward), "CultureBridgeStaking: reward transfer failed");
            emit RewardPaid(msg.sender, reward);
        }
    }
    
    /**
     * @dev 更新奖励率
     * @param newRate 新的奖励率（千分之一为单位）
     */
    function updateRewardRate(uint256 newRate) external onlyRole(ADMIN_ROLE) {
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }
    
    /**
     * @dev 更新锁定期选项
     * @param newPeriods 新的锁定期数组（以秒为单位）
     * @param newMultipliers 新的奖励倍数数组
     */
    function updateLockPeriods(
        uint256[] calldata newPeriods, 
        uint256[] calldata newMultipliers
    ) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newPeriods.length == newMultipliers.length, "CultureBridgeStaking: arrays length mismatch");
        require(newPeriods.length > 0, "CultureBridgeStaking: empty arrays");
        
        lockPeriods = newPeriods;
        lockMultipliers = newMultipliers;
    }
    
    /**
     * @dev 计算用户当前奖励
     * @param user 用户地址
     * @return 累计奖励数量
     */
    function calculateReward(address user) public view returns (uint256) {
        if (stakes[user].amount == 0) {
            return stakes[user].accumulatedRewards;
        }
        
        uint256 timeElapsed = block.timestamp.sub(stakes[user].lastRewardTime);
        if (timeElapsed == 0) {
            return stakes[user].accumulatedRewards;
        }
        
        // 获取用户的锁定倍数
        uint256 multiplier = lockMultipliers[userLockPeriod[user]];
        
        // 计算奖励：质押金额 * 奖励率 * 时间 * 锁定倍数 / (365天 * 24小时 * 3600秒 * 1000)
        uint256 reward = stakes[user].amount
            .mul(rewardRate)
            .mul(timeElapsed)
            .mul(multiplier)
            .div(365 days)
            .div(1000)
            .div(1000);
            
        return stakes[user].accumulatedRewards.add(reward);
    }
    
    /**
     * @dev 获取用户质押信息
     * @param user 用户地址
     * @return 质押金额、开始时间、最后奖励时间、累计奖励、锁定期索引、锁定结束时间
     */
    function getUserStakeInfo(address user) 
        external 
        view 
        returns (
            uint256 amount,
            uint256 startTime,
            uint256 lastRewardTime,
            uint256 accumulatedRewards,
            uint256 lockPeriodIndex,
            uint256 lockEndTime
        ) 
    {
        StakeInfo memory info = stakes[user];
        return (
            info.amount,
            info.startTime,
            info.lastRewardTime,
            calculateReward(user),
            userLockPeriod[user],
            userLockEndTime[user]
        );
    }
    
    /**
     * @dev 内部函数：更新用户奖励
     * @param user 用户地址
     */
    function _updateReward(address user) internal {
        // 如果是首次质押，设置初始时间
        if (stakes[user].startTime == 0) {
            stakes[user].startTime = block.timestamp;
            stakes[user].lastRewardTime = block.timestamp;
            return;
        }
        
        // 计算并更新累计奖励
        stakes[user].accumulatedRewards = calculateReward(user);
        stakes[user].lastRewardTime = block.timestamp;
    }
}
