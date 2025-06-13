const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 开始部署CultureBridge智能合约...");
    
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("📝 部署者地址:", deployer.address);
    
    // 检查部署者余额
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 部署者余额:", ethers.formatEther(balance), "BNB");
    
    if (parseFloat(ethers.formatEther(balance)) < 0.01) {
        throw new Error("部署者余额不足，至少需要0.01 BNB");
    }
    
    const deploymentResults = {};
    const network = await ethers.provider.getNetwork();
    console.log("🌐 部署网络:", network.name, "Chain ID:", network.chainId);
    
    try {
        // 1. 部署CBT代币合约
        console.log("\n1️⃣ 部署CBT代币合约...");
        const CultureBridgeToken = await ethers.getContractFactory("CultureBridgeToken");
        const cbtToken = await CultureBridgeToken.deploy();
        await cbtToken.waitForDeployment();
        
        const cbtTokenAddress = await cbtToken.getAddress();
        console.log("✅ CBT代币合约部署成功:", cbtTokenAddress);
        
        // 初始化CBT代币合约
        await cbtToken.initialize(deployer.address);
        console.log("🔧 CBT代币合约初始化完成");
        
        deploymentResults.cbtToken = {
            name: "CultureBridgeToken",
            address: cbtTokenAddress,
            deploymentTransaction: cbtToken.deploymentTransaction()
        };
        
        // 等待几个区块确认
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 2. 部署身份验证合约（如果存在）
        try {
            console.log("\n2️⃣ 部署身份验证合约...");
            const CultureIdentity = await ethers.getContractFactory("CultureIdentity");
            const identity = await CultureIdentity.deploy(cbtTokenAddress, deployer.address);
            await identity.waitForDeployment();
            
            const identityAddress = await identity.getAddress();
            console.log("✅ 身份验证合约部署成功:", identityAddress);
            
            deploymentResults.identity = {
                name: "CultureIdentity",
                address: identityAddress,
                deploymentTransaction: identity.deploymentTransaction()
            };
        } catch (error) {
            console.warn("⚠️ 身份验证合约部署跳过:", error.message);
        }
        
        // 3. 部署文化交流市场合约（如果存在）
        try {
            console.log("\n3️⃣ 部署文化交流市场合约...");
            const CultureMarketplace = await ethers.getContractFactory("CultureMarketplace");
            const marketplace = await CultureMarketplace.deploy(
                cbtTokenAddress,
                deploymentResults.identity?.address || deployer.address,
                deployer.address
            );
            await marketplace.waitForDeployment();
            
            const marketplaceAddress = await marketplace.getAddress();
            console.log("✅ 文化交流市场合约部署成功:", marketplaceAddress);
            
            deploymentResults.marketplace = {
                name: "CultureMarketplace",
                address: marketplaceAddress,
                deploymentTransaction: marketplace.deploymentTransaction()
            };
        } catch (error) {
            console.warn("⚠️ 文化交流市场合约部署跳过:", error.message);
        }
        
        // 4. 配置合约权限
        console.log("\n4️⃣ 配置合约权限...");
        
        // 授予奖励分发者角色
        const REWARD_DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REWARD_DISTRIBUTOR_ROLE"));
        await cbtToken.grantRole(REWARD_DISTRIBUTOR_ROLE, deployer.address);
        console.log("🔐 已授予部署者奖励分发权限");
        
        // 如果有其他合约，授予相应权限
        if (deploymentResults.identity) {
            await cbtToken.grantRole(REWARD_DISTRIBUTOR_ROLE, deploymentResults.identity.address);
            console.log("🔐 已授予身份验证合约奖励分发权限");
        }
        
        if (deploymentResults.marketplace) {
            await cbtToken.grantRole(REWARD_DISTRIBUTOR_ROLE, deploymentResults.marketplace.address);
            console.log("🔐 已授予市场合约奖励分发权限");
        }
        
        // 5. 保存部署信息
        console.log("\n5️⃣ 保存部署信息...");
        const deploymentInfo = {
            network: {
                name: network.name,
                chainId: network.chainId.toString(),
                deployedAt: new Date().toISOString()
            },
            deployer: {
                address: deployer.address,
                balance: ethers.formatEther(balance)
            },
            contracts: {}
        };
        
        // 整理合约信息
        for (const [key, contract] of Object.entries(deploymentResults)) {
            deploymentInfo.contracts[contract.name] = {
                address: contract.address,
                transactionHash: contract.deploymentTransaction.hash,
                blockNumber: contract.deploymentTransaction.blockNumber
            };
        }
        
        // 保存到文件
        const deploymentsDir = path.join(__dirname, '../deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const deploymentFile = path.join(deploymentsDir, `deployment_${network.chainId}_${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log("📄 部署信息已保存到:", deploymentFile);
        
        // 6. 生成环境变量
        console.log("\n6️⃣ 生成环境变量配置...");
        const envConfig = generateEnvConfig(deploymentInfo, network);
        const envFile = path.join(deploymentsDir, `${network.chainId}.env`);
        fs.writeFileSync(envFile, envConfig);
        console.log("📝 环境变量配置已保存到:", envFile);
        
        // 7. 验证部署
        console.log("\n7️⃣ 验证部署结果...");
        await verifyDeployment(deploymentResults);
        
        console.log("\n🎉 所有合约部署完成!");
        console.log("📋 部署摘要:");
        for (const [key, contract] of Object.entries(deploymentResults)) {
            console.log(`   ${contract.name}: ${contract.address}`);
        }
        
        // 8. 输出后续步骤
        console.log("\n📌 后续步骤:");
        console.log("1. 更新.env文件中的合约地址");
        console.log("2. 在BSCScan上验证合约源代码");
        console.log("3. 配置前端应用的合约地址");
        console.log("4. 测试合约功能");
        
        return deploymentInfo;
        
    } catch (error) {
        console.error("❌ 部署失败:", error);
        throw error;
    }
}

