// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CultureBridgeIdentity.sol";
import "./CultureBridgeAsset.sol";
import "./CultureBridgeExchange.sol";
import "./CultureBridgeToken.sol";

/**
 * @title CultureBridgeFactory
 * @dev 工厂合约，用于部署和管理所有CultureBridge合约
 */
contract CultureBridgeFactory is Ownable {
    CultureBridgeIdentity public identityContract;
    CultureBridgeAsset public assetContract;
    CultureBridgeExchange public exchangeContract;
    CultureBridgeToken public tokenContract;
    
    event ContractsDeployed(
        address identityContract,
        address assetContract,
        address exchangeContract,
        address tokenContract
    );
    
    /**
     * @dev 构造函数，部署所有合约
     */
    constructor() {
        // 部署身份合约
        identityContract = new CultureBridgeIdentity();
        
        // 部署资产合约
        assetContract = new CultureBridgeAsset(address(identityContract));
        
        // 部署交流合约
        exchangeContract = new CultureBridgeExchange(address(identityContract), address(assetContract));
        
        // 部署代币合约
        tokenContract = new CultureBridgeToken(address(identityContract));
        
        emit ContractsDeployed(
            address(identityContract),
            address(assetContract),
            address(exchangeContract),
            address(tokenContract)
        );
    }
    
    /**
     * @dev 转移所有合约的所有权
     * @param _newOwner 新的所有者地址
     */
    function transferOwnership(address _newOwner) public override onlyOwner {
        super.transferOwnership(_newOwner);
        identityContract.transferOwnership(_newOwner);
        assetContract.transferOwnership(_newOwner);
        exchangeContract.transferOwnership(_newOwner);
        tokenContract.transferOwnership(_newOwner);
    }
    
    /**
     * @dev 获取所有合约地址
     * @return identity 身份合约地址
     * @return asset 资产合约地址
     * @return exchange 交流合约地址
     * @return token 代币合约地址
     */
    function getContractAddresses() public view returns (
        address identity,
        address asset,
        address exchange,
        address token
    ) {
        return (
            address(identityContract),
            address(assetContract),
            address(exchangeContract),
            address(tokenContract)
        );
    }
}
