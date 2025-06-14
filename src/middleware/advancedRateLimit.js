const rateLimit = require('express-rate-limit');
const { databaseManager } = require('../utils/databaseManager');

class AdvancedRateLimiter {
  constructor() {
    this.limiters = new Map();
    this.defaultConfig = {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 最大请求数
      message: {
        error: '请求过于频繁，请稍后再试',
        retryAfter: '请在 {{retryAfter}} 秒后重试'
      },
      standardHeaders: true,
      legacyHeaders: false
    };
  }

  // 创建基础限流器
  createBasicLimiter(options = {}) {
    const config = { ...this.defaultConfig, ...options };
    
    return rateLimit({
      ...config,
      store: this.createRedisStore(),
      keyGenerator: (req) => this.generateKey(req, options.keyType),
      handler: (req, res) => this.handleRateLimit(req, res, config),
      onLimitReached: (req, res, options) => this.onLimitReached(req, res, options)
    });
  }

  // 创建Redis存储
  createRedisStore() {
    const redisClient = databaseManager.redisClient;
    
    if (!redisClient) {
      console.warn('⚠️ Redis不可用，使用内存存储进行限流');
      return undefined; // 使用默认内存存储
    }

    return {
      incr: async (key, windowMs) => {
        try {
          const pipeline = redisClient.multi();
          pipeline.incr(key);
          pipeline.expire(key, Math.ceil(windowMs / 1000));
          const results = await pipeline.exec();
          return results[0][1]; // 返回计数值
        } catch (error) {
          console.error('Redis限流存储错误:', error);
          throw error;
        }
      },
      
      decrement: async (key) => {
        try {
          await redisClient.decr(key);
        } catch (error) {
          console.error('Redis限流递减错误:', error);
        }
      },
      
      resetKey: async (key) => {
        try {
          await redisClient.del(key);
        } catch (error) {
          console.error('Redis限流重置错误:', error);
        }
      }
    };
  }

  // 生成限流键
  generateKey(req, keyType = 'ip') {
    const baseKey = 'rate_limit:';
    
    switch (keyType) {
      case 'ip':
        return baseKey + 'ip:' + this.getClientIP(req);
      
      case 'user':
        const userId = req.user ? req.user.id : 'anonymous';
        return baseKey + 'user:' + userId;
      
      case 'api':
        const route = req.route ? req.route.path : req.path;
        return baseKey + 'api:' + route + ':' + this.getClientIP(req);
      
      case 'global':
        return baseKey + 'global';
      
      case 'combined':
        const ip = this.getClientIP(req);
        const user = req.user ? req.user.id : 'anonymous';
        return baseKey + 'combined:' + ip + ':' + user;
      
      default:
        return baseKey + 'ip:' + this.getClientIP(req);
    }
  }

