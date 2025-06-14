const mongoose = require('mongoose');
const redis = require('redis');

class DatabaseManager {
  constructor() {
    this.mongoConnection = null;
    this.redisClient = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5秒
  }

  // MongoDB连接配置
  async connectMongoDB() {
    try {
      const mongoOptions = {
        // 连接池配置
        maxPoolSize: 10, // 最大连接数
        minPoolSize: 2,  // 最小连接数
        maxIdleTimeMS: 30000, // 连接空闲时间
        serverSelectionTimeoutMS: 5000, // 服务器选择超时
        socketTimeoutMS: 45000, // Socket超时
        
        // 缓冲配置
        bufferMaxEntries: 0,
        bufferCommands: false,
        
        // 其他配置
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: process.env.NODE_ENV !== 'production', // 生产环境禁用自动索引
        autoCreate: true,
        
        // 心跳配置
        heartbeatFrequencyMS: 10000,
        
        // 压缩配置
        compressors: ['zlib'],
        zlibCompressionLevel: 6,
        
        // 读写配置
        readPreference: 'primary',
        writeConcern: {
          w: 'majority',
          j: true,
          wtimeout: 10000
        }
      };

      // 根据环境设置不同的连接字符串
      const mongoURI = process.env.NODE_ENV === 'production' 
        ? process.env.MONGO_URI_PROD 
        : process.env.MONGO_URI || 'mongodb://localhost:27017/culturebridge';

      console.log('🔄 正在连接MongoDB...');
      this.mongoConnection = await mongoose.connect(mongoURI, mongoOptions);
      
      // 监听连接事件
      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB连接成功');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB连接错误:', err);
        this.handleConnectionError();
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB连接断开');
        this.isConnected = false;
        this.handleReconnection();
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB重新连接成功');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      // 设置查询性能监控
      if (process.env.NODE_ENV === 'development') {
        mongoose.set('debug', true);
      }

      return this.mongoConnection;
    } catch (error) {
      console.error('❌ MongoDB连接失败:', error);
      throw error;
    }
  }

  // Redis连接配置
  async connectRedis() {
    try {
      const redisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        
        // 连接池配置
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxLoadingTimeout: 5000,
        
        // 连接配置
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: true,
        
        // 重连配置
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        
        // 性能配置
        enableOfflineQueue: false,
        keepAlive: 30000,
        
        // 序列化配置
        keyPrefix: 'culturebridge:',
        
        // 集群配置（如果使用Redis集群）
        enableReadyCheck: true,
        redisOptions: {
          password: process.env.REDIS_PASSWORD
        }
      };

      console.log('🔄 正在连接Redis...');
      this.redisClient = redis.createClient(redisOptions);

      // 监听Redis事件
      this.redisClient.on('connect', () => {
        console.log('✅ Redis连接成功');
      });

      this.redisClient.on('ready', () => {
        console.log('✅ Redis准备就绪');
      });

      this.redisClient.on('error', (err) => {
        console.error('❌ Redis连接错误:', err);
      });

      this.redisClient.on('end', () => {
        console.log('⚠️ Redis连接结束');
      });

      this.redisClient.on('reconnecting', () => {
        console.log('🔄 Redis重新连接中...');
      });

      await this.redisClient.connect();
      return this.redisClient;
    } catch (error) {
      console.error('❌ Redis连接失败:', error);
      // Redis连接失败不应该阻止应用启动
      console.log('⚠️ 应用将在没有Redis缓存的情况下运行');
      return null;
    }
  }

  // 处理连接错误
  handleConnectionError() {
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      console.log(`🔄 尝试重新连接 (${this.connectionRetries}/${this.maxRetries})...`);
      setTimeout(() => {
        this.handleReconnection();
      }, this.retryDelay * this.connectionRetries);
    } else {
      console.error('❌ 达到最大重连次数，停止重连');
      process.exit(1);
    }
  }

  // 处理重连
  async handleReconnection() {
    try {
      if (!this.isConnected) {
        await this.connectMongoDB();
      }
    } catch (error) {
      console.error('❌ 重连失败:', error);
      this.handleConnectionError();
    }
  }

  // 获取数据库连接状态
  getConnectionStatus() {
    return {
      mongodb: {
        connected: this.isConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      },
      redis: {
        connected: this.redisClient ? this.redisClient.isReady : false,
        status: this.redisClient ? this.redisClient.status : 'disconnected'
      }
    };
  }

  // 获取连接池统计
  getPoolStats() {
    const mongoStats = {
      totalConnections: mongoose.connection.db?.serverConfig?.connections?.length || 0,
      availableConnections: mongoose.connection.db?.serverConfig?.availableConnections?.length || 0,
      checkedOutConnections: mongoose.connection.db?.serverConfig?.checkedOutConnections?.length || 0
    };

    return {
      mongodb: mongoStats,
      redis: {
        connectedClients: this.redisClient ? 1 : 0,
        blockedClients: 0,
        totalSystemMemory: process.memoryUsage().heapTotal
      }
    };
  }

  // 健康检查
  async healthCheck() {
    const health = {
      mongodb: false,
      redis: false,
      timestamp: new Date().toISOString()
    };

    try {
      // MongoDB健康检查
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        health.mongodb = true;
      }
    } catch (error) {
      console.error('MongoDB健康检查失败:', error);
    }

    try {
      // Redis健康检查
      if (this.redisClient && this.redisClient.isReady) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      console.error('Redis健康检查失败:', error);
    }

    return health;
  }

  // 优雅关闭连接
  async gracefulShutdown() {
    console.log('🔄 正在优雅关闭数据库连接...');
    
    try {
      // 关闭Redis连接
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('✅ Redis连接已关闭');
      }

      // 关闭MongoDB连接
      if (this.mongoConnection) {
        await mongoose.connection.close();
        console.log('✅ MongoDB连接已关闭');
      }
    } catch (error) {
      console.error('❌ 关闭数据库连接时出错:', error);
    }
  }

  // 缓存操作封装
  async cacheGet(key) {
    if (!this.redisClient || !this.redisClient.isReady) {
      return null;
    }
    
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('缓存读取错误:', error);
      return null;
    }
  }

  async cacheSet(key, value, ttl = 3600) {
    if (!this.redisClient || !this.redisClient.isReady) {
      return false;
    }
    
    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('缓存写入错误:', error);
      return false;
    }
  }

  async cacheDel(key) {
    if (!this.redisClient || !this.redisClient.isReady) {
      return false;
    }
    
    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      console.error('缓存删除错误:', error);
      return false;
    }
  }

  async cacheExists(key) {
    if (!this.redisClient || !this.redisClient.isReady) {
      return false;
    }
    
    try {
      const exists = await this.redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('缓存检查错误:', error);
      return false;
    }
  }

  // 批量缓存操作
  async cacheMultiGet(keys) {
    if (!this.redisClient || !this.redisClient.isReady) {
      return {};
    }
    
    try {
      const values = await this.redisClient.mGet(keys);
      const result = {};
      keys.forEach((key, index) => {
        result[key] = values[index] ? JSON.parse(values[index]) : null;
      });
      return result;
    } catch (error) {
      console.error('批量缓存读取错误:', error);
      return {};
    }
  }

  async cacheMultiSet(keyValuePairs, ttl = 3600) {
    if (!this.redisClient || !this.redisClient.isReady) {
      return false;
    }
    
    try {
      const pipeline = this.redisClient.multi();
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        pipeline.setEx(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('批量缓存写入错误:', error);
      return false;
    }
  }
}

// 创建单例实例
const databaseManager = new DatabaseManager();

// 导出实例和类
module.exports = {
  DatabaseManager,
  databaseManager,
  
  // 便捷方法
  connectDatabases: async () => {
    await databaseManager.connectMongoDB();
    await databaseManager.connectRedis();
    return databaseManager;
  },
  
  getMongoConnection: () => databaseManager.mongoConnection,
  getRedisClient: () => databaseManager.redisClient,
  getConnectionStatus: () => databaseManager.getConnectionStatus(),
  healthCheck: () => databaseManager.healthCheck(),
  gracefulShutdown: () => databaseManager.gracefulShutdown()
};

