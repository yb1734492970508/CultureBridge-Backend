const { ethers } = require('ethers');
const { optimizedBlockchainManager } = require('./optimizedBlockchainManager');
const { databaseManager } = require('../utils/databaseManager');
const EventEmitter = require('events');

class BlockchainEventListener extends EventEmitter {
  constructor() {
    super();
    this.listeners = new Map();
    this.isListening = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5秒
    this.eventBuffer = [];
    this.maxBufferSize = 1000;
    this.processedEvents = new Set();
    this.eventFilters = new Map();
  }

  // 启动事件监听
  async startListening() {
    if (this.isListening) {
      console.log('⚠️ 事件监听器已在运行');
      return;
    }

    try {
      console.log('🔄 启动区块链事件监听器...');
      
      // 设置CBT代币事件监听
      await this.setupCBTEventListeners();
      
      // 设置重连机制
      this.setupReconnectionHandlers();
      
      // 启动事件处理器
      this.startEventProcessor();
      
      this.isListening = true;
      console.log('✅ 区块链事件监听器启动成功');
      
      this.emit('listenerStarted');
    } catch (error) {
      console.error('❌ 启动事件监听器失败:', error);
      throw error;
    }
  }

  // 设置CBT代币事件监听
  async setupCBTEventListeners() {
    const networks = ['bscMainnet', 'bscTestnet'];
    
    for (const networkName of networks) {
      try {
        const contract = optimizedBlockchainManager.contracts.get(`CBT_${networkName}`);
        if (!contract) {
          console.warn(`⚠️ CBT合约不可用 (${networkName})`);
          continue;
        }

        // Transfer事件监听
        const transferFilter = contract.filters.Transfer();
        this.eventFilters.set(`Transfer_${networkName}`, transferFilter);
        
        contract.on(transferFilter, async (from, to, value, event) => {
          await this.handleTransferEvent(from, to, value, event, networkName);
        });

        // RewardDistributed事件监听
        const rewardFilter = contract.filters.RewardDistributed();
        this.eventFilters.set(`RewardDistributed_${networkName}`, rewardFilter);
        
        contract.on(rewardFilter, async (user, amount, reason, event) => {
          await this.handleRewardEvent(user, amount, reason, event, networkName);
        });

        console.log(`✅ ${networkName} CBT事件监听器设置完成`);
        this.listeners.set(networkName, contract);
      } catch (error) {
        console.error(`❌ 设置 ${networkName} 事件监听失败:`, error);
      }
    }
  }

  // 处理Transfer事件
  async handleTransferEvent(from, to, value, event, networkName) {
    try {
      const eventId = `transfer_${event.transactionHash}_${event.logIndex}`;
      
      // 防止重复处理
      if (this.processedEvents.has(eventId)) {
        return;
      }
      this.processedEvents.add(eventId);

      const transferData = {
        eventType: 'Transfer',
        networkName,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        from,
        to,
        value: ethers.formatEther(value),
        timestamp: new Date()
      };

      // 添加到事件缓冲区
      this.addToEventBuffer(transferData);

      // 发送实时通知
      this.emit('transfer', transferData);

      console.log(`📤 Transfer事件: ${from} -> ${to}, 金额: ${transferData.value} CBT`);
    } catch (error) {
      console.error('处理Transfer事件失败:', error);
    }
  }

  // 处理RewardDistributed事件
  async handleRewardEvent(user, amount, reason, event, networkName) {
    try {
      const eventId = `reward_${event.transactionHash}_${event.logIndex}`;
      
      if (this.processedEvents.has(eventId)) {
        return;
      }
      this.processedEvents.add(eventId);

      const rewardData = {
        eventType: 'RewardDistributed',
        networkName,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        user,
        amount: ethers.formatEther(amount),
        reason,
        timestamp: new Date()
      };

      this.addToEventBuffer(rewardData);
      this.emit('reward', rewardData);

      console.log(`🎁 奖励事件: ${user} 获得 ${rewardData.amount} CBT (${reason})`);
    } catch (error) {
      console.error('处理Reward事件失败:', error);
    }
  }

