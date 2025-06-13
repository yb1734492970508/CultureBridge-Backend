const { Web3 } = require('web3');
const { ethers } = require('ethers');
const Redis = require('redis');

class EnhancedBlockchainService {
    constructor() {
        // BNB Smart Chain配置
        this.networks = {
            mainnet: {
                rpc: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org:443',
                chainId: 56,
                name: 'BSC Mainnet'
            },
            testnet: {
                rpc: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
                chainId: 97,
                name: 'BSC Testnet'
            }
        };
        
        // 当前网络配置
        this.currentNetwork = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
        this.networkConfig = this.networks[this.currentNetwork];
        
        // 初始化Web3和ethers
        this.web3 = new Web3(this.networkConfig.rpc);
        this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpc);
        
        // 合约地址配置
        this.contractAddresses = {
            CBT_TOKEN: process.env.CBT_TOKEN_ADDRESS || '',
            IDENTITY: process.env.IDENTITY_CONTRACT_ADDRESS || '',
            MARKETPLACE: process.env.MARKETPLACE_CONTRACT_ADDRESS || '',
            EXCHANGE: process.env.EXCHANGE_CONTRACT_ADDRESS || ''
        };
        
        // 初始化Redis缓存
        this.initializeCache();
        
        // 初始化合约
        this.initializeContracts();
        
        // 启动事件监听
        this.startEventListening();
        
