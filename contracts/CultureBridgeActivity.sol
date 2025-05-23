// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CultureBridgeActivity
 * @dev 管理文化活动的创建、验证和参与
 */
contract CultureBridgeActivity is Ownable {
    using Counters for Counters.Counter;
    
    // 活动ID计数器
    Counters.Counter private _activityIdCounter;
    
    // 活动状态枚举
    enum ActivityStatus { 
        PLANNED,    // 计划中
        ONGOING,    // 进行中
        COMPLETED,  // 已完成
        CANCELLED   // 已取消
    }
    
    // 验证状态枚举
    enum VerificationStatus {
        PENDING,    // 待验证
        VERIFIED,   // 已验证
        REJECTED    // 已拒绝
    }
    
    // 活动结构体
    struct Activity {
        uint256 id;                     // 活动ID
        string name;                    // 活动名称
        string description;             // 活动描述
        string activityType;            // 活动类型
        uint256 startTime;              // 开始时间
        uint256 endTime;                // 结束时间
        string location;                // 活动地点
        address organizer;              // 组织者地址
        ActivityStatus status;          // 活动状态
        uint256 capacity;               // 最大参与人数
        uint256 fee;                    // 活动费用
        bytes32 contentHash;            // 活动内容哈希
        uint256 createdAt;              // 创建时间
        uint256 updatedAt;              // 更新时间
        VerificationStatus verificationStatus; // 验证状态
        address verifier;               // 验证人地址
        string[] culturalTags;          // 文化标签
        uint256 participantCount;       // 参与人数
    }
    
    // 参与记录结构体
    struct Participation {
        uint256 activityId;             // 活动ID
        address participant;            // 参与者地址
        uint256 joinedAt;               // 参与时间
        bool attended;                  // 是否实际参与
        string feedback;                // 参与反馈
    }
    
    // 验证记录结构体
    struct Verification {
        uint256 activityId;             // 活动ID
        address verifier;               // 验证人地址
        VerificationStatus status;      // 验证状态
        string comments;                // 验证评论
        uint256 verifiedAt;             // 验证时间
    }
    
    // 存储所有活动
    mapping(uint256 => Activity) private _activities;
    
    // 存储活动参与记录 (活动ID => 参与者地址 => 参与记录)
    mapping(uint256 => mapping(address => Participation)) private _participations;
    
    // 存储活动参与者列表 (活动ID => 参与者地址数组)
    mapping(uint256 => address[]) private _activityParticipants;
    
    // 存储验证记录 (活动ID => 验证记录)
    mapping(uint256 => Verification) private _verifications;
    
    // 存储用户组织的活动 (组织者地址 => 活动ID数组)
    mapping(address => uint256[]) private _organizerActivities;
    
    // 存储用户参与的活动 (参与者地址 => 活动ID数组)
    mapping(address => uint256[]) private _participantActivities;
    
    // 存储文化标签到活动的映射 (标签 => 活动ID数组)
    mapping(string => uint256[]) private _tagActivities;
    
    // 验证人角色
    mapping(address => bool) private _verifiers;
    
    // 事件
    event ActivityCreated(uint256 indexed activityId, address indexed organizer, string name, uint256 startTime);
    event ActivityUpdated(uint256 indexed activityId, address indexed organizer, uint256 updatedAt);
    event ActivityStatusChanged(uint256 indexed activityId, ActivityStatus newStatus);
    event ActivityVerified(uint256 indexed activityId, address indexed verifier, VerificationStatus status);
    event ParticipantJoined(uint256 indexed activityId, address indexed participant, uint256 joinedAt);
    event ParticipantAttended(uint256 indexed activityId, address indexed participant, uint256 attendedAt);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    /**
     * @dev 构造函数
     */
    constructor() {
        // 合约部署者默认为第一个验证人
        _verifiers[msg.sender] = true;
    }
    
    /**
     * @dev 添加验证人
     * @param verifier 验证人地址
     */
    function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        require(!_verifiers[verifier], "Already a verifier");
        
        _verifiers[verifier] = true;
        emit VerifierAdded(verifier);
    }
    
    /**
     * @dev 移除验证人
     * @param verifier 验证人地址
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(_verifiers[verifier], "Not a verifier");
        
        _verifiers[verifier] = false;
        emit VerifierRemoved(verifier);
    }
    
    /**
     * @dev 检查地址是否为验证人
     * @param verifier 验证人地址
     * @return 是否为验证人
     */
    function isVerifier(address verifier) public view returns (bool) {
        return _verifiers[verifier];
    }
    
    /**
     * @dev 创建新活动
     * @param name 活动名称
     * @param description 活动描述
     * @param activityType 活动类型
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param location 活动地点
     * @param capacity 最大参与人数
     * @param fee 活动费用
     * @param contentHash 活动内容哈希
     * @param culturalTags 文化标签数组
     * @return 新创建的活动ID
     */
    function createActivity(
        string memory name,
        string memory description,
        string memory activityType,
        uint256 startTime,
        uint256 endTime,
        string memory location,
        uint256 capacity,
        uint256 fee,
        bytes32 contentHash,
        string[] memory culturalTags
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(startTime > block.timestamp, "Start time must be in the future");
        require(endTime > startTime, "End time must be after start time");
        
        // 增加活动ID计数
        _activityIdCounter.increment();
        uint256 activityId = _activityIdCounter.current();
        
        // 创建新活动
        Activity storage newActivity = _activities[activityId];
        newActivity.id = activityId;
        newActivity.name = name;
        newActivity.description = description;
        newActivity.activityType = activityType;
        newActivity.startTime = startTime;
        newActivity.endTime = endTime;
        newActivity.location = location;
        newActivity.organizer = msg.sender;
        newActivity.status = ActivityStatus.PLANNED;
        newActivity.capacity = capacity;
        newActivity.fee = fee;
        newActivity.contentHash = contentHash;
        newActivity.createdAt = block.timestamp;
        newActivity.updatedAt = block.timestamp;
        newActivity.verificationStatus = VerificationStatus.PENDING;
        newActivity.culturalTags = culturalTags;
        newActivity.participantCount = 0;
        
        // 更新组织者活动列表
        _organizerActivities[msg.sender].push(activityId);
        
        // 更新标签到活动的映射
        for (uint i = 0; i < culturalTags.length; i++) {
            _tagActivities[culturalTags[i]].push(activityId);
        }
        
        // 触发活动创建事件
        emit ActivityCreated(activityId, msg.sender, name, startTime);
        
        return activityId;
    }
    
    /**
     * @dev 更新活动信息
     * @param activityId 活动ID
     * @param name 活动名称
     * @param description 活动描述
     * @param activityType 活动类型
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @param location 活动地点
     * @param capacity 最大参与人数
     * @param fee 活动费用
     * @param contentHash 活动内容哈希
     * @param culturalTags 文化标签数组
     */
    function updateActivity(
        uint256 activityId,
        string memory name,
        string memory description,
        string memory activityType,
        uint256 startTime,
        uint256 endTime,
        string memory location,
        uint256 capacity,
        uint256 fee,
        bytes32 contentHash,
        string[] memory culturalTags
    ) external {
        Activity storage activity = _activities[activityId];
        
        // 检查活动是否存在
        require(activity.id == activityId, "Activity does not exist");
        
        // 检查调用者是否为活动组织者或合约拥有者
        require(
            activity.organizer == msg.sender || owner() == msg.sender,
            "Only organizer or owner can update activity"
        );
        
        // 检查活动是否已开始
        require(
            activity.startTime > block.timestamp || owner() == msg.sender,
            "Cannot update ongoing or completed activity"
        );
        
        // 更新活动信息
        if (bytes(name).length > 0) {
            activity.name = name;
        }
        
        activity.description = description;
        activity.activityType = activityType;
        
        if (startTime > block.timestamp) {
            activity.startTime = startTime;
        }
        
        if (endTime > startTime) {
            activity.endTime = endTime;
        }
        
        activity.location = location;
        activity.capacity = capacity;
        activity.fee = fee;
        activity.contentHash = contentHash;
        activity.updatedAt = block.timestamp;
        
        // 更新文化标签
        activity.culturalTags = culturalTags;
        
        // 触发活动更新事件
        emit ActivityUpdated(activityId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev 更改活动状态
     * @param activityId 活动ID
     * @param newStatus 新状态
     */
    function changeActivityStatus(uint256 activityId, ActivityStatus newStatus) external {
        Activity storage activity = _activities[activityId];
        
        // 检查活动是否存在
        require(activity.id == activityId, "Activity does not exist");
        
        // 检查调用者是否为活动组织者或合约拥有者
        require(
            activity.organizer == msg.sender || owner() == msg.sender,
            "Only organizer or owner can change status"
        );
        
        // 更新活动状态
        activity.status = newStatus;
        activity.updatedAt = block.timestamp;
        
        // 触发活动状态变更事件
        emit ActivityStatusChanged(activityId, newStatus);
    }
    
    /**
     * @dev 验证活动
     * @param activityId 活动ID
     * @param status 验证状态
     * @param comments 验证评论
     */
    function verifyActivity(
        uint256 activityId,
        VerificationStatus status,
        string memory comments
    ) external {
        // 检查调用者是否为验证人
        require(_verifiers[msg.sender], "Only verifiers can verify activities");
        
        Activity storage activity = _activities[activityId];
        
        // 检查活动是否存在
        require(activity.id == activityId, "Activity does not exist");
        
        // 更新活动验证状态
        activity.verificationStatus = status;
        activity.verifier = msg.sender;
        activity.updatedAt = block.timestamp;
        
        // 记录验证信息
        Verification storage verification = _verifications[activityId];
        verification.activityId = activityId;
        verification.verifier = msg.sender;
        verification.status = status;
        verification.comments = comments;
        verification.verifiedAt = block.timestamp;
        
        // 触发活动验证事件
        emit ActivityVerified(activityId, msg.sender, status);
    }
    
    /**
     * @dev 参与活动
     * @param activityId 活动ID
     */
    function joinActivity(uint256 activityId) external {
        Activity storage activity = _activities[activityId];
        
        // 检查活动是否存在
        require(activity.id == activityId, "Activity does not exist");
        
        // 检查活动状态
        require(activity.status == ActivityStatus.PLANNED || activity.status == ActivityStatus.ONGOING, "Activity not available for joining");
        
        // 检查活动容量
        require(activity.participantCount < activity.capacity, "Activity is full");
        
        // 检查用户是否已参与
        require(_participations[activityId][msg.sender].joinedAt == 0, "Already joined this activity");
        
        // 记录参与信息
        Participation storage participation = _participations[activityId][msg.sender];
        participation.activityId = activityId;
        participation.participant = msg.sender;
        participation.joinedAt = block.timestamp;
        participation.attended = false;
        
        // 更新参与者列表
        _activityParticipants[activityId].push(msg.sender);
        
        // 更新参与者活动列表
        _participantActivities[msg.sender].push(activityId);
        
        // 更新活动参与人数
        activity.participantCount++;
        
        // 触发参与事件
        emit ParticipantJoined(activityId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev 记录参与者出席
     * @param activityId 活动ID
     * @param participant 参与者地址
     */
    function recordAttendance(uint256 activityId, address participant) external {
        Activity storage activity = _activities[activityId];
        
        // 检查活动是否存在
        require(activity.id == activityId, "Activity does not exist");
        
        // 检查调用者是否为活动组织者或合约拥有者
        require(
            activity.organizer == msg.sender || owner() == msg.sender,
            "Only organizer or owner can record attendance"
        );
        
        // 检查用户是否已参与
        require(_participations[activityId][participant].joinedAt > 0, "Participant not registered");
        
        // 更新参与记录
        _participations[activityId][participant].attended = true;
        
        // 触发出席事件
        emit ParticipantAttended(activityId, participant, block.timestamp);
    }
    
    /**
     * @dev 提交参与反馈
     * @param activityId 活动ID
     * @param feedback 反馈内容
     */
    function submitFeedback(uint256 activityId, string memory feedback) external {
        // 检查用户是否已参与
        require(_participations[activityId][msg.sender].joinedAt > 0, "Not a participant");
        
        // 更新参与反馈
        _participations[activityId][msg.sender].feedback = feedback;
    }
    
    /**
     * @dev 获取活动信息
     * @param activityId 活动ID
     * @return 活动信息
     */
    function getActivity(uint256 activityId) external view returns (
        uint256 id,
        string memory name,
        string memory description,
        string memory activityType,
        uint256 startTime,
        uint256 endTime,
        string memory location,
        address organizer,
        ActivityStatus status,
        uint256 capacity,
        uint256 fee,
        bytes32 contentHash,
        uint256 createdAt,
        uint256 updatedAt,
        VerificationStatus verificationStatus,
        address verifier,
        uint256 participantCount
    ) {
        Activity storage activity = _activities[activityId];
        require(activity.id == activityId, "Activity does not exist");
        
        return (
            activity.id,
            activity.name,
            activity.description,
            activity.activityType,
            activity.startTime,
            activity.endTime,
            activity.location,
            activity.organizer,
            activity.status,
            activity.capacity,
            activity.fee,
            activity.contentHash,
            activity.createdAt,
            activity.updatedAt,
            activity.verificationStatus,
            activity.verifier,
            activity.participantCount
        );
    }
    
    /**
     * @dev 获取活动文化标签
     * @param activityId 活动ID
     * @return 文化标签数组
     */
    function getActivityTags(uint256 activityId) external view returns (string[] memory) {
        Activity storage activity = _activities[activityId];
        require(activity.id == activityId, "Activity does not exist");
        
        return activity.culturalTags;
    }
    
    /**
     * @dev 获取活动参与者列表
     * @param activityId 活动ID
     * @return 参与者地址数组
     */
    function getActivityParticipants(uint256 activityId) external view returns (address[] memory) {
        require(_activities[activityId].id == activityId, "Activity does not exist");
        
        return _activityParticipants[activityId];
    }
    
    /**
     * @dev 获取参与记录
     * @param activityId 活动ID
     * @param participant 参与者地址
     * @return 参与记录
     */
    function getParticipation(uint256 activityId, address participant) external view returns (
        uint256 joinedAt,
        bool attended,
        string memory feedback
    ) {
        Participation storage participation = _participations[activityId][participant];
        require(participation.joinedAt > 0, "Participation record not found");
        
        return (
            participation.joinedAt,
            participation.attended,
            participation.feedback
        );
    }
    
    /**
     * @dev 获取验证记录
     * @param activityId 活动ID
     * @return 验证记录
     */
    function getVerification(uint256 activityId) external view returns (
        address verifier,
        VerificationStatus status,
        string memory comments,
        uint256 verifiedAt
    ) {
        Verification storage verification = _verifications[activityId];
        require(verification.verifiedAt > 0, "Verification record not found");
        
        return (
            verification.verifier,
            verification.status,
            verification.comments,
            verification.verifiedAt
        );
    }
    
    /**
     * @dev 获取用户组织的活动列表
     * @param organizer 组织者地址
     * @return 活动ID数组
     */
    function getOrganizerActivities(address organizer) external view returns (uint256[] memory) {
        return _organizerActivities[organizer];
    }
    
    /**
     * @dev 获取用户参与的活动列表
     * @param participant 参与者地址
     * @return 活动ID数组
     */
    function getParticipantActivities(address participant) external view returns (uint256[] memory) {
        return _participantActivities[participant];
    }
    
    /**
     * @dev 获取特定标签的活动列表
     * @param tag 文化标签
     * @return 活动ID数组
     */
    function getActivitiesByTag(string memory tag) external view returns (uint256[] memory) {
        return _tagActivities[tag];
    }
    
    /**
     * @dev 获取活动总数
     * @return 活动总数
     */
    function getActivityCount() external view returns (uint256) {
        return _activityIdCounter.current();
    }
}
