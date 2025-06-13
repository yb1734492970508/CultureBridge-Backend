// 测试环境设置
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRE = '1d';

// 禁用控制台输出以保持测试输出清洁
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

