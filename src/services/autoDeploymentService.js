const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

class AutoDeploymentService {
    constructor() {
        // 网络配置
        this.networks = {
            testnet: {
                rpc: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
                chainId: 97,
                name: 'BSC Testnet',
                explorer: 'https://testnet.bscscan.com'
            },
            mainnet: {
                rpc: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org:443',
                chainId: 56,
                name: 'BSC Mainnet',
                explorer: 'https://bscscan.com'
            }
        };
        
        // 部署配置
        this.deploymentConfig = {
            gasPrice: '10000000000', // 10 Gwei
            gasLimit: '8000000',
            confirmations: 2
        };
        
        // 合约编译路径
        this.artifactsPath = path.join(process.cwd(), 'blockchain', 'artifacts', 'contracts');
        
        console.log('✅ 自动化部署服务已初始化');
    }
    
    /**
     * 部署CBT代币合约
     */
    async deployCBTToken(network = 'testnet', deployerPrivateKey) {
        try {
            console.log(`🚀 开始部署CBT代币合约到 ${network}...`);
            
            // 获取网络配置
            const networkConfig = this.networks[network];
            if (!networkConfig) {
                throw new Error(`不支持的网络: ${network}`);
            }
            
            // 创建provider和wallet
            const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
            const wallet = new ethers.Wallet(deployerPrivateKey, provider);
            
            // 验证网络连接
            const networkInfo = await provider.getNetwork();
            if (Number(networkInfo.chainId) !== networkConfig.chainId) {
                throw new Error(`网络ID不匹配: 期望 ${networkConfig.chainId}, 实际 ${networkInfo.chainId}`);
            }
            
            // 检查部署者余额
            const balance = await provider.getBalance(wallet.address);
            console.log(`💰 部署者余额: ${ethers.formatEther(balance)} BNB`);
            
            if (balance < ethers.parseEther('0.1')) {
                throw new Error('部署者余额不足，至少需要0.1 BNB');
            }
            
            // 读取合约编译文件
            const contractPath = path.join(this.artifactsPath, 'CultureBridgeToken.sol', 'CultureBridgeToken.json');
            const contractArtifact = JSON.parse(await fs.readFile(contractPath, 'utf8'));
            
            // 创建合约工厂
            const contractFactory = new ethers.ContractFactory(
                contractArtifact.abi,
                contractArtifact.bytecode,
                wallet
            );
            
            // 部署参数
            const tokenName = 'CultureBridge Token';
            const tokenSymbol = 'CBT';
            const adminAddress = wallet.address;
            
            console.log('📋 部署参数:', {
                name: tokenName,
                symbol: tokenSymbol,
                admin: adminAddress
            });
            
            // 估算gas费用
            const deploymentData = contractFactory.interface.encodeDeploy([]);
            const gasEstimate = await provider.estimateGas({
                data: contractFactory.bytecode + deploymentData.slice(2)
            });
            
            console.log(`⛽ 预估gas费用: ${gasEstimate.toString()}`);
            
            // 部署合约
            const contract = await contractFactory.deploy({
                gasLimit: gasEstimate * 120n / 100n, // 增加20%缓冲
                gasPrice: this.deploymentConfig.gasPrice
            });
            
            console.log(`📤 部署交易已提交: ${contract.deploymentTransaction().hash}`);
            console.log(`⏳ 等待合约部署确认...`);
            
            // 等待部署完成
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            
            console.log(`✅ CBT代币合约部署成功!`);
            console.log(`📍 合约地址: ${contractAddress}`);
            console.log(`🔗 浏览器链接: ${networkConfig.explorer}/address/${contractAddress}`);
            
            // 初始化合约
            console.log('🔧 正在初始化合约...');
            const initTx = await contract.initialize(tokenName, tokenSymbol, adminAddress, {
                gasLimit: '500000',
                gasPrice: this.deploymentConfig.gasPrice
            });
            
            await initTx.wait(this.deploymentConfig.confirmations);
            console.log(`✅ 合约初始化完成: ${initTx.hash}`);
            
            // 验证部署
            const totalSupply = await contract.totalSupply();
            const contractName = await contract.name();
            const contractSymbol = await contract.symbol();
            
            console.log('📊 合约验证信息:');
            console.log(`  名称: ${contractName}`);
            console.log(`  符号: ${contractSymbol}`);
            console.log(`  总供应量: ${ethers.formatEther(totalSupply)} CBT`);
            
            // 保存部署信息
            const deploymentInfo = {
                network: network,
                contractAddress: contractAddress,
                deploymentHash: contract.deploymentTransaction().hash,
                initializationHash: initTx.hash,
                deployer: wallet.address,
                timestamp: new Date().toISOString(),
                gasUsed: {
                    deployment: contract.deploymentTransaction().gasLimit?.toString() || 'N/A',
                    initialization: '500000'
                },
                verification: {
                    name: contractName,
                    symbol: contractSymbol,
                    totalSupply: ethers.formatEther(totalSupply)
                }
            };
            
            await this.saveDeploymentInfo('CBT_TOKEN', deploymentInfo);
            
            return {
                success: true,
                contractAddress,
                deploymentInfo
            };
            
        } catch (error) {
            console.error('❌ CBT代币合约部署失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 部署身份验证合约
     */
    async deployIdentityContract(network = 'testnet', deployerPrivateKey, cbtTokenAddress) {
        try {
            console.log(`🚀 开始部署身份验证合约到 ${network}...`);
            
            const networkConfig = this.networks[network];
            const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
            const wallet = new ethers.Wallet(deployerPrivateKey, provider);
            
            // 读取合约编译文件
            const contractPath = path.join(this.artifactsPath, 'CultureBridgeIdentity.sol', 'CultureBridgeIdentity.json');
            const contractArtifact = JSON.parse(await fs.readFile(contractPath, 'utf8'));
            
            // 创建合约工厂
            const contractFactory = new ethers.ContractFactory(
                contractArtifact.abi,
                contractArtifact.bytecode,
                wallet
            );
            
            // 部署合约
            const contract = await contractFactory.deploy(cbtTokenAddress, {
                gasLimit: this.deploymentConfig.gasLimit,
                gasPrice: this.deploymentConfig.gasPrice
            });
            
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            
            console.log(`✅ 身份验证合约部署成功: ${contractAddress}`);
            
            // 保存部署信息
            const deploymentInfo = {
                network: network,
                contractAddress: contractAddress,
                deploymentHash: contract.deploymentTransaction().hash,
                deployer: wallet.address,
                timestamp: new Date().toISOString(),
                dependencies: {
                    cbtToken: cbtTokenAddress
                }
            };
            
            await this.saveDeploymentInfo('IDENTITY', deploymentInfo);
            
            return {
                success: true,
                contractAddress,
                deploymentInfo
            };
            
        } catch (error) {
            console.error('❌ 身份验证合约部署失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 部署市场合约
     */
    async deployMarketplaceContract(network = 'testnet', deployerPrivateKey, cbtTokenAddress) {
        try {
            console.log(`🚀 开始部署市场合约到 ${network}...`);
            
            const networkConfig = this.networks[network];
            const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
            const wallet = new ethers.Wallet(deployerPrivateKey, provider);
            
            // 读取合约编译文件
            const contractPath = path.join(this.artifactsPath, 'CultureBridgeMarketplace.sol', 'CultureBridgeMarketplace.json');
            const contractArtifact = JSON.parse(await fs.readFile(contractPath, 'utf8'));
            
            // 创建合约工厂
            const contractFactory = new ethers.ContractFactory(
                contractArtifact.abi,
                contractArtifact.bytecode,
                wallet
            );
            
            // 部署合约
            const contract = await contractFactory.deploy(cbtTokenAddress, {
                gasLimit: this.deploymentConfig.gasLimit,
                gasPrice: this.deploymentConfig.gasPrice
            });
            
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            
            console.log(`✅ 市场合约部署成功: ${contractAddress}`);
            
            // 保存部署信息
            const deploymentInfo = {
                network: network,
                contractAddress: contractAddress,
                deploymentHash: contract.deploymentTransaction().hash,
                deployer: wallet.address,
                timestamp: new Date().toISOString(),
                dependencies: {
                    cbtToken: cbtTokenAddress
                }
            };
            
            await this.saveDeploymentInfo('MARKETPLACE', deploymentInfo);
            
            return {
                success: true,
                contractAddress,
                deploymentInfo
            };
            
        } catch (error) {
            console.error('❌ 市场合约部署失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 完整部署流程
     */
    async deployAll(network = 'testnet', deployerPrivateKey) {
        try {
            console.log(`🚀 开始完整部署流程到 ${network}...`);
            
            const deploymentResults = {};
            
            // 1. 部署CBT代币合约
            console.log('\n📋 步骤 1/3: 部署CBT代币合约');
            const cbtResult = await this.deployCBTToken(network, deployerPrivateKey);
            deploymentResults.cbtToken = cbtResult;
            
            // 2. 部署身份验证合约
            console.log('\n📋 步骤 2/3: 部署身份验证合约');
            const identityResult = await this.deployIdentityContract(
                network, 
                deployerPrivateKey, 
                cbtResult.contractAddress
            );
            deploymentResults.identity = identityResult;
            
            // 3. 部署市场合约
            console.log('\n📋 步骤 3/3: 部署市场合约');
            const marketplaceResult = await this.deployMarketplaceContract(
                network, 
                deployerPrivateKey, 
                cbtResult.contractAddress
            );
            deploymentResults.marketplace = marketplaceResult;
            
            // 生成环境变量配置
            const envConfig = this.generateEnvConfig(deploymentResults, network);
            await this.saveEnvConfig(envConfig, network);
            
            console.log('\n🎉 完整部署流程成功完成!');
            console.log('📋 部署摘要:');
            console.log(`  CBT代币: ${cbtResult.contractAddress}`);
            console.log(`  身份验证: ${identityResult.contractAddress}`);
            console.log(`  市场合约: ${marketplaceResult.contractAddress}`);
            
            return {
                success: true,
                network,
                contracts: deploymentResults,
                envConfig
            };
            
        } catch (error) {
            console.error('❌ 完整部署流程失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 保存部署信息
     */
    async saveDeploymentInfo(contractName, info) {
        try {
            const deploymentsDir = path.join(process.cwd(), 'blockchain', 'deployments');
            await fs.mkdir(deploymentsDir, { recursive: true });
            
            const filePath = path.join(deploymentsDir, `${contractName}_${info.network}.json`);
            await fs.writeFile(filePath, JSON.stringify(info, null, 2));
            
            console.log(`💾 部署信息已保存: ${filePath}`);
        } catch (error) {
            console.warn('⚠️ 保存部署信息失败:', error.message);
        }
    }
    
    /**
     * 生成环境变量配置
     */
    generateEnvConfig(deploymentResults, network) {
        const config = [
            `# CultureBridge 合约地址 - ${network.toUpperCase()}`,
            `CBT_TOKEN_ADDRESS=${deploymentResults.cbtToken.contractAddress}`,
            `IDENTITY_CONTRACT_ADDRESS=${deploymentResults.identity.contractAddress}`,
            `MARKETPLACE_CONTRACT_ADDRESS=${deploymentResults.marketplace.contractAddress}`,
            ``,
            `# 网络配置`,
            `BSC_NETWORK=${network}`,
            `BSC_CHAIN_ID=${this.networks[network].chainId}`,
            `BSC_RPC_URL=${this.networks[network].rpc}`,
            ``
        ];
        
        return config.join('\\n');
    }
    
    /**
     * 保存环境变量配置
     */
    async saveEnvConfig(envConfig, network) {
        try {
            const configPath = path.join(process.cwd(), `.env.${network}`);
            await fs.writeFile(configPath, envConfig);
            console.log(`💾 环境变量配置已保存: ${configPath}`);
        } catch (error) {
            console.warn('⚠️ 保存环境变量配置失败:', error.message);
        }
    }
    
    /**
     * 验证合约部署
     */
    async verifyDeployment(network, contractAddress, contractName) {
        try {
            const networkConfig = this.networks[network];
            const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
            
            // 检查合约代码
            const code = await provider.getCode(contractAddress);
            if (code === '0x') {
                throw new Error('合约地址无代码');
            }
            
            console.log(`✅ ${contractName} 合约验证成功: ${contractAddress}`);
            return true;
            
        } catch (error) {
            console.error(`❌ ${contractName} 合约验证失败:`, error.message);
            return false;
        }
    }
    
    /**
     * 获取部署摘要
     */
    async getDeploymentSummary() {
        try {
            const deploymentsDir = path.join(process.cwd(), 'blockchain', 'deployments');
            const files = await fs.readdir(deploymentsDir);
            
            const summary = {};
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(deploymentsDir, file);
                    const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    const [contractName, network] = file.replace('.json', '').split('_');
                    
                    if (!summary[network]) {
                        summary[network] = {};
                    }
                    summary[network][contractName] = {
                        address: content.contractAddress,
                        timestamp: content.timestamp
                    };
                }
            }
            
            return summary;
        } catch (error) {
            console.warn('获取部署摘要失败:', error.message);
            return {};
        }
    }
}

module.exports = AutoDeploymentService;

