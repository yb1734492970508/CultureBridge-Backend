const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/app');
const User = require('../src/models/User');
const CulturalExchange = require('../src/models/CulturalExchange');
const LanguageLearningSession = require('../src/models/LanguageLearningSession');

// 测试数据库连接
const MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/culturebridge_test';

describe('CultureBridge API Tests', () => {
    let authToken;
    let userId;
    let exchangeId;
    let sessionId;

    beforeAll(async () => {
        // 连接测试数据库
        await mongoose.connect(MONGODB_URI);
        
        // 清理测试数据
        await User.deleteMany({});
        await CulturalExchange.deleteMany({});
        await LanguageLearningSession.deleteMany({});
    });

    afterAll(async () => {
        // 清理测试数据
        await User.deleteMany({});
        await CulturalExchange.deleteMany({});
        await LanguageLearningSession.deleteMany({});
        
        // 关闭数据库连接
        await mongoose.connection.close();
    });

    describe('Authentication', () => {
        test('应该能够注册新用户', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            
            authToken = response.body.token;
        });

        test('应该能够登录用户', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });

        test('应该能够获取当前用户信息', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('testuser');
            
            userId = response.body.data._id;
        });
    });

    describe('Cultural Exchange', () => {
        test('应该能够创建文化交流活动', async () => {
            const exchangeData = {
                title: '中英文化交流',
                description: '一个促进中英文化理解的活动',
                category: 'language_exchange',
                languages: ['zh', 'en'],
                maxParticipants: 20,
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 明天
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
                location: {
                    type: 'online',
                    platform: 'Zoom'
                }
            };

            const response = await request(app)
                .post('/api/v1/cultural-exchanges')
                .set('Authorization', `Bearer ${authToken}`)
                .send(exchangeData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(exchangeData.title);
            
            exchangeId = response.body.data._id;
        });

        test('应该能够获取文化交流活动列表', async () => {
            const response = await request(app)
                .get('/api/v1/cultural-exchanges')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        test('应该能够加入文化交流活动', async () => {
            // 创建另一个用户来测试加入功能
            const newUser = await User.create({
                username: 'participant',
                email: 'participant@example.com',
                password: 'password123'
            });

            const participantToken = newUser.getSignedJwtToken();

            const response = await request(app)
                .post(`/api/v1/cultural-exchanges/${exchangeId}/join`)
                .set('Authorization', `Bearer ${participantToken}`)
                .send({ contribution: '我想学习中文' })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Language Learning', () => {
        test('应该能够创建语言学习会话', async () => {
            const sessionData = {
                title: '英语口语提升班',
                description: '专注于提升英语口语能力的学习会话',
                targetLanguage: 'en',
                sourceLanguage: 'zh',
                level: 'intermediate',
                maxStudents: 15,
                schedule: {
                    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 一个月后
                    sessions: [
                        {
                            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                            startTime: '19:00',
                            endTime: '20:00',
                            topic: '日常对话'
                        }
                    ]
                },
                curriculum: [
                    {
                        lesson: '第一课：自我介绍',
                        objectives: ['学会基本的自我介绍', '掌握常用问候语'],
                        order: 1
                    }
                ]
            };

            const response = await request(app)
                .post('/api/v1/language-learning')
                .set('Authorization', `Bearer ${authToken}`)
                .send(sessionData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(sessionData.title);
            
            sessionId = response.body.data._id;
        });

        test('应该能够注册语言学习会话', async () => {
            // 创建学生用户
            const student = await User.create({
                username: 'student',
                email: 'student@example.com',
                password: 'password123'
            });

            const studentToken = student.getSignedJwtToken();

            const response = await request(app)
                .post(`/api/v1/language-learning/${sessionId}/enroll`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ currentLevel: 'beginner' })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Blockchain Integration', () => {
        test('应该能够生成钱包地址', async () => {
            const response = await request(app)
                .post('/api/v1/blockchain/wallet/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.address).toBeDefined();
        });

        test('应该能够获取网络状态', async () => {
            const response = await request(app)
                .get('/api/v1/blockchain/gas-price')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.gasPrice).toBeDefined();
        });
    });

    describe('Voice Translation', () => {
        test('应该能够获取支持的语言列表', async () => {
            const response = await request(app)
                .get('/api/v1/voice/languages')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Object);
        });

        test('应该能够获取服务状态', async () => {
            const response = await request(app)
                .get('/api/v1/voice/status')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Object);
        });
    });

    describe('Error Handling', () => {
        test('应该正确处理未认证的请求', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        test('应该正确处理不存在的路由', async () => {
            const response = await request(app)
                .get('/api/v1/nonexistent')
                .expect(404);
        });

        test('应该正确处理无效的数据', async () => {
            const response = await request(app)
                .post('/api/v1/cultural-exchanges')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: '', // 空标题应该失败
                    description: '测试描述'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Performance Tests', () => {
        test('API响应时间应该在合理范围内', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/api/v1/cultural-exchanges')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(1000); // 应该在1秒内响应
        });

        test('应该能够处理并发请求', async () => {
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(app)
                        .get('/api/v1/cultural-exchanges')
                        .expect(200)
                );
            }
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(10);
        });
    });
});

