/**
 * 安全中间件
 * Security Middleware
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

/**
 * 应用安全中间件
 * @param {Object} app - Express应用实例
 */
const securityMiddleware = (app) => {
    // 设置安全头
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));

    // 速率限制
    const limiter = rateLimit({
        windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15分钟
        max: process.env.RATE_LIMIT_MAX || 100, // 限制每个IP每15分钟最多100个请求
        message: {
            success: false,
            message: '请求过于频繁，请稍后再试'
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use('/api/', limiter);

    // 防止NoSQL注入
    app.use(mongoSanitize());

    // 防止XSS攻击
    app.use(xss());

    // 防止HTTP参数污染
    app.use(hpp());
};

module.exports = { securityMiddleware };

