const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');
const User = require('../src/models/User');
const TokenTransaction = require('../src/models/TokenTransaction');

let mongoServer;
let authToken;
let userId;

describe('Token Reward Tests', () => {
    beforeAll(async () => {
        // 启动内存数据库
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        // 连接到测试数据库
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        // 清理和关闭连接
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // 清理数据
        await User.deleteMany({});
        await TokenTransaction.deleteMany({});

        // 创建测试用户并获取token
        const user = new User({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            walletAddress: '0x1234567890123456789012345678901234567890'
        });
        await user.save();
        userId = user._id;

        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });

        authToken = loginResponse.body.data.token;
    });

    describe('POST /api/v1/tokens/daily-checkin', () => {
        it('应该成功进行每日签到', async () => {
            const response = await request(app)
                .post('/api/v1/tokens/daily-checkin')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBeGreaterThan(0);
            expect(response.body.data.streak).toBe(1);
        });

        it('应该拒绝重复签到', async () => {
            // 第一次签到
            await request(app)
                .post('/api/v1/tokens/daily-checkin')
                .set('Authorization', `Bearer ${authToken}`);

            // 第二次签到
            const response = await request(app)
                .post('/api/v1/tokens/daily-checkin')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/tokens/learning-reward', () => {
        it('应该成功奖励学习成就', async () => {
            const rewardData = {
                type: 'vocabulary',
                language: 'en',
                details: {
                    difficulty: 'intermediate'
                }
            };

            const response = await request(app)
                .post('/api/v1/tokens/learning-reward')
                .set('Authorization', `Bearer ${authToken}`)
                .send(rewardData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBeGreaterThan(0);
        });

        it('应该拒绝无效的奖励类型', async () => {
            const rewardData = {
                type: 'invalid_type',
                language: 'en'
            };

            const response = await request(app)
                .post('/api/v1/tokens/learning-reward')
                .set('Authorization', `Bearer ${authToken}`)
                .send(rewardData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/tokens/balance', () => {
        it('应该返回用户代币余额', async () => {
            const response = await request(app)
                .get('/api/v1/tokens/balance')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.balance).toBeDefined();
            expect(response.body.data.walletAddress).toBeDefined();
        });
    });

    describe('POST /api/v1/tokens/payment', () => {
        beforeEach(async () => {
            // 先给用户一些代币
            await request(app)
                .post('/api/v1/tokens/daily-checkin')
                .set('Authorization', `Bearer ${authToken}`);
        });

        it('应该成功进行代币支付', async () => {
            const paymentData = {
                amount: 1,
                purpose: '购买学习资源',
                category: 'premium_features'
            };

            const response = await request(app)
                .post('/api/v1/tokens/payment')
                .set('Authorization', `Bearer ${authToken}`)
                .send(paymentData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBe(1);
        });

        it('应该拒绝余额不足的支付', async () => {
            const paymentData = {
                amount: 1000,
                purpose: '购买昂贵资源',
                category: 'premium_features'
            };

            const response = await request(app)
                .post('/api/v1/tokens/payment')
                .set('Authorization', `Bearer ${authToken}`)
                .send(paymentData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/tokens/stats', () => {
        beforeEach(async () => {
            // 创建一些交易记录
            await request(app)
                .post('/api/v1/tokens/daily-checkin')
                .set('Authorization', `Bearer ${authToken}`);

            await request(app)
                .post('/api/v1/tokens/learning-reward')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'vocabulary',
                    language: 'en'
                });
        });

        it('应该返回用户代币统计信息', async () => {
            const response = await request(app)
                .get('/api/v1/tokens/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.totalIncome).toBeGreaterThan(0);
            expect(response.body.data.currentBalance).toBeGreaterThan(0);
            expect(response.body.data.rewardsByCategory).toBeDefined();
        });
    });
});

