const { cacheManager } = require('../config/redis');

/**
 * 内存监控中间件
 * Memory Monitoring Middleware
 */
const memoryMonitor = (req, res, next) => {
    // 获取内存使用情况
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024 * 100) / 100
    };
    
    // 设置内存使用信息到请求对象
    req.memoryUsage = memoryUsageMB;
    
    // 内存使用警告阈值（MB）
    const WARNING_THRESHOLD = 512; // 512MB
    const CRITICAL_THRESHOLD = 1024; // 1GB
    
    // 检查内存使用情况
    if (memoryUsageMB.heapUsed > CRITICAL_THRESHOLD) {
        console.error(`🚨 严重内存警告 / Critical Memory Warning: ${memoryUsageMB.heapUsed}MB`);
        
        // 触发垃圾回收（如果可用）
        if (global.gc) {
            global.gc();
            console.log('🗑️ 手动垃圾回收已触发 / Manual garbage collection triggered');
        }
    } else if (memoryUsageMB.heapUsed > WARNING_THRESHOLD) {
        console.warn(`⚠️ 内存使用警告 / Memory Usage Warning: ${memoryUsageMB.heapUsed}MB`);
    }
    
    // 异步记录内存使用情况
    setImmediate(async () => {
        try {
            const timestamp = Date.now();
            const memoryKey = `memory:${timestamp}`;
            
            await cacheManager.set(memoryKey, {
                ...memoryUsageMB,
                timestamp: new Date().toISOString(),
                pid: process.pid
            }, 3600); // 保存1小时
            
            // 清理旧的内存记录（保留最近100条）
            const memoryKeys = await cacheManager.client.keys('memory:*');
            if (memoryKeys.length > 100) {
                const sortedKeys = memoryKeys.sort();
                const keysToDelete = sortedKeys.slice(0, memoryKeys.length - 100);
                await cacheManager.client.del(keysToDelete);
            }
        } catch (error) {
            console.error('内存监控数据保存失败 / Memory monitoring data save failed:', error);
        }
    });
    
    next();
};

/**
 * 获取内存使用统计
 * Get Memory Usage Statistics
 */
