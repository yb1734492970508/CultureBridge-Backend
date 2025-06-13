const mongoose = require('mongoose');
const { cacheManager } = require('../config/redis');

/**
 * 健康检查中间件
 * Health Check Middleware
 */
const healthCheck = async (req, res) => {
    const startTime = Date.now();
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.1.0',
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        services: {},
        performance: {},
        system: {}
    };
    
    try {
        // 检查数据库连接
        try {
            const dbState = mongoose.connection.readyState;
            const dbStates = {
                0: 'disconnected',
                1: 'connected',
                2: 'connecting',
                3: 'disconnecting'
            };
            
            healthStatus.services.database = {
                status: dbState === 1 ? 'healthy' : 'unhealthy',
                state: dbStates[dbState],
                host: mongoose.connection.host,
                name: mongoose.connection.name
            };
            
            if (dbState === 1) {
                // 执行简单的数据库查询测试
                const dbTestStart = Date.now();
                await mongoose.connection.db.admin().ping();
                healthStatus.services.database.responseTime = Date.now() - dbTestStart;
            }
        } catch (error) {
            healthStatus.services.database = {
                status: 'unhealthy',
                error: error.message
            };
            healthStatus.status = 'degraded';
        }
        
        // 检查Redis连接
        try {
            const redisTestStart = Date.now();
            await cacheManager.client.ping();
            healthStatus.services.redis = {
                status: 'healthy',
                responseTime: Date.now() - redisTestStart
            };
            
            // 获取Redis信息
            const redisInfo = await cacheManager.client.info('memory');
            const memoryMatch = redisInfo.match(/used_memory_human:([^\r\n]+)/);
            if (memoryMatch) {
                healthStatus.services.redis.memoryUsage = memoryMatch[1].trim();
            }
        } catch (error) {
            healthStatus.services.redis = {
                status: 'unhealthy',
                error: error.message
            };
            healthStatus.status = 'degraded';
        }
        
        // 检查外部服务（区块链RPC）
        try {
            if (process.env.BSC_RPC_URL) {
                const rpcTestStart = Date.now();
                const response = await fetch(process.env.BSC_RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_blockNumber',
                        params: [],
                        id: 1
                    }),
                    timeout: 5000
                });
                
                if (response.ok) {
                    healthStatus.services.blockchain = {
                        status: 'healthy',
                        responseTime: Date.now() - rpcTestStart,
                        network: process.env.NODE_ENV === 'production' ? 'BSC Mainnet' : 'BSC Testnet'
                    };
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            }
        } catch (error) {
            healthStatus.services.blockchain = {
                status: 'unhealthy',
                error: error.message
            };
            healthStatus.status = 'degraded';
        }
        
        // 性能指标
        const memoryUsage = process.memoryUsage();
        healthStatus.performance = {
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
                external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
                unit: 'MB'
            },
            cpu: process.cpuUsage(),
            eventLoop: {
                delay: await getEventLoopDelay()
            }
        };
        
        // 系统信息
        const os = require('os');
        healthStatus.system = {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024 * 100) / 100,
            freeMemory: Math.round(os.freemem() / 1024 / 1024 * 100) / 100,
            loadAverage: os.loadavg(),
            cpuCount: os.cpus().length
        };
        
        // 检查关键阈值
        if (healthStatus.performance.memory.heapUsed > 1024) {
            healthStatus.status = 'unhealthy';
            healthStatus.alerts = healthStatus.alerts || [];
            healthStatus.alerts.push('High memory usage detected');
        }
        
        if (healthStatus.performance.eventLoop.delay > 100) {
            healthStatus.status = 'degraded';
            healthStatus.alerts = healthStatus.alerts || [];
            healthStatus.alerts.push('High event loop delay detected');
        }
        
        // 计算总响应时间
        healthStatus.responseTime = Date.now() - startTime;
        
        // 根据状态设置HTTP状态码
        const statusCode = healthStatus.status === 'healthy' ? 200 : 
                          healthStatus.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(healthStatus);
        
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            responseTime: Date.now() - startTime
        });
    }
};

