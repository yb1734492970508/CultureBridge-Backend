const mongoose = require('mongoose');

// 优化的数据库连接配置
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // 连接池配置
            maxPoolSize: 10, // 最大连接数
            minPoolSize: 2,  // 最小连接数
            maxIdleTimeMS: 30000, // 连接空闲时间
            serverSelectionTimeoutMS: 5000, // 服务器选择超时
            socketTimeoutMS: 45000, // Socket超时
            
            // 缓冲配置
            bufferMaxEntries: 0, // 禁用mongoose缓冲
            bufferCommands: false,
            
            // 其他优化配置
            useNewUrlParser: true,
            useUnifiedTopology: true,
            
            // 读写分离配置（如果有副本集）
            readPreference: 'secondaryPreferred',
            
            // 压缩配置
            compressors: ['zlib'],
            zlibCompressionLevel: 6,
            
            // 心跳配置
            heartbeatFrequencyMS: 10000,
            
            // 重试配置
            retryWrites: true,
            retryReads: true,
            
            // 监控配置
            monitorCommands: process.env.NODE_ENV === 'development'
        });

        console.log(`✅ MongoDB连接成功: ${conn.connection.host}`);
        
        // 连接事件监听
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB连接错误:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB连接断开');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB重新连接成功');
        });
        
        // 性能监控
        if (process.env.NODE_ENV === 'development') {
            mongoose.set('debug', true);
        }
        
        // 设置全局查询优化
        mongoose.set('strictQuery', true);
        
        return conn;
    } catch (error) {
        console.error('❌ 数据库连接失败:', error);
        process.exit(1);
    }
};

module.exports = connectDB;

