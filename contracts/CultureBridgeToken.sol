// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title CultureBridgeToken
 * @dev CultureBridge治理代币(CBT)实现，基于ERC20标准，添加治理功能
 */
contract CultureBridgeToken is ERC20Votes, AccessControl, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // 代币参数
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 1亿代币，18位小数
    
    // 代币池
    uint256 public communityGovernancePool; // 社区治理池
    uint256 public ecosystemIncentivePool;  // 生态激励池
    uint256 public teamAllocation;          // 团队分配
    uint256 public partnersAllocation;      // 合作伙伴分配
    uint256 public liquidityReserve;        // 流动性储备

    // 锁定相关
    mapping(address => uint256) public lockedAmount;
    mapping(address => uint256) public lockReleaseTime;
    
    // 质押相关
    mapping(address => uint256) public stakedAmount;
    mapping(address => uint256) public stakingStartTime;
    
    // 声誉加权
    mapping(address => uint256) public reputationScore;
    
    // 事件
    event TokensLocked(address indexed account, uint256 amount, uint256 releaseTime);
    event TokensUnlocked(address indexed account, uint256 amount);
    event TokensStaked(address indexed account, uint256 amount);
    event TokensUnstaked(address indexed account, uint256 amount);
    event ReputationUpdated(address indexed account, uint256 newScore);
    event PoolFunded(string poolName, uint256 amount);
    event RewardDistributed(address indexed recipient, uint256 amount, string reason);

    /**
     * @dev 构造函数
     */
    constructor() 
        ERC20("CultureBridge Token", "CBT") 
        ERC20Permit("CultureBridge Token") 
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(BURNER_ROLE, msg.sender);
        _setupRole(GOVERNANCE_ROLE, msg.sender);
        
        // 初始化代币池
        communityGovernancePool = 40_000_000 * 10**18; // 40%
        ecosystemIncentivePool = 30_000_000 * 10**18;  // 30%
        teamAllocation = 15_000_000 * 10**18;          // 15%
        partnersAllocation = 10_000_000 * 10**18;      // 10%
        liquidityReserve = 5_000_000 * 10**18;         // 5%
        
        // 铸造初始代币到合约地址
        _mint(address(this), MAX_SUPPLY);
        
        emit PoolFunded("Community Governance Pool", communityGovernancePool);
        emit PoolFunded("Ecosystem Incentive Pool", ecosystemIncentivePool);
        emit PoolFunded("Team Allocation", teamAllocation);
        emit PoolFunded("Partners Allocation", partnersAllocation);
        emit PoolFunded("Liquidity Reserve", liquidityReserve);
    }
    
    /**
     * @dev 暂停合约功能
     * 只有管理员可以调用
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev 恢复合约功能
     * 只有管理员可以调用
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev 从指定池中分配代币
     * @param to 接收者地址
     * @param amount 代币数量
     * @param poolName 池名称
     * @param reason 分配原因
     */
    function allocateFromPool(
        address to, 
        uint256 amount, 
        string memory poolName, 
        string memory reason
    ) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(to != address(0), "CBT: allocation to zero address");
        require(amount > 0, "CBT: allocation amount must be positive");
        
        bytes32 poolNameHash = keccak256(abi.encodePacked(poolName));
        
        if (poolNameHash == keccak256(abi.encodePacked("Community Governance Pool"))) {
            require(communityGovernancePool >= amount, "CBT: insufficient governance pool");
            communityGovernancePool = communityGovernancePool.sub(amount);
        } else if (poolNameHash == keccak256(abi.encodePacked("Ecosystem Incentive Pool"))) {
            require(ecosystemIncentivePool >= amount, "CBT: insufficient incentive pool");
            ecosystemIncentivePool = ecosystemIncentivePool.sub(amount);
        } else if (poolNameHash == keccak256(abi.encodePacked("Team Allocation"))) {
            require(teamAllocation >= amount, "CBT: insufficient team allocation");
            teamAllocation = teamAllocation.sub(amount);
        } else if (poolNameHash == keccak256(abi.encodePacked("Partners Allocation"))) {
            require(partnersAllocation >= amount, "CBT: insufficient partners allocation");
            partnersAllocation = partnersAllocation.sub(amount);
        } else if (poolNameHash == keccak256(abi.encodePacked("Liquidity Reserve"))) {
            require(liquidityReserve >= amount, "CBT: insufficient liquidity reserve");
            liquidityReserve = liquidityReserve.sub(amount);
        } else {
            revert("CBT: invalid pool name");
        }
        
        _transfer(address(this), to, amount);
        emit RewardDistributed(to, amount, reason);
    }
    
    /**
     * @dev 锁定代币
     * @param account 账户地址
     * @param amount 锁定数量
     * @param duration 锁定时长（秒）
     */
    function lockTokens(
        address account, 
        uint256 amount, 
        uint256 duration
    ) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(account != address(0), "CBT: lock to zero address");
        require(amount > 0, "CBT: lock amount must be positive");
        require(duration > 0, "CBT: lock duration must be positive");
        
        if (msg.sender != account) {
            // 如果不是自己锁定，则需要授权
            uint256 allowance = allowance(account, msg.sender);
            require(allowance >= amount, "CBT: insufficient allowance for lock");
            _spendAllowance(account, msg.sender, amount);
        }
        
        // 转移代币到合约
        _transfer(account, address(this), amount);
        
        // 更新锁定信息
        lockedAmount[account] = lockedAmount[account].add(amount);
        lockReleaseTime[account] = block.timestamp.add(duration);
        
        emit TokensLocked(account, amount, lockReleaseTime[account]);
    }
    
    /**
     * @dev 解锁代币
     */
    function unlockTokens() external whenNotPaused nonReentrant {
        require(lockedAmount[msg.sender] > 0, "CBT: no locked tokens");
        require(block.timestamp >= lockReleaseTime[msg.sender], "CBT: tokens still locked");
        
        uint256 amount = lockedAmount[msg.sender];
        lockedAmount[msg.sender] = 0;
        
        // 转移代币回用户
        _transfer(address(this), msg.sender, amount);
        
        emit TokensUnlocked(msg.sender, amount);
    }
    
    /**
     * @dev 质押代币
     * @param amount 质押数量
     */
    function stakeTokens(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "CBT: stake amount must be positive");
        require(balanceOf(msg.sender) >= amount, "CBT: insufficient balance for stake");
        
        // 转移代币到合约
        _transfer(msg.sender, address(this), amount);
        
        // 更新质押信息
        stakedAmount[msg.sender] = stakedAmount[msg.sender].add(amount);
        if (stakingStartTime[msg.sender] == 0) {
            stakingStartTime[msg.sender] = block.timestamp;
        }
        
        emit TokensStaked(msg.sender, amount);
    }
    
    /**
     * @dev 取消质押代币
     * @param amount 取消质押数量
     */
    function unstakeTokens(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "CBT: unstake amount must be positive");
        require(stakedAmount[msg.sender] >= amount, "CBT: insufficient staked amount");
        
        // 更新质押信息
        stakedAmount[msg.sender] = stakedAmount[msg.sender].sub(amount);
        
        // 转移代币回用户
        _transfer(address(this), msg.sender, amount);
        
        // 如果全部取消质押，重置开始时间
        if (stakedAmount[msg.sender] == 0) {
            stakingStartTime[msg.sender] = 0;
        }
        
        emit TokensUnstaked(msg.sender, amount);
    }
    
    /**
     * @dev 更新用户声誉分数
     * @param account 账户地址
     * @param score 新的声誉分数
     */
    function updateReputationScore(address account, uint256 score) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
    {
        reputationScore[account] = score;
        emit ReputationUpdated(account, score);
    }
    
    /**
     * @dev 计算用户的投票权重
     * @param account 账户地址
     * @return 投票权重
     */
    function getVotingPower(address account) public view returns (uint256) {
        uint256 baseVotingPower = getVotes(account);
        
        // 添加声誉加权（最高20%加成）
        uint256 reputationBonus = 0;
        if (reputationScore[account] > 0) {
            // 假设最高声誉分数为10000
            uint256 reputationMultiplier = reputationScore[account].mul(20).div(10000);
            reputationBonus = baseVotingPower.mul(reputationMultiplier).div(100);
        }
        
        // 添加质押时长加权（最高50%加成）
        uint256 stakingBonus = 0;
        if (stakedAmount[account] > 0 && stakingStartTime[account] > 0) {
            uint256 stakingDuration = block.timestamp.sub(stakingStartTime[account]);
            // 最长考虑1年质押时间
            uint256 maxDuration = 365 days;
            uint256 durationMultiplier = stakingDuration.mul(50).div(maxDuration);
            if (durationMultiplier > 50) {
                durationMultiplier = 50;
            }
            stakingBonus = baseVotingPower.mul(durationMultiplier).div(100);
        }
        
        return baseVotingPower.add(reputationBonus).add(stakingBonus);
    }
    
    /**
     * @dev 铸造新代币（仅限有MINTER_ROLE权限的地址）
     * @param to 接收者地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        require(totalSupply().add(amount) <= MAX_SUPPLY, "CBT: exceeds max supply");
        _mint(to, amount);
    }
    
    /**
     * @dev 销毁代币（仅限有BURNER_ROLE权限的地址）
     * @param amount 销毁数量
     */
    function burn(uint256 amount) 
        external 
        onlyRole(BURNER_ROLE) 
        whenNotPaused 
    {
        _burn(msg.sender, amount);
    }
    
    /**
     * @dev 从指定地址销毁代币（仅限有BURNER_ROLE权限的地址）
     * @param account 账户地址
     * @param amount 销毁数量
     */
    function burnFrom(address account, uint256 amount) 
        external 
        onlyRole(BURNER_ROLE) 
        whenNotPaused 
    {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "CBT: burn amount exceeds allowance");
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }
    
    /**
     * @dev 转移代币时检查暂停状态
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev 覆盖ERC20Votes的_afterTokenTransfer以更新投票权
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._afterTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev 覆盖ERC20Votes的_mint以更新投票权
     */
    function _mint(address to, uint256 amount) internal override {
        super._mint(to, amount);
    }
    
    /**
     * @dev 覆盖ERC20Votes的_burn以更新投票权
     */
    function _burn(address account, uint256 amount) internal override {
        super._burn(account, amount);
    }
}