/**
 * 简单的健康检查端点
 * Simple Health Check Endpoint
 */
const simpleHealthCheck = (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
};

/**
 * 就绪检查端点
 * Readiness Check Endpoint
 */
const readinessCheck = async (req, res) => {
    try {
        // 检查关键服务是否就绪
        const checks = [];
        
        // 数据库就绪检查
        checks.push(new Promise(async (resolve) => {
            try {
                if (mongoose.connection.readyState === 1) {
                    await mongoose.connection.db.admin().ping();
                    resolve({ service: 'database', status: 'ready' });
                } else {
                    resolve({ service: 'database', status: 'not_ready', reason: 'not_connected' });
                }
            } catch (error) {
                resolve({ service: 'database', status: 'not_ready', reason: error.message });
            }
        }));
        
        // Redis就绪检查
        checks.push(new Promise(async (resolve) => {
            try {
                await cacheManager.client.ping();
                resolve({ service: 'redis', status: 'ready' });
            } catch (error) {
                resolve({ service: 'redis', status: 'not_ready', reason: error.message });
            }
        }));
        
        const results = await Promise.all(checks);
        const allReady = results.every(result => result.status === 'ready');
        
        res.status(allReady ? 200 : 503).json({
            status: allReady ? 'ready' : 'not_ready',
            timestamp: new Date().toISOString(),
            checks: results
        });
        
    } catch (error) {
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
};

/**
 * 存活检查端点
 * Liveness Check Endpoint
 */
const livenessCheck = (req, res) => {
    // 简单的存活检查，只要进程在运行就返回成功
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: process.uptime()
    });
};

/**
 * 获取事件循环延迟
 * Get Event Loop Delay
 */
const getEventLoopDelay = () => {
    return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const delta = process.hrtime.bigint() - start;
            const delay = Number(delta) / 1000000; // 转换为毫秒
            resolve(Math.round(delay * 100) / 100);
        });
    });
};

/**
 * 获取详细的系统指标
 * Get Detailed System Metrics
 */
const getSystemMetrics = async (req, res) => {
    try {
        const os = require('os');
        const fs = require('fs').promises;
        
        // 获取CPU使用率
        const cpuUsage = process.cpuUsage();
        
        // 获取内存使用情况
        const memoryUsage = process.memoryUsage();
        
        // 获取系统负载
        const loadAverage = os.loadavg();
        
        // 获取网络接口信息
        const networkInterfaces = os.networkInterfaces();
        
        // 获取磁盘使用情况（如果可用）
        let diskUsage = null;
        try {
            const stats = await fs.stat('.');
            diskUsage = {
                available: true,
                // 这里可以添加更详细的磁盘使用统计
            };
        } catch (error) {
            diskUsage = { available: false, error: error.message };
        }
        
        // 获取事件循环延迟
        const eventLoopDelay = await getEventLoopDelay();
        
        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    hostname: os.hostname(),
                    nodeVersion: process.version,
                    uptime: {
                        system: os.uptime(),
                        process: process.uptime()
                    }
                },
                cpu: {
                    count: os.cpus().length,
                    model: os.cpus()[0]?.model,
                    usage: cpuUsage,
                    loadAverage: loadAverage
                },
                memory: {
                    system: {
                        total: Math.round(os.totalmem() / 1024 / 1024 * 100) / 100,
                        free: Math.round(os.freemem() / 1024 / 1024 * 100) / 100,
                        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 * 100) / 100,
                        unit: 'MB'
                    },
                    process: {
                        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
                        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
                        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
                        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
                        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024 * 100) / 100,
                        unit: 'MB'
                    }
                },
                network: networkInterfaces,
                disk: diskUsage,
                performance: {
                    eventLoopDelay: eventLoopDelay,
                    pid: process.pid,
                    ppid: process.ppid
                }
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取系统指标失败 / Failed to get system metrics',
            error: error.message
        });
    }
};

module.exports = {
    healthCheck,
    simpleHealthCheck,
    readinessCheck,
    livenessCheck,
    getSystemMetrics
};

