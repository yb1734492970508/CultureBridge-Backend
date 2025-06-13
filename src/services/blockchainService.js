const Web3 = require('web3');
const { ethers } = require('ethers');

class BlockchainService {
    constructor() {
        // BNB Smart Chain配置
        this.bscMainnetRPC = 'https://bsc-dataseed1.binance.org:443';
        this.bscTestnetRPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
        
        // 根据环境选择网络
        this.rpcUrl = process.env.NODE_ENV === 'production' 
            ? this.bscMainnetRPC 
            : this.bscTestnetRPC;
            
        this.chainId = process.env.NODE_ENV === 'production' ? 56 : 97;
        
        // 初始化Web3和ethers
        this.web3 = new Web3(this.rpcUrl);
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        
        // 合约地址（需要部署后更新）
        this.contractAddresses = {
            CBT_TOKEN: process.env.CBT_TOKEN_ADDRESS || '',
            IDENTITY: process.env.IDENTITY_CONTRACT_ADDRESS || '',
            MARKETPLACE: process.env.MARKETPLACE_CONTRACT_ADDRESS || '',
            EXCHANGE: process.env.EXCHANGE_CONTRACT_ADDRESS || ''
        };
        
        // 合约ABI（简化版，实际使用时需要完整ABI）
        this.contractABIs = {
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
                        {"name": "_reason", "type": "string"}
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
                    "inputs": [{"name": "_id", "type": "uint256"}],
                    "name": "getTransaction",
                    "outputs": [
                        {"name": "id", "type": "uint256"},
                        {"name": "from", "type": "address"},
                        {"name": "to", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "purpose", "type": "string"},
                        {"name": "timestamp", "type": "uint256"},
                        {"name": "category", "type": "string"}
                    ],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_user", "type": "address"}],
                    "name": "getUserTransactions",
                    "outputs": [{"name": "", "type": "uint256[]"}],
                    "type": "function"
                }
            ]
        };
        
        // 初始化合约实例
        this.initializeContracts();
    }
    
    /**
     * 初始化合约实例
     */
    initializeContracts() {
        try {
            if (this.contractAddresses.CBT_TOKEN) {
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
     * 获取用户CBT代币余额
     * @param {string} userAddress 用户钱包地址
     * @returns {Promise<string>} 代币余额
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
     * @param {string} toAddress 接收者地址
     * @param {string} amount 代币数量
     * @param {string} reason 奖励原因
     * @param {string} privateKey 管理员私钥
     * @returns {Promise<string>} 交易哈希
     */
    async awardTokens(toAddress, amount, reason, privateKey) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            const amountWei = this.web3.utils.toWei(amount, 'ether');
            
            const tx = await this.cbtTokenContract.methods.awardTokens(
                toAddress,
                amountWei,
                reason
            ).send({
                from: account.address,
                gas: 200000
            });
            
            return tx.transactionHash;
        } catch (error) {
            console.error('奖励代币失败:', error);
            throw error;
        }
    }
    
    /**
     * 带目的的代币转账
     * @param {string} fromPrivateKey 发送者私钥
     * @param {string} toAddress 接收者地址
     * @param {string} amount 代币数量
     * @param {string} purpose 转账目的
     * @param {string} category 交易类别
     * @param {string[]} tags 交易标签
     * @returns {Promise<Object>} 交易结果
     */
    async transferWithPurpose(fromPrivateKey, toAddress, amount, purpose, category, tags) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const account = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            const amountWei = this.web3.utils.toWei(amount, 'ether');
            
            const tx = await this.cbtTokenContract.methods.transferWithPurpose(
                toAddress,
                amountWei,
                purpose,
                category,
                tags
            ).send({
                from: account.address,
                gas: 300000
            });
            
            return {
                transactionHash: tx.transactionHash,
                transactionId: tx.events.CulturalTransaction?.returnValues?.id
            };
        } catch (error) {
            console.error('代币转账失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取交易详情
     * @param {number} transactionId 交易ID
     * @returns {Promise<Object>} 交易详情
     */
    async getTransaction(transactionId) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const result = await this.cbtTokenContract.methods.getTransaction(transactionId).call();
            
            return {
                id: result.id,
                from: result.from,
                to: result.to,
                amount: this.web3.utils.fromWei(result.amount, 'ether'),
                purpose: result.purpose,
                timestamp: new Date(parseInt(result.timestamp) * 1000),
                category: result.category
            };
        } catch (error) {
            console.error('获取交易详情失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户交易历史
     * @param {string} userAddress 用户地址
     * @returns {Promise<Array>} 交易历史
     */
    async getUserTransactions(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const transactionIds = await this.cbtTokenContract.methods.getUserTransactions(userAddress).call();
            
            const transactions = [];
            for (const id of transactionIds) {
                const transaction = await this.getTransaction(id);
                transactions.push(transaction);
            }
            
            return transactions;
        } catch (error) {
            console.error('获取用户交易历史失败:', error);
            throw error;
        }
    }
    
    /**
     * 验证钱包地址格式
     * @param {string} address 钱包地址
     * @returns {boolean} 是否有效
     */
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }
    
    /**
     * 生成新的钱包地址
     * @returns {Object} 包含地址和私钥的对象
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
     * @param {string} address 钱包地址
     * @returns {Promise<string>} BNB余额
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
     * @returns {Promise<string>} Gas价格
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
     * @param {string} eventName 事件名称
     * @param {Function} callback 回调函数
     */
    subscribeToEvent(eventName, callback) {
        if (!this.cbtTokenContract) {
            throw new Error('CBT代币合约未初始化');
        }
        
        this.cbtTokenContract.events[eventName]()
            .on('data', callback)
            .on('error', console.error);
    }
}

module.exports = BlockchainService;

