const Web3 = require('web3');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class EnhancedBlockchainService {
    constructor() {
        // BNB Smart Chain配置
        this.networks = {
            mainnet: {
                rpc: 'https://bsc-dataseed1.binance.org:443',
                chainId: 56,
                name: 'BSC Mainnet'
            },
            testnet: {
                rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
                chainId: 97,
                name: 'BSC Testnet'
            }
        };
        
        // 根据环境选择网络
        this.currentNetwork = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
        this.networkConfig = this.networks[this.currentNetwork];
        
        // 初始化Web3和ethers
        this.web3 = new Web3(this.networkConfig.rpc);
        this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpc);
        
        // 合约地址配置
        this.contractAddresses = {
            CBT_TOKEN: process.env.CBT_TOKEN_ADDRESS || '',
            CULTURAL_EXCHANGE: process.env.CULTURAL_EXCHANGE_ADDRESS || '',
            LANGUAGE_LEARNING: process.env.LANGUAGE_LEARNING_ADDRESS || '',
            REWARD_POOL: process.env.REWARD_POOL_ADDRESS || ''
        };
        
        // 加载合约ABI
        this.loadContractABIs();
        
        // 初始化合约实例
        this.initializeContracts();
        
        // Gas价格配置
        this.gasConfig = {
            gasPrice: '5000000000', // 5 Gwei
            gasLimit: '500000'
        };
    }
    
    /**
     * 加载合约ABI
     */
    loadContractABIs() {
        try {
            const abiPath = path.join(__dirname, '../blockchain/abis');
            
            // 如果ABI文件存在，加载它们
            if (fs.existsSync(path.join(abiPath, 'CultureBridgeToken.json'))) {
                this.contractABIs = {
                    CBT_TOKEN: JSON.parse(fs.readFileSync(path.join(abiPath, 'CultureBridgeToken.json'), 'utf8')),
                    CULTURAL_EXCHANGE: JSON.parse(fs.readFileSync(path.join(abiPath, 'CulturalExchange.json'), 'utf8')),
                    LANGUAGE_LEARNING: JSON.parse(fs.readFileSync(path.join(abiPath, 'LanguageLearning.json'), 'utf8'))
                };
            } else {
                // 使用简化的ABI作为后备
                this.contractABIs = this.getDefaultABIs();
            }
        } catch (error) {
            console.warn('加载合约ABI失败，使用默认ABI:', error);
            this.contractABIs = this.getDefaultABIs();
        }
    }
    
    /**
     * 获取默认ABI
     */
    getDefaultABIs() {
        return {
            CBT_TOKEN: [
                {
                    "inputs": [
                        {"name": "_to", "type": "address"},
                        {"name": "_amount", "type": "uint256"},
                        {"name": "_purpose", "type": "string"},
                        {"name": "_category", "type": "string"},
                        {"name": "_tags", "type": "string[]"}
                    ],
                    "name": "transferWithPurpose",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                },
                {
                    "inputs": [
                        {"name": "_to", "type": "address"},
                        {"name": "_amount", "type": "uint256"},
                        {"name": "_reason", "type": "string"},
                        {"name": "_category", "type": "string"}
                    ],
                    "name": "awardTokens",
                    "outputs": [],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_user", "type": "address"}],
                    "name": "balanceOf",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_user", "type": "address"}],
                    "name": "getUserTransactions",
                    "outputs": [{"name": "", "type": "uint256[]"}],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_user", "type": "address"}],
                    "name": "getTodayRewards",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                }
            ]
        };
    }
    
    /**
     * 初始化合约实例
     */
    initializeContracts() {
        try {
            if (this.contractAddresses.CBT_TOKEN && this.contractABIs.CBT_TOKEN) {
                this.cbtTokenContract = new this.web3.eth.Contract(
                    this.contractABIs.CBT_TOKEN,
                    this.contractAddresses.CBT_TOKEN
                );
                
                this.cbtTokenEthersContract = new ethers.Contract(
                    this.contractAddresses.CBT_TOKEN,
                    this.contractABIs.CBT_TOKEN,
                    this.provider
                );
            }
        } catch (error) {
            console.error('合约初始化失败:', error);
        }
    }
    
    /**
     * 部署CBT代币合约
     */
    async deployCBTToken(deployerPrivateKey) {
        try {
            const account = this.web3.eth.accounts.privateKeyToAccount(deployerPrivateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            // 读取合约字节码
            const contractPath = path.join(__dirname, '../blockchain/contracts/CultureBridgeToken.sol');
            
            // 这里需要编译合约，实际部署时需要使用Hardhat或Truffle
            console.log('合约部署功能需要配置Hardhat或Truffle环境');
            
            return {
                success: false,
                message: '请使用Hardhat或Truffle部署合约'
            };
        } catch (error) {
            console.error('部署合约失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户CBT代币余额
     */
    async getUserBalance(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const balance = await this.cbtTokenContract.methods.balanceOf(userAddress).call();
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('获取用户余额失败:', error);
            throw error;
        }
    }
    
    /**
     * 奖励代币给用户
     */
    async awardTokens(toAddress, amount, reason, category, privateKey) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');
            
            // 估算Gas费用
            const gasEstimate = await this.cbtTokenContract.methods.awardTokens(
                toAddress,
                amountWei,
                reason,
                category
            ).estimateGas({ from: account.address });
            
            const tx = await this.cbtTokenContract.methods.awardTokens(
                toAddress,
                amountWei,
                reason,
                category
            ).send({
                from: account.address,
                gas: Math.floor(gasEstimate * 1.2), // 增加20%的Gas缓冲
                gasPrice: this.gasConfig.gasPrice
            });
            
            return {
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                gasUsed: tx.gasUsed
            };
        } catch (error) {
            console.error('奖励代币失败:', error);
            throw error;
        }
    }
    
    /**
     * 带目的的代币转账
     */
    async transferWithPurpose(fromPrivateKey, toAddress, amount, purpose, category, tags) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const account = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');
            
            // 检查余额
            const balance = await this.getUserBalance(account.address);
            if (parseFloat(balance) < parseFloat(amount)) {
                throw new Error('余额不足');
            }
            
            // 估算Gas费用
            const gasEstimate = await this.cbtTokenContract.methods.transferWithPurpose(
                toAddress,
                amountWei,
                purpose,
                category,
                tags
            ).estimateGas({ from: account.address });
            
            const tx = await this.cbtTokenContract.methods.transferWithPurpose(
                toAddress,
                amountWei,
                purpose,
                category,
                tags
            ).send({
                from: account.address,
                gas: Math.floor(gasEstimate * 1.2),
                gasPrice: this.gasConfig.gasPrice
            });
            
            return {
                transactionHash: tx.transactionHash,
                transactionId: tx.events.CulturalTransaction?.returnValues?.id,
                blockNumber: tx.blockNumber,
                gasUsed: tx.gasUsed
            };
        } catch (error) {
            console.error('代币转账失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户交易历史
     */
    async getUserTransactions(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const transactionIds = await this.cbtTokenContract.methods.getUserTransactions(userAddress).call();
            
            const transactions = [];
            for (const id of transactionIds) {
                try {
                    const transaction = await this.getTransaction(id);
                    transactions.push(transaction);
                } catch (error) {
                    console.warn(`获取交易${id}失败:`, error);
                }
            }
            
            return transactions;
        } catch (error) {
            console.error('获取用户交易历史失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户今日奖励
     */
    async getTodayRewards(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const todayRewards = await this.cbtTokenContract.methods.getTodayRewards(userAddress).call();
            return this.web3.utils.fromWei(todayRewards, 'ether');
        } catch (error) {
            console.error('获取今日奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量奖励代币
     */
    async batchAwardTokens(recipients, amounts, reasons, category, privateKey) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            // 转换金额为Wei
            const amountsWei = amounts.map(amount => this.web3.utils.toWei(amount.toString(), 'ether'));
            
            const tx = await this.cbtTokenContract.methods.batchAwardTokens(
                recipients,
                amountsWei,
                reasons,
                category
            ).send({
                from: account.address,
                gas: this.gasConfig.gasLimit,
                gasPrice: this.gasConfig.gasPrice
            });
            
            return {
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                gasUsed: tx.gasUsed
            };
        } catch (error) {
            console.error('批量奖励代币失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取网络状态
     */
    async getNetworkStatus() {
        try {
            const blockNumber = await this.web3.eth.getBlockNumber();
            const gasPrice = await this.web3.eth.getGasPrice();
            const networkId = await this.web3.eth.net.getId();
            
            return {
                network: this.networkConfig.name,
                chainId: this.networkConfig.chainId,
                blockNumber,
                gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei') + ' Gwei',
                networkId,
                rpcUrl: this.networkConfig.rpc
            };
        } catch (error) {
            console.error('获取网络状态失败:', error);
            throw error;
        }
    }
    
    /**
     * 验证钱包地址格式
     */
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }
    
    /**
     * 生成新的钱包地址
     */
    generateWallet() {
        const account = this.web3.eth.accounts.create();
        return {
            address: account.address,
            privateKey: account.privateKey
        };
    }
    
    /**
     * 获取BNB余额
     */
    async getBNBBalance(address) {
        try {
            const balance = await this.web3.eth.getBalance(address);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('获取BNB余额失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取当前gas价格
     */
    async getGasPrice() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            return this.web3.utils.fromWei(gasPrice, 'gwei');
        } catch (error) {
            console.error('获取Gas价格失败:', error);
            throw error;
        }
    }
    
    /**
     * 监听合约事件
     */
    subscribeToEvents(eventName, callback) {
        if (!this.cbtTokenContract) {
            throw new Error('CBT代币合约未初始化');
        }
        
        this.cbtTokenContract.events[eventName]()
            .on('data', callback)
            .on('error', console.error);
    }
    
    /**
     * 获取合约信息
     */
    async getContractInfo() {
        try {
            if (!this.cbtTokenContract) {
                return { error: 'CBT代币合约未初始化' };
            }
            
            const totalSupply = await this.cbtTokenContract.methods.totalSupply().call();
            const transactionCount = await this.cbtTokenContract.methods.getTransactionCount().call();
            
            return {
                contractAddress: this.contractAddresses.CBT_TOKEN,
                totalSupply: this.web3.utils.fromWei(totalSupply, 'ether'),
                transactionCount,
                network: this.networkConfig.name,
                chainId: this.networkConfig.chainId
            };
        } catch (error) {
            console.error('获取合约信息失败:', error);
            throw error;
        }
    }
}

module.exports = EnhancedBlockchainService;