/**
 * 生成环境变量配置
 */
function generateEnvConfig(deploymentInfo, network) {
    const contracts = deploymentInfo.contracts;
    
    return `# CultureBridge 智能合约配置
# 网络: ${deploymentInfo.network.name} (Chain ID: ${deploymentInfo.network.chainId})
# 部署时间: ${deploymentInfo.network.deployedAt}
# 部署者: ${deploymentInfo.deployer.address}

# 网络配置
BSC_NETWORK=${network.chainId === 97n ? 'testnet' : 'mainnet'}
BSC_CHAIN_ID=${deploymentInfo.network.chainId}

# 智能合约地址
CBT_TOKEN_ADDRESS=${contracts.CultureBridgeToken?.address || ''}
IDENTITY_CONTRACT_ADDRESS=${contracts.CultureIdentity?.address || ''}
MARKETPLACE_CONTRACT_ADDRESS=${contracts.CultureMarketplace?.address || ''}

# 管理员配置
ADMIN_PRIVATE_KEY=your_admin_private_key_here
REWARD_DISTRIBUTOR_ADDRESS=${deploymentInfo.deployer.address}

# 部署信息
DEPLOYMENT_BLOCK=${contracts.CultureBridgeToken?.blockNumber || ''}
DEPLOYMENT_TX=${contracts.CultureBridgeToken?.transactionHash || ''}
`;
}

/**
 * 验证部署结果
 */
async function verifyDeployment(deploymentResults) {
    console.log("🔍 验证合约部署...");
    
    for (const [key, contract] of Object.entries(deploymentResults)) {
        try {
            // 检查合约代码
            const code = await ethers.provider.getCode(contract.address);
            if (code === '0x') {
                throw new Error(`合约 ${contract.name} 在地址 ${contract.address} 没有代码`);
            }
            
            console.log(`✅ ${contract.name} 验证通过`);
            
            // 如果是CBT代币合约，检查基本功能
            if (contract.name === 'CultureBridgeToken') {
                const cbtContract = await ethers.getContractAt('CultureBridgeToken', contract.address);
                const name = await cbtContract.name();
                const symbol = await cbtContract.symbol();
                const totalSupply = await cbtContract.totalSupply();
                
                console.log(`   代币名称: ${name}`);
                console.log(`   代币符号: ${symbol}`);
                console.log(`   总供应量: ${ethers.formatEther(totalSupply)} CBT`);
            }
            
        } catch (error) {
            console.error(`❌ ${contract.name} 验证失败:`, error.message);
            throw error;
        }
    }
}

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('未处理的Promise拒绝:', error);
    process.exit(1);
});

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };

