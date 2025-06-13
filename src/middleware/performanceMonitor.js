const { cacheManager } = require('../config/redis');

/**
 * 性能监控中间件
 * Performance Monitoring Middleware
 */
const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();
    
    // 记录请求开始时间
    req.startTime = startTime;
    
    // 监听响应结束事件
    res.on('finish', async () => {
        const endTime = Date.now();
        const endHrTime = process.hrtime(startHrTime);
        
        // 计算响应时间
        const responseTime = endTime - startTime;
        const hrResponseTime = endHrTime[0] * 1000 + endHrTime[1] / 1000000;
        
        // 收集性能指标
        const metrics = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: responseTime,
            hrResponseTime: hrResponseTime,
            contentLength: res.get('Content-Length') || 0,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            timestamp: new Date().toISOString()
        };
        
        // 设置响应头
        res.set('X-Response-Time', `${responseTime}ms`);
        
        // 记录慢查询
        if (responseTime > 1000) {
            console.warn(`🐌 慢请求警告 / Slow Request Warning: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
        }
        
        // 异步保存指标到缓存
        try {
            const metricsKey = `metrics:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
            await cacheManager.set(metricsKey, metrics, 86400); // 保存24小时
            
            // 更新统计数据
            const statsKey = `stats:${new Date().toISOString().split('T')[0]}`;
            await cacheManager.incr(`${statsKey}:requests`);
            await cacheManager.incr(`${statsKey}:response_time`, responseTime);
            
            if (res.statusCode >= 400) {
                await cacheManager.incr(`${statsKey}:errors`);
            }
        } catch (error) {
            console.error('性能指标保存失败 / Performance metrics save failed:', error);
        }
    });
    
    next();
};

/**
 * 获取性能统计
 * Get Performance Statistics
 */
const getPerformanceStats = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const statsKey = `stats:${today}`;
        
        const [requests, totalResponseTime, errors] = await Promise.all([
            cacheManager.get(`${statsKey}:requests`) || 0,
            cacheManager.get(`${statsKey}:response_time`) || 0,
            cacheManager.get(`${statsKey}:errors`) || 0
        ]);
        
        const avgResponseTime = requests > 0 ? totalResponseTime / requests : 0;
        const errorRate = requests > 0 ? (errors / requests) * 100 : 0;
        
        res.json({
            success: true,
            data: {
                date: today,
                requests: parseInt(requests),
                averageResponseTime: Math.round(avgResponseTime * 100) / 100,
                errors: parseInt(errors),
                errorRate: Math.round(errorRate * 100) / 100,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取性能统计失败 / Failed to get performance statistics',
            error: error.message
        });
    }
};

module.exports = {
    performanceMonitor,
    getPerformanceStats
};