  // 添加事件到缓冲区
  addToEventBuffer(eventData) {
    this.eventBuffer.push(eventData);
    
    // 限制缓冲区大小
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift(); // 移除最旧的事件
    }
  }

  // 启动事件处理器
  startEventProcessor() {
    // 每10秒处理一次事件缓冲区
    setInterval(async () => {
      if (this.eventBuffer.length > 0) {
        await this.processEventBuffer();
      }
    }, 10000);
  }

  // 处理事件缓冲区
  async processEventBuffer() {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = this.eventBuffer.splice(0, 100); // 每次处理100个事件
    
    try {
      // 批量保存事件到数据库
      await this.batchSaveEvents(events);
      
      console.log(`📊 处理了 ${events.length} 个区块链事件`);
    } catch (error) {
      console.error('处理事件缓冲区失败:', error);
      
      // 将事件重新添加到缓冲区开头
      this.eventBuffer.unshift(...events);
    }
  }

  // 批量保存事件
  async batchSaveEvents(events) {
    const cachePromises = events.map(event => {
      const cacheKey = `blockchain_event:${event.transactionHash}:${event.logIndex}`;
      return databaseManager.cacheSet(cacheKey, event, 86400); // 24小时
    });

    await Promise.allSettled(cachePromises);
  }

  // 设置重连处理器
  setupReconnectionHandlers() {
    for (const [networkName, contract] of this.listeners) {
      const provider = contract.provider;
      
      provider.on('error', (error) => {
        console.error(`❌ ${networkName} 网络错误:`, error);
        this.handleReconnection(networkName);
      });
    }
  }

  // 处理重连
  async handleReconnection(networkName) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ ${networkName} 达到最大重连次数，停止重连`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 尝试重连 ${networkName} (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.setupCBTEventListeners();
        this.reconnectAttempts = 0;
        console.log(`✅ ${networkName} 重连成功`);
      } catch (error) {
        console.error(`❌ ${networkName} 重连失败:`, error);
        this.handleReconnection(networkName);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // 停止监听
  async stopListening() {
    if (!this.isListening) {
      console.log('⚠️ 事件监听器未在运行');
      return;
    }

    try {
      console.log('🔄 停止区块链事件监听器...');
      
      // 移除所有监听器
      for (const [networkName, contract] of this.listeners) {
        contract.removeAllListeners();
      }
      
      this.listeners.clear();
      this.eventFilters.clear();
      this.isListening = false;
      
      console.log('✅ 区块链事件监听器已停止');
      this.emit('listenerStopped');
    } catch (error) {
      console.error('❌ 停止事件监听器失败:', error);
      throw error;
    }
  }

  // 健康检查
  async healthCheck() {
    try {
      const health = {
        healthy: this.isListening,
        listeners: this.listeners.size,
        eventBuffer: this.eventBuffer.length,
        processedEvents: this.processedEvents.size,
        reconnectAttempts: this.reconnectAttempts,
        networks: {},
        timestamp: new Date().toISOString()
      };

      // 检查每个网络的连接状态
      for (const [networkName, contract] of this.listeners) {
        try {
          const provider = contract.provider;
          const blockNumber = await provider.getBlockNumber();
          
          health.networks[networkName] = {
            connected: true,
            latestBlock: blockNumber
          };
        } catch (error) {
          health.networks[networkName] = {
            connected: false,
            error: error.message
          };
          health.healthy = false;
        }
      }

      return health;
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 创建单例实例
const blockchainEventListener = new BlockchainEventListener();

module.exports = {
  BlockchainEventListener,
  blockchainEventListener,
  
  // 便捷方法
  startEventListening: () => blockchainEventListener.startListening(),
  stopEventListening: () => blockchainEventListener.stopListening(),
  eventListenerHealthCheck: () => blockchainEventListener.healthCheck()
};

