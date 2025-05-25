// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CultureBridgeGovernance
 * @dev CultureBridge治理合约，基于OpenZeppelin Governor实现
 */
contract CultureBridgeGovernance is 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotes, 
    GovernorVotesQuorumFraction, 
    GovernorTimelockControl,
    AccessControl
{
    bytes32 public constant GOVERNANCE_ADMIN_ROLE = keccak256("GOVERNANCE_ADMIN_ROLE");
    
    // 提案类型
    enum ProposalType { 
        PLATFORM_FEATURE,   // 平台功能提案
        PARAMETER_CHANGE,   // 参数调整提案
        FUND_ALLOCATION,    // 资金分配提案
        EMERGENCY           // 紧急提案
    }
    
    // 提案元数据
    struct ProposalMetadata {
        ProposalType proposalType;
        string title;
        string description;
        address proposer;
        uint256 createdAt;
    }
    
    // 提案ID到元数据的映射
    mapping(uint256 => ProposalMetadata) public proposalMetadata;
    
    // 提案类型到最低提案门槛的映射（以代币数量表示）
    mapping(ProposalType => uint256) public proposalThresholds;
    
    // 事件
    event ProposalCreatedWithMetadata(
        uint256 proposalId,
        ProposalType proposalType,
        string title,
        address proposer
    );
    
    event ProposalThresholdUpdated(
        ProposalType proposalType,
        uint256 newThreshold
    );

    /**
     * @dev 构造函数
     * @param _token 投票代币地址
     * @param _timelock 时间锁控制器地址
     */
    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("CultureBridgeGovernance")
        GovernorSettings(
            7200,  // 1 day voting delay (in blocks)
            36000, // 5 days voting period (in blocks)
            10000 * 10**18  // 10,000 tokens proposal threshold
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(30) // 30% quorum
        GovernorTimelockControl(_timelock)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(GOVERNANCE_ADMIN_ROLE, msg.sender);
        
        // 设置默认提案门槛
        proposalThresholds[ProposalType.PLATFORM_FEATURE] = 10000 * 10**18;  // 10,000 tokens
        proposalThresholds[ProposalType.PARAMETER_CHANGE] = 20000 * 10**18;  // 20,000 tokens
        proposalThresholds[ProposalType.FUND_ALLOCATION] = 30000 * 10**18;   // 30,000 tokens
        proposalThresholds[ProposalType.EMERGENCY] = 50000 * 10**18;         // 50,000 tokens
    }
    
    /**
     * @dev 创建提案并添加元数据
     * @param targets 目标合约地址数组
     * @param values 发送的以太币数量数组
     * @param calldatas 调用数据数组
     * @param description 提案描述
     * @param proposalType 提案类型
     * @param title 提案标题
     * @return 提案ID
     */
    function proposeWithMetadata(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType,
        string memory title
    ) public virtual returns (uint256) {
        // 检查提案门槛
        uint256 threshold = proposalThresholds[proposalType];
        require(getVotes(msg.sender, block.number - 1) >= threshold, "CultureBridgeGovernance: below proposal threshold");
        
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        
        // 存储提案元数据
        proposalMetadata[proposalId] = ProposalMetadata({
            proposalType: proposalType,
            title: title,
            description: description,
            proposer: msg.sender,
            createdAt: block.timestamp
        });
        
        emit ProposalCreatedWithMetadata(proposalId, proposalType, title, msg.sender);
        
        return proposalId;
    }
    
    /**
     * @dev 更新提案门槛
     * @param proposalType 提案类型
     * @param newThreshold 新的门槛值
     */
    function updateProposalThreshold(ProposalType proposalType, uint256 newThreshold) 
        external 
        onlyRole(GOVERNANCE_ADMIN_ROLE) 
    {
        proposalThresholds[proposalType] = newThreshold;
        emit ProposalThresholdUpdated(proposalType, newThreshold);
    }
    
    /**
     * @dev 获取提案元数据
     * @param proposalId 提案ID
     * @return 提案类型、标题、描述、提案人和创建时间
     */
    function getProposalMetadata(uint256 proposalId) 
        external 
        view 
        returns (
            ProposalType, 
            string memory, 
            string memory, 
            address, 
            uint256
        ) 
    {
        ProposalMetadata memory metadata = proposalMetadata[proposalId];
        return (
            metadata.proposalType,
            metadata.title,
            metadata.description,
            metadata.proposer,
            metadata.createdAt
        );
    }
    
    /**
     * @dev 获取提案状态的可读字符串
     * @param proposalId 提案ID
     * @return 状态字符串
     */
    function getProposalStatusString(uint256 proposalId) external view returns (string memory) {
        ProposalState state = state(proposalId);
        
        if (state == ProposalState.Pending) return "Pending";
        if (state == ProposalState.Active) return "Active";
        if (state == ProposalState.Canceled) return "Canceled";
        if (state == ProposalState.Defeated) return "Defeated";
        if (state == ProposalState.Succeeded) return "Succeeded";
        if (state == ProposalState.Queued) return "Queued";
        if (state == ProposalState.Expired) return "Expired";
        if (state == ProposalState.Executed) return "Executed";
        
        return "Unknown";
    }

    // The following functions are overrides required by Solidity.

    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
        public
        override(Governor, IGovernor)
        returns (uint256)
    {
        return super.propose(targets, values, calldatas, description);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _execute(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
    {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, GovernorTimelockControl, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
