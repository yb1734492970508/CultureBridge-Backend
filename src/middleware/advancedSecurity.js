const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { cacheManager } = require('../config/redis');

/**
 * 高级安全中间件集合
 * Advanced Security Middleware Collection
 */
class SecurityMiddleware {
    constructor() {
        this.failedAttempts = new Map();
        this.blockedIPs = new Set();
        this.suspiciousPatterns = [
            /(\<|\%3C).*script.*(\>|\%3E)/i,
            /(\<|\%3C).*iframe.*(\>|\%3E)/i,
            /(\<|\%3C).*object.*(\>|\%3E)/i,
            /(\<|\%3C).*embed.*(\>|\%3E)/i,
            /(\<|\%3C).*form.*(\>|\%3E)/i,
            /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
            /(\||;|&|\$|\`)/,
            /(\.\.\/|\.\.\\)/,
            /\/etc\/passwd/i,
            /\/proc\/self\/environ/i
        ];
    }

    /**
     * 配置安全头
     * Configure Security Headers
     */
    configureSecurityHeaders() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:", "blob:"],
                    connectSrc: ["'self'", "wss:", "ws:", "https://api.binance.org", "https://bsc-dataseed.binance.org"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'", "blob:"],
                    frameSrc: ["'none'"],
                    childSrc: ["'none'"],
                    workerSrc: ["'self'", "blob:"],
                    manifestSrc: ["'self'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"],
                    upgradeInsecureRequests: []
                }
            },
            crossOriginEmbedderPolicy: false,
            crossOriginOpenerPolicy: { policy: "same-origin" },
            crossOriginResourcePolicy: { policy: "cross-origin" },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: false,
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            xssFilter: true
        });
    }

    /**
     * 高级速率限制
     * Advanced Rate Limiting
     */
    configureRateLimit() {
        // 全局速率限制
        const globalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15分钟
            max: process.env.NODE_ENV === 'production' ? 100 : 1000,
            message: {
                success: false,
                message: '请求过于频繁，请稍后再试 / Too many requests, please try again later',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                return req.path === '/health' || 
                       req.path === '/api' || 
                       req.path.startsWith('/uploads') ||
                       this.isWhitelistedIP(req.ip);
            },
            keyGenerator: (req) => {
                return req.ip + ':' + req.get('User-Agent');
            },
            onLimitReached: (req, res, options) => {
                this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path,
                    method: req.method
                });
            }
        });

        // 认证端点严格限制
        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            message: {
                success: false,
                message: '认证请求过于频繁，请稍后再试 / Too many authentication attempts',
                retryAfter: '15 minutes'
            },
            skipSuccessfulRequests: true,
            onLimitReached: (req, res, options) => {
                this.logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path
                });
                this.addSuspiciousIP(req.ip);
            }
        });

        // 慢速攻击防护
        const speedLimiter = slowDown({
            windowMs: 15 * 60 * 1000,
            delayAfter: 50,
            delayMs: 500,
            maxDelayMs: 20000,
            skipSuccessfulRequests: true
        });

        return { globalLimiter, authLimiter, speedLimiter };
    }

    /**
     * 输入验证中间件
     * Input Validation Middleware
     */
    inputValidation() {
        return (req, res, next) => {
            try {
                // 检查请求大小
                const contentLength = parseInt(req.get('Content-Length') || '0');
                if (contentLength > 10 * 1024 * 1024) { // 10MB限制
                    return res.status(413).json({
                        success: false,
                        message: '请求体过大 / Request entity too large'
                    });
                }

                // 检查恶意模式
                const checkString = JSON.stringify(req.body) + req.originalUrl + JSON.stringify(req.query);
                for (const pattern of this.suspiciousPatterns) {
                    if (pattern.test(checkString)) {
                        this.logSecurityEvent('MALICIOUS_PATTERN_DETECTED', {
                            ip: req.ip,
                            pattern: pattern.toString(),
                            url: req.originalUrl,
                            body: req.body,
                            query: req.query
                        });
                        
                        return res.status(400).json({
                            success: false,
                            message: '检测到恶意输入 / Malicious input detected'
                        });
                    }
                }

                // 验证常见字段
                if (req.body) {
                    this.validateCommonFields(req.body);
                }

                // 清理输入数据
                req.body = this.sanitizeInput(req.body);
                req.query = this.sanitizeInput(req.query);
                req.params = this.sanitizeInput(req.params);

                next();
            } catch (error) {
                this.logSecurityEvent('INPUT_VALIDATION_ERROR', {
                    ip: req.ip,
                    error: error.message,
                    url: req.originalUrl
                });
                
                return res.status(400).json({
                    success: false,
                    message: '输入验证失败 / Input validation failed'
                });
            }
        };
    }

    /**
     * 验证常见字段
     * Validate Common Fields
     */
    validateCommonFields(data) {
        if (data.email && !validator.isEmail(data.email)) {
            throw new Error('Invalid email format');
        }
        
        if (data.url && !validator.isURL(data.url, { require_protocol: true })) {
            throw new Error('Invalid URL format');
        }
        
        if (data.phone && !validator.isMobilePhone(data.phone)) {
            throw new Error('Invalid phone number format');
        }
        
        if (data.username && !validator.isAlphanumeric(data.username.replace(/[_-]/g, ''))) {
            throw new Error('Invalid username format');
        }
    }

    /**
     * 清理输入数据
     * Sanitize Input Data
     */
    sanitizeInput(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        const sanitized = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // 移除潜在的恶意字符
                sanitized[key] = value
                    .replace(/[<>]/g, '') // 移除尖括号
                    .replace(/javascript:/gi, '') // 移除javascript协议
                    .replace(/on\w+=/gi, '') // 移除事件处理器
                    .trim();
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeInput(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * 暴力破解防护
     * Brute Force Protection
     */
    bruteForcePrevention() {
        return async (req, res, next) => {
            const key = `${req.ip}:${req.path}`;
            const maxAttempts = 5;
            const blockDuration = 15 * 60 * 1000; // 15分钟

            try {
                // 检查IP是否被阻止
                if (this.blockedIPs.has(req.ip)) {
                    return res.status(429).json({
                        success: false,
                        message: 'IP地址已被临时阻止 / IP address temporarily blocked'
                    });
                }

                // 检查失败尝试次数
                const attempts = await cacheManager.get(`failed_attempts:${key}`) || 0;
                
                if (attempts >= maxAttempts) {
                    this.blockedIPs.add(req.ip);
                    
                    // 设置自动解除阻止
                    setTimeout(() => {
                        this.blockedIPs.delete(req.ip);
                        cacheManager.del(`failed_attempts:${key}`);
                    }, blockDuration);
                    
                    this.logSecurityEvent('IP_BLOCKED', {
                        ip: req.ip,
                        attempts: attempts,
                        path: req.path
                    });
                    
                    return res.status(429).json({
                        success: false,
                        message: '尝试次数过多，IP已被阻止 / Too many attempts, IP blocked'
                    });
                }

                // 记录当前尝试
                req.securityContext = { key, attempts };
                next();
            } catch (error) {
                console.error('暴力破解防护错误:', error);
                next();
            }
        };
    }

    /**
     * 记录失败尝试
     * Record Failed Attempt
     */
    async recordFailedAttempt(req) {
        if (req.securityContext) {
            const { key } = req.securityContext;
            const newAttempts = await cacheManager.incr(`failed_attempts:${key}`);
            await cacheManager.expire(`failed_attempts:${key}`, 900); // 15分钟过期
            
            this.logSecurityEvent('FAILED_ATTEMPT', {
                ip: req.ip,
                attempts: newAttempts,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
        }
    }

    /**
     * 清除失败尝试记录
     * Clear Failed Attempts
     */
    async clearFailedAttempts(req) {
        if (req.securityContext) {
            const { key } = req.securityContext;
            await cacheManager.del(`failed_attempts:${key}`);
        }
    }

    /**
     * CSRF保护
     * CSRF Protection
     */
    csrfProtection() {
        return (req, res, next) => {
            // 对于状态改变的请求检查CSRF令牌
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
                const token = req.headers['x-csrf-token'] || req.body._csrf;
                const sessionToken = req.session?.csrfToken;
                
                if (!token || !sessionToken || token !== sessionToken) {
                    this.logSecurityEvent('CSRF_TOKEN_MISMATCH', {
                        ip: req.ip,
                        method: req.method,
                        path: req.path,
                        providedToken: token ? 'present' : 'missing',
                        sessionToken: sessionToken ? 'present' : 'missing'
                    });
                    
                    return res.status(403).json({
                        success: false,
                        message: 'CSRF令牌无效 / Invalid CSRF token'
                    });
                }
            }
            
            next();
        };
    }

    /**
     * 生成CSRF令牌
     * Generate CSRF Token
     */
    generateCSRFToken(req, res, next) {
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        }
        
        res.locals.csrfToken = req.session.csrfToken;
        next();
    }

    /**
     * 内容类型验证
     * Content Type Validation
     */
    contentTypeValidation() {
        return (req, res, next) => {
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                const contentType = req.get('Content-Type');
                
                if (!contentType) {
                    return res.status(400).json({
                        success: false,
                        message: '缺少Content-Type头 / Missing Content-Type header'
                    });
                }
                
                const allowedTypes = [
                    'application/json',
                    'application/x-www-form-urlencoded',
                    'multipart/form-data'
                ];
                
                const isAllowed = allowedTypes.some(type => 
                    contentType.toLowerCase().includes(type)
                );
                
                if (!isAllowed) {
                    this.logSecurityEvent('INVALID_CONTENT_TYPE', {
                        ip: req.ip,
                        contentType: contentType,
                        path: req.path
                    });
                    
                    return res.status(415).json({
                        success: false,
                        message: '不支持的内容类型 / Unsupported content type'
                    });
                }
            }
            
            next();
        };
    }

    /**
     * 添加可疑IP
     * Add Suspicious IP
     */
    addSuspiciousIP(ip) {
        // 这里可以实现更复杂的威胁情报逻辑
        console.warn(`🚨 可疑IP检测 / Suspicious IP detected: ${ip}`);
    }

    /**
     * 检查IP白名单
     * Check IP Whitelist
     */
    isWhitelistedIP(ip) {
        const whitelist = process.env.IP_WHITELIST?.split(',') || [];
        return whitelist.includes(ip);
    }

    /**
     * 记录安全事件
     * Log Security Event
     */
    async logSecurityEvent(eventType, details) {
        const event = {
            type: eventType,
            timestamp: new Date().toISOString(),
            details: details,
            severity: this.getEventSeverity(eventType)
        };
        
        console.warn(`🔒 安全事件 / Security Event [${eventType}]:`, details);
        
        try {
            // 保存到Redis用于实时监控
            await cacheManager.lpush('security_events', event);
            
            // 保持最近1000条记录
            const listLength = await cacheManager.client.lLen('security_events');
            if (listLength > 1000) {
                await cacheManager.client.lTrim('security_events', 0, 999);
            }
            
            // 高严重性事件立即告警
            if (event.severity === 'high' || event.severity === 'critical') {
                this.triggerSecurityAlert(event);
            }
        } catch (error) {
            console.error('安全事件记录失败:', error);
        }
    }

    /**
     * 获取事件严重性
     * Get Event Severity
     */
    getEventSeverity(eventType) {
        const severityMap = {
            'MALICIOUS_PATTERN_DETECTED': 'high',
            'IP_BLOCKED': 'high',
            'CSRF_TOKEN_MISMATCH': 'medium',
            'RATE_LIMIT_EXCEEDED': 'low',
            'AUTH_RATE_LIMIT_EXCEEDED': 'medium',
            'INVALID_CONTENT_TYPE': 'low',
            'FAILED_ATTEMPT': 'low',
            'INPUT_VALIDATION_ERROR': 'medium'
        };
        
        return severityMap[eventType] || 'low';
    }

    /**
     * 触发安全告警
     * Trigger Security Alert
     */
    triggerSecurityAlert(event) {
        // 这里可以集成邮件、短信、Slack等告警系统
        console.error(`🚨 高级安全告警 / High-level Security Alert:`, event);
        
        // 可以在这里添加更多告警逻辑，如：
        // - 发送邮件通知
        // - 调用Webhook
        // - 集成监控系统
    }

    /**
     * 获取安全统计
     * Get Security Statistics
     */
    async getSecurityStats() {
        try {
            const events = await cacheManager.lrange('security_events', 0, -1);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            
            const recentEvents = events.filter(event => 
                now - new Date(event.timestamp).getTime() < oneHour
            );
            
            const dailyEvents = events.filter(event => 
                now - new Date(event.timestamp).getTime() < oneDay
            );
            
            const eventsByType = {};
            events.forEach(event => {
                eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
            });
            
            return {
                totalEvents: events.length,
                recentEvents: recentEvents.length,
                dailyEvents: dailyEvents.length,
                eventsByType: eventsByType,
                blockedIPs: Array.from(this.blockedIPs),
                topThreats: Object.entries(eventsByType)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
            };
        } catch (error) {
            console.error('获取安全统计失败:', error);
            return null;
        }
    }
}

module.exports = SecurityMiddleware;

