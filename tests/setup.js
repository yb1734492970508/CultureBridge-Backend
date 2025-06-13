const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// 全局测试设置
beforeAll(async () => {
    console.log('🚀 启动测试环境...');
    
    // 启动内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // 连接到内存数据库
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    console.log('✅ 测试数据库已连接');
});

// 每个测试前清理数据库
beforeEach(async () => {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

// 全局测试清理
afterAll(async () => {
    console.log('🧹 清理测试环境...');
    
    // 关闭数据库连接
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    // 停止内存数据库
    if (mongoServer) {
        await mongoServer.stop();
    }
    
    console.log('✅ 测试环境已清理');
});

// 全局错误处理
process.on('unhandledRejection', (err) => {
    console.error('❌ 未处理的Promise拒绝:', err);
});

// 测试工具函数
global.testUtils = {
    // 创建测试用户
    createTestUser: async (userData = {}) => {
        const User = require('../src/models/User');
        const defaultUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            nativeLanguages: ['zh-CN'],
            learningLanguages: ['en-US']
        };
        
        const user = new User({ ...defaultUser, ...userData });
        await user.save();
        return user;
    },
    
    // 创建测试JWT令牌
    createTestToken: (userId) => {
        const jwt = require('jsonwebtoken');
        return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE
        });
    },
    
    // 创建测试聊天室
    createTestChatRoom: async (roomData = {}) => {
        const ChatRoom = require('../src/models/ChatRoom');
        const defaultRoom = {
            name: 'Test Room',
            type: 'public',
            description: 'Test chat room'
        };
        
        const room = new ChatRoom({ ...defaultRoom, ...roomData });
        await room.save();
        return room;
    },
    
    // 创建测试帖子
    createTestPost: async (postData = {}) => {
        const Post = require('../src/models/Post');
        const defaultPost = {
            title: 'Test Post',
            content: 'This is a test post',
            category: 'general'
        };
        
        const post = new Post({ ...defaultPost, ...postData });
        await post.save();
        return post;
    },
    
    // 模拟区块链交易
    mockBlockchainTransaction: () => ({
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockNumber: 12345,
        gasUsed: '21000',
        status: 'success'
    }),
    
    // 模拟语音翻译结果
    mockVoiceTranslationResult: () => ({
        originalText: 'Hello world',
        sourceLanguage: 'en-US',
        confidence: 0.95,
        translations: {
            'zh-CN': {
                text: '你好世界',
                confidence: 0.92,
                isOriginal: false
            }
        },
        audioTranslations: {
            'zh-CN': {
                audioData: 'base64_audio_data',
                mimeType: 'audio/mpeg',
                duration: 2
            }
        }
    }),
    
    // 等待异步操作
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // 生成随机字符串
    randomString: (length = 10) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // 生成随机邮箱
    randomEmail: () => {
        const username = global.testUtils.randomString(8);
        return `${username}@test.com`;
    }
};

// 模拟外部服务
jest.mock('../src/services/enhancedBlockchainService', () => {
    return jest.fn().mockImplementation(() => ({
        healthCheck: jest.fn().mockResolvedValue({
            web3Connected: true,
            contractsLoaded: true,
            redisConnected: true
        }),
        getUserBalance: jest.fn().mockResolvedValue(100),
        getBNBBalance: jest.fn().mockResolvedValue(1.5),
        getUserStats: jest.fn().mockResolvedValue({
            totalEarned: 50,
            totalSpent: 20,
            totalTransactions: 10,
            todayRewards: 5
        }),
        transferWithPurpose: jest.fn().mockResolvedValue(global.testUtils.mockBlockchainTransaction()),
        distributeReward: jest.fn().mockResolvedValue(global.testUtils.mockBlockchainTransaction()),
        generateWallet: jest.fn().mockReturnValue({
            address: '0x1234567890123456789012345678901234567890',
            privateKey: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            mnemonic: 'test mnemonic phrase for testing purposes only'
        }),
        isValidAddress: jest.fn().mockReturnValue(true),
        verifySignature: jest.fn().mockResolvedValue(true)
    }));
});

jest.mock('../src/services/enhancedVoiceTranslationService', () => {
    return jest.fn().mockImplementation(() => ({
        healthCheck: jest.fn().mockResolvedValue({
            speechRecognition: true,
            textToSpeech: true,
            translation: true,
            tempDirectory: true
        }),
        processVoiceMessage: jest.fn().mockResolvedValue({
            success: true,
            data: global.testUtils.mockVoiceTranslationResult()
        }),
        transcribeAudio: jest.fn().mockResolvedValue({
            text: 'Hello world',
            confidence: 0.95,
            detectedLanguage: 'en-US',
            wordTimings: []
        }),
        synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('fake_audio_data')),
        translateText: jest.fn().mockResolvedValue({
            'zh-CN': {
                text: '你好世界',
                confidence: 0.92,
                isOriginal: false
            }
        }),
        getSupportedLanguages: jest.fn().mockReturnValue([
            { code: 'en-US', name: '英语（美国）', hasVoice: true },
            { code: 'zh-CN', name: '中文（简体）', hasVoice: true }
        ])
    }));
});

console.log('✅ 测试设置已完成');