const getMemoryStats = async (req, res) => {
    try {
        // 获取当前内存使用情况
        const currentMemory = process.memoryUsage();
        const currentMemoryMB = {
            rss: Math.round(currentMemory.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(currentMemory.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(currentMemory.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(currentMemory.external / 1024 / 1024 * 100) / 100,
            arrayBuffers: Math.round(currentMemory.arrayBuffers / 1024 / 1024 * 100) / 100
        };
        
        // 获取历史内存数据
        const memoryKeys = await cacheManager.client.keys('memory:*');
        const recentKeys = memoryKeys.sort().slice(-20); // 最近20条记录
        
        const historyData = [];
        for (const key of recentKeys) {
            const data = await cacheManager.get(key);
            if (data) {
                historyData.push(data);
            }
        }
        
        // 计算平均值
        const avgMemory = historyData.length > 0 ? {
            rss: Math.round(historyData.reduce((sum, item) => sum + item.rss, 0) / historyData.length * 100) / 100,
            heapTotal: Math.round(historyData.reduce((sum, item) => sum + item.heapTotal, 0) / historyData.length * 100) / 100,
            heapUsed: Math.round(historyData.reduce((sum, item) => sum + item.heapUsed, 0) / historyData.length * 100) / 100,
            external: Math.round(historyData.reduce((sum, item) => sum + item.external, 0) / historyData.length * 100) / 100,
            arrayBuffers: Math.round(historyData.reduce((sum, item) => sum + item.arrayBuffers, 0) / historyData.length * 100) / 100
        } : currentMemoryMB;
        
        // 计算内存使用趋势
        const trend = historyData.length >= 2 ? {
            rss: historyData[historyData.length - 1].rss - historyData[0].rss,
            heapUsed: historyData[historyData.length - 1].heapUsed - historyData[0].heapUsed
        } : { rss: 0, heapUsed: 0 };
        
        res.json({
            success: true,
            data: {
                current: currentMemoryMB,
                average: avgMemory,
                trend: trend,
                history: historyData,
                warnings: {
                    warningThreshold: 512,
                    criticalThreshold: 1024,
                    currentStatus: currentMemoryMB.heapUsed > 1024 ? 'critical' : 
                                  currentMemoryMB.heapUsed > 512 ? 'warning' : 'normal'
                },
                recommendations: getMemoryRecommendations(currentMemoryMB, trend)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取内存统计失败 / Failed to get memory statistics',
            error: error.message
        });
    }
};

/**
 * 获取内存优化建议
 * Get Memory Optimization Recommendations
 */
const getMemoryRecommendations = (currentMemory, trend) => {
    const recommendations = [];
    
    if (currentMemory.heapUsed > 1024) {
        recommendations.push({
            level: 'critical',
            message: '内存使用过高，建议立即重启应用 / Memory usage is too high, recommend immediate restart',
            action: 'restart'
        });
    } else if (currentMemory.heapUsed > 512) {
        recommendations.push({
            level: 'warning',
            message: '内存使用较高，建议检查内存泄漏 / Memory usage is high, recommend checking for memory leaks',
            action: 'investigate'
        });
    }
    
    if (trend.heapUsed > 50) {
        recommendations.push({
            level: 'warning',
            message: '内存使用呈上升趋势，建议监控 / Memory usage is trending upward, recommend monitoring',
            action: 'monitor'
        });
    }
    
    if (currentMemory.external > 100) {
        recommendations.push({
            level: 'info',
            message: '外部内存使用较高，可能由Buffer或其他外部资源引起 / High external memory usage, possibly caused by Buffers or other external resources',
            action: 'optimize'
        });
    }
    
    return recommendations;
};

/**
 * 强制垃圾回收（仅在开发环境或启用--expose-gc时可用）
 * Force Garbage Collection (only available in development or with --expose-gc)
 */
const forceGarbageCollection = (req, res) => {
    try {
        if (global.gc) {
            const beforeMemory = process.memoryUsage();
            global.gc();
            const afterMemory = process.memoryUsage();
            
            const freed = {
                rss: Math.round((beforeMemory.rss - afterMemory.rss) / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round((beforeMemory.heapTotal - afterMemory.heapTotal) / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024 * 100) / 100,
                external: Math.round((beforeMemory.external - afterMemory.external) / 1024 / 1024 * 100) / 100
            };
            
            res.json({
                success: true,
                message: '垃圾回收已执行 / Garbage collection executed',
                data: {
                    before: {
                        rss: Math.round(beforeMemory.rss / 1024 / 1024 * 100) / 100,
                        heapTotal: Math.round(beforeMemory.heapTotal / 1024 / 1024 * 100) / 100,
                        heapUsed: Math.round(beforeMemory.heapUsed / 1024 / 1024 * 100) / 100,
                        external: Math.round(beforeMemory.external / 1024 / 1024 * 100) / 100
                    },
                    after: {
                        rss: Math.round(afterMemory.rss / 1024 / 1024 * 100) / 100,
                        heapTotal: Math.round(afterMemory.heapTotal / 1024 / 1024 * 100) / 100,
                        heapUsed: Math.round(afterMemory.heapUsed / 1024 / 1024 * 100) / 100,
                        external: Math.round(afterMemory.external / 1024 / 1024 * 100) / 100
                    },
                    freed: freed
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: '垃圾回收不可用，请使用 --expose-gc 启动应用 / Garbage collection not available, please start app with --expose-gc'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '垃圾回收执行失败 / Garbage collection execution failed',
            error: error.message
        });
    }
};

module.exports = {
    memoryMonitor,
    getMemoryStats,
    forceGarbageCollection
};

