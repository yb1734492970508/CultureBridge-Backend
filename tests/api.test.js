const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');

let mongoServer;

// 测试前设置
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

// 测试后清理
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// 每个测试后清理数据库
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

describe('CultureBridge API Tests', () => {
    describe('基础API测试', () => {
        test('GET / - 应该返回API信息', async () => {
            const res = await request(app).get('/');
            
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('CultureBridge API 运行中...');
            expect(res.body.version).toBe('2.0.0');
            expect(res.body.features).toContain('BNB链区块链集成');
        });

        test('GET /health - 应该返回健康状态', async () => {
            const res = await request(app).get('/health');
            
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('healthy');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('uptime');
        });
    });

    describe('用户认证测试', () => {
        test('POST /api/v1/auth/register - 应该成功注册用户', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            };

            const res = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('token');
        });

        test('POST /api/v1/auth/login - 应该成功登录', async () => {
            // 先注册用户
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            };

            await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            // 然后登录
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('token');
        });
    });

    describe('区块链API测试', () => {
        let authToken;

        beforeEach(async () => {
            // 注册并登录用户
            const userData = {
                username: 'blockchainuser',
                email: 'blockchain@example.com',
                password: 'password123'
            };

            const registerRes = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            authToken = registerRes.body.token;
        });

        test('POST /api/v1/blockchain/wallet/generate - 应该生成钱包', async () => {
            const res = await request(app)
                .post('/api/v1/blockchain/wallet/generate')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('address');
            expect(res.body.data.message).toContain('钱包生成成功');
        });

        test('GET /api/v1/blockchain/gas-price - 应该返回Gas价格', async () => {
            const res = await request(app).get('/api/v1/blockchain/gas-price');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('gasPrice');
        });
    });

    describe('聊天API测试', () => {
        let authToken;

        beforeEach(async () => {
            const userData = {
                username: 'chatuser',
                email: 'chat@example.com',
                password: 'password123'
            };

            const registerRes = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            authToken = registerRes.body.token;
        });

        test('POST /api/v1/chat/rooms - 应该创建聊天室', async () => {
            const roomData = {
                name: '测试聊天室',
                description: '这是一个测试聊天室',
                type: 'public',
                languages: ['zh', 'en']
            };

            const res = await request(app)
                .post('/api/v1/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .send(roomData);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('测试聊天室');
            expect(res.body.data.languages).toContain('zh');
        });

        test('GET /api/v1/chat/rooms - 应该获取聊天室列表', async () => {
            const res = await request(app).get('/api/v1/chat/rooms');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('语音API测试', () => {
        let authToken;

        beforeEach(async () => {
            const userData = {
                username: 'voiceuser',
                email: 'voice@example.com',
                password: 'password123'
            };

            const registerRes = await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            authToken = registerRes.body.token;
        });

        test('GET /api/v1/voice/languages - 应该返回支持的语言', async () => {
            const res = await request(app).get('/api/v1/voice/languages');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        test('POST /api/v1/voice/text-to-speech - 应该转换文字为语音', async () => {
            const ttsData = {
                text: '你好，这是一个测试',
                language: 'zh',
                voice: 'female'
            };

            const res = await request(app)
                .post('/api/v1/voice/text-to-speech')
                .set('Authorization', `Bearer ${authToken}`)
                .send(ttsData);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('audioUrl');
            expect(res.body.data.text).toBe('你好，这是一个测试');
        });
    });

    describe('错误处理测试', () => {
        test('访问不存在的路由应该返回404', async () => {
            const res = await request(app).get('/api/v1/nonexistent');

            expect(res.statusCode).toBe(404);
        });

        test('未认证访问受保护路由应该返回401', async () => {
            const res = await request(app).post('/api/v1/chat/rooms');

            expect(res.statusCode).toBe(401);
        });

        test('无效的JSON数据应该返回400', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send('invalid json')
                .set('Content-Type', 'application/json');

            expect(res.statusCode).toBe(400);
        });
    });
});

