const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// 导入服务
const ContentService = require('../src/services/contentService');
const blockchainService = require('../src/services/blockchainService');

describe('CultureBridge API Tests', () => {
  let app;
  let mongoServer;
  let contentService;

  beforeAll(async () => {
    // 启动内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 初始化服务
    contentService = new ContentService();
    app.use('/api/content', contentService.router);

    // 模拟用户认证中间件
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user-id',
        username: 'testuser',
        avatar: '/test-avatar.jpg'
      };
      next();
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Content API', () => {
    let contentId;

    test('创建新内容', async () => {
      const contentData = {
        title: '测试文化内容',
        content: '这是一个测试内容，用于验证API功能。',
        category: 'culture',
        language: 'zh',
        tags: ['测试', '文化'],
        type: 'post'
      };

      const response = await request(app)
        .post('/api/content')
        .send(contentData)
        .expect(201);

      expect(response.body.title).toBe(contentData.title);
      expect(response.body.author.userId).toBe('test-user-id');
      contentId = response.body._id;
    });

    test('获取内容列表', async () => {
      const response = await request(app)
        .get('/api/content')
        .expect(200);

      expect(response.body.contents).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    test('获取单个内容', async () => {
      const response = await request(app)
        .get(`/api/content/${contentId}`)
        .expect(200);

      expect(response.body.title).toBe('测试文化内容');
      expect(response.body.stats.views).toBe(1);
    });

    test('点赞内容', async () => {
      const response = await request(app)
        .post(`/api/content/${contentId}/like`)
        .expect(200);

      expect(response.body.liked).toBe(true);
      expect(response.body.likes).toBe(1);
    });

    test('添加评论', async () => {
      const commentData = {
        content: '这是一个测试评论'
      };

      const response = await request(app)
        .post(`/api/content/${contentId}/comment`)
        .send(commentData)
        .expect(201);

      expect(response.body.content).toBe(commentData.content);
      expect(response.body.userId).toBe('test-user-id');
    });

    test('搜索内容', async () => {
      const response = await request(app)
        .get('/api/content/search/query?q=测试')
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].title).toContain('测试');
    });

    test('获取热门内容', async () => {
      const response = await request(app)
        .get('/api/content/trending/all')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('区块链服务测试', () => {
    test('健康检查', async () => {
      const health = await blockchainService.healthCheck();
      expect(health.status).toBeDefined();
    });

    test('验证地址格式', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d0b1';
      const invalidAddress = 'invalid-address';

      expect(blockchainService.isValidAddress(validAddress)).toBe(true);
      expect(blockchainService.isValidAddress(invalidAddress)).toBe(false);
    });
  });
});

// 性能测试
describe('性能测试', () => {
  test('内容列表API响应时间', async () => {
    const start = Date.now();
    
    const response = await request(app)
      .get('/api/content?limit=50')
      .expect(200);
    
    const responseTime = Date.now() - start;
    
    // 响应时间应该小于500ms
    expect(responseTime).toBeLessThan(500);
    console.log(`内容列表API响应时间: ${responseTime}ms`);
  });

  test('并发请求处理', async () => {
    const promises = [];
    const concurrentRequests = 10;

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        request(app)
          .get('/api/content')
          .expect(200)
      );
    }

    const start = Date.now();
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - start;

    expect(responses).toHaveLength(concurrentRequests);
    console.log(`${concurrentRequests}个并发请求总时间: ${totalTime}ms`);
    console.log(`平均响应时间: ${totalTime / concurrentRequests}ms`);
  });
});

// 集成测试
describe('集成测试', () => {
  test('完整的用户交互流程', async () => {
    // 1. 创建内容
    const contentResponse = await request(app)
      .post('/api/content')
      .send({
        title: '集成测试内容',
        content: '这是集成测试的内容',
        category: 'culture',
        language: 'zh',
        tags: ['集成测试']
      })
      .expect(201);

    const contentId = contentResponse.body._id;

    // 2. 查看内容（增加浏览量）
    await request(app)
      .get(`/api/content/${contentId}`)
      .expect(200);

    // 3. 点赞内容
    await request(app)
      .post(`/api/content/${contentId}/like`)
      .expect(200);

    // 4. 添加评论
    await request(app)
      .post(`/api/content/${contentId}/comment`)
      .send({ content: '很棒的内容！' })
      .expect(201);

    // 5. 验证最终状态
    const finalResponse = await request(app)
      .get(`/api/content/${contentId}`)
      .expect(200);

    expect(finalResponse.body.stats.views).toBe(2); // 两次查看
    expect(finalResponse.body.stats.likes).toBe(1);
    expect(finalResponse.body.stats.comments).toBe(1);
  });
});

module.exports = {
  app,
  contentService
};

