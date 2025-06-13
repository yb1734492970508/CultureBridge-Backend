const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

/**
 * 性能优化中间件配置
 */
class PerformanceOptimizer {
    constructor() {
        this.cacheConfig = {
            // Redis缓存配置
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_DB || 0,
                keyPrefix: 'culturebridge:',
                ttl: 3600, // 1小时默认TTL
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                enableOfflineQueue: false
            },
            
            // 内存缓存配置
            memory: {
                max: 1000, // 最大缓存项数
                ttl: 300,  // 5分钟TTL
                checkperiod: 60 // 每分钟检查过期项
            },
            
            // 缓存策略
            strategies: {
                userProfile: { ttl: 1800 }, // 30分钟
                tokenInfo: { ttl: 3600 },   // 1小时
                translations: { ttl: 7200 }, // 2小时
                blockchainData: { ttl: 300 }, // 5分钟
                apiResponses: { ttl: 600 }   // 10分钟
            }
        };
        
        this.compressionConfig = {
            // 压缩配置
            level: 6, // 压缩级别 (1-9)
            threshold: 1024, // 最小压缩大小 (1KB)
            filter: (req, res) => {
                // 不压缩已压缩的内容
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        };
        
        this.rateLimitConfig = {
            // 全局限流
            global: {
                windowMs: 15 * 60 * 1000, // 15分钟
                max: 1000, // 每个IP最多1000请求
                message: {
                    success: false,
                    error: '请求过于频繁，请稍后再试'
                },
                standardHeaders: true,
                legacyHeaders: false
            },
            
            // API限流
            api: {
                windowMs: 15 * 60 * 1000,
                max: 500,
                message: {
                    success: false,
                    error: 'API请求过于频繁，请稍后再试'
                }
            },
            
            // 认证限流
            auth: {
                windowMs: 15 * 60 * 1000,
                max: 10, // 登录/注册限制更严格
                message: {
                    success: false,
                    error: '认证请求过于频繁，请15分钟后再试'
                }
            },
            
            // 文件上传限流
            upload: {
                windowMs: 60 * 60 * 1000, // 1小时
                max: 50,
                message: {
                    success: false,
                    error: '文件上传过于频繁，请1小时后再试'
                }
            }
        };
        
        this.securityConfig = {
            helmet: {
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        connectSrc: ["'self'"],
                        fontSrc: ["'self'"],
                        objectSrc: ["'none'"],
                        mediaSrc: ["'self'"],
                        frameSrc: ["'none'"]
                    }
                },
                crossOriginEmbedderPolicy: false
            },
            
            mongoSanitize: {
                replaceWith: '_'
            },
            
            xss: {
                whiteList: {
                    a: ['href', 'title'],
                    b: [],
                    i: [],
                    em: [],
                    strong: [],
                    p: [],
                    br: []
                }
            },
            
