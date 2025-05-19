const request = require('supertest');
const app = require('../src/app');

// 测试API根路由
describe('API根路由', () => {
  it('应返回API运行状态', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('CultureBridge API 运行中');
  });
});

// 测试用户认证API
describe('用户认证API', () => {
  let token;
  let userId;

  // 测试用户注册
  it('应成功注册新用户', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
    
    token = res.body.token;
  });

  // 测试用户登录
  it('应成功登录用户', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
  });

  // 测试获取当前用户
  it('应返回当前登录用户信息', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('username', 'testuser');
    expect(res.body.data).toHaveProperty('email', 'test@example.com');
    
    userId = res.body.data._id;
  });

  // 测试更新用户信息
  it('应成功更新用户信息', async () => {
    const res = await request(app)
      .put('/api/v1/auth/updatedetails')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'updateduser',
        email: 'updated@example.com'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('username', 'updateduser');
    expect(res.body.data).toHaveProperty('email', 'updated@example.com');
  });

  // 测试更新密码
  it('应成功更新密码', async () => {
    const res = await request(app)
      .put('/api/v1/auth/updatepassword')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
    
    token = res.body.token;
  });
});

// 测试个人资料API
describe('个人资料API', () => {
  let token;
  let profileId;

  // 在测试前先注册用户并登录
  beforeAll(async () => {
    // 注册用户
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'profileuser',
        email: 'profile@example.com',
        password: 'password123'
      });
    
    token = registerRes.body.token;
  });

  // 测试创建个人资料
  it('应成功创建个人资料', async () => {
    const res = await request(app)
      .post('/api/v1/profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '测试用户',
        bio: '这是一个测试用户的个人简介',
        location: '北京',
        languages: [
          {
            language: '中文',
            proficiency: '母语'
          },
          {
            language: '英语',
            proficiency: '中级'
          }
        ],
        interests: ['文化交流', '语言学习']
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('name', '测试用户');
    expect(res.body.data).toHaveProperty('bio', '这是一个测试用户的个人简介');
    expect(res.body.data.languages).toHaveLength(2);
    expect(res.body.data.interests).toHaveLength(2);
    
    profileId = res.body.data._id;
  });

  // 测试获取个人资料
  it('应成功获取个人资料', async () => {
    const res = await request(app)
      .get(`/api/v1/profiles/${profileId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('name', '测试用户');
    expect(res.body.data).toHaveProperty('bio', '这是一个测试用户的个人简介');
  });

  // 测试更新个人资料
  it('应成功更新个人资料', async () => {
    const res = await request(app)
      .put(`/api/v1/profiles/${profileId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '更新后的用户',
        bio: '这是更新后的个人简介',
        location: '上海'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('name', '更新后的用户');
    expect(res.body.data).toHaveProperty('bio', '这是更新后的个人简介');
    expect(res.body.data).toHaveProperty('location', '上海');
  });
});

// 测试话题API
describe('话题API', () => {
  let token;
  let topicId;

  // 在测试前先注册用户并登录
  beforeAll(async () => {
    // 注册用户
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'topicuser',
        email: 'topic@example.com',
        password: 'password123'
      });
    
    token = registerRes.body.token;
  });

  // 测试创建话题
  it('应成功创建话题', async () => {
    const res = await request(app)
      .post('/api/v1/topics')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '测试话题',
        description: '这是一个测试话题的描述',
        category: '文化交流',
        tags: ['文化', '交流', '测试']
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('title', '测试话题');
    expect(res.body.data).toHaveProperty('description', '这是一个测试话题的描述');
    expect(res.body.data).toHaveProperty('category', '文化交流');
    expect(res.body.data.tags).toHaveLength(3);
    
    topicId = res.body.data._id;
  });

  // 测试获取话题
  it('应成功获取话题', async () => {
    const res = await request(app)
      .get(`/api/v1/topics/${topicId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('title', '测试话题');
    expect(res.body.data).toHaveProperty('description', '这是一个测试话题的描述');
  });

  // 测试更新话题
  it('应成功更新话题', async () => {
    const res = await request(app)
      .put(`/api/v1/topics/${topicId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '更新后的话题',
        description: '这是更新后的话题描述',
        category: '语言学习'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('title', '更新后的话题');
    expect(res.body.data).toHaveProperty('description', '这是更新后的话题描述');
    expect(res.body.data).toHaveProperty('category', '语言学习');
  });
});

// 更多测试用例可以按照类似的方式添加，覆盖其他API端点
