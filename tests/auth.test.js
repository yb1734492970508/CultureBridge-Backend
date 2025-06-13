const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');
const User = require('../src/models/User');

let mongoServer;

describe('Authentication Tests', () => {
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
    });

    describe('POST /api/v1/auth/register', () => {
        it('应该成功注册新用户', async () => {
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
            expect(response.body.data.user.username).toBe(userData.username);
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.token).toBeDefined();
        });

        it('应该拒绝重复的用户名', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            };

            // 第一次注册
            await request(app)
                .post('/api/v1/auth/register')
                .send(userData);

            // 第二次注册相同用户名
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test2@example.com',
                    password: 'password123'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('应该拒绝无效的邮箱格式', async () => {
            const userData = {
                username: 'testuser',
                email: 'invalid-email',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            // 创建测试用户
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            });
            await user.save();
        });

        it('应该成功登录有效用户', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
        });

        it('应该拒绝错误的密码', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('应该拒绝不存在的用户', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/auth/me', () => {
        let authToken;
        let userId;

        beforeEach(async () => {
            // 创建并登录用户
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
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

        it('应该返回当前用户信息', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('testuser');
            expect(response.body.data.email).toBe('test@example.com');
        });

        it('应该拒绝无效的token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('应该拒绝没有token的请求', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });
});

