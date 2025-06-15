const { databaseManager } = require('./databaseManager');
const crypto = require('crypto');

class APICache {
  constructor() {
    this.defaultTTL = 300; // 5分钟默认缓存时间
    this.maxCacheSize = 1000; // 最大缓存条目数
    this.hitCount = 0;
    this.missCount = 0;
    this.memoryCache = new Map(); // 内存缓存作为Redis的备份
  }

  // 生成缓存键
  generateCacheKey(req) {
    const { method, originalUrl, query, body, user } = req;
    const keyData = {
      method,
      url: originalUrl,
      query: query || {},
      body: method === 'POST' || method === 'PUT' ? body : {},
      userId: user ? user.id : 'anonymous'
    };
    
    const keyString = JSON.stringify(keyData);
    return `api_cache:${crypto.createHash('md5').update(keyString).digest('hex')}`;
  }

  // 检查是否应该缓存
  shouldCache(req, res) {
    // 只缓存GET请求
    if (req.method !== 'GET') {
      return false;
    }

    // 不缓存错误响应
    if (res.statusCode >= 400) {
      return false;
    }

    // 不缓存包含敏感信息的路由
    const sensitiveRoutes = [
      '/api/auth/profile',
      '/api/wallet/balance',
      '/api/user/private'
    ];
    
    if (sensitiveRoutes.some(route => req.originalUrl.includes(route))) {
      return false;
    }

    // 不缓存实时数据
    const realtimeRoutes = [
      '/api/chat/messages',
      '/api/notifications',
      '/api/live'
    ];
    
    if (realtimeRoutes.some(route => req.originalUrl.includes(route))) {
      return false;
    }

    return true;
  }

  // 获取缓存TTL
  getCacheTTL(req) {
    const url = req.originalUrl;
    
    // 不同类型的数据使用不同的缓存时间
    if (url.includes('/api/blockchain/')) {
      return 60; // 区块链数据1分钟
    }
    
    if (url.includes('/api/translation/')) {
      return 3600; // 翻译结果1小时
    }
    
    if (url.includes('/api/users/')) {
      return 300; // 用户数据5分钟
    }
    
    if (url.includes('/api/posts/')) {
      return 600; // 帖子数据10分钟
    }
    
    if (url.includes('/api/stats/')) {
      return 1800; // 统计数据30分钟
    }
    
    return this.defaultTTL;
  }

  // 缓存中间件
  middleware() {
    return async (req, res, next) => {
      // 检查是否应该使用缓存
      if (!this.shouldCache(req, res)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req);
      
      try {
        // 尝试从Redis获取缓存
        let cachedData = await databaseManager.cacheGet(cacheKey);
        
        // 如果Redis不可用，尝试从内存缓存获取
        if (!cachedData && this.memoryCache.has(cacheKey)) {
          const memoryCacheItem = this.memoryCache.get(cacheKey);
          if (memoryCacheItem.expires > Date.now()) {
            cachedData = memoryCacheItem.data;
          } else {
            this.memoryCache.delete(cacheKey);
          }
        }

        if (cachedData) {
          // 缓存命中
          this.hitCount++;
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);
          res.set('X-Cache-TTL', cachedData.ttl || 'unknown');
          
          return res.status(cachedData.statusCode || 200).json(cachedData.data);
        }

        // 缓存未命中，继续处理请求
        this.missCount++;
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);

        // 保存原始的json方法
        const originalJson = res.json;
        
        // 重写json方法以拦截响应
        res.json = (data) => {
          // 检查是否应该缓存响应
          if (this.shouldCache(req, res)) {
            const ttl = this.getCacheTTL(req);
            const cacheData = {
              data,
              statusCode: res.statusCode,
              ttl,
              timestamp: Date.now()
            };

            // 异步保存到缓存，不阻塞响应
            setImmediate(async () => {
              try {
                // 保存到Redis
                await databaseManager.cacheSet(cacheKey, cacheData, ttl);
                
                // 保存到内存缓存作为备份
                if (this.memoryCache.size >= this.maxCacheSize) {
                  // 清理最旧的缓存项
                  const firstKey = this.memoryCache.keys().next().value;
                  this.memoryCache.delete(firstKey);
                }
                
                this.memoryCache.set(cacheKey, {
                  data: cacheData,
                  expires: Date.now() + (ttl * 1000)
                });
              } catch (error) {
                console.error('缓存保存失败:', error);
              }
            });
          }

          // 调用原始的json方法
          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        console.error('缓存中间件错误:', error);
        next();
      }
    };
  }

  // 手动缓存数据
  async set(key, data, ttl = null) {
    ttl = ttl || this.defaultTTL;
    
    const cacheData = {
      data,
      ttl,
      timestamp: Date.now()
    };

    try {
      // 保存到Redis
      await databaseManager.cacheSet(key, cacheData, ttl);
      
      // 保存到内存缓存
      this.memoryCache.set(key, {
        data: cacheData,
        expires: Date.now() + (ttl * 1000)
      });
      
      return true;
    } catch (error) {
      console.error('手动缓存设置失败:', error);
      return false;
    }
  }

  // 手动获取缓存
  async get(key) {
    try {
      // 尝试从Redis获取
      let cachedData = await databaseManager.cacheGet(key);
      
      // 如果Redis不可用，尝试从内存缓存获取
      if (!cachedData && this.memoryCache.has(key)) {
        const memoryCacheItem = this.memoryCache.get(key);
        if (memoryCacheItem.expires > Date.now()) {
          cachedData = memoryCacheItem.data;
        } else {
          this.memoryCache.delete(key);
        }
      }

      return cachedData ? cachedData.data : null;
    } catch (error) {
      console.error('手动缓存获取失败:', error);
      return null;
    }
  }

  // 删除缓存
  async delete(key) {
    try {
      await databaseManager.cacheDel(key);
      this.memoryCache.delete(key);
      return true;
    } catch (error) {
      console.error('缓存删除失败:', error);
      return false;
    }
  }

  // 清空特定模式的缓存
  async deletePattern(pattern) {
    try {
      // 这里需要Redis的SCAN命令来查找匹配的键
      // 简化实现，实际应用中需要更复杂的逻辑
      const keys = Array.from(this.memoryCache.keys()).filter(key => 
        key.includes(pattern)
      );
      
      for (const key of keys) {
        await this.delete(key);
      }
      
      return true;
    } catch (error) {
      console.error('模式缓存删除失败:', error);
      return false;
    }
  }

  // 获取缓存统计
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(2) : 0;
    
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      totalRequests,
      hitRate: `${hitRate}%`,
      memoryCacheSize: this.memoryCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }

  // 重置统计
  resetStats() {
    this.hitCount = 0;
    this.missCount = 0;
  }

  // 清空所有缓存
  async clear() {
    try {
      // 清空内存缓存
      this.memoryCache.clear();
      
      // 清空Redis缓存（需要谨慎使用）
      // await databaseManager.redisClient.flushDb();
      
      return true;
    } catch (error) {
      console.error('清空缓存失败:', error);
      return false;
    }
  }

  // 预热缓存
  async warmup(routes) {
    console.log('🔥 开始缓存预热...');
    
    for (const route of routes) {
      try {
        // 这里可以模拟请求来预热缓存
        // 实际实现需要根据具体需求调整
        console.log(`预热路由: ${route}`);
      } catch (error) {
        console.error(`预热路由失败 ${route}:`, error);
      }
    }
    
    console.log('✅ 缓存预热完成');
  }

  // 缓存健康检查
  async healthCheck() {
    try {
      const testKey = 'health_check_' + Date.now();
      const testData = { test: true, timestamp: Date.now() };
      
      // 测试写入
      await this.set(testKey, testData, 10);
      
      // 测试读取
      const retrieved = await this.get(testKey);
      
      // 测试删除
      await this.delete(testKey);
      
      const isHealthy = retrieved && retrieved.test === true;
      
      return {
        healthy: isHealthy,
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
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
const apiCache = new APICache();

module.exports = {
  APICache,
  apiCache,
  
  // 便捷方法
  cacheMiddleware: () => apiCache.middleware(),
  getCacheStats: () => apiCache.getStats(),
  clearCache: () => apiCache.clear(),
  cacheHealthCheck: () => apiCache.healthCheck()
};