  // 获取客户端IP
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '0.0.0.0';
  }

  // 处理限流
  handleRateLimit(req, res, config) {
    const retryAfter = Math.round(config.windowMs / 1000);
    
    res.status(429).json({
      success: false,
      error: config.message.error,
      retryAfter: retryAfter,
      limit: config.max,
      windowMs: config.windowMs,
      timestamp: new Date().toISOString()
    });
  }

  // 限流触发回调
  onLimitReached(req, res, options) {
    const ip = this.getClientIP(req);
    const user = req.user ? req.user.id : 'anonymous';
    
    console.warn(`🚨 限流触发: IP=${ip}, User=${user}, Route=${req.originalUrl}`);
    
    // 记录到数据库或日志系统
    this.logRateLimitEvent(req, options);
  }

  // 记录限流事件
  async logRateLimitEvent(req, options) {
    try {
      const event = {
        ip: this.getClientIP(req),
        userId: req.user ? req.user.id : null,
        route: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        limit: options.max,
        windowMs: options.windowMs
      };

      // 保存到Redis或数据库
      const key = `rate_limit_log:${Date.now()}`;
      await databaseManager.cacheSet(key, event, 86400); // 保存24小时
    } catch (error) {
      console.error('限流事件记录失败:', error);
    }
  }

  // 预定义的限流配置
  getPresetLimiters() {
    return {
      // 严格限流 - 用于敏感操作
      strict: this.createBasicLimiter({
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 5, // 最多5次请求
        keyType: 'combined',
        message: {
          error: '操作过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // 认证限流 - 用于登录注册
      auth: this.createBasicLimiter({
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 10, // 最多10次尝试
        keyType: 'ip',
        message: {
          error: '登录尝试过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // API限流 - 用于一般API
      api: this.createBasicLimiter({
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100, // 最多100次请求
        keyType: 'user',
        message: {
          error: 'API请求过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // 区块链限流 - 用于区块链操作
      blockchain: this.createBasicLimiter({
        windowMs: 60 * 1000, // 1分钟
        max: 10, // 最多10次交易
        keyType: 'user',
        message: {
          error: '区块链操作过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // 语音翻译限流
      voice: this.createBasicLimiter({
        windowMs: 60 * 1000, // 1分钟
        max: 20, // 最多20次翻译
        keyType: 'user',
        message: {
          error: '语音翻译请求过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // 聊天限流
      chat: this.createBasicLimiter({
        windowMs: 60 * 1000, // 1分钟
        max: 30, // 最多30条消息
        keyType: 'user',
        message: {
          error: '发送消息过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // 上传限流
      upload: this.createBasicLimiter({
        windowMs: 60 * 1000, // 1分钟
        max: 5, // 最多5次上传
        keyType: 'user',
        message: {
          error: '文件上传过于频繁，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      }),

      // 全局限流 - 防止DDoS
      global: this.createBasicLimiter({
        windowMs: 60 * 1000, // 1分钟
        max: 1000, // 全局最多1000次请求
        keyType: 'global',
        message: {
          error: '服务器负载过高，请稍后再试',
          retryAfter: '请在 {{retryAfter}} 秒后重试'
        }
      })
    };
  }

  // 动态限流 - 根据用户等级调整限制
  createDynamicLimiter(baseConfig = {}) {
    return (req, res, next) => {
      const user = req.user;
      let config = { ...this.defaultConfig, ...baseConfig };

      if (user) {
        // 根据用户角色调整限制
        switch (user.role) {
          case 'admin':
            config.max = config.max * 10; // 管理员10倍限制
            break;
          case 'moderator':
            config.max = config.max * 5; // 版主5倍限制
            break;
          case 'premium':
            config.max = config.max * 3; // 高级用户3倍限制
            break;
          case 'verified':
            config.max = config.max * 2; // 认证用户2倍限制
            break;
          default:
            // 普通用户使用默认限制
            break;
        }

        // 根据用户信誉调整限制
        if (user.reputation) {
          if (user.reputation >= 1000) {
            config.max = Math.floor(config.max * 1.5);
          } else if (user.reputation < 100) {
            config.max = Math.floor(config.max * 0.5);
          }
        }
      }

      // 创建动态限流器
      const limiter = this.createBasicLimiter(config);
      limiter(req, res, next);
    };
  }

  // 智能限流 - 根据系统负载调整
  createSmartLimiter(baseConfig = {}) {
    return async (req, res, next) => {
      try {
        // 获取系统负载
        const systemLoad = await this.getSystemLoad();
        let config = { ...this.defaultConfig, ...baseConfig };

        // 根据系统负载调整限制
        if (systemLoad > 0.8) {
          config.max = Math.floor(config.max * 0.5); // 高负载时减少50%
        } else if (systemLoad > 0.6) {
          config.max = Math.floor(config.max * 0.7); // 中等负载时减少30%
        } else if (systemLoad < 0.3) {
          config.max = Math.floor(config.max * 1.5); // 低负载时增加50%
        }

        // 创建智能限流器
        const limiter = this.createBasicLimiter(config);
        limiter(req, res, next);
      } catch (error) {
        console.error('智能限流错误:', error);
        // 出错时使用默认限流
        const limiter = this.createBasicLimiter(baseConfig);
        limiter(req, res, next);
      }
    };
  }

  // 获取系统负载
  async getSystemLoad() {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // 简化的负载计算
      const memLoad = memUsage.heapUsed / memUsage.heapTotal;
      const cpuLoad = (cpuUsage.user + cpuUsage.system) / 1000000; // 转换为秒
      
      return Math.max(memLoad, Math.min(cpuLoad / 100, 1));
    } catch (error) {
      console.error('获取系统负载失败:', error);
      return 0.5; // 默认中等负载
    }
  }

  // 获取限流统计
  async getStats() {
    try {
      const stats = {
        totalRequests: 0,
        blockedRequests: 0,
        activeKeys: 0,
        topIPs: [],
        topUsers: [],
        timestamp: new Date().toISOString()
      };

      // 从Redis获取统计数据
      if (databaseManager.redisClient) {
        // 这里需要实现具体的统计逻辑
        // 扫描所有限流键并统计
      }

      return stats;
    } catch (error) {
      console.error('获取限流统计失败:', error);
      return null;
    }
  }

  // 清除特定用户的限流
  async clearUserLimits(userId) {
    try {
      const patterns = [
        `rate_limit:user:${userId}`,
        `rate_limit:combined:*:${userId}`
      ];

      for (const pattern of patterns) {
        // 删除匹配的键
        await databaseManager.cacheDel(pattern);
      }

      return true;
    } catch (error) {
      console.error('清除用户限流失败:', error);
      return false;
    }
  }

  // 清除特定IP的限流
  async clearIPLimits(ip) {
    try {
      const patterns = [
        `rate_limit:ip:${ip}`,
        `rate_limit:combined:${ip}:*`
      ];

      for (const pattern of patterns) {
        await databaseManager.cacheDel(pattern);
      }

      return true;
    } catch (error) {
      console.error('清除IP限流失败:', error);
      return false;
    }
  }
}

// 创建单例实例
const advancedRateLimiter = new AdvancedRateLimiter();

module.exports = {
  AdvancedRateLimiter,
  advancedRateLimiter,
  
  // 预设限流器
  ...advancedRateLimiter.getPresetLimiters(),
  
  // 便捷方法
  createDynamicLimiter: (config) => advancedRateLimiter.createDynamicLimiter(config),
  createSmartLimiter: (config) => advancedRateLimiter.createSmartLimiter(config),
  getRateLimitStats: () => advancedRateLimiter.getStats(),
  clearUserLimits: (userId) => advancedRateLimiter.clearUserLimits(userId),
  clearIPLimits: (ip) => advancedRateLimiter.clearIPLimits(ip)
};

