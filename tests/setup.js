const mongoose = require('mongoose');

// 测试环境设置
beforeAll(async () => {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/culturebridge_test';
    
    // 禁用控制台日志（可选）
    if (process.env.SILENT_TESTS === 'true') {
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
    }
});

afterAll(async () => {
    // 清理数据库连接
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});

// 全局测试配置
jest.setTimeout(30000);

// 模拟外部服务
jest.mock('../src/services/advancedVoiceTranslationService', () => {
    return jest.fn().mockImplementation(() => ({
        translateText: jest.fn().mockResolvedValue({
            success: true,
            originalText: 'Hello',
            translatedText: '你好',
            sourceLanguage: 'en-US',
            targetLanguage: 'zh-CN',
            confidence: 0.95
        }),
        speechToText: jest.fn().mockResolvedValue({
            success: true,
            text: 'Hello world',
            language: 'en-US',
            confidence: 0.9
        }),
        textToSpeech: jest.fn().mockResolvedValue({
            success: true,
            audioUrl: '/mock/audio.mp3',
            duration: 2.5,
            format: 'mp3'
        }),
        getSupportedLanguages: jest.fn().mockReturnValue({
            'zh-CN': { name: '中文（简体）', voice: 'zh-CN-XiaoxiaoNeural' },
            'en-US': { name: '英语（美国）', voice: 'en-US-JennyNeural' }
        }),
        detectLanguage: jest.fn().mockResolvedValue({
            success: true,
            language: 'zh-CN',
            confidence: 0.9
        }),
        getServiceStatus: jest.fn().mockReturnValue({
            azureConfigured: false,
            googleConfigured: false,
            baiduConfigured: false,
            cacheSize: { translation: 0, speech: 0 },
            supportedLanguages: 2
        }),
        clearCache: jest.fn()
    }));
});

jest.mock('../src/services/optimizedBlockchainService', () => {
    return jest.fn().mockImplementation(() => ({
        getNetworkStatus: jest.fn().mockResolvedValue({
            success: true,
            network: 'BSC Testnet',
            blockNumber: 12345,
            gasPrice: '5000000000'
        }),
        getTokenInfo: jest.fn().mockResolvedValue({
            success: true,
            name: 'CultureBridge Token',
            symbol: 'CBT',
            totalSupply: '1000000000',
            decimals: 18
        }),
        getBalance: jest.fn().mockResolvedValue({
            success: true,
            balance: '100.0'
        }),
        transfer: jest.fn().mockResolvedValue({
            success: true,
            transactionHash: '0x123456789abcdef',
            gasUsed: 21000
        })
    }));
});

// 数据库清理辅助函数
global.cleanupDatabase = async () => {
    if (mongoose.connection.readyState !== 0) {
        const collections = await mongoose.connection.db.collections();
        for (let collection of collections) {
            await collection.deleteMany({});
        }
    }
};

// 创建测试用户辅助函数
global.createTestUser = async (userData = {}) => {
    const User = require('../src/models/User');
    const bcrypt = require('bcryptjs');
    
    const defaultUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 12),
        isEmailVerified: true,
        ...userData
    };
    
    const user = new User(defaultUser);
    await user.save();
    return user;
};

// 生成JWT token辅助函数
global.generateAuthToken = (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

