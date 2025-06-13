const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

/**
 * 安全中间件配置
 */
class SecurityMiddleware {
    constructor() {
        this.rateLimiters = new Map();
        this.setupRateLimiters();
    }
    
    /**
     * 设置速率限制器
     */
    setupRateLimiters() {
        // 通用API限制
        this.rateLimiters.set('general', rateLimit({
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 100, // 每个IP最多100个请求
            message: {
                success: false,
                error: '请求过于频繁，请稍后再试'
            },
            standardHeaders: true,
            legacyHeaders: false
        }));
        
        // 认证相关限制
        this.rateLimiters.set('auth', rateLimit({
            windowMs: 15 * 60 * 1000, // 15分钟
            max: 5, // 每个IP最多5次登录尝试
            message: {
                success: false,
                error: '登录尝试过于频繁，请15分钟后再试'
            },
            skipSuccessfulRequests: true
        }));
        
        // 语音翻译限制
        this.rateLimiters.set('voice', rateLimit({
            windowMs: 60 * 1000, // 1分钟
            max: 10, // 每分钟最多10次语音请求
            message: {
                success: false,
                error: '语音请求过于频繁，请稍后再试'
            }
        }));
        
        // 文件上传限制
        this.rateLimiters.set('upload', rateLimit({
            windowMs: 60 * 1000, // 1分钟
            max: 5, // 每分钟最多5次上传
            message: {
                success: false,
                error: '文件上传过于频繁，请稍后再试'
            }
        }));
        
        // CBT代币操作限制
        this.rateLimiters.set('cbt', rateLimit({
            windowMs: 60 * 1000, // 1分钟
            max: 20, // 每分钟最多20次代币操作
            message: {
                success: false,
                error: '代币操作过于频繁，请稍后再试'
            }
        }));
    }
    
    /**
     * 获取速率限制器
     */
    getRateLimit(type = 'general') {
        return this.rateLimiters.get(type) || this.rateLimiters.get('general');
    }
    
    /**
     * 基础安全中间件
     */
    getBasicSecurity() {
        return [
            // 设置安全头
            helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                        fontSrc: ["'self'", "https://fonts.gstatic.com"],
                        imgSrc: ["'self'", "data:", "https:"],
                        scriptSrc: ["'self'"],
                        connectSrc: ["'self'", "wss:", "ws:"]
                    }
                },
                crossOriginEmbedderPolicy: false
            }),
            
            // CORS配置
            cors({
                origin: function (origin, callback) {
                    // 允许的域名列表
                    const allowedOrigins = [
                        'http://localhost:3000',
                        'http://localhost:3001',
                        'https://culturebridge.com',
                        'https://app.culturebridge.com'
                    ];
                    
                    // 开发环境允许所有来源
                    if (process.env.NODE_ENV === 'development') {
                        return callback(null, true);
                    }
                    
                    if (!origin || allowedOrigins.includes(origin)) {
                        callback(null, true);
                    } else {
                        callback(new Error('CORS策略不允许此来源'));
                    }
                },
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
            }),
            
            // 防止NoSQL注入
            mongoSanitize(),
            
            // 防止XSS攻击
            xss(),
            
            // 防止HTTP参数污染
            hpp({
                whitelist: ['tags', 'languages', 'targetLanguages']
            })
        ];
    }
    
    /**
     * API密钥验证中间件
     */
    validateApiKey() {
        return (req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            
            // 如果是公开路由，跳过验证
            const publicRoutes = ['/api/v2/auth/login', '/api/v2/auth/register', '/api-docs'];
            if (publicRoutes.some(route => req.path.startsWith(route))) {
                return next();
            }
            
            // 检查API密钥
            const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
            
            if (validApiKeys.length > 0 && (!apiKey || !validApiKeys.includes(apiKey))) {
                return res.status(401).json({
                    success: false,
                    error: '无效的API密钥'
                });
            }
            
            next();
        };
    }
    
    /**
     * IP白名单中间件
     */
    ipWhitelist(whitelist = []) {
        return (req, res, next) => {
            if (whitelist.length === 0) {
                return next();
            }
            
            const clientIp = req.ip || req.connection.remoteAddress;
            
            if (!whitelist.includes(clientIp)) {
                return res.status(403).json({
                    success: false,
                    error: 'IP地址不在白名单中'
                });
            }
            
            next();
        };
    }
    
    /**
     * 请求大小限制中间件
     */
    requestSizeLimit() {
        return (req, res, next) => {
            const maxSize = 50 * 1024 * 1024; // 50MB
            
            if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
                return res.status(413).json({
                    success: false,
                    error: '请求体过大'
                });
            }
            
            next();
        };
    }
    
    /**
     * 用户权限验证中间件
     */
    requireRole(roles = []) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: '需要登录'
                });
            }
            
            if (roles.length > 0 && !roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: '权限不足'
                });
            }
            
            next();
        };
    }
    
    /**
     * 敏感操作验证中间件
     */
    requireTwoFactor() {
        return (req, res, next) => {
            // 检查是否需要双因素认证
            const sensitiveOperations = [
                '/api/v2/cbt/transfer',
                '/api/v2/blockchain/deploy',
                '/api/v2/admin'
            ];
            
            const requiresTwoFactor = sensitiveOperations.some(op => req.path.startsWith(op));
            
            if (requiresTwoFactor && !req.headers['x-2fa-token']) {
                return res.status(403).json({
                    success: false,
                    error: '此操作需要双因素认证'
                });
            }
            
            next();
        };
    }
    
    /**
     * 请求日志中间件
     */
    requestLogger() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // 记录请求信息
            const logData = {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString(),
                userId: req.user?.id
            };
            
            // 响应完成时记录响应信息
            res.on('finish', () => {
                logData.statusCode = res.statusCode;
                logData.responseTime = Date.now() - startTime;
                
                // 记录到日志文件或数据库
                if (process.env.NODE_ENV === 'production') {
                    console.log(JSON.stringify(logData));
                }
            });
            
            next();
        };
    }
    
    /**
     * 错误处理中间件
     */
    errorHandler() {
        return (error, req, res, next) => {
            console.error('API错误:', error);
            
            // 默认错误响应
            let statusCode = 500;
            let message = '服务器内部错误';
            
            // 处理特定类型的错误
            if (error.name === 'ValidationError') {
                statusCode = 400;
                message = '数据验证失败';
            } else if (error.name === 'CastError') {
                statusCode = 400;
                message = '无效的数据格式';
            } else if (error.code === 11000) {
                statusCode = 400;
                message = '数据已存在';
            } else if (error.name === 'JsonWebTokenError') {
                statusCode = 401;
                message = '无效的访问令牌';
            } else if (error.name === 'TokenExpiredError') {
                statusCode = 401;
                message = '访问令牌已过期';
            }
            
            // 开发环境返回详细错误信息
            const response = {
                success: false,
                error: message
            };
            
            if (process.env.NODE_ENV === 'development') {
                response.stack = error.stack;
                response.details = error.message;
            }
            
            res.status(statusCode).json(response);
        };
    }
    
    /**
     * 404处理中间件
     */
    notFoundHandler() {
        return (req, res) => {
            res.status(404).json({
                success: false,
                error: '请求的资源不存在'
            });
        };
    }
}

module.exports = new SecurityMiddleware();

