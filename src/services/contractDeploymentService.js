const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class ContractDeploymentService {
    constructor() {
        // 网络配置
        this.networks = {
            bscTestnet: {
                name: 'BSC Testnet',
                rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
                chainId: 97,
                explorer: 'https://testnet.bscscan.com'
            },
            bscMainnet: {
                name: 'BSC Mainnet',
                rpc: 'https://bsc-dataseed1.binance.org:443',
                chainId: 56,
                explorer: 'https://bscscan.com'
            }
        };
        
        // 当前网络
        this.currentNetwork = process.env.NODE_ENV === 'production' ? 'bscMainnet' : 'bscTestnet';
        this.networkConfig = this.networks[this.currentNetwork];
        
        // 初始化provider
        this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpc);
        
        // 部署者钱包
        this.deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
        if (!this.deployerPrivateKey) {
            console.warn('⚠️ 部署者私钥未配置，无法部署合约');
        } else {
            this.deployerWallet = new ethers.Wallet(this.deployerPrivateKey, this.provider);
        }
        
        // 合约编译输出目录
        this.artifactsDir = path.join(__dirname, '../../blockchain/artifacts');
        this.deploymentsDir = path.join(__dirname, '../../blockchain/deployments');
        
        // 确保目录存在
        this.ensureDirectories();
    }
    
    /**
     * 确保必要目录存在
     */
    ensureDirectories() {
        [this.artifactsDir, this.deploymentsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    /**
     * 部署CBT代币合约
     */
    async deployCBTToken() {
        try {
            console.log(`🚀 开始部署CBT代币合约到 ${this.networkConfig.name}...`);
            
            if (!this.deployerWallet) {
                throw new Error('部署者钱包未初始化');
            }
            
            // 检查部署者余额
            const balance = await this.provider.getBalance(this.deployerWallet.address);
            const balanceEth = ethers.formatEther(balance);
            console.log(`💰 部署者余额: ${balanceEth} BNB`);
            
            if (parseFloat(balanceEth) < 0.01) {
                throw new Error('部署者余额不足，至少需要0.01 BNB');
            }
            
            // 合约字节码和ABI（这里使用简化版本，实际需要编译Solidity合约）
            const contractBytecode = await this.getContractBytecode('CultureBridgeToken');
            const contractABI = await this.getContractABI('CultureBridgeToken');
            
            // 创建合约工厂
            const contractFactory = new ethers.ContractFactory(
                contractABI,
                contractBytecode,
                this.deployerWallet
            );
            
            // 部署参数
            const deployParams = [
                this.deployerWallet.address // 管理员地址
            ];
            
            // 估算Gas费用
            const gasEstimate = await contractFactory.getDeployTransaction(...deployParams).gasLimit;
            const gasPrice = await this.provider.getFeeData();
            
            console.log(`⛽ 预估Gas费用: ${ethers.formatEther(gasEstimate * gasPrice.gasPrice)} BNB`);
            
            // 部署合约
            console.log('📝 正在部署合约...');
            const contract = await contractFactory.deploy(...deployParams, {
                gasLimit: gasEstimate,
                gasPrice: gasPrice.gasPrice
            });
            
            console.log(`⏳ 等待交易确认... 交易哈希: ${contract.deploymentTransaction().hash}`);
            
            // 等待部署完成
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            
            console.log(`✅ CBT代币合约部署成功!`);
            console.log(`📍 合约地址: ${contractAddress}`);
            console.log(`🔗 区块链浏览器: ${this.networkConfig.explorer}/address/${contractAddress}`);
            
            // 保存部署信息
            const deploymentInfo = {
                contractName: 'CultureBridgeToken',
                contractAddress,
                deployerAddress: this.deployerWallet.address,
                transactionHash: contract.deploymentTransaction().hash,
                blockNumber: contract.deploymentTransaction().blockNumber,
                network: this.currentNetwork,
                deployedAt: new Date().toISOString(),
                gasUsed: gasEstimate.toString(),
                constructorArgs: deployParams
            };
            
            await this.saveDeploymentInfo('CultureBridgeToken', deploymentInfo);
            
            // 验证合约
            await this.verifyContract(contractAddress, deployParams);
            
            return {
                success: true,
                contractAddress,
                transactionHash: contract.deploymentTransaction().hash,
                deploymentInfo
            };
            
        } catch (error) {
            console.error('❌ CBT代币合约部署失败:', error);
            throw error;
        }
    }
    
    /**
     * 部署身份验证合约
     */
    async deployCultureIdentity() {
        try {
            console.log(`🚀 开始部署身份验证合约到 ${this.networkConfig.name}...`);
            
            // 获取CBT代币合约地址
            const cbtTokenAddress = await this.getDeployedContractAddress('CultureBridgeToken');
            if (!cbtTokenAddress) {
                throw new Error('CBT代币合约未部署，请先部署CBT代币合约');
            }
            
            const contractBytecode = await this.getContractBytecode('CultureIdentity');
            const contractABI = await this.getContractABI('CultureIdentity');
            
            const contractFactory = new ethers.ContractFactory(
                contractABI,
                contractBytecode,
                this.deployerWallet
            );
            
            const deployParams = [
                cbtTokenAddress, // CBT代币合约地址
                this.deployerWallet.address // 管理员地址
            ];
            
            const contract = await contractFactory.deploy(...deployParams);
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            
            console.log(`✅ 身份验证合约部署成功!`);
            console.log(`📍 合约地址: ${contractAddress}`);
            
            const deploymentInfo = {
                contractName: 'CultureIdentity',
                contractAddress,
                deployerAddress: this.deployerWallet.address,
                transactionHash: contract.deploymentTransaction().hash,
                network: this.currentNetwork,
                deployedAt: new Date().toISOString(),
                constructorArgs: deployParams
            };
            
            await this.saveDeploymentInfo('CultureIdentity', deploymentInfo);
            
            return {
                success: true,
                contractAddress,
                transactionHash: contract.deploymentTransaction().hash,
                deploymentInfo
            };
            
        } catch (error) {
            console.error('❌ 身份验证合约部署失败:', error);
            throw error;
        }
    }
    
    /**
     * 部署文化交流市场合约
     */
    async deployCultureMarketplace() {
        try {
            console.log(`🚀 开始部署文化交流市场合约到 ${this.networkConfig.name}...`);
            
            const cbtTokenAddress = await this.getDeployedContractAddress('CultureBridgeToken');
            const identityAddress = await this.getDeployedContractAddress('CultureIdentity');
            
            if (!cbtTokenAddress || !identityAddress) {
                throw new Error('依赖合约未部署完成');
            }
            
            const contractBytecode = await this.getContractBytecode('CultureMarketplace');
            const contractABI = await this.getContractABI('CultureMarketplace');
            
            const contractFactory = new ethers.ContractFactory(
                contractABI,
                contractBytecode,
                this.deployerWallet
            );
            
            const deployParams = [
                cbtTokenAddress,
                identityAddress,
                this.deployerWallet.address
            ];
            
            const contract = await contractFactory.deploy(...deployParams);
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            
            console.log(`✅ 文化交流市场合约部署成功!`);
            console.log(`📍 合约地址: ${contractAddress}`);
            
            const deploymentInfo = {
                contractName: 'CultureMarketplace',
                contractAddress,
                deployerAddress: this.deployerWallet.address,
                transactionHash: contract.deploymentTransaction().hash,
                network: this.currentNetwork,
                deployedAt: new Date().toISOString(),
                constructorArgs: deployParams
            };
            
            await this.saveDeploymentInfo('CultureMarketplace', deploymentInfo);
            
            return {
                success: true,
                contractAddress,
                transactionHash: contract.deploymentTransaction().hash,
                deploymentInfo
            };
            
        } catch (error) {
            console.error('❌ 文化交流市场合约部署失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量部署所有合约
     */
    async deployAllContracts() {
        try {
            console.log('🚀 开始批量部署所有合约...');
            
            const results = {};
            
            // 1. 部署CBT代币合约
            console.log('\n1️⃣ 部署CBT代币合约');
            results.cbtToken = await this.deployCBTToken();
            
            // 等待一段时间确保合约完全部署
            await this.delay(5000);
            
            // 2. 部署身份验证合约
            console.log('\n2️⃣ 部署身份验证合约');
            results.identity = await this.deployCultureIdentity();
            
            await this.delay(5000);
            
            // 3. 部署文化交流市场合约
            console.log('\n3️⃣ 部署文化交流市场合约');
            results.marketplace = await this.deployCultureMarketplace();
            
            // 4. 配置合约权限
            console.log('\n4️⃣ 配置合约权限');
            await this.configureContractPermissions();
            
            // 5. 生成环境变量配置
            console.log('\n5️⃣ 生成环境变量配置');
            await this.generateEnvConfig(results);
            
            console.log('\n🎉 所有合约部署完成!');
            
            return results;
            
        } catch (error) {
            console.error('❌ 批量部署失败:', error);
            throw error;
        }
    }
    
    /**
     * 配置合约权限
     */
    async configureContractPermissions() {
        try {
            const cbtTokenAddress = await this.getDeployedContractAddress('CultureBridgeToken');
            const identityAddress = await this.getDeployedContractAddress('CultureIdentity');
            const marketplaceAddress = await this.getDeployedContractAddress('CultureMarketplace');
            
            // 获取CBT代币合约实例
            const cbtTokenABI = await this.getContractABI('CultureBridgeToken');
            const cbtToken = new ethers.Contract(cbtTokenAddress, cbtTokenABI, this.deployerWallet);
            
            // 授予身份验证合约铸币权限
            console.log('🔐 授予身份验证合约铸币权限...');
            const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
            await cbtToken.grantRole(MINTER_ROLE, identityAddress);
            
            // 授予市场合约铸币权限
            console.log('🔐 授予市场合约铸币权限...');
            await cbtToken.grantRole(MINTER_ROLE, marketplaceAddress);
            
            console.log('✅ 合约权限配置完成');
            
        } catch (error) {
            console.error('❌ 配置合约权限失败:', error);
            throw error;
        }
    }
    
    /**
     * 生成环境变量配置
     */
    async generateEnvConfig(deploymentResults) {
        try {
            const cbtTokenAddress = await this.getDeployedContractAddress('CultureBridgeToken');
            const identityAddress = await this.getDeployedContractAddress('CultureIdentity');
            const marketplaceAddress = await this.getDeployedContractAddress('CultureMarketplace');
            
            const envConfig = `
# 区块链配置 - ${this.networkConfig.name}
BSC_NETWORK=${this.currentNetwork}
BSC_RPC_URL=${this.networkConfig.rpc}
BSC_CHAIN_ID=${this.networkConfig.chainId}

# 智能合约地址
CBT_TOKEN_ADDRESS=${cbtTokenAddress}
IDENTITY_CONTRACT_ADDRESS=${identityAddress}
MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}

# 部署信息
DEPLOYED_AT=${new Date().toISOString()}
DEPLOYER_ADDRESS=${this.deployerWallet.address}
NETWORK_EXPLORER=${this.networkConfig.explorer}

# 管理员配置（请更新为实际的管理员私钥）
ADMIN_PRIVATE_KEY=${this.deployerPrivateKey}
REWARD_DISTRIBUTOR_ADDRESS=${this.deployerWallet.address}
`;
            
            const envFilePath = path.join(this.deploymentsDir, `${this.currentNetwork}.env`);
            fs.writeFileSync(envFilePath, envConfig.trim());
            
            console.log(`📝 环境变量配置已保存到: ${envFilePath}`);
            
        } catch (error) {
            console.error('❌ 生成环境变量配置失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取合约字节码
     */
    async getContractBytecode(contractName) {
        // 这里应该从编译输出中读取字节码
        // 为了演示，返回一个占位符
        return "0x608060405234801561001057600080fd5b50..."; // 实际字节码
    }
    
    /**
     * 获取合约ABI
     */
    async getContractABI(contractName) {
        // 这里应该从编译输出中读取ABI
        // 为了演示，返回一个简化的ABI
        return [
            {
                "inputs": [{"name": "admin", "type": "address"}],
                "stateMutability": "nonpayable",
                "type": "constructor"
            }
        ];
    }
    
    /**
     * 保存部署信息
     */
    async saveDeploymentInfo(contractName, deploymentInfo) {
        const filePath = path.join(this.deploymentsDir, `${contractName}_${this.currentNetwork}.json`);
        fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📄 部署信息已保存到: ${filePath}`);
    }
    
    /**
     * 获取已部署合约地址
     */
    async getDeployedContractAddress(contractName) {
        try {
            const filePath = path.join(this.deploymentsDir, `${contractName}_${this.currentNetwork}.json`);
            if (fs.existsSync(filePath)) {
                const deploymentInfo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return deploymentInfo.contractAddress;
            }
            return null;
        } catch (error) {
            console.error(`获取合约地址失败 (${contractName}):`, error);
            return null;
        }
    }
    
    /**
     * 验证合约
     */
    async verifyContract(contractAddress, constructorArgs) {
        try {
            console.log(`🔍 开始验证合约: ${contractAddress}`);
            
            // 这里应该调用BSCScan API进行合约验证
            // 由于需要API密钥和源代码，这里只是记录
            console.log('📝 合约验证需要手动完成，请访问BSCScan进行验证');
            console.log(`🔗 验证链接: ${this.networkConfig.explorer}/verifyContract?a=${contractAddress}`);
            
        } catch (error) {
            console.warn('⚠️ 合约验证失败:', error);
        }
    }
    
    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 获取网络状态
     */
    async getNetworkStatus() {
        try {
            const [blockNumber, gasPrice, chainId] = await Promise.all([
                this.provider.getBlockNumber(),
                this.provider.getFeeData(),
                this.provider.getNetwork()
            ]);
            
            return {
                network: this.networkConfig.name,
                chainId: chainId.chainId,
                blockNumber,
                gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei') + ' Gwei',
                isConnected: true
            };
        } catch (error) {
            return {
                network: this.networkConfig.name,
                isConnected: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取部署摘要
     */
    async getDeploymentSummary() {
        const contracts = ['CultureBridgeToken', 'CultureIdentity', 'CultureMarketplace'];
        const summary = {
            network: this.networkConfig.name,
            deployedContracts: {},
            totalContracts: contracts.length,
            deployedCount: 0
        };
        
        for (const contractName of contracts) {
            const address = await this.getDeployedContractAddress(contractName);
            if (address) {
                summary.deployedContracts[contractName] = address;
                summary.deployedCount++;
            }
        }
        
        summary.isComplete = summary.deployedCount === summary.totalContracts;
        
        return summary;
    }
}

module.exports = ContractDeploymentService;

