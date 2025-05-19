const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const request = require('supertest');

// 创建内存MongoDB服务器用于测试
let mongoServer;

// 在所有测试前连接到内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// 在所有测试后断开连接并停止服务器
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 测试安全中间件
describe('安全中间件测试', () => {
  // 测试API速率限制
  it('应该有适当的安全头部', async () => {
    const res = await request(app).get('/');
    expect(res.headers).toHaveProperty('x-content-type-options');
    expect(res.headers).toHaveProperty('x-xss-protection');
  });

  // 测试CORS配置
  it('应该允许CORS', async () => {
    const res = await request(app).get('/');
    expect(res.headers).toHaveProperty('access-control-allow-origin');
  });

  // 测试请求体大小限制
  it('应该限制请求体大小', async () => {
    // 创建一个超大的请求体
    const largeBody = { data: 'a'.repeat(11 * 1024 * 1024) }; // 11MB
    
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(largeBody);
    
    expect(res.status).toBe(413); // 请求体过大
  });
});

// 测试用户注册验证
describe('用户注册验证', () => {
  it('应该验证用户注册数据', async () => {
    const invalidUser = {
      username: 'a', // 用户名太短
      email: 'invalid-email', // 无效邮箱
      password: '123' // 密码太短
    };
    
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(invalidUser);
    
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

// 测试API路由
describe('API路由测试', () => {
  it('应该返回API运行状态', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('CultureBridge API 运行中');
  });
});
