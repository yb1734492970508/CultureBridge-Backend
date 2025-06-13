const request = require('supertest');
const { app } = require('../../src/enhancedApp');
const User = require('../../src/models/User');

describe('Enhanced Auth API', () => {
    describe('POST /api/v2/auth/register', () => {
        it('应该成功注册新用户', async () => {
            const userData = {
                username: 'newuser',
                email: 'newuser@test.com',
                password: 'password123',
                nativeLanguages: ['zh-CN'],
                learningLanguages: ['en-US']
            };

            const res = await request(app)
                .post('/api/v2/auth/register')
                .send(userData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.data.username).toBe(userData.username);
            expect(res.body.data.email).toBe(userData.email);
            expect(res.body.data.password).toBeUndefined();
        });

        it('应该拒绝重复的邮箱', async () => {
            const userData = {
                username: 'user1',
                email: 'duplicate@test.com',
                password: 'password123'
            };

            // 第一次注册
            await request(app)
                .post('/api/v2/auth/register')
                .send(userData)
                .expect(201);

            // 第二次注册相同邮箱
            const res = await request(app)
                .post('/api/v2/auth/register')
                .send({
                    username: 'user2',
                    email: 'duplicate@test.com',
                    password: 'password123'
                })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('邮箱已被注册');
        });

        it('应该验证必填字段', async () => {
            const res = await request(app)
                .post('/api/v2/auth/register')
                .send({
                    username: 'testuser'
                    // 缺少email和password
                })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('请提供用户名、邮箱和密码');
        });
    });

    describe('POST /api/v2/auth/login', () => {
        let testUser;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser({
                email: 'login@test.com',
                password: 'password123'
            });
        });

        it('应该成功登录有效用户', async () => {
            const res = await request(app)
                .post('/api/v2/auth/login')
                .send({
                    email: 'login@test.com',
                    password: 'password123'
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.data.email).toBe('login@test.com');
            expect(res.body.message).toBe('登录成功');
        });

        it('应该拒绝错误的密码', async () => {
            const res = await request(app)
                .post('/api/v2/auth/login')
                .send({
                    email: 'login@test.com',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('邮箱或密码错误');
        });

        it('应该拒绝不存在的用户', async () => {
            const res = await request(app)
                .post('/api/v2/auth/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'password123'
                })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('邮箱或密码错误');
        });
    });

    describe('GET /api/v2/auth/me', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser();
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该返回当前用户信息', async () => {
            const res = await request(app)
                .get('/api/v2/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.user._id).toBe(testUser._id.toString());
            expect(res.body.data.user.email).toBe(testUser.email);
            expect(res.body.data.blockchain).toBeDefined();
        });

        it('应该拒绝无效令牌', async () => {
            const res = await request(app)
                .get('/api/v2/auth/me')
                .set('Authorization', 'Bearer invalid_token')
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('应该拒绝缺少令牌的请求', async () => {
            const res = await request(app)
                .get('/api/v2/auth/me')
                .expect(401);

            expect(res.body.success).toBe(false);
        });
    });

    describe('PUT /api/v2/auth/update-details', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser();
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该成功更新用户详情', async () => {
            const updateData = {
                username: 'updateduser',
                nativeLanguages: ['zh-CN', 'zh-TW'],
                learningLanguages: ['en-US', 'ja-JP']
            };

            const res = await request(app)
                .put('/api/v2/auth/update-details')
                .set('Authorization', `Bearer ${token}`)
                .send(updateData)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.username).toBe(updateData.username);
            expect(res.body.data.nativeLanguages).toEqual(updateData.nativeLanguages);
            expect(res.body.message).toBe('用户信息更新成功');
        });

        it('应该拒绝重复的用户名', async () => {
            // 创建另一个用户
            const anotherUser = await global.testUtils.createTestUser({
                username: 'existinguser',
                email: 'another@test.com'
            });

            const res = await request(app)
                .put('/api/v2/auth/update-details')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: 'existinguser'
                })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('用户名或邮箱已被使用');
        });
    });

    describe('PUT /api/v2/auth/update-password', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser({
                password: 'oldpassword123'
            });
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该成功更新密码', async () => {
            const res = await request(app)
                .put('/api/v2/auth/update-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'oldpassword123',
                    newPassword: 'newpassword123'
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.message).toBe('密码更新成功');
        });

        it('应该拒绝错误的当前密码', async () => {
            const res = await request(app)
                .put('/api/v2/auth/update-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword123'
                })
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('当前密码不正确');
        });

        it('应该拒绝过短的新密码', async () => {
            const res = await request(app)
                .put('/api/v2/auth/update-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'oldpassword123',
                    newPassword: '123'
                })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('新密码至少需要8个字符');
        });
    });

    describe('POST /api/v2/auth/create-wallet', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser();
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该成功创建钱包', async () => {
            const res = await request(app)
                .post('/api/v2/auth/create-wallet')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.walletAddress).toBeDefined();
            expect(res.body.message).toBe('钱包创建成功');
        });

        it('应该拒绝为已有钱包的用户创建钱包', async () => {
            // 先创建一个钱包
            await request(app)
                .post('/api/v2/auth/create-wallet')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            // 再次尝试创建钱包
            const res = await request(app)
                .post('/api/v2/auth/create-wallet')
                .set('Authorization', `Bearer ${token}`)
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('用户已有钱包地址');
        });
    });

    describe('GET /api/v2/auth/permissions', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser();
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该返回用户权限', async () => {
            const res = await request(app)
                .get('/api/v2/auth/permissions')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('canCreatePost');
            expect(res.body.data).toHaveProperty('canComment');
            expect(res.body.data).toHaveProperty('canUseVoiceTranslation');
            expect(res.body.data).toHaveProperty('canTransferTokens');
            expect(res.body.data).toHaveProperty('isAdmin');
        });
    });

    describe('GET /api/v2/auth/activity-stats', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser();
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该返回用户活动统计', async () => {
            const res = await request(app)
                .get('/api/v2/auth/activity-stats')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('profile');
            expect(res.body.data).toHaveProperty('content');
            expect(res.body.data).toHaveProperty('engagement');
            expect(res.body.data.profile).toHaveProperty('joinedDaysAgo');
            expect(res.body.data.content).toHaveProperty('postsCreated');
        });
    });

    describe('POST /api/v2/auth/logout', () => {
        let testUser;
        let token;

        beforeEach(async () => {
            testUser = await global.testUtils.createTestUser();
            token = global.testUtils.createTestToken(testUser._id);
        });

        it('应该成功登出', async () => {
            const res = await request(app)
                .post('/api/v2/auth/logout')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('登出成功');
        });
    });

    describe('GET /api/v2/auth/health', () => {
        it('应该返回认证服务健康状态', async () => {
            const res = await request(app)
                .get('/api/v2/auth/health')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('database');
            expect(res.body.data).toHaveProperty('userCount');
            expect(res.body.data).toHaveProperty('features');
            expect(res.body.data).toHaveProperty('timestamp');
        });
    });
});