        // 交易类别映射
        this.transactionCategories = {
            GENERAL: 0,
            LEARNING_REWARD: 1,
            CULTURAL_EXCHANGE: 2,
            CONTENT_CREATION: 3,
            COMMUNITY_CONTRIBUTION: 4,
            MARKETPLACE_PURCHASE: 5,
            GOVERNANCE_PARTICIPATION: 6
        };
    }
    
    /**
     * 初始化Redis缓存
     */
    async initializeCache() {
        try {
            this.redis = Redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });
            
            this.redis.on('error', (err) => {
                console.warn('Redis连接错误:', err);
            });
            
            await this.redis.connect();
            console.log('✅ Redis缓存已连接');
        } catch (error) {
            console.warn('⚠️ Redis缓存初始化失败，将使用内存缓存:', error.message);
            this.redis = null;
        }
    }
    
    /**
     * 初始化智能合约
     */
    initializeContracts() {
        try {
            // CBT代币合约ABI（完整版）
            this.cbtTokenABI = [
                // ERC20标准函数
                {
                    "inputs": [{"name": "account", "type": "address"}],
                    "name": "balanceOf",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "totalSupply",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                },
                // 文化交流特定函数
                {
                    "inputs": [
                        {"name": "to", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "purpose", "type": "string"},
                        {"name": "category", "type": "uint8"},
                        {"name": "tags", "type": "string[]"}
                    ],
                    "name": "transferWithPurpose",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                },
                {
                    "inputs": [
                        {"name": "recipient", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "reason", "type": "string"},
                        {"name": "category", "type": "uint8"}
                    ],
                    "name": "distributeReward",
                    "outputs": [],
                    "type": "function"
                },
                {
                    "inputs": [
                        {"name": "recipients", "type": "address[]"},
                        {"name": "amounts", "type": "uint256[]"},
                        {"name": "reasons", "type": "string[]"},
                        {"name": "category", "type": "uint8"}
                    ],
                    "name": "batchDistributeRewards",
                    "outputs": [],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "user", "type": "address"}],
                    "name": "getUserTransactions",
                    "outputs": [{"name": "", "type": "uint256[]"}],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "transactionId", "type": "uint256"}],
                    "name": "getTransaction",
                    "outputs": [
                        {"name": "id", "type": "uint256"},
                        {"name": "from", "type": "address"},
                        {"name": "to", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "purpose", "type": "string"},
                        {"name": "category", "type": "uint8"},
                        {"name": "tags", "type": "string[]"},
                        {"name": "timestamp", "type": "uint256"},
                        {"name": "isReward", "type": "bool"}
                    ],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "user", "type": "address"}],
                    "name": "getUserStats",
                    "outputs": [
                        {"name": "totalEarned", "type": "uint256"},
                        {"name": "totalSpent", "type": "uint256"},
                        {"name": "totalTransactions", "type": "uint256"},
                        {"name": "lastActivityTime", "type": "uint256"}
                    ],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "user", "type": "address"}],
                    "name": "getTodayRewards",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "type": "function"
                },
                {
                    "inputs": [{"name": "user", "type": "address"}],
                    "name": "verifyUser",
                    "outputs": [],
                    "type": "function"
                },
                // 事件
                {
                    "anonymous": false,
                    "inputs": [
                        {"indexed": true, "name": "transactionId", "type": "uint256"},
                        {"indexed": true, "name": "from", "type": "address"},
                        {"indexed": true, "name": "to", "type": "address"},
                        {"indexed": false, "name": "amount", "type": "uint256"},
                        {"indexed": false, "name": "purpose", "type": "string"},
                        {"indexed": false, "name": "category", "type": "uint8"}
                    ],
                    "name": "CulturalTransactionCreated",
                    "type": "event"
                },
                {
                    "anonymous": false,
                    "inputs": [
                        {"indexed": true, "name": "recipient", "type": "address"},
                        {"indexed": false, "name": "amount", "type": "uint256"},
                        {"indexed": false, "name": "reason", "type": "string"},
                        {"indexed": false, "name": "category", "type": "uint8"}
                    ],
                    "name": "RewardDistributed",
                    "type": "event"
                }
            ];
            
            // 初始化合约实例
            if (this.contractAddresses.CBT_TOKEN) {
                this.cbtTokenContract = new this.web3.eth.Contract(
                    this.cbtTokenABI,
                    this.contractAddresses.CBT_TOKEN
                );
                
                this.cbtTokenEthersContract = new ethers.Contract(
                    this.contractAddresses.CBT_TOKEN,
                    this.cbtTokenABI,
                    this.provider
                );
                
                console.log('✅ CBT代币合约已初始化');
            } else {
                console.warn('⚠️ CBT代币合约地址未配置');
            }
        } catch (error) {
            console.error('❌ 合约初始化失败:', error);
        }
    }
    
    /**
     * 启动事件监听
     */
    startEventListening() {
        if (!this.cbtTokenContract) return;
        
        try {
            // 监听文化交流交易事件
            this.cbtTokenContract.events.CulturalTransactionCreated()
                .on('data', this.handleCulturalTransactionEvent.bind(this))
                .on('error', console.error);
            
            // 监听奖励分发事件
            this.cbtTokenContract.events.RewardDistributed()
                .on('data', this.handleRewardDistributedEvent.bind(this))
                .on('error', console.error);
            
            console.log('✅ 区块链事件监听已启动');
        } catch (error) {
            console.error('❌ 事件监听启动失败:', error);
        }
    }
    
    /**
     * 处理文化交流交易事件
     */
    async handleCulturalTransactionEvent(event) {
        try {
            const { transactionId, from, to, amount, purpose, category } = event.returnValues;
            
            // 缓存交易数据
            await this.cacheTransactionData(transactionId, {
                id: transactionId,
                from,
                to,
                amount,
                purpose,
                category,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Date.now()
            });
            
            console.log(`📝 文化交流交易记录: ${transactionId}`);
        } catch (error) {
            console.error('处理文化交流交易事件失败:', error);
        }
    }
    
    /**
     * 处理奖励分发事件
     */
    async handleRewardDistributedEvent(event) {
        try {
            const { recipient, amount, reason, category } = event.returnValues;
            
            // 更新用户奖励统计
            await this.updateUserRewardStats(recipient, amount, reason, category);
            
            console.log(`🎁 奖励分发: ${recipient} 获得 ${this.web3.utils.fromWei(amount, 'ether')} CBT`);
        } catch (error) {
            console.error('处理奖励分发事件失败:', error);
        }
    }
    
    /**
     * 获取用户CBT代币余额（带缓存）
     */
    async getUserBalance(userAddress) {
        const cacheKey = `balance:${userAddress}`;
        
        try {
            // 尝试从缓存获取
            if (this.redis) {
                const cachedBalance = await this.redis.get(cacheKey);
                if (cachedBalance) {
                    return cachedBalance;
                }
            }
            
            // 从区块链获取
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const balance = await this.cbtTokenContract.methods.balanceOf(userAddress).call();
            const balanceEther = this.web3.utils.fromWei(balance, 'ether');
            
            // 缓存结果（5分钟）
            if (this.redis) {
                await this.redis.setEx(cacheKey, 300, balanceEther);
            }
            
            return balanceEther;
        } catch (error) {
            console.error('获取用户余额失败:', error);
            throw error;
        }
    }
    
    /**
     * 分发奖励代币
     */
    async distributeReward(recipientAddress, amount, reason, category, adminPrivateKey) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            // 验证参数
            if (!this.isValidAddress(recipientAddress)) {
                throw new Error('无效的接收者地址');
            }
            
            if (!adminPrivateKey) {
                throw new Error('管理员私钥未提供');
            }
            
            // 创建管理员账户
            const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
            this.web3.eth.accounts.wallet.add(adminAccount);
            
            // 转换金额
            const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');
            const categoryIndex = this.transactionCategories[category] || 0;
            
            // 估算Gas费用
            const gasEstimate = await this.cbtTokenContract.methods.distributeReward(
                recipientAddress,
                amountWei,
                reason,
                categoryIndex
            ).estimateGas({ from: adminAccount.address });
            
            // 执行交易
            const tx = await this.cbtTokenContract.methods.distributeReward(
                recipientAddress,
                amountWei,
                reason,
                categoryIndex
            ).send({
                from: adminAccount.address,
                gas: Math.floor(gasEstimate * 1.2), // 增加20%的Gas缓冲
                gasPrice: await this.getOptimalGasPrice()
            });
            
            // 清除相关缓存
            await this.clearUserCache(recipientAddress);
            
            return {
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                gasUsed: tx.gasUsed
            };
        } catch (error) {
            console.error('分发奖励失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量分发奖励
     */
    async batchDistributeRewards(rewardData, adminPrivateKey) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const recipients = rewardData.map(r => r.recipient);
            const amounts = rewardData.map(r => this.web3.utils.toWei(r.amount.toString(), 'ether'));
            const reasons = rewardData.map(r => r.reason);
            const category = this.transactionCategories[rewardData[0].category] || 0;
            
            // 创建管理员账户
            const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
            this.web3.eth.accounts.wallet.add(adminAccount);
            
            // 执行批量奖励
            const tx = await this.cbtTokenContract.methods.batchDistributeRewards(
                recipients,
                amounts,
                reasons,
                category
            ).send({
                from: adminAccount.address,
                gas: 500000 * recipients.length, // 每个奖励预估50万Gas
                gasPrice: await this.getOptimalGasPrice()
            });
            
            // 清除所有接收者的缓存
            for (const recipient of recipients) {
                await this.clearUserCache(recipient);
            }
            
            return {
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                gasUsed: tx.gasUsed,
                recipientCount: recipients.length
            };
        } catch (error) {
            console.error('批量分发奖励失败:', error);
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
            
            // 创建发送者账户
            const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
            this.web3.eth.accounts.wallet.add(fromAccount);
            
            // 转换参数
            const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');
            const categoryIndex = this.transactionCategories[category] || 0;
            
            // 执行转账
            const tx = await this.cbtTokenContract.methods.transferWithPurpose(
                toAddress,
                amountWei,
                purpose,
                categoryIndex,
                tags || []
            ).send({
                from: fromAccount.address,
                gas: 300000,
                gasPrice: await this.getOptimalGasPrice()
            });
            
            // 清除相关缓存
            await this.clearUserCache(fromAccount.address);
            await this.clearUserCache(toAddress);
            
            return {
                transactionHash: tx.transactionHash,
                transactionId: tx.events.CulturalTransactionCreated?.returnValues?.transactionId,
                blockNumber: tx.blockNumber,
                gasUsed: tx.gasUsed
            };
        } catch (error) {
            console.error('代币转账失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户统计信息
     */
    async getUserStats(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const cacheKey = `stats:${userAddress}`;
            
            // 尝试从缓存获取
            if (this.redis) {
                const cachedStats = await this.redis.get(cacheKey);
                if (cachedStats) {
                    return JSON.parse(cachedStats);
                }
            }
            
            // 从区块链获取
            const stats = await this.cbtTokenContract.methods.getUserStats(userAddress).call();
            const todayRewards = await this.cbtTokenContract.methods.getTodayRewards(userAddress).call();
            
            const result = {
                totalEarned: this.web3.utils.fromWei(stats.totalEarned, 'ether'),
                totalSpent: this.web3.utils.fromWei(stats.totalSpent, 'ether'),
                totalTransactions: stats.totalTransactions,
                lastActivityTime: new Date(parseInt(stats.lastActivityTime) * 1000),
                todayRewards: this.web3.utils.fromWei(todayRewards, 'ether')
            };
            
            // 缓存结果（10分钟）
            if (this.redis) {
                await this.redis.setEx(cacheKey, 600, JSON.stringify(result));
            }
            
            return result;
        } catch (error) {
            console.error('获取用户统计失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取交易详情
     */
    async getTransaction(transactionId) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const cacheKey = `transaction:${transactionId}`;
            
            // 尝试从缓存获取
            if (this.redis) {
                const cachedTx = await this.redis.get(cacheKey);
                if (cachedTx) {
                    return JSON.parse(cachedTx);
                }
            }
            
            // 从区块链获取
            const tx = await this.cbtTokenContract.methods.getTransaction(transactionId).call();
            
            const result = {
                id: tx.id,
                from: tx.from,
                to: tx.to,
                amount: this.web3.utils.fromWei(tx.amount, 'ether'),
                purpose: tx.purpose,
                category: Object.keys(this.transactionCategories)[tx.category],
                tags: tx.tags,
                timestamp: new Date(parseInt(tx.timestamp) * 1000),
                isReward: tx.isReward
            };
            
            // 永久缓存（交易不会改变）
            if (this.redis) {
                await this.redis.set(cacheKey, JSON.stringify(result));
            }
            
            return result;
        } catch (error) {
            console.error('获取交易详情失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户交易历史
     */
    async getUserTransactions(userAddress, limit = 50, offset = 0) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            // 获取用户所有交易ID
            const transactionIds = await this.cbtTokenContract.methods.getUserTransactions(userAddress).call();
            
            // 分页处理
            const paginatedIds = transactionIds.slice(offset, offset + limit);
            
            // 获取交易详情
            const transactions = [];
            for (const id of paginatedIds) {
                try {
                    const transaction = await this.getTransaction(id);
                    transactions.push(transaction);
                } catch (error) {
                    console.warn(`获取交易 ${id} 失败:`, error);
                }
            }
            
            return {
                transactions,
                total: transactionIds.length,
                hasMore: offset + limit < transactionIds.length
            };
        } catch (error) {
            console.error('获取用户交易历史失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取最优Gas价格
     */
    async getOptimalGasPrice() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            // 在BSC上，可以使用稍低的Gas价格
            return Math.floor(gasPrice * 0.9);
        } catch (error) {
            console.error('获取Gas价格失败:', error);
            // 返回默认值（5 Gwei）
            return this.web3.utils.toWei('5', 'gwei');
        }
    }
    
    /**
     * 验证钱包地址
     */
    isValidAddress(address) {
        return this.web3.utils.isAddress(address);
    }
    
    /**
     * 生成新钱包
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
     * 缓存交易数据
     */
    async cacheTransactionData(transactionId, data) {
        if (!this.redis) return;
        
        try {
            const cacheKey = `transaction:${transactionId}`;
            await this.redis.set(cacheKey, JSON.stringify(data));
        } catch (error) {
            console.warn('缓存交易数据失败:', error);
        }
    }
    
    /**
     * 更新用户奖励统计
     */
    async updateUserRewardStats(userAddress, amount, reason, category) {
        if (!this.redis) return;
        
        try {
            const statsKey = `reward_stats:${userAddress}`;
            const stats = await this.redis.get(statsKey);
            const currentStats = stats ? JSON.parse(stats) : {
                totalRewards: 0,
                rewardCount: 0,
                categories: {}
            };
            
            currentStats.totalRewards += parseFloat(this.web3.utils.fromWei(amount, 'ether'));
            currentStats.rewardCount += 1;
            currentStats.categories[category] = (currentStats.categories[category] || 0) + 1;
            currentStats.lastRewardTime = Date.now();
            
            await this.redis.setEx(statsKey, 86400, JSON.stringify(currentStats)); // 24小时缓存
        } catch (error) {
            console.warn('更新用户奖励统计失败:', error);
        }
    }
    
    /**
     * 清除用户相关缓存
     */
    async clearUserCache(userAddress) {
        if (!this.redis) return;
        
        try {
            const keys = [
                `balance:${userAddress}`,
                `stats:${userAddress}`,
                `reward_stats:${userAddress}`
            ];
            
            await this.redis.del(keys);
        } catch (error) {
            console.warn('清除用户缓存失败:', error);
        }
    }
    
    /**
     * 获取网络状态
     */
    async getNetworkStatus() {
        try {
            const [blockNumber, gasPrice, networkId] = await Promise.all([
                this.web3.eth.getBlockNumber(),
                this.web3.eth.getGasPrice(),
                this.web3.eth.net.getId()
            ]);
            
            return {
                network: this.networkConfig.name,
                chainId: this.networkConfig.chainId,
                networkId,
                blockNumber,
                gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei') + ' Gwei',
                isConnected: true
            };
        } catch (error) {
            console.error('获取网络状态失败:', error);
            return {
                network: this.networkConfig.name,
                chainId: this.networkConfig.chainId,
                isConnected: false,
                error: error.message
            };
        }
    }
    
    /**
     * 健康检查
     */
    async healthCheck() {
        const status = {
            blockchain: false,
            contracts: false,
            cache: false,
            events: false
        };
        
        try {
            // 检查区块链连接
            await this.web3.eth.getBlockNumber();
            status.blockchain = true;
            
            // 检查合约
            if (this.cbtTokenContract) {
                await this.cbtTokenContract.methods.totalSupply().call();
                status.contracts = true;
            }
            
            // 检查缓存
            if (this.redis) {
                await this.redis.ping();
                status.cache = true;
            }
            
            // 事件监听状态（简化检查）
            status.events = !!this.cbtTokenContract;
            
        } catch (error) {
            console.error('健康检查失败:', error);
        }
        
        return status;
    }
}

module.exports = EnhancedBlockchainService;

