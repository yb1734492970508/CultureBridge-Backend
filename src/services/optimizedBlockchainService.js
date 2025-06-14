const { Web3 } = require('web3');
const { ethers } = require('ethers');
const Redis = require('redis');

class OptimizedBlockchainService {
    constructor() {
        // BNB Smart Chain配置
        this.networks = {
            mainnet: {
                rpc: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org:443',
                chainId: 56,
                name: 'BSC Mainnet',
                gasPrice: '5000000000', // 5 Gwei
                gasLimit: '300000'
            },
            testnet: {
                rpc: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
                chainId: 97,
                name: 'BSC Testnet',
                gasPrice: '10000000000', // 10 Gwei
                gasLimit: '300000'
            }
        };
        
        // 当前网络配置
        this.currentNetwork = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
        this.networkConfig = this.networks[this.currentNetwork];
        
        // 连接状态管理
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5秒
        
        // 初始化连接
        this.initializeConnections();
        
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
        
        // 事件监听器
        this.eventListeners = new Map();
        
        console.log(`✅ 优化版区块链服务已初始化 - 网络: ${this.networkConfig.name}`);
    }
    
    /**
     * 初始化区块链连接
     */
    async initializeConnections() {
        try {
            // 初始化Web3
            this.web3 = new Web3(this.networkConfig.rpc);
            
            // 初始化ethers provider
            this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpc);
            
            // 测试连接
            await this.testConnection();
            
            this.isConnected = true;
            this.connectionRetries = 0;
            console.log(`✅ 区块链连接成功 - ${this.networkConfig.name}`);
            
        } catch (error) {
            console.error('❌ 区块链连接失败:', error.message);
            await this.handleConnectionError();
        }
    }
    
    /**
     * 测试区块链连接
     */
    async testConnection() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            const networkInfo = await this.provider.getNetwork();
            
            if (Number(networkInfo.chainId) !== this.networkConfig.chainId) {
                throw new Error(`网络ID不匹配: 期望 ${this.networkConfig.chainId}, 实际 ${networkInfo.chainId}`);
            }
            
            console.log(`📊 当前区块高度: ${blockNumber}`);
            return true;
        } catch (error) {
            throw new Error(`连接测试失败: ${error.message}`);
        }
    }
    
    /**
     * 处理连接错误
     */
    async handleConnectionError() {
        this.isConnected = false;
        this.connectionRetries++;
        
        if (this.connectionRetries < this.maxRetries) {
            console.log(`🔄 尝试重新连接 (${this.connectionRetries}/${this.maxRetries})...`);
            setTimeout(() => {
                this.initializeConnections();
            }, this.retryDelay * this.connectionRetries);
        } else {
            console.error('❌ 达到最大重试次数，区块链服务不可用');
        }
    }
    
    /**
     * 初始化Redis缓存
     */
    async initializeCache() {
        try {
            this.redis = Redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        return new Error('Redis服务器拒绝连接');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        return new Error('重试时间已用尽');
                    }
                    if (options.attempt > 10) {
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });
            
            this.redis.on('error', (err) => {
                console.warn('⚠️ Redis连接错误:', err.message);
            });
            
            this.redis.on('connect', () => {
                console.log('✅ Redis缓存已连接');
            });
            
            await this.redis.connect();
        } catch (error) {
            console.warn('⚠️ Redis缓存初始化失败，将使用内存缓存:', error.message);
            this.redis = null;
            this.memoryCache = new Map();
        }
    }
    
    /**
     * 初始化智能合约
     */
    initializeContracts() {
        try {
            // CBT代币合约ABI
            this.cbtTokenABI = [
                // ERC20标准函数
                "function balanceOf(address account) view returns (uint256)",
                "function totalSupply() view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
                "function allowance(address owner, address spender) view returns (uint256)",
                "function approve(address spender, uint256 amount) returns (bool)",
                "function transferFrom(address from, address to, uint256 amount) returns (bool)",
                
                // 文化交流特定函数
                "function distributeReward(address recipient, uint8 category, string description)",
                "function batchDistributeRewards(address[] recipients, uint8[] categories, string[] descriptions)",
                "function claimDailyReward()",
                "function culturalTransfer(address to, uint256 amount, uint8 category, string description)",
                "function setRewardRate(uint8 category, uint256 newRate)",
                "function getUserCategoryEarnings(address user, uint8 category) view returns (uint256)",
                "function getTransaction(uint256 transactionId) view returns (tuple)",
                
                // 管理函数
                "function pause()",
                "function unpause()",
                "function mint(address to, uint256 amount)",
                
                // 事件
                "event RewardDistributed(address indexed recipient, uint256 amount, uint8 category, string description)",
                "event CulturalTransactionRecorded(uint256 indexed transactionId, address indexed from, address indexed to, uint256 amount, uint8 category)",
                "event Transfer(address indexed from, address indexed to, uint256 value)"
            ];
            
            // 如果有合约地址，初始化合约实例
            if (this.contractAddresses.CBT_TOKEN) {
                this.cbtTokenContract = new ethers.Contract(
                    this.contractAddresses.CBT_TOKEN,
                    this.cbtTokenABI,
                    this.provider
                );
                console.log('✅ CBT代币合约已初始化');
            }
            
        } catch (error) {
            console.error('❌ 合约初始化失败:', error.message);
        }
    }
    
    /**
     * 获取CBT代币余额
     */
    async getCBTBalance(address) {
        try {
            if (!this.isConnected || !this.cbtTokenContract) {
                throw new Error('区块链服务未连接或合约未初始化');
            }
            
            // 检查缓存
            const cacheKey = `cbt_balance_${address}`;
            const cachedBalance = await this.getFromCache(cacheKey);
            if (cachedBalance !== null) {
                return cachedBalance;
            }
            
            const balance = await this.cbtTokenContract.balanceOf(address);
            const formattedBalance = ethers.formatEther(balance);
            
            // 缓存结果（30秒）
            await this.setCache(cacheKey, formattedBalance, 30);
            
            return formattedBalance;
        } catch (error) {
            console.error('获取CBT余额失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 分发奖励
     */
    async distributeReward(recipientAddress, category, description, adminPrivateKey) {
        try {
            if (!this.isConnected || !this.cbtTokenContract) {
                throw new Error('区块链服务未连接或合约未初始化');
            }
            
            // 创建钱包实例
            const wallet = new ethers.Wallet(adminPrivateKey, this.provider);
            const contractWithSigner = this.cbtTokenContract.connect(wallet);
            
            // 估算gas费用
            const gasEstimate = await contractWithSigner.distributeReward.estimateGas(
                recipientAddress,
                this.transactionCategories[category] || 0,
                description
            );
            
            // 执行交易
            const tx = await contractWithSigner.distributeReward(
                recipientAddress,
                this.transactionCategories[category] || 0,
                description,
                {
                    gasLimit: gasEstimate * 120n / 100n, // 增加20%的gas缓冲
                    gasPrice: this.networkConfig.gasPrice
                }
            );
            
            console.log(`📤 奖励分发交易已提交: ${tx.hash}`);
            
            // 等待交易确认
            const receipt = await tx.wait();
            console.log(`✅ 奖励分发成功: ${receipt.transactionHash}`);
            
            // 清除相关缓存
            await this.clearBalanceCache(recipientAddress);
            
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                gasUsed: receipt.gasUsed.toString()
            };
            
        } catch (error) {
            console.error('分发奖励失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量分发奖励
     */
    async batchDistributeRewards(recipients, categories, descriptions, adminPrivateKey) {
        try {
            if (!this.isConnected || !this.cbtTokenContract) {
                throw new Error('区块链服务未连接或合约未初始化');
            }
            
            if (recipients.length !== categories.length || categories.length !== descriptions.length) {
                throw new Error('数组长度不匹配');
            }
            
            // 创建钱包实例
            const wallet = new ethers.Wallet(adminPrivateKey, this.provider);
            const contractWithSigner = this.cbtTokenContract.connect(wallet);
            
            // 转换类别为数字
            const categoryNumbers = categories.map(cat => this.transactionCategories[cat] || 0);
            
            // 估算gas费用
            const gasEstimate = await contractWithSigner.batchDistributeRewards.estimateGas(
                recipients,
                categoryNumbers,
                descriptions
            );
            
            // 执行交易
            const tx = await contractWithSigner.batchDistributeRewards(
                recipients,
                categoryNumbers,
                descriptions,
                {
                    gasLimit: gasEstimate * 120n / 100n,
                    gasPrice: this.networkConfig.gasPrice
                }
            );
            
            console.log(`📤 批量奖励分发交易已提交: ${tx.hash}`);
            
            // 等待交易确认
            const receipt = await tx.wait();
            console.log(`✅ 批量奖励分发成功: ${receipt.transactionHash}`);
            
            // 清除相关缓存
            for (const recipient of recipients) {
                await this.clearBalanceCache(recipient);
            }
            
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                gasUsed: receipt.gasUsed.toString(),
                recipientCount: recipients.length
            };
            
        } catch (error) {
            console.error('批量分发奖励失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 缓存操作
     */
    async getFromCache(key) {
        try {
            if (this.redis) {
                const value = await this.redis.get(key);
                return value ? JSON.parse(value) : null;
            } else if (this.memoryCache) {
                return this.memoryCache.get(key) || null;
            }
            return null;
        } catch (error) {
            console.warn('缓存读取失败:', error.message);
            return null;
        }
    }
    
    async setCache(key, value, ttl = 300) {
        try {
            if (this.redis) {
                await this.redis.setEx(key, ttl, JSON.stringify(value));
            } else if (this.memoryCache) {
                this.memoryCache.set(key, value);
                // 简单的TTL实现
                setTimeout(() => {
                    this.memoryCache.delete(key);
                }, ttl * 1000);
            }
        } catch (error) {
            console.warn('缓存写入失败:', error.message);
        }
    }
    
    async clearBalanceCache(address) {
        const cacheKey = `cbt_balance_${address}`;
        try {
            if (this.redis) {
                await this.redis.del(cacheKey);
            } else if (this.memoryCache) {
                this.memoryCache.delete(cacheKey);
            }
        } catch (error) {
            console.warn('清除缓存失败:', error.message);
        }
    }
    
    /**
     * 健康检查
     */
    async healthCheck() {
        const health = {
            connection: false,
            network: false,
            contracts: false,
            cache: false
        };
        
        try {
            // 检查连接
            if (this.isConnected) {
                await this.testConnection();
                health.connection = true;
                health.network = true;
            }
            
            // 检查合约
            if (this.cbtTokenContract) {
                await this.cbtTokenContract.totalSupply();
                health.contracts = true;
            }
            
            // 检查缓存
            if (this.redis) {
                await this.redis.ping();
                health.cache = true;
            } else if (this.memoryCache) {
                health.cache = true;
            }
            
        } catch (error) {
            console.warn('健康检查部分失败:', error.message);
        }
        
        return health;
    }
    
    /**
     * 获取网络状态
     */
    async getNetworkStatus() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            const gasPrice = await this.provider.getFeeData();
            const network = await this.provider.getNetwork();
            
            return {
                isConnected: this.isConnected,
                network: this.networkConfig.name,
                chainId: Number(network.chainId),
                blockNumber,
                gasPrice: gasPrice.gasPrice?.toString() || 'N/A',
                contractAddresses: this.contractAddresses
            };
        } catch (error) {
            return {
                isConnected: false,
                error: error.message
            };
        }
    }
    
    /**
     * 启动事件监听
     */
    startEventListening() {
        if (!this.cbtTokenContract) {
            console.warn('⚠️ 合约未初始化，跳过事件监听');
            return;
        }
        
        try {
            // 监听奖励分发事件
            this.cbtTokenContract.on('RewardDistributed', (recipient, amount, category, description, event) => {
                console.log('🎁 奖励分发事件:', {
                    recipient,
                    amount: ethers.formatEther(amount),
                    category,
                    description,
                    transactionHash: event.transactionHash
                });
                
                // 清除相关缓存
                this.clearBalanceCache(recipient);
            });
            
            // 监听转账事件
            this.cbtTokenContract.on('Transfer', (from, to, value, event) => {
                console.log('💸 转账事件:', {
                    from,
                    to,
                    value: ethers.formatEther(value),
                    transactionHash: event.transactionHash
                });
                
                // 清除相关缓存
                this.clearBalanceCache(from);
                this.clearBalanceCache(to);
            });
            
            console.log('✅ 区块链事件监听已启动');
            
        } catch (error) {
            console.error('❌ 事件监听启动失败:', error.message);
        }
    }
    
    /**
     * 停止事件监听
     */
    stopEventListening() {
        if (this.cbtTokenContract) {
            this.cbtTokenContract.removeAllListeners();
            console.log('🛑 区块链事件监听已停止');
        }
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        try {
            this.stopEventListening();
            
            if (this.redis) {
                await this.redis.quit();
            }
            
            console.log('✅ 区块链服务资源已清理');
        } catch (error) {
            console.error('❌ 资源清理失败:', error.message);
        }
    }
}

module.exports = OptimizedBlockchainService;

