// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CultureBridgeIdentity
 * @dev 管理用户身份和权限的智能合约
 */
contract CultureBridgeIdentity is Ownable {
    uint256 private _userIdCounter;
    
    struct User {
        uint256 id;
        string username;
        string culturalBackground;
        uint256 reputationScore;
        bool isVerified;
        mapping(string => bool) credentials;
    }
    
    mapping(address => User) private users;
    mapping(string => address) private usernameToAddress;
    
    event UserRegistered(address indexed userAddress, uint256 id, string username);
    event UserVerified(address indexed userAddress);
    event CredentialAdded(address indexed userAddress, string credentialType);
    
    /**
     * @dev 注册新用户
     * @param _username 用户名
     * @param _culturalBackground 文化背景
     */
    function registerUser(string memory _username, string memory _culturalBackground) public {
        require(users[msg.sender].id == 0, "User already registered");
        require(usernameToAddress[_username] == address(0), "Username already taken");
        
        _userIdCounter++;
        uint256 newUserId = _userIdCounter;
        
        User storage newUser = users[msg.sender];
        newUser.id = newUserId;
        newUser.username = _username;
        newUser.culturalBackground = _culturalBackground;
        newUser.reputationScore = 0;
        newUser.isVerified = false;
        
        usernameToAddress[_username] = msg.sender;
        
        emit UserRegistered(msg.sender, newUserId, _username);
    }
    
    /**
     * @dev 验证用户身份
     * @param _userAddress 用户地址
     */
    function verifyUser(address _userAddress) public onlyOwner {
        require(users[_userAddress].id != 0, "User not registered");
        users[_userAddress].isVerified = true;
        emit UserVerified(_userAddress);
    }
    
    /**
     * @dev 添加用户凭证
     * @param _userAddress 用户地址
     * @param _credentialType 凭证类型
     */
    function addCredential(address _userAddress, string memory _credentialType) public onlyOwner {
        require(users[_userAddress].id != 0, "User not registered");
        users[_userAddress].credentials[_credentialType] = true;
        emit CredentialAdded(_userAddress, _credentialType);
    }
    
    /**
     * @dev 更新用户声誉分数
     * @param _userAddress 用户地址
     * @param _score 新的声誉分数
     */
    function updateReputationScore(address _userAddress, uint256 _score) public onlyOwner {
        require(users[_userAddress].id != 0, "User not registered");
        users[_userAddress].reputationScore = _score;
    }
    
    /**
     * @dev 获取用户信息
     * @param _userAddress 用户地址
     * @return id 用户ID
     * @return username 用户名
     * @return culturalBackground 文化背景
     * @return reputationScore 声誉分数
     * @return isVerified 是否已验证
     */
    function getUserInfo(address _userAddress) public view returns (
        uint256 id,
        string memory username,
        string memory culturalBackground,
        uint256 reputationScore,
        bool isVerified
    ) {
        User storage user = users[_userAddress];
        return (
            user.id,
            user.username,
            user.culturalBackground,
            user.reputationScore,
            user.isVerified
        );
    }
    
    /**
     * @dev 检查用户凭证
     * @param _userAddress 用户地址
     * @param _credentialType 凭证类型
     * @return 是否拥有该凭证
     */
    function checkCredential(address _userAddress, string memory _credentialType) public view returns (bool) {
        return users[_userAddress].credentials[_credentialType];
    }
    
    /**
     * @dev 通过用户名获取地址
     * @param _username 用户名
     * @return 用户地址
     */
    function getAddressByUsername(string memory _username) public view returns (address) {
        return usernameToAddress[_username];
    }
}
