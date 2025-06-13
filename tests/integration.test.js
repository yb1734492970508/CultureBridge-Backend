const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/enhancedApp');

// 测试数据库连接
const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/culturebridge_test';

describe('CultureBridge API Tests', () => {
    let authToken;
    let testUserId;
    let testChatRoomId;
    
    beforeAll(async () => {
        // 连接测试数据库
        await mongoose.connect(MONGODB_URI);
        
        // 创建测试用户并获取token
        const userResponse = await request(app)
            .post('/api/v2/auth/register')
            .send({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });
        
        if (userResponse.status === 201) {
            authToken = userResponse.body.token;
            testUserId = userResponse.body.user.id;
        } else {
            // 如果用户已存在，尝试登录
            const loginResponse = await request(app)
                .post('/api/v2/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });
            
            authToken = loginResponse.body.token;
            testUserId = loginResponse.body.user.id;
        }
    });
    
    afterAll(async () => {
        // 清理测试数据
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
    });
    
    describe('Authentication Tests', () => {
        test('应该能够注册新用户', async () => {
            const response = await request(app)
                .post('/api/v2/auth/register')
                .send({
                    username: 'newuser',
                    email: 'newuser@example.com',
                    password: 'password123',
                    confirmPassword: 'password123'
                });
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });
        
        test('应该能够登录用户', async () => {
            const response = await request(app)
                .post('/api/v2/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });
        
        test('应该拒绝无效的登录凭据', async () => {
            const response = await request(app)
                .post('/api/v2/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });
            
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });
    
    describe('CBT Token Tests', () => {
        test('应该能够获取用户钱包信息', async () => {
            const response = await request(app)
                .get('/api/v2/cbt/wallet')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.balance).toBeDefined();
        });
        
        test('应该能够分发奖励', async () => {
            const response = await request(app)
                .post('/api/v2/cbt/distribute-reward')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    userId: testUserId,
                    type: 'DAILY_LOGIN',
                    amount: '10',
                    description: '每日登录奖励'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        
        test('应该能够获取交易历史', async () => {
            const response = await request(app)
                .get('/api/v2/cbt/transactions')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.transactions)).toBe(true);
        });
    });
    
    describe('Chat Room Tests', () => {
        test('应该能够创建聊天室', async () => {
            const response = await request(app)
                .post('/api/v2/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: '测试聊天室',
                    description: '这是一个测试聊天室',
                    type: 'PUBLIC',
                    category: 'GENERAL'
                });
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            testChatRoomId = response.body.data._id;
        });
        
        test('应该能够获取聊天室列表', async () => {
            const response = await request(app)
                .get('/api/v2/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.chatRooms)).toBe(true);
        });
        
        test('应该能够加入聊天室', async () => {
            const response = await request(app)
                .post(`/api/v2/chat/rooms/${testChatRoomId}/join`)
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        
        test('应该能够获取聊天消息', async () => {
            const response = await request(app)
                .get(`/api/v2/chat/rooms/${testChatRoomId}/messages`)
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.messages)).toBe(true);
        });
    });
    
    describe('Cultural Learning Tests', () => {
        test('应该能够创建文化交流活动', async () => {
            const response = await request(app)
                .post('/api/v2/cultural/exchanges')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: '中国传统节日介绍',
                    description: '介绍中国的传统节日文化',
                    type: 'CULTURAL_SHARING',
                    targetLanguage: 'en-US',
                    sourceLanguage: 'zh-CN'
                });
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });
        
        test('应该能够获取学习进度', async () => {
            const response = await request(app)
                .get('/api/v2/cultural/progress')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('Voice Translation Tests', () => {
        test('应该能够获取支持的语言列表', async () => {
            const response = await request(app)
                .get('/api/v2/voice/supported-languages')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.languages).toBeDefined();
        });
        
        test('应该能够翻译文本', async () => {
            const response = await request(app)
                .post('/api/v2/voice/translate-text')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    text: 'Hello, how are you?',
                    targetLanguage: 'zh-CN',
                    sourceLanguage: 'en-US'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.translatedText).toBeDefined();
        });
        
        test('应该能够检测语言', async () => {
            const response = await request(app)
                .post('/api/v2/voice/detect-language')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    text: '你好，世界！'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.language).toBeDefined();
        });
        
        test('应该能够获取服务状态', async () => {
            const response = await request(app)
                .get('/api/v2/voice/service-status')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('Blockchain Integration Tests', () => {
        test('应该能够获取区块链状态', async () => {
            const response = await request(app)
                .get('/api/v2/blockchain/status')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        
        test('应该能够获取代币信息', async () => {
            const response = await request(app)
                .get('/api/v2/blockchain/token-info')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('Error Handling Tests', () => {
        test('应该正确处理未授权访问', async () => {
            const response = await request(app)
                .get('/api/v2/cbt/wallet');
            
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
        
        test('应该正确处理不存在的路由', async () => {
            const response = await request(app)
                .get('/api/v2/nonexistent')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(404);
        });
        
        test('应该正确处理无效的请求数据', async () => {
            const response = await request(app)
                .post('/api/v2/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    // 缺少必需的name字段
                    description: '无效的聊天室'
                });
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });
    
    describe('Performance Tests', () => {
        test('API响应时间应该在合理范围内', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .get('/api/v2/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`);
            
            const responseTime = Date.now() - startTime;
            
            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(2000); // 2秒内响应
        });
        
        test('并发请求处理', async () => {
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(app)
                        .get('/api/v2/cbt/wallet')
                        .set('Authorization', `Bearer ${authToken}`)
                );
            }
            
            const responses = await Promise.all(promises);
            
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });
        });
    });
});

module.exports = {
    testConfig: {
        testEnvironment: 'node',
        setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
        testTimeout: 30000,
        collectCoverage: true,
        coverageDirectory: 'coverage',
        coverageReporters: ['text', 'lcov', 'html'],
        collectCoverageFrom: [
            'src/**/*.js',
            '!src/config/**',
            '!src/uploads/**',
            '!**/node_modules/**'
        ]
    }
};

