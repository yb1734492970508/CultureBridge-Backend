const { Web3 } = require('web3');
const { ethers } = require('ethers');
const redis = require('redis');

class EnhancedBlockchainService {
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
        
        // Redis缓存客户端
        this.redisClient = redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379
        });
        
        // 合约地址（需要部署后更新）
        this.contractAddresses = {
            CBT_TOKEN: process.env.CBT_TOKEN_ADDRESS || '',
            IDENTITY: process.env.IDENTITY_CONTRACT_ADDRESS || '',
            MARKETPLACE: process.env.MARKETPLACE_CONTRACT_ADDRESS || '',
            EXCHANGE: process.env.EXCHANGE_CONTRACT_ADDRESS || ''
        };
        
        // 合约实例
        this.contracts = {};
        this.initializeContracts();
        
        // 事件监听器
        this.eventListeners = new Map();
        this.setupEventListeners();
    }

    /**
     * 初始化智能合约实例
     */
    async initializeContracts() {
        try {
            // CBT代币合约
            if (this.contractAddresses.CBT_TOKEN) {
                this.contracts.cbtToken = new ethers.Contract(
                    this.contractAddresses.CBT_TOKEN,
                    this.getCBTTokenABI(),
                    this.provider
                );
            }

            // 身份合约
            if (this.contractAddresses.IDENTITY) {
                this.contracts.identity = new ethers.Contract(
                    this.contractAddresses.IDENTITY,
                    this.getIdentityABI(),
                    this.provider
                );
            }

            // 市场合约
            if (this.contractAddresses.MARKETPLACE) {
                this.contracts.marketplace = new ethers.Contract(
                    this.contractAddresses.MARKETPLACE,
                    this.getMarketplaceABI(),
                    this.provider
                );
            }

            console.log('智能合约初始化完成');
        } catch (error) {
            console.error('智能合约初始化失败:', error);
        }
    }

    /**
     * 获取CBT代币余额
     * @param {string} address 用户地址
     * @returns {Promise<string>} 代币余额
     */
    async getCBTBalance(address) {
        try {
            // 先从缓存获取
            const cacheKey = `cbt_balance_${address}`;
            const cachedBalance = await this.redisClient.get(cacheKey);
            
            if (cachedBalance) {
                return cachedBalance;
            }

            // 从区块链获取
            const balance = await this.contracts.cbtToken.balanceOf(address);
            const formattedBalance = ethers.formatEther(balance);
            
            // 缓存5分钟
            await this.redisClient.setex(cacheKey, 300, formattedBalance);
            
            return formattedBalance;
        } catch (error) {
            console.error('获取CBT余额失败:', error);
            throw error;
        }
    }

    /**
     * 奖励CBT代币给用户
     * @param {string} userAddress 用户地址
     * @param {string} amount 奖励数量
     * @param {string} reason 奖励原因
     * @returns {Promise<string>} 交易哈希
     */
    async awardCBTTokens(userAddress, amount, reason) {
        try {
            const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);
            const contractWithSigner = this.contracts.cbtToken.connect(wallet);
            
            const amountInWei = ethers.parseEther(amount);
            
            const tx = await contractWithSigner.awardTokens(
                userAddress,
                amountInWei,
                reason
            );
            
            console.log(`奖励交易已发送: ${tx.hash}`);
            
            // 等待交易确认
            const receipt = await tx.wait();
            console.log(`奖励交易已确认: ${receipt.transactionHash}`);
            
            // 清除缓存
            await this.redisClient.del(`cbt_balance_${userAddress}`);
            
            return receipt.transactionHash;
        } catch (error) {
            console.error('奖励CBT代币失败:', error);
            throw error;
        }
    }

    /**
     * 执行带目的的代币转账
     * @param {string} fromAddress 发送者地址
     * @param {string} toAddress 接收者地址
     * @param {string} amount 转账数量
     * @param {string} purpose 转账目的
     * @param {string} category 交易类别
     * @param {Array} tags 交易标签
     * @returns {Promise<string>} 交易哈希
     */
    async transferWithPurpose(fromAddress, toAddress, amount, purpose, category, tags) {
        try {
            const wallet = new ethers.Wallet(process.env.USER_PRIVATE_KEY, this.provider);
            const contractWithSigner = this.contracts.cbtToken.connect(wallet);
            
            const amountInWei = ethers.parseEther(amount);
            
            const tx = await contractWithSigner.transferWithPurpose(
                toAddress,
                amountInWei,
                purpose,
                category,
                tags
            );
            
            console.log(`目的转账交易已发送: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`目的转账交易已确认: ${receipt.transactionHash}`);
            
            // 清除相关缓存
            await this.redisClient.del(`cbt_balance_${fromAddress}`);
            await this.redisClient.del(`cbt_balance_${toAddress}`);
            
            return receipt.transactionHash;
        } catch (error) {
            console.error('目的转账失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户交易历史
     * @param {string} userAddress 用户地址
     * @param {number} limit 限制数量
     * @returns {Promise<Array>} 交易历史
     */
    async getUserTransactionHistory(userAddress, limit = 50) {
        try {
            const cacheKey = `tx_history_${userAddress}_${limit}`;
            const cachedHistory = await this.redisClient.get(cacheKey);
            
            if (cachedHistory) {
                return JSON.parse(cachedHistory);
            }

            // 从区块链获取交易历史
            const filter = this.contracts.cbtToken.filters.CulturalTransaction(null, userAddress, null);
            const events = await this.contracts.cbtToken.queryFilter(filter, -10000);
            
            const transactions = events.slice(-limit).map(event => ({
                id: event.args.id.toString(),
                from: event.args.from,
                to: event.args.to,
                amount: ethers.formatEther(event.args.amount),
                purpose: event.args.purpose,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            }));
            
            // 缓存10分钟
            await this.redisClient.setex(cacheKey, 600, JSON.stringify(transactions));
            
            return transactions;
        } catch (error) {
            console.error('获取交易历史失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户奖励历史
     * @param {string} userAddress 用户地址
     * @returns {Promise<Array>} 奖励历史
     */
    async getUserRewardHistory(userAddress) {
        try {
            const cacheKey = `reward_history_${userAddress}`;
            const cachedHistory = await this.redisClient.get(cacheKey);
            
            if (cachedHistory) {
                return JSON.parse(cachedHistory);
            }

            const filter = this.contracts.cbtToken.filters.TokensAwarded(userAddress);
            const events = await this.contracts.cbtToken.queryFilter(filter, -10000);
            
            const rewards = events.map(event => ({
                amount: ethers.formatEther(event.args.amount),
                reason: event.args.reason,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            }));
            
            // 缓存10分钟
            await this.redisClient.setex(cacheKey, 600, JSON.stringify(rewards));
            
            return rewards;
        } catch (error) {
            console.error('获取奖励历史失败:', error);
            throw error;
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        if (this.contracts.cbtToken) {
            // 监听代币奖励事件
            this.contracts.cbtToken.on('TokensAwarded', (to, amount, reason, event) => {
                console.log(`代币奖励事件: ${to} 获得 ${ethers.formatEther(amount)} CBT, 原因: ${reason}`);
                this.handleTokensAwardedEvent(to, amount, reason, event);
            });

            // 监听文化交易事件
            this.contracts.cbtToken.on('CulturalTransaction', (id, from, to, amount, purpose, event) => {
                console.log(`文化交易事件: ${from} -> ${to}, 数量: ${ethers.formatEther(amount)}, 目的: ${purpose}`);
                this.handleCulturalTransactionEvent(id, from, to, amount, purpose, event);
            });
        }
    }

    /**
     * 处理代币奖励事件
     */
    async handleTokensAwardedEvent(to, amount, reason, event) {
        try {
            // 清除相关缓存
            await this.redisClient.del(`cbt_balance_${to}`);
            await this.redisClient.del(`reward_history_${to}`);
            
            // 可以在这里添加其他业务逻辑，如发送通知等
        } catch (error) {
            console.error('处理代币奖励事件失败:', error);
        }
    }

    /**
     * 处理文化交易事件
     */
    async handleCulturalTransactionEvent(id, from, to, amount, purpose, event) {
        try {
            // 清除相关缓存
            await this.redisClient.del(`cbt_balance_${from}`);
            await this.redisClient.del(`cbt_balance_${to}`);
            await this.redisClient.del(`tx_history_${from}_50`);
            await this.redisClient.del(`tx_history_${to}_50`);
            
            // 可以在这里添加其他业务逻辑
        } catch (error) {
            console.error('处理文化交易事件失败:', error);
        }
    }

    /**
     * 获取CBT代币合约ABI
     */
    getCBTTokenABI() {
        return [
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
                "inputs": [{"name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "to", "type": "address"},
                    {"indexed": false, "name": "amount", "type": "uint256"},
                    {"indexed": false, "name": "reason", "type": "string"}
                ],
                "name": "TokensAwarded",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "id", "type": "uint256"},
                    {"indexed": true, "name": "from", "type": "address"},
                    {"indexed": true, "name": "to", "type": "address"},
                    {"indexed": false, "name": "amount", "type": "uint256"},
                    {"indexed": false, "name": "purpose", "type": "string"}
                ],
                "name": "CulturalTransaction",
                "type": "event"
            }
        ];
    }

    /**
     * 获取身份合约ABI
     */
    getIdentityABI() {
        return [
            {
                "inputs": [{"name": "userAddress", "type": "address"}],
                "name": "getUserInfo",
                "outputs": [
                    {"name": "userId", "type": "uint256"},
                    {"name": "username", "type": "string"},
                    {"name": "email", "type": "string"},
                    {"name": "reputation", "type": "uint256"},
                    {"name": "isVerified", "type": "bool"}
                ],
                "type": "function"
            }
        ];
    }

    /**
     * 获取市场合约ABI
     */
    getMarketplaceABI() {
        return [
            // 市场合约的ABI定义
        ];
    }

    /**
     * 关闭连接
     */
    async close() {
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        
        // 移除所有事件监听器
        if (this.contracts.cbtToken) {
            this.contracts.cbtToken.removeAllListeners();
        }
    }
}

module.exports = EnhancedBlockchainService;

