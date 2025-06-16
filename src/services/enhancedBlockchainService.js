const { Web3 } = require('web3');
const { ethers } = require('ethers');
const Redis = require('redis');

/**
 * 增强版区块链服务
 * Enhanced Blockchain Service for CultureBridge
 */
class EnhancedBlockchainService {
    constructor() {
        // BNB Smart Chain配置
        this.networks = {
            mainnet: {
                rpc: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org:443',
                chainId: 56,
                name: 'BSC Mainnet',
                explorer: 'https://bscscan.com'
            },
            testnet: {
                rpc: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
                chainId: 97,
                name: 'BSC Testnet',
                explorer: 'https://testnet.bscscan.com'
            }
        };
        
        // 当前网络配置
        this.currentNetwork = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
        this.networkConfig = this.networks[this.currentNetwork];
        
        // 初始化Web3和ethers
        this.web3 = new Web3(this.networkConfig.rpc);
        this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpc);
        
        // 管理员钱包配置
        if (process.env.ADMIN_PRIVATE_KEY) {
            this.adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);
        }
        
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
        
        // 奖励配置
        this.rewardRates = {
            SEND_MESSAGE: ethers.parseEther('0.1'),
            VOICE_MESSAGE: ethers.parseEther('0.2'),
            TEXT_TRANSLATION: ethers.parseEther('0.5'),
            VOICE_TRANSLATION: ethers.parseEther('1.0'),
            DAILY_LOGIN: ethers.parseEther('1.0'),
            CONTENT_CREATION: ethers.parseEther('5.0'),
            CULTURAL_SHARING: ethers.parseEther('10.0')
        };
        
        // 用户等级配置
        this.userLevels = {
            BRONZE: { min: 0, max: 99, dailyLimit: ethers.parseEther('50') },
            SILVER: { min: 100, max: 499, dailyLimit: ethers.parseEther('100') },
            GOLD: { min: 500, max: 1999, dailyLimit: ethers.parseEther('200') },
            PLATINUM: { min: 2000, max: 9999, dailyLimit: ethers.parseEther('500') },
            DIAMOND: { min: 10000, max: Infinity, dailyLimit: ethers.parseEther('1000') }
        };
        
        console.log(`🔗 区块链服务已初始化 - 网络: ${this.networkConfig.name}`);
    }

    /**
     * 初始化Redis缓存
     */
    async initializeCache() {
        try {
            if (process.env.REDIS_URL) {
                this.redis = Redis.createClient({
                    url: process.env.REDIS_URL
                });
                
                this.redis.on('error', (err) => {
                    console.error('❌ Redis连接错误:', err);
                });
                
                await this.redis.connect();
                console.log('✅ Redis缓存已连接');
            }
        } catch (error) {
            console.warn('⚠️ Redis缓存初始化失败，将使用内存缓存:', error.message);
            this.cache = new Map();
        }
    }

    /**
     * 初始化智能合约
     */
    async initializeContracts() {
        try {
            // CBT代币合约ABI（简化版）
            this.cbtTokenABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
                "function distributeReward(address recipient, uint8 category, string description)",
                "function claimDailyReward()",
                "function culturalTransfer(address to, uint256 amount, uint8 category, string description)",
                "function getUserStats(address user) view returns (uint256 totalEarned, uint256 totalSpent, uint256 transactionCount, uint256 lastActivityTime)",
                "function getUserCategoryEarnings(address user, uint8 category) view returns (uint256)",
                "function totalSupply() view returns (uint256)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
                "function name() view returns (string)",
                "event RewardDistributed(address indexed recipient, uint256 amount, uint8 category, string description)",
                "event CulturalTransactionRecorded(uint256 indexed transactionId, address indexed from, address indexed to, uint256 amount, uint8 category)"
            ];

            // 初始化CBT代币合约
            if (this.contractAddresses.CBT_TOKEN) {
                this.cbtTokenContract = new ethers.Contract(
                    this.contractAddresses.CBT_TOKEN,
                    this.cbtTokenABI,
                    this.provider
                );
                
                if (this.adminWallet) {
                    this.cbtTokenContractWithSigner = this.cbtTokenContract.connect(this.adminWallet);
                }
                
                console.log('✅ CBT代币合约已初始化');
            }
            
        } catch (error) {
            console.error('❌ 合约初始化失败:', error);
        }
    }

    /**
     * 获取用户CBT余额
     */
    async getUserBalance(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const balance = await this.cbtTokenContract.balanceOf(userAddress);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('❌ 获取用户余额失败:', error);
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
            
            const stats = await this.cbtTokenContract.getUserStats(userAddress);
            return {
                totalEarned: ethers.formatEther(stats[0]),
                totalSpent: ethers.formatEther(stats[1]),
                transactionCount: stats[2].toString(),
                lastActivityTime: new Date(Number(stats[3]) * 1000)
            };
        } catch (error) {
            console.error('❌ 获取用户统计失败:', error);
            throw error;
        }
    }

    /**
     * 分发奖励
     */
    async distributeReward(userAddress, category, description, amount = null) {
        try {
            if (!this.cbtTokenContractWithSigner) {
                throw new Error('管理员钱包未配置');
            }
            
            // 如果没有指定金额，使用默认奖励金额
            if (!amount) {
                const categoryKey = Object.keys(this.transactionCategories).find(
                    key => this.transactionCategories[key] === category
                );
                amount = this.rewardRates[categoryKey] || this.rewardRates.GENERAL;
            }
            
            // 检查用户每日限额
            const userLevel = await this.getUserLevel(userAddress);
            const dailyEarned = await this.getDailyEarned(userAddress);
            
            if (dailyEarned + amount > userLevel.dailyLimit) {
                throw new Error('超出每日奖励限额');
            }
            
            // 调用智能合约分发奖励
            const tx = await this.cbtTokenContractWithSigner.distributeReward(
                userAddress,
                category,
                description
            );
            
            await tx.wait();
            
            // 更新缓存
            await this.updateUserCache(userAddress);
            
            console.log(`✅ 奖励分发成功: ${userAddress} - ${ethers.formatEther(amount)} CBT`);
            
            return {
                success: true,
                txHash: tx.hash,
                amount: ethers.formatEther(amount),
                category,
                description
            };
            
        } catch (error) {
            console.error('❌ 奖励分发失败:', error);
            throw error;
        }
    }

    /**
     * 批量分发奖励
     */
    async batchDistributeRewards(rewards) {
        const results = [];
        
        for (const reward of rewards) {
            try {
                const result = await this.distributeReward(
                    reward.userAddress,
                    reward.category,
                    reward.description,
                    reward.amount
                );
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    userAddress: reward.userAddress
                });
            }
        }
        
        return results;
    }

    /**
     * 用户每日登录奖励
     */
    async claimDailyReward(userAddress) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            // 检查是否已经领取今日奖励
            const lastClaimTime = await this.getLastClaimTime(userAddress);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            if (lastClaimTime && lastClaimTime >= today) {
                throw new Error('今日奖励已领取');
            }
            
            // 创建带签名的合约实例
            const userWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);
            const contractWithSigner = this.cbtTokenContract.connect(userWallet);
            
            const tx = await contractWithSigner.claimDailyReward();
            await tx.wait();
            
            // 更新缓存
            await this.setLastClaimTime(userAddress, now);
            await this.updateUserCache(userAddress);
            
            console.log(`✅ 每日奖励领取成功: ${userAddress}`);
            
            return {
                success: true,
                txHash: tx.hash,
                amount: ethers.formatEther(this.rewardRates.DAILY_LOGIN)
            };
            
        } catch (error) {
            console.error('❌ 每日奖励领取失败:', error);
            throw error;
        }
    }

    /**
     * 文化交流转账
     */
    async culturalTransfer(fromAddress, toAddress, amount, category, description) {
        try {
            if (!this.cbtTokenContract) {
                throw new Error('CBT代币合约未初始化');
            }
            
            const amountWei = ethers.parseEther(amount.toString());
            
            // 这里需要用户的私钥来签名交易
            // 在实际应用中，这应该在前端完成
            const tx = await this.cbtTokenContract.culturalTransfer(
                toAddress,
                amountWei,
                category,
                description
            );
            
            await tx.wait();
            
            // 更新缓存
            await this.updateUserCache(fromAddress);
            await this.updateUserCache(toAddress);
            
            console.log(`✅ 文化交流转账成功: ${fromAddress} -> ${toAddress} - ${amount} CBT`);
            
            return {
                success: true,
                txHash: tx.hash,
                from: fromAddress,
                to: toAddress,
                amount,
                category,
                description
            };
            
        } catch (error) {
            console.error('❌ 文化交流转账失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户等级
     */
    async getUserLevel(userAddress) {
        try {
            const balance = await this.getUserBalance(userAddress);
            const balanceNum = parseFloat(balance);
            
            for (const [level, config] of Object.entries(this.userLevels)) {
                if (balanceNum >= config.min && balanceNum <= config.max) {
                    return {
                        level,
                        ...config,
                        currentBalance: balanceNum
                    };
                }
            }
            
            return {
                level: 'DIAMOND',
                ...this.userLevels.DIAMOND,
                currentBalance: balanceNum
            };
            
        } catch (error) {
            console.error('❌ 获取用户等级失败:', error);
            return {
                level: 'BRONZE',
                ...this.userLevels.BRONZE,
                currentBalance: 0
            };
        }
    }

    /**
     * 获取用户今日已获得奖励
     */
    async getDailyEarned(userAddress) {
        try {
            const cacheKey = `daily_earned:${userAddress}:${new Date().toDateString()}`;
            
            if (this.redis) {
                const cached = await this.redis.get(cacheKey);
                if (cached) {
                    return ethers.parseEther(cached);
                }
            } else if (this.cache) {
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    return ethers.parseEther(cached);
                }
            }
            
            return ethers.parseEther('0');
        } catch (error) {
            console.error('❌ 获取每日奖励失败:', error);
            return ethers.parseEther('0');
        }
    }

    /**
     * 更新用户缓存
     */
    async updateUserCache(userAddress) {
        try {
            const balance = await this.getUserBalance(userAddress);
            const stats = await this.getUserStats(userAddress);
            const level = await this.getUserLevel(userAddress);
            
            const userData = {
                balance,
                stats,
                level,
                lastUpdated: new Date().toISOString()
            };
            
            const cacheKey = `user:${userAddress}`;
            
            if (this.redis) {
                await this.redis.setEx(cacheKey, 300, JSON.stringify(userData)); // 5分钟缓存
            } else if (this.cache) {
                this.cache.set(cacheKey, userData);
            }
            
        } catch (error) {
            console.error('❌ 更新用户缓存失败:', error);
        }
    }

    /**
     * 获取最后领取时间
     */
    async getLastClaimTime(userAddress) {
        try {
            const cacheKey = `last_claim:${userAddress}`;
            
            if (this.redis) {
                const cached = await this.redis.get(cacheKey);
                return cached ? new Date(cached) : null;
            } else if (this.cache) {
                return this.cache.get(cacheKey) || null;
            }
            
            return null;
        } catch (error) {
            console.error('❌ 获取最后领取时间失败:', error);
            return null;
        }
    }

    /**
     * 设置最后领取时间
     */
    async setLastClaimTime(userAddress, time) {
        try {
            const cacheKey = `last_claim:${userAddress}`;
            
            if (this.redis) {
                await this.redis.setEx(cacheKey, 86400, time.toISOString()); // 24小时缓存
            } else if (this.cache) {
                this.cache.set(cacheKey, time);
            }
            
        } catch (error) {
            console.error('❌ 设置最后领取时间失败:', error);
        }
    }

    /**
     * 获取网络信息
     */
    getNetworkInfo() {
        return {
            network: this.currentNetwork,
            chainId: this.networkConfig.chainId,
            name: this.networkConfig.name,
            rpc: this.networkConfig.rpc,
            explorer: this.networkConfig.explorer
        };
    }

    /**
     * 获取合约地址
     */
    getContractAddresses() {
        return this.contractAddresses;
    }

    /**
     * 验证地址格式
     */
    isValidAddress(address) {
        return ethers.isAddress(address);
    }

    /**
     * 获取交易详情
     */
    async getTransactionDetails(txHash) {
        try {
            const tx = await this.provider.getTransaction(txHash);
            const receipt = await this.provider.getTransactionReceipt(txHash);
            
            return {
                transaction: tx,
                receipt: receipt,
                status: receipt.status === 1 ? 'success' : 'failed'
            };
        } catch (error) {
            console.error('❌ 获取交易详情失败:', error);
            throw error;
        }
    }

    /**
     * 监听合约事件
     */
    startEventListening() {
        if (!this.cbtTokenContract) {
            console.warn('⚠️ CBT代币合约未初始化，无法监听事件');
            return;
        }

        // 监听奖励分发事件
        this.cbtTokenContract.on('RewardDistributed', (recipient, amount, category, description, event) => {
            console.log('🎉 奖励分发事件:', {
                recipient,
                amount: ethers.formatEther(amount),
                category,
                description,
                txHash: event.transactionHash
            });
        });

        // 监听文化交流交易事件
        this.cbtTokenContract.on('CulturalTransactionRecorded', (transactionId, from, to, amount, category, event) => {
            console.log('🌍 文化交流交易事件:', {
                transactionId: transactionId.toString(),
                from,
                to,
                amount: ethers.formatEther(amount),
                category,
                txHash: event.transactionHash
            });
        });

        console.log('👂 开始监听合约事件');
    }

    /**
     * 停止事件监听
     */
    stopEventListening() {
        if (this.cbtTokenContract) {
            this.cbtTokenContract.removeAllListeners();
            console.log('🔇 停止监听合约事件');
        }
    }

    /**
     * 关闭服务
     */
    async close() {
        try {
            this.stopEventListening();
            
            if (this.redis) {
                await this.redis.quit();
            }
            
            console.log('🔒 区块链服务已关闭');
        } catch (error) {
            console.error('❌ 关闭区块链服务失败:', error);
        }
    }
}

module.exports = EnhancedBlockchainService;

