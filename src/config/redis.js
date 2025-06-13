const redis = require('redis');

// Redis客户端配置
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
    
    // 连接池配置
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    
    // 性能优化配置
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // 集群配置（如果使用Redis集群）
    enableOfflineQueue: false,
    
    // 重试配置
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    
    // 连接配置
    socket: {
        keepAlive: true,
        reconnectOnError: (err) => {
            const targetError = 'READONLY';
            return err.message.includes(targetError);
        }
    }
};

// 创建Redis客户端
const redisClient = redis.createClient(redisConfig);

// 错误处理
redisClient.on('error', (err) => {
    console.error('❌ Redis连接错误:', err);
});

redisClient.on('connect', () => {
    console.log('🔗 Redis连接建立');
});

redisClient.on('ready', () => {
    console.log('✅ Redis客户端就绪');
});

redisClient.on('end', () => {
    console.log('⚠️ Redis连接关闭');
});

redisClient.on('reconnecting', () => {
    console.log('🔄 Redis重新连接中...');
});

// 缓存工具类
class CacheManager {
    constructor(client) {
        this.client = client;
        this.defaultTTL = 3600; // 1小时默认过期时间
    }
    
    /**
     * 设置缓存
     * @param {string} key 缓存键
     * @param {any} value 缓存值
     * @param {number} ttl 过期时间（秒）
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const serializedValue = JSON.stringify(value);
            await this.client.setEx(key, ttl, serializedValue);
            return true;
        } catch (error) {
            console.error('缓存设置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取缓存
     * @param {string} key 缓存键
     */
    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('缓存获取失败:', error);
            return null;
        }
    }
    
    /**
     * 删除缓存
     * @param {string} key 缓存键
     */
    async del(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('缓存删除失败:', error);
            return false;
        }
    }
    
    /**
     * 批量删除缓存
     * @param {string} pattern 匹配模式
     */
    async delPattern(pattern) {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        } catch (error) {
            console.error('批量缓存删除失败:', error);
            return false;
        }
    }
    
    /**
     * 检查缓存是否存在
     * @param {string} key 缓存键
     */
    async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('缓存检查失败:', error);
            return false;
        }
    }
    
    /**
     * 设置缓存过期时间
     * @param {string} key 缓存键
     * @param {number} ttl 过期时间（秒）
     */
    async expire(key, ttl) {
        try {
            await this.client.expire(key, ttl);
            return true;
        } catch (error) {
            console.error('设置过期时间失败:', error);
            return false;
        }
    }
    
    /**
     * 获取缓存剩余过期时间
     * @param {string} key 缓存键
     */
    async ttl(key) {
        try {
            return await this.client.ttl(key);
        } catch (error) {
            console.error('获取过期时间失败:', error);
            return -1;
        }
    }
    
    /**
     * 原子递增
     * @param {string} key 缓存键
     * @param {number} increment 递增值
     */
    async incr(key, increment = 1) {
        try {
            return await this.client.incrBy(key, increment);
        } catch (error) {
            console.error('递增操作失败:', error);
            return null;
        }
    }
    
    /**
     * 列表操作 - 左推入
     * @param {string} key 列表键
     * @param {any} value 值
     */
    async lpush(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            return await this.client.lPush(key, serializedValue);
        } catch (error) {
            console.error('列表推入失败:', error);
            return null;
        }
    }
    
    /**
     * 列表操作 - 右弹出
     * @param {string} key 列表键
     */
    async rpop(key) {
        try {
            const value = await this.client.rPop(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('列表弹出失败:', error);
            return null;
        }
    }
    
    /**
     * 列表操作 - 获取范围
     * @param {string} key 列表键
     * @param {number} start 开始索引
     * @param {number} stop 结束索引
     */
    async lrange(key, start = 0, stop = -1) {
        try {
            const values = await this.client.lRange(key, start, stop);
            return values.map(value => JSON.parse(value));
        } catch (error) {
            console.error('列表范围获取失败:', error);
            return [];
        }
    }
    
    /**
     * 哈希操作 - 设置字段
     * @param {string} key 哈希键
     * @param {string} field 字段名
     * @param {any} value 值
     */
    async hset(key, field, value) {
        try {
            const serializedValue = JSON.stringify(value);
            return await this.client.hSet(key, field, serializedValue);
        } catch (error) {
            console.error('哈希设置失败:', error);
            return null;
        }
    }
    
    /**
     * 哈希操作 - 获取字段
     * @param {string} key 哈希键
     * @param {string} field 字段名
     */
    async hget(key, field) {
        try {
            const value = await this.client.hGet(key, field);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('哈希获取失败:', error);
            return null;
        }
    }
    
    /**
     * 哈希操作 - 获取所有字段
     * @param {string} key 哈希键
     */
    async hgetall(key) {
        try {
            const hash = await this.client.hGetAll(key);
            const result = {};
            for (const [field, value] of Object.entries(hash)) {
                result[field] = JSON.parse(value);
            }
            return result;
        } catch (error) {
            console.error('哈希全部获取失败:', error);
            return {};
        }
    }
    
    /**
     * 集合操作 - 添加成员
     * @param {string} key 集合键
     * @param {any} member 成员
     */
    async sadd(key, member) {
        try {
            const serializedMember = JSON.stringify(member);
            return await this.client.sAdd(key, serializedMember);
        } catch (error) {
            console.error('集合添加失败:', error);
            return null;
        }
    }
    
    /**
     * 集合操作 - 获取所有成员
     * @param {string} key 集合键
     */
    async smembers(key) {
        try {
            const members = await this.client.sMembers(key);
            return members.map(member => JSON.parse(member));
        } catch (error) {
            console.error('集合成员获取失败:', error);
            return [];
        }
    }
    
    /**
     * 有序集合操作 - 添加成员
     * @param {string} key 有序集合键
     * @param {number} score 分数
     * @param {any} member 成员
     */
    async zadd(key, score, member) {
        try {
            const serializedMember = JSON.stringify(member);
            return await this.client.zAdd(key, { score, value: serializedMember });
        } catch (error) {
            console.error('有序集合添加失败:', error);
            return null;
        }
    }
    
    /**
     * 有序集合操作 - 按分数范围获取
     * @param {string} key 有序集合键
     * @param {number} min 最小分数
     * @param {number} max 最大分数
     */
    async zrangebyscore(key, min, max) {
        try {
            const members = await this.client.zRangeByScore(key, min, max);
            return members.map(member => JSON.parse(member));
        } catch (error) {
            console.error('有序集合范围获取失败:', error);
            return [];
        }
    }
}

// 创建缓存管理器实例
const cacheManager = new CacheManager(redisClient);

module.exports = {
    redisClient,
    cacheManager
};

