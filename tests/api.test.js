const request = require('supertest');
const app = require('../src/enhancedApp');

describe('CultureBridge API 测试套件', () => {
    let authToken;
    let userId;

    // 测试前的设置
    beforeAll(async () => {
        // 这里可以设置测试数据库连接等
    });

    // 测试后的清理
    afterAll(async () => {
        // 清理测试数据
    });

    describe('健康检查接口', () => {
        test('GET /health - 应该返回服务状态', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('services');
        });

        test('GET /api/status - 应该返回详细状态信息', async () => {
            const response = await request(app)
                .get('/api/status')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('server');
            expect(response.body.data).toHaveProperty('database');
            expect(response.body.data).toHaveProperty('blockchain');
        });
    });

    describe('用户认证接口', () => {
        const testUser = {
            username: 'testuser' + Date.now(),
            email: 'test' + Date.now() + '@example.com',
            password: 'TestPassword123!',
            culturalBackground: 'Chinese',
            preferredLanguages: ['zh', 'en']
        };

        test('POST /api/v1/auth/register - 应该成功注册新用户', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('username', testUser.username);
            expect(response.body.user).toHaveProperty('email', testUser.email);
            
            authToken = response.body.token;
            userId = response.body.user.id;
        });

        test('POST /api/v1/auth/login - 应该成功登录', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('email', testUser.email);
        });

        test('GET /api/v1/auth/me - 应该返回当前用户信息', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.user).toHaveProperty('id', userId);
        });
    });

    describe('区块链集成接口', () => {
        test('GET /api/blockchain/status - 应该返回区块链服务状态', async () => {
            const response = await request(app)
                .get('/api/blockchain/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('network');
            expect(response.body.data).toHaveProperty('blockNumber');
        });

        test('GET /api/blockchain/balance/:address - 应该返回代币余额', async () => {
            const testAddress = '0x1234567890abcdef1234567890abcdef12345678';
            const response = await request(app)
                .get(`/api/blockchain/balance/${testAddress}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('address', testAddress);
            expect(response.body.data).toHaveProperty('balance');
        });
    });

    describe('交易所集成接口', () => {
        test('GET /api/exchange/token-info - 应该返回代币信息包', async () => {
            const response = await request(app)
                .get('/api/exchange/token-info')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('basicInfo');
            expect(response.body.data).toHaveProperty('projectInfo');
            expect(response.body.data).toHaveProperty('technicalInfo');
            expect(response.body.data).toHaveProperty('tokenomics');
        });

        test('GET /api/exchange/readiness-check - 应该返回上线准备状态', async () => {
            const response = await request(app)
                .get('/api/exchange/readiness-check')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('readinessPercentage');
            expect(response.body.data).toHaveProperty('isReady');
            expect(response.body.data).toHaveProperty('checklist');
            expect(response.body.data).toHaveProperty('nextSteps');
        });

        test('GET /api/exchange/pancakeswap-listing - 应该返回 PancakeSwap 上线信息', async () => {
            const response = await request(app)
                .get('/api/exchange/pancakeswap-listing')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('step1');
            expect(response.body.data).toHaveProperty('step2');
            expect(response.body.data).toHaveProperty('step3');
        });

        test('GET /api/exchange/timeline - 应该返回上线时间表', async () => {
            const response = await request(app)
                .get('/api/exchange/timeline')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        test('GET /api/exchange/contacts - 应该返回交易所联系信息', async () => {
            const response = await request(app)
                .get('/api/exchange/contacts')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('tier1');
            expect(response.body.data).toHaveProperty('tier2');
            expect(response.body.data).toHaveProperty('tier3');
        });
    });

    describe('文化交流活动接口', () => {
        test('GET /api/v1/events - 应该返回活动列表', async () => {
            const response = await request(app)
                .get('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
        });

        test('POST /api/v1/events - 应该创建新活动', async () => {
            const newEvent = {
                title: 'Test Cultural Exchange Event',
                description: 'A test event for cultural exchange',
                category: 'language-exchange',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
                maxParticipants: 20,
                rewardAmount: '50'
            };

            const response = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newEvent)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('title', newEvent.title);
            expect(response.body.data).toHaveProperty('organizer', userId);
        });
    });

    describe('语音翻译接口', () => {
        test('GET /api/voice/status - 应该返回语音服务状态', async () => {
            const response = await request(app)
                .get('/api/voice/status')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('service');
            expect(response.body.data).toHaveProperty('status');
        });

        test('POST /api/voice/text-to-speech - 应该转换文字为语音', async () => {
            const textData = {
                text: 'Hello, welcome to CultureBridge!',
                language: 'en-US',
                voice: 'female'
            };

            const response = await request(app)
                .post('/api/voice/text-to-speech')
                .set('Authorization', `Bearer ${authToken}`)
                .send(textData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('audioUrl');
        });
    });

    describe('错误处理测试', () => {
        test('未认证请求应该返回 401', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .expect(401);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        test('无效的路由应该返回 404', async () => {
            const response = await request(app)
                .get('/api/nonexistent-route')
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        test('无效的 JSON 应该返回 400', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    describe('性能测试', () => {
        test('健康检查接口响应时间应该小于 100ms', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/health')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(100);
        });

        test('并发请求处理', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(app)
                        .get('/health')
                        .expect(200)
                );
            }

            const results = await Promise.all(promises);
            expect(results.length).toBe(10);
            results.forEach(result => {
                expect(result.body).toHaveProperty('status', 'OK');
            });
        });
    });

    describe('安全性测试', () => {
        test('SQL 注入防护', async () => {
            const maliciousInput = {
                email: "test@example.com'; DROP TABLE users; --",
                password: 'password'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(maliciousInput)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });

        test('XSS 防护', async () => {
            const maliciousInput = {
                username: '<script>alert("xss")</script>',
                email: 'test@example.com',
                password: 'password'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(maliciousInput)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
        });

        test('请求频率限制', async () => {
            // 快速发送多个请求测试频率限制
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(
                    request(app)
                        .post('/api/v1/auth/login')
                        .send({
                            email: 'test@example.com',
                            password: 'wrongpassword'
                        })
                );
            }

            const results = await Promise.allSettled(promises);
            const rateLimitedRequests = results.filter(
                result => result.value && result.value.status === 429
            );

            expect(rateLimitedRequests.length).toBeGreaterThan(0);
        });
    });
});

// 辅助函数
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateTestUser() {
    const timestamp = Date.now();
    return {
        username: `testuser_${timestamp}`,
        email: `test_${timestamp}@example.com`,
        password: 'TestPassword123!',
        culturalBackground: 'Chinese',
        preferredLanguages: ['zh', 'en']
    };
}

module.exports = {
    generateRandomString,
    generateTestUser
};

