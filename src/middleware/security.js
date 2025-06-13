const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

/**
 * 应用安全中间件
 * @param {Object} app Express应用实例
 */
const securityMiddleware = (app) => {
    // 设置安全头
    app.use(helmet({
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
    }));

    // 限制请求频率
    const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15分钟
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 限制每个IP每15分钟最多100个请求
        message: {
            success: false,
            error: '请求过于频繁，请稍后再试'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

    // 对API路由应用限流
    app.use('/api/', limiter);

    // 更严格的认证路由限流
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 5, // 限制每个IP每15分钟最多5次认证尝试
        message: {
            success: false,
            error: '认证尝试过于频繁，请15分钟后再试'
        },
        skipSuccessfulRequests: true
    });

    app.use('/api/v1/auth/login', authLimiter);
    app.use('/api/v1/auth/register', authLimiter);

    // 防止NoSQL注入攻击
    app.use(mongoSanitize());

    // 防止XSS攻击
    app.use(xss());

    // 防止HTTP参数污染
    app.use(hpp({
        whitelist: ['sort', 'fields', 'page', 'limit', 'category', 'language']
    }));
};

module.exports = {
    securityMiddleware
};

