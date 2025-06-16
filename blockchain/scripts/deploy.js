const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("开始部署CultureBridge智能合约...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.utils.formatEther(await deployer.getBalance()));

  // 部署CBT代币合约
  console.log("\n=== 部署CBT代币合约 ===");
  const CultureBridgeToken = await ethers.getContractFactory("CultureBridgeToken");
  
  const cbtToken = await upgrades.deployProxy(
    CultureBridgeToken,
    [
      "CultureBridge Token", // 代币名称
      "CBT",                 // 代币符号
      deployer.address       // 管理员地址
    ],
    { 
      initializer: 'initialize',
      kind: 'uups'
    }
  );

  await cbtToken.deployed();
  console.log("CBT代币合约地址:", cbtToken.address);

  // 部署文化身份合约
  console.log("\n=== 部署文化身份合约 ===");
  const CultureBridgeIdentity = await ethers.getContractFactory("CultureBridgeIdentity");
  const identityContract = await CultureBridgeIdentity.deploy();
  await identityContract.deployed();
  console.log("文化身份合约地址:", identityContract.address);

  // 部署文化资产合约
  console.log("\n=== 部署文化资产合约 ===");
  const CultureBridgeAsset = await ethers.getContractFactory("CultureBridgeAsset");
  const assetContract = await CultureBridgeAsset.deploy(
    "CultureBridge Cultural Assets",
    "CBCA",
    deployer.address
  );
  await assetContract.deployed();
  console.log("文化资产合约地址:", assetContract.address);

  // 部署市场合约
  console.log("\n=== 部署市场合约 ===");
  const CultureBridgeMarketplace = await ethers.getContractFactory("CultureBridgeMarketplace");
  const marketplaceContract = await CultureBridgeMarketplace.deploy(
    cbtToken.address,
    assetContract.address,
    deployer.address
  );
  await marketplaceContract.deployed();
  console.log("市场合约地址:", marketplaceContract.address);

  // 部署交换合约
  console.log("\n=== 部署交换合约 ===");
  const CultureBridgeExchange = await ethers.getContractFactory("CultureBridgeExchange");
  const exchangeContract = await CultureBridgeExchange.deploy(
    cbtToken.address,
    deployer.address
  );
  await exchangeContract.deployed();
  console.log("交换合约地址:", exchangeContract.address);

  // 部署工厂合约
  console.log("\n=== 部署工厂合约 ===");
  const CultureBridgeFactory = await ethers.getContractFactory("CultureBridgeFactory");
  const factoryContract = await CultureBridgeFactory.deploy(
    cbtToken.address,
    deployer.address
  );
  await factoryContract.deployed();
  console.log("工厂合约地址:", factoryContract.address);

  // 设置合约权限
  console.log("\n=== 设置合约权限 ===");
  
  // 给市场合约分发奖励权限
  const REWARD_DISTRIBUTOR_ROLE = await cbtToken.REWARD_DISTRIBUTOR_ROLE();
  await cbtToken.grantRole(REWARD_DISTRIBUTOR_ROLE, marketplaceContract.address);
  console.log("已授予市场合约奖励分发权限");

  // 给交换合约铸币权限
  const MINTER_ROLE = await cbtToken.MINTER_ROLE();
  await cbtToken.grantRole(MINTER_ROLE, exchangeContract.address);
  console.log("已授予交换合约铸币权限");

  // 验证部署
  console.log("\n=== 验证部署 ===");
  const tokenName = await cbtToken.name();
  const tokenSymbol = await cbtToken.symbol();
  const totalSupply = await cbtToken.totalSupply();
  
  console.log("代币名称:", tokenName);
  console.log("代币符号:", tokenSymbol);
  console.log("总供应量:", ethers.utils.formatEther(totalSupply));

  // 保存部署信息
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CultureBridgeToken: {
        address: cbtToken.address,
        name: tokenName,
        symbol: tokenSymbol,
        totalSupply: ethers.utils.formatEther(totalSupply)
      },
      CultureBridgeIdentity: {
        address: identityContract.address
      },
      CultureBridgeAsset: {
        address: assetContract.address
      },
      CultureBridgeMarketplace: {
        address: marketplaceContract.address
      },
      CultureBridgeExchange: {
        address: exchangeContract.address
      },
      CultureBridgeFactory: {
        address: factoryContract.address
      }
    },
    gasUsed: {
      // 这里可以添加gas使用统计
    }
  };

  // 保存到文件
  const deploymentPath = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  const networkName = (await ethers.provider.getNetwork()).name;
  const fileName = `${networkName}-${Date.now()}.json`;
  const filePath = path.join(deploymentPath, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n部署信息已保存到: ${filePath}`);

  // 生成前端配置文件
  const frontendConfig = {
    contracts: {
      CBT_TOKEN_ADDRESS: cbtToken.address,
      IDENTITY_CONTRACT_ADDRESS: identityContract.address,
      ASSET_CONTRACT_ADDRESS: assetContract.address,
      MARKETPLACE_CONTRACT_ADDRESS: marketplaceContract.address,
      EXCHANGE_CONTRACT_ADDRESS: exchangeContract.address,
      FACTORY_CONTRACT_ADDRESS: factoryContract.address
    },
    network: {
      chainId: (await ethers.provider.getNetwork()).chainId,
      name: networkName
    }
  };

  const frontendConfigPath = path.join(__dirname, '../../Frontend1/src/config/contracts.json');
  fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
  console.log(`前端配置已保存到: ${frontendConfigPath}`);

  console.log("\n🎉 所有合约部署完成！");
  console.log("\n📋 部署摘要:");
  console.log("CBT代币:", cbtToken.address);
  console.log("文化身份:", identityContract.address);
  console.log("文化资产:", assetContract.address);
  console.log("市场合约:", marketplaceContract.address);
  console.log("交换合约:", exchangeContract.address);
  console.log("工厂合约:", factoryContract.address);

  // 如果是测试网，分发一些测试代币
  if (networkName === 'bscTestnet') {
    console.log("\n=== 分发测试代币 ===");
    const testAmount = ethers.utils.parseEther("1000"); // 1000 CBT
    await cbtToken.mint(deployer.address, testAmount);
    console.log(`已向部署者分发 1000 CBT 测试代币`);
  }
}

// 错误处理
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });

