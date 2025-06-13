module.exports = {
  // 测试环境配置
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  
  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/enhancedApp.js',
    '!src/config/**',
    '!src/middleware/**',
    '!src/utils/**'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // 测试超时
  testTimeout: 30000,
  
  // 环境变量
  setupFiles: ['<rootDir>/tests/env.js'],
  
  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 忽略的文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/blockchain/artifacts/',
    '/blockchain/cache/',
    '/temp/',
    '/uploads/'
  ],
  
  // 全局变量
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // 清理模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 详细输出
  verbose: true,
  
  // 并行运行
  maxWorkers: '50%',
  
  // 监视模式配置
  watchman: false,
  
  // 转换配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 模拟配置
  moduleFileExtensions: ['js', 'json'],
  
  // 报告器配置
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/html-report',
      filename: 'report.html',
      expand: true
    }]
  ]
};

