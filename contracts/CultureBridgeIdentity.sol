// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CultureBridgeIdentity
 * @dev 用户身份与声誉系统智能合约
 */
contract CultureBridgeIdentity is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _userIds;
    
    struct UserIdentity {
        uint256 id;
        address walletAddress;
        string username;
        uint256 reputationScore;
        uint256 contributionCount;
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    mapping(address => UserIdentity) private _identities;
    mapping(string => address) private _usernameToAddress;
    
    event IdentityCreated(address indexed user, uint256 id, string username);
    event ReputationUpdated(address indexed user, uint256 newScore);
    event ContributionAdded(address indexed user, uint256 newCount);
    
    /**
     * @dev 创建用户身份
     * @param user 用户钱包地址
     * @param username 用户名
     */
    function createIdentity(address user, string memory username) external onlyOwner {
        require(_identities[user].id == 0, "Identity already exists");
        require(_usernameToAddress[username] == address(0), "Username already taken");
        
        _userIds.increment();
        uint256 newUserId = _userIds.current();
        
        _identities[user] = UserIdentity({
            id: newUserId,
            walletAddress: user,
            username: username,
            reputationScore: 0,
            contributionCount: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        _usernameToAddress[username] = user;
        
        emit IdentityCreated(user, newUserId, username);
    }
    
    /**
     * @dev 更新用户声誉分数
     * @param user 用户钱包地址
     * @param newScore 新的声誉分数
     */
    function updateReputation(address user, uint256 newScore) external onlyOwner {
        require(_identities[user].id != 0, "Identity does not exist");
        
        _identities[user].reputationScore = newScore;
        _identities[user].updatedAt = block.timestamp;
        
        emit ReputationUpdated(user, newScore);
    }
    
    /**
     * @dev 增加用户贡献计数
     * @param user 用户钱包地址
     */
    function addContribution(address user) external onlyOwner {
        require(_identities[user].id != 0, "Identity does not exist");
        
        _identities[user].contributionCount += 1;
        _identities[user].updatedAt = block.timestamp;
        
        emit ContributionAdded(user, _identities[user].contributionCount);
    }
    
    /**
     * @dev 获取用户身份信息
     * @param user 用户钱包地址
     * @return 用户身份信息
     */
    function getIdentity(address user) external view returns (
        uint256 id,
        string memory username,
        uint256 reputationScore,
        uint256 contributionCount,
        uint256 createdAt,
        uint256 updatedAt
    ) {
        UserIdentity memory identity = _identities[user];
        return (
            identity.id,
            identity.username,
            identity.reputationScore,
            identity.contributionCount,
            identity.createdAt,
            identity.updatedAt
        );
    }
    
    /**
     * @dev 通过用户名查找地址
     * @param username 用户名
     * @return 用户钱包地址
     */
    function getAddressByUsername(string memory username) external view returns (address) {
        return _usernameToAddress[username];
    }
}