            hpp: {
                whitelist: ['tags', 'languages', 'categories']
            }
        };
    }
    
    /**
     * 应用性能优化中间件
     */
    applyOptimizations(app) {
        console.log('🚀 应用性能优化中间件...');
        
        // 1. 安全中间件
        app.use(helmet(this.securityConfig.helmet));
        app.use(mongoSanitize(this.securityConfig.mongoSanitize));
        app.use(xss());
        app.use(hpp(this.securityConfig.hpp));
        
        // 2. 压缩中间件
        app.use(compression(this.compressionConfig));
        
        // 3. 全局限流
        app.use(rateLimit(this.rateLimitConfig.global));
        
        // 4. API特定限流
        app.use('/api/', rateLimit(this.rateLimitConfig.api));
        
        console.log('✅ 性能优化中间件已应用');
    }
    
    /**
     * 获取认证限流中间件
     */
    getAuthLimiter() {
        return rateLimit(this.rateLimitConfig.auth);
    }
    
    /**
     * 获取上传限流中间件
     */
    getUploadLimiter() {
        return rateLimit(this.rateLimitConfig.upload);
    }
    
    /**
     * 创建缓存中间件
     */
    createCacheMiddleware(strategy = 'default', customTtl = null) {
        return (req, res, next) => {
            const ttl = customTtl || this.cacheConfig.strategies[strategy]?.ttl || this.cacheConfig.redis.ttl;
            
            // 生成缓存键
            const cacheKey = this.generateCacheKey(req);
            
            // 设置缓存头
            res.set({
                'Cache-Control': `public, max-age=${ttl}`,
                'ETag': `"${cacheKey}"`,
                'Vary': 'Accept-Encoding'
            });
            
            next();
        };
    }
    
    /**
     * 生成缓存键
     */
    generateCacheKey(req) {
        const { method, originalUrl, user } = req;
        const userId = user?.id || 'anonymous';
        const query = JSON.stringify(req.query);
        
        return `${method}:${originalUrl}:${userId}:${query}`;
    }
    
    /**
     * 数据库查询优化
     */
    getDatabaseOptimizations() {
        return {
            // MongoDB连接优化
            mongoose: {
                maxPoolSize: 10, // 最大连接池大小
                serverSelectionTimeoutMS: 5000, // 服务器选择超时
                socketTimeoutMS: 45000, // Socket超时
                bufferMaxEntries: 0, // 禁用缓冲
                bufferCommands: false,
                useNewUrlParser: true,
                useUnifiedTopology: true
            },
            
            // 查询优化建议
            queryOptimizations: {
                // 使用索引
                indexes: [
                    { collection: 'users', fields: { email: 1 }, unique: true },
                    { collection: 'users', fields: { username: 1 }, unique: true },
                    { collection: 'users', fields: { walletAddress: 1 }, sparse: true },
                    { collection: 'posts', fields: { user: 1, createdAt: -1 } },
                    { collection: 'comments', fields: { post: 1, createdAt: -1 } },
                    { collection: 'chatmessages', fields: { chatRoom: 1, createdAt: -1 } },
                    { collection: 'voicetranslations', fields: { user: 1, createdAt: -1 } }
                ],
                
                // 分页优化
                pagination: {
                    defaultLimit: 20,
                    maxLimit: 100,
                    useSkipLimit: false, // 使用cursor-based分页
                    sortField: 'createdAt'
                },
                
                // 聚合优化
                aggregation: {
                    allowDiskUse: true,
                    maxTimeMS: 30000
                }
            }
        };
    }
    
    /**
     * 文件处理优化
     */
    getFileOptimizations() {
        return {
            // 文件上传优化
            upload: {
                limits: {
                    fileSize: 10 * 1024 * 1024, // 10MB
                    files: 5,
                    fields: 10
                },
                
                // 文件类型限制
                allowedTypes: {
                    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                    audio: ['audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm'],
                    documents: ['application/pdf', 'text/plain']
                },
                
                // 存储优化
                storage: {
                    destination: './uploads',
                    filename: (req, file, cb) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
                    }
                }
            },
            
            // 图片处理优化
            imageProcessing: {
                resize: {
                    thumbnail: { width: 150, height: 150 },
                    medium: { width: 500, height: 500 },
                    large: { width: 1200, height: 1200 }
                },
                
                compression: {
                    quality: 80,
                    progressive: true
                }
            }
        };
    }
    
    /**
     * API响应优化
     */
    getResponseOptimizations() {
        return {
            // JSON响应优化
            json: {
                spaces: process.env.NODE_ENV === 'production' ? 0 : 2,
                replacer: null,
                escape: true
            },
            
            // 分页响应格式
            pagination: {
                format: (data, page, limit, total) => ({
                    success: true,
                    data,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit),
                        hasNext: page * limit < total,
                        hasPrev: page > 1
                    }
                })
            },
            
            // 错误响应格式
            error: {
                format: (message, statusCode = 500, details = null) => ({
                    success: false,
                    error: message,
                    statusCode,
                    details: process.env.NODE_ENV === 'development' ? details : undefined,
                    timestamp: new Date().toISOString()
                })
            }
        };
    }
    
    /**
     * 监控和日志优化
     */
    getMonitoringOptimizations() {
        return {
            // 性能监控
            performance: {
                responseTime: true,
                memoryUsage: true,
                cpuUsage: true,
                requestCount: true
            },
            
            // 日志配置
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: 'combined',
                maxFiles: 10,
                maxSize: '10m',
                datePattern: 'YYYY-MM-DD'
            },
            
            // 健康检查
            healthCheck: {
                interval: 30000, // 30秒
                timeout: 5000,   // 5秒超时
                checks: [
                    'database',
                    'redis',
                    'blockchain',
                    'voice-service'
                ]
            }
        };
    }
}

module.exports = PerformanceOptimizer;

