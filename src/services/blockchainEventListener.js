const EventEmitter = require('events');
const OptimizedBlockchainService = require('./optimizedBlockchainService');

class BlockchainEventListener extends EventEmitter {
    constructor(blockchainService) {
        super();
        this.blockchainService = blockchainService;
        this.isListening = false;
        this.eventFilters = new Map();
        this.lastProcessedBlock = 0;
        this.batchSize = 100; // 每次处理的区块数量
        this.pollingInterval = 15000; // 15秒轮询间隔
        this.pollingTimer = null;
        
        // 事件处理器映射
        this.eventHandlers = {
            'RewardDistributed': this.handleRewardDistributed.bind(this),
            'CulturalTransactionRecorded': this.handleCulturalTransaction.bind(this),
            'Transfer': this.handleTransfer.bind(this),
            'Approval': this.handleApproval.bind(this)
        };
        
        console.log('✅ 区块链事件监听器已初始化');
    }
    
    /**
     * 开始监听事件
     */
    async startListening() {
        try {
            if (this.isListening) {
                console.log('⚠️ 事件监听器已在运行');
                return;
            }
            
            // 检查区块链服务状态
            const health = await this.blockchainService.healthCheck();
            if (!health.connection || !health.contracts) {
                throw new Error('区块链服务未就绪');
            }
            
            // 获取当前区块高度
            const currentBlock = await this.blockchainService.provider.getBlockNumber();
            this.lastProcessedBlock = currentBlock;
            
            console.log(`🎧 开始监听区块链事件，起始区块: ${currentBlock}`);
            
            // 设置实时事件监听
            this.setupRealtimeListeners();
            
            // 启动轮询检查
            this.startPolling();
            
            this.isListening = true;
            this.emit('listenerStarted', { startBlock: currentBlock });
            
        } catch (error) {
            console.error('❌ 启动事件监听失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 停止监听事件
     */
    stopListening() {
        try {
            if (!this.isListening) {
                console.log('⚠️ 事件监听器未在运行');
                return;
            }
            
            // 停止轮询
            if (this.pollingTimer) {
                clearInterval(this.pollingTimer);
                this.pollingTimer = null;
            }
            
            // 移除实时监听器
            this.removeRealtimeListeners();
            
            this.isListening = false;
            console.log('🛑 区块链事件监听已停止');
            this.emit('listenerStopped');
            
        } catch (error) {
            console.error('❌ 停止事件监听失败:', error.message);
        }
    }
    
    /**
     * 设置实时事件监听
     */
    setupRealtimeListeners() {
        if (!this.blockchainService.cbtTokenContract) {
            console.warn('⚠️ CBT代币合约未初始化，跳过实时监听');
            return;
        }
        
        const contract = this.blockchainService.cbtTokenContract;
        
        // 监听奖励分发事件
        contract.on('RewardDistributed', async (recipient, amount, category, description, event) => {
            try {
                await this.handleRewardDistributed({
                    recipient,
                    amount,
                    category,
                    description,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('处理奖励分发事件失败:', error.message);
            }
        });
        
        // 监听文化交流交易事件
        contract.on('CulturalTransactionRecorded', async (transactionId, from, to, amount, category, event) => {
            try {
                await this.handleCulturalTransaction({
                    transactionId,
                    from,
                    to,
                    amount,
                    category,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('处理文化交流交易事件失败:', error.message);
            }
        });
        
        // 监听转账事件
        contract.on('Transfer', async (from, to, value, event) => {
            try {
                await this.handleTransfer({
                    from,
                    to,
                    value,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('处理转账事件失败:', error.message);
            }
        });
        
        console.log('✅ 实时事件监听器已设置');
    }
    
    /**
     * 移除实时事件监听
     */
    removeRealtimeListeners() {
        if (this.blockchainService.cbtTokenContract) {
            this.blockchainService.cbtTokenContract.removeAllListeners();
            console.log('🗑️ 实时事件监听器已移除');
        }
    }
    
    /**
     * 启动轮询检查
     */
    startPolling() {
        this.pollingTimer = setInterval(async () => {
            try {
                await this.checkMissedEvents();
            } catch (error) {
                console.error('轮询检查失败:', error.message);
            }
        }, this.pollingInterval);
        
        console.log(`⏰ 轮询检查已启动，间隔: ${this.pollingInterval}ms`);
    }
    
    /**
     * 检查遗漏的事件
     */
    async checkMissedEvents() {
        try {
            const currentBlock = await this.blockchainService.provider.getBlockNumber();
            
            if (currentBlock <= this.lastProcessedBlock) {
                return; // 没有新区块
            }
            
            const fromBlock = this.lastProcessedBlock + 1;
            const toBlock = Math.min(currentBlock, fromBlock + this.batchSize - 1);
            
            console.log(`🔍 检查区块 ${fromBlock} 到 ${toBlock} 的遗漏事件`);
            
            // 查询遗漏的事件
            await this.queryHistoricalEvents(fromBlock, toBlock);
            
            this.lastProcessedBlock = toBlock;
            
        } catch (error) {
            console.error('检查遗漏事件失败:', error.message);
        }
    }
    
    /**
     * 查询历史事件
     */
    async queryHistoricalEvents(fromBlock, toBlock) {
        if (!this.blockchainService.cbtTokenContract) {
            return;
        }
        
        const contract = this.blockchainService.cbtTokenContract;
        
        try {
            // 查询奖励分发事件
            const rewardEvents = await contract.queryFilter(
                contract.filters.RewardDistributed(),
                fromBlock,
                toBlock
            );
            
            for (const event of rewardEvents) {
                await this.handleRewardDistributed({
                    recipient: event.args[0],
                    amount: event.args[1],
                    category: event.args[2],
                    description: event.args[3],
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now(),
                    isHistorical: true
                });
            }
            
            // 查询文化交流交易事件
            const culturalEvents = await contract.queryFilter(
                contract.filters.CulturalTransactionRecorded(),
                fromBlock,
                toBlock
            );
            
            for (const event of culturalEvents) {
                await this.handleCulturalTransaction({
                    transactionId: event.args[0],
                    from: event.args[1],
                    to: event.args[2],
                    amount: event.args[3],
                    category: event.args[4],
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now(),
                    isHistorical: true
                });
            }
            
            // 查询转账事件
            const transferEvents = await contract.queryFilter(
                contract.filters.Transfer(),
                fromBlock,
                toBlock
            );
            
            for (const event of transferEvents) {
                await this.handleTransfer({
                    from: event.args[0],
                    to: event.args[1],
                    value: event.args[2],
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: Date.now(),
                    isHistorical: true
                });
            }
            
        } catch (error) {
            console.error('查询历史事件失败:', error.message);
        }
    }
    
    /**
     * 处理奖励分发事件
     */
    async handleRewardDistributed(eventData) {
        try {
            const { ethers } = require('ethers');
            
            const processedEvent = {
                type: 'RewardDistributed',
                recipient: eventData.recipient,
                amount: ethers.formatEther(eventData.amount),
                category: eventData.category,
                description: eventData.description,
                transactionHash: eventData.transactionHash,
                blockNumber: eventData.blockNumber,
                timestamp: eventData.timestamp,
                isHistorical: eventData.isHistorical || false
            };
            
            console.log('🎁 奖励分发事件:', processedEvent);
            
            // 清除相关缓存
            await this.blockchainService.clearBalanceCache(eventData.recipient);
            
            // 发出事件
            this.emit('rewardDistributed', processedEvent);
            
            // 可以在这里添加数据库记录逻辑
            // await this.saveEventToDatabase(processedEvent);
            
        } catch (error) {
            console.error('处理奖励分发事件失败:', error.message);
        }
    }
    
    /**
     * 处理文化交流交易事件
     */
    async handleCulturalTransaction(eventData) {
        try {
            const { ethers } = require('ethers');
            
            const processedEvent = {
                type: 'CulturalTransaction',
                transactionId: eventData.transactionId.toString(),
                from: eventData.from,
                to: eventData.to,
                amount: ethers.formatEther(eventData.amount),
                category: eventData.category,
                transactionHash: eventData.transactionHash,
                blockNumber: eventData.blockNumber,
                timestamp: eventData.timestamp,
                isHistorical: eventData.isHistorical || false
            };
            
            console.log('🌍 文化交流交易事件:', processedEvent);
            
            // 清除相关缓存
            await this.blockchainService.clearBalanceCache(eventData.from);
            await this.blockchainService.clearBalanceCache(eventData.to);
            
            // 发出事件
            this.emit('culturalTransaction', processedEvent);
            
        } catch (error) {
            console.error('处理文化交流交易事件失败:', error.message);
        }
    }
    
    /**
     * 处理转账事件
     */
    async handleTransfer(eventData) {
        try {
            const { ethers } = require('ethers');
            
            // 过滤零地址转账（铸造和销毁）
            const isZeroAddress = (addr) => addr === ethers.ZeroAddress;
            
            const processedEvent = {
                type: 'Transfer',
                from: eventData.from,
                to: eventData.to,
                value: ethers.formatEther(eventData.value),
                transactionHash: eventData.transactionHash,
                blockNumber: eventData.blockNumber,
                timestamp: eventData.timestamp,
                isHistorical: eventData.isHistorical || false,
                isMint: isZeroAddress(eventData.from),
                isBurn: isZeroAddress(eventData.to)
            };
            
            console.log('💸 转账事件:', processedEvent);
            
            // 清除相关缓存
            if (!isZeroAddress(eventData.from)) {
                await this.blockchainService.clearBalanceCache(eventData.from);
            }
            if (!isZeroAddress(eventData.to)) {
                await this.blockchainService.clearBalanceCache(eventData.to);
            }
            
            // 发出事件
            this.emit('transfer', processedEvent);
            
        } catch (error) {
            console.error('处理转账事件失败:', error.message);
        }
    }
    
    /**
     * 处理授权事件
     */
    async handleApproval(eventData) {
        try {
            const { ethers } = require('ethers');
            
            const processedEvent = {
                type: 'Approval',
                owner: eventData.owner,
                spender: eventData.spender,
                value: ethers.formatEther(eventData.value),
                transactionHash: eventData.transactionHash,
                blockNumber: eventData.blockNumber,
                timestamp: eventData.timestamp,
                isHistorical: eventData.isHistorical || false
            };
            
            console.log('✅ 授权事件:', processedEvent);
            
            // 发出事件
            this.emit('approval', processedEvent);
            
        } catch (error) {
            console.error('处理授权事件失败:', error.message);
        }
    }
    
    /**
     * 获取监听状态
     */
    getListenerStatus() {
        return {
            isListening: this.isListening,
            lastProcessedBlock: this.lastProcessedBlock,
            pollingInterval: this.pollingInterval,
            batchSize: this.batchSize,
            eventHandlers: Object.keys(this.eventHandlers)
        };
    }
    
    /**
     * 设置轮询间隔
     */
    setPollingInterval(interval) {
        this.pollingInterval = interval;
        
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.startPolling();
        }
        
        console.log(`⏰ 轮询间隔已更新为: ${interval}ms`);
    }
    
    /**
     * 设置批处理大小
     */
    setBatchSize(size) {
        this.batchSize = size;
        console.log(`📦 批处理大小已更新为: ${size}`);
    }
    
    /**
     * 重置监听器
     */
    async reset() {
        try {
            this.stopListening();
            
            // 重置状态
            this.lastProcessedBlock = 0;
            this.eventFilters.clear();
            
            console.log('🔄 事件监听器已重置');
            
        } catch (error) {
            console.error('重置监听器失败:', error.message);
        }
    }
    
    /**
     * 清理资源
     */
    cleanup() {
        try {
            this.stopListening();
            this.removeAllListeners();
            console.log('✅ 事件监听器资源已清理');
        } catch (error) {
            console.error('清理事件监听器失败:', error.message);
        }
    }
}

module.exports = BlockchainEventListener;

