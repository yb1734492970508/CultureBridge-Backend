# CultureBridge Backend - 文化桥梁后端服务

## 项目简介 | Project Overview

CultureBridge后端是一个基于Node.js和Express的RESTful API服务，为文化交流和语言学习平台提供完整的后端支持，包括区块链集成、实时通信、AI翻译等核心功能。

CultureBridge Backend is a Node.js and Express-based RESTful API service that provides comprehensive backend support for the cultural exchange and language learning platform, including blockchain integration, real-time communication, AI translation, and other core features.

## 主要功能 | Key Features

### 🔗 区块链服务 | Blockchain Services
- BNB链(BSC)集成
- CBT代币智能合约交互
- 奖励分发系统
- 交易历史记录
- 钱包地址验证

### 🌍 AI翻译服务 | AI Translation Services
- 支持15种语言翻译
- 文本翻译API
- 语音翻译处理
- 翻译质量评分
- 翻译历史管理

### 💬 实时通信 | Real-time Communication
- Socket.IO实时消息
- 多房间聊天支持
- 语音消息处理
- 在线用户管理
- 消息历史存储

### 👤 用户管理 | User Management
- JWT身份验证
- 用户资料管理
- 等级系统
- 奖励统计
- 权限控制

### 🛡️ 安全特性 | Security Features
- 请求频率限制
- CORS跨域配置
- 数据验证和清理
- 错误处理机制
- 日志记录系统

## 技术栈 | Tech Stack

### 核心技术 | Core Technologies
- **Node.js 18+** - 运行时环境
- **Express.js** - Web框架
- **Socket.IO** - 实时通信
- **MongoDB** - 数据库
- **Mongoose** - ODM框架

### 区块链技术 | Blockchain Technologies
- **Web3.js** - 以太坊交互
- **ethers.js** - 智能合约交互
- **BSC (Binance Smart Chain)** - 区块链网络

### 开发工具 | Development Tools
- **dotenv** - 环境变量管理
- **cors** - 跨域资源共享
- **express-rate-limit** - 频率限制
- **express-validator** - 数据验证
- **jsonwebtoken** - JWT认证

## 项目结构 | Project Structure

```
src/
├── config/              # 配置文件
│   └── db.js           # 数据库配置
├── middleware/          # 中间件
│   ├── auth.js         # 身份验证
│   ├── error.js        # 错误处理
│   └── security.js     # 安全中间件
├── models/              # 数据模型
│   └── User.js         # 用户模型
├── routes/              # API路由
│   ├── auth.js         # 认证路由
│   ├── blockchain.js   # 区块链路由
│   ├── translation.js  # 翻译路由
│   └── ...             # 其他路由
├── services/            # 业务服务
│   ├── enhancedBlockchainService.js  # 区块链服务
│   ├── enhancedTranslationService.js # 翻译服务
│   └── enhancedSocketService.js      # Socket服务
├── enhancedApp.js       # 主应用文件
└── simpleApp.js         # 简化版应用
```

## 安装和运行 | Installation & Setup

### 环境要求 | Prerequisites
- Node.js 18.0+
- npm 8.0+
- MongoDB 5.0+
- Redis 6.0+ (可选)

### 安装步骤 | Installation Steps

1. **克隆仓库 | Clone Repository**
```bash
git clone https://github.com/yb1734492970508/CultureBridge-Backend.git
cd CultureBridge-Backend
```

2. **安装依赖 | Install Dependencies**
```bash
npm install
```

3. **配置环境变量 | Configure Environment**
```bash
cp .env.example .env
# 编辑.env文件，配置必要的环境变量
```

4. **启动服务 | Start Service**
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 环境配置 | Environment Configuration

创建 `.env` 文件并配置以下变量：

```env
# 服务器配置
PORT=5000
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/culturebridge

# JWT配置
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d

# 区块链配置 (BSC Testnet)
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
BSC_CHAIN_ID=97
PRIVATE_KEY=your_private_key_here
CBT_CONTRACT_ADDRESS=0x...

# 翻译服务配置
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key
AZURE_TRANSLATOR_KEY=your_azure_translator_key
AZURE_TRANSLATOR_REGION=your_azure_region

# 安全配置
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## API文档 | API Documentation

### 认证相关 | Authentication APIs

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

### 区块链相关 | Blockchain APIs

#### 获取网络信息
```http
GET /api/blockchain/network
```

#### 查询代币余额
```http
GET /api/blockchain/balance/:address
```

#### 分发奖励
```http
POST /api/blockchain/reward/distribute
Authorization: Bearer <token>
Content-Type: application/json

{
  "userAddress": "0x...",
  "category": 1,
  "description": "翻译奖励",
  "amount": "1.0"
}
```

#### 代币转账
```http
POST /api/blockchain/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "toAddress": "0x...",
  "amount": "10.0"
}
```

### 翻译相关 | Translation APIs

#### 获取支持的语言
```http
GET /api/translation/languages
```

#### 文本翻译
```http
POST /api/translation/translate
Content-Type: application/json

{
  "text": "你好",
  "fromLang": "zh-CN",
  "toLang": "en"
}
```

#### 语音翻译
```http
POST /api/translation/voice
Content-Type: application/json

{
  "audioData": "data:audio/wav;base64,...",
  "fromLang": "zh-CN",
  "toLang": "en"
}
```

## 数据库设计 | Database Design

### 用户模型 | User Model
```javascript
{
  username: String,
  email: String,
  password: String,
  walletAddress: String,
  level: String,
  experience: Number,
  tokenStats: {
    totalEarned: Number,
    totalSpent: Number,
    currentBalance: Number
  },
  activityStats: {
    totalMessages: Number,
    totalTranslations: Number,
    totalVoiceMessages: Number
  },
  socialStats: {
    friendsCount: Number,
    followersCount: Number,
    followingCount: Number
  }
}
```

## 智能合约集成 | Smart Contract Integration

### CBT代币合约 | CBT Token Contract
- **网络**: BSC Testnet
- **合约地址**: 配置在环境变量中
- **功能**: 代币转账、余额查询、奖励分发

### 奖励类别 | Reward Categories
```javascript
const REWARD_CATEGORIES = {
  GENERAL: 0,           // 一般奖励
  LEARNING_REWARD: 1,   // 学习奖励
  CULTURAL_REWARD: 2,   // 文化奖励
  REFERRAL_REWARD: 3,   // 推荐奖励
  ACHIEVEMENT_REWARD: 4, // 成就奖励
  DAILY_REWARD: 5,      // 每日奖励
  SPECIAL_REWARD: 6     // 特殊奖励
};
```

## 实时通信 | Real-time Communication

### Socket.IO事件 | Socket.IO Events

#### 客户端发送 | Client Emit
- `join_room` - 加入房间
- `leave_room` - 离开房间
- `send_message` - 发送消息
- `send_voice_message` - 发送语音消息
- `translate_message` - 翻译消息

#### 服务端发送 | Server Emit
- `welcome` - 欢迎消息
- `new_message` - 新消息
- `new_voice_message` - 新语音消息
- `user_joined` - 用户加入
- `user_left` - 用户离开
- `translation_result` - 翻译结果
- `reward_earned` - 获得奖励

## 部署指南 | Deployment Guide

### Docker部署 | Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "src/enhancedApp.js"]
```

### PM2部署 | PM2 Deployment
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start src/enhancedApp.js --name "culturebridge-backend"

# 查看状态
pm2 status

# 查看日志
pm2 logs culturebridge-backend
```

### Nginx配置 | Nginx Configuration
```nginx
server {
    listen 80;
    server_name api.culturebridge.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 监控和日志 | Monitoring & Logging

### 日志配置 | Logging Configuration
- 使用Winston进行日志管理
- 分级日志记录(error, warn, info, debug)
- 日志文件轮转
- 错误追踪和报告

### 性能监控 | Performance Monitoring
- API响应时间监控
- 数据库查询性能
- 内存使用情况
- CPU使用率

## 安全最佳实践 | Security Best Practices

### 数据验证 | Data Validation
- 使用express-validator验证输入
- 防止SQL注入和XSS攻击
- 数据清理和转义

### 访问控制 | Access Control
- JWT令牌验证
- 角色权限管理
- API频率限制
- CORS配置

### 敏感信息保护 | Sensitive Data Protection
- 环境变量存储敏感配置
- 密码哈希存储
- 私钥安全管理

## 测试指南 | Testing Guide

### 单元测试 | Unit Testing
```bash
npm test
```

### API测试 | API Testing
```bash
npm run test:api
```

### 集成测试 | Integration Testing
```bash
npm run test:integration
```

## 贡献指南 | Contributing

### 开发流程 | Development Workflow
1. Fork项目仓库
2. 创建功能分支
3. 编写代码和测试
4. 提交Pull Request

### 代码规范 | Code Standards
- 使用ESLint进行代码检查
- 遵循Airbnb JavaScript规范
- 添加详细的注释和文档
- 编写单元测试

## 故障排除 | Troubleshooting

### 常见问题 | Common Issues

#### 数据库连接失败
```bash
# 检查MongoDB服务状态
sudo systemctl status mongod

# 重启MongoDB服务
sudo systemctl restart mongod
```

#### 区块链连接问题
- 检查BSC网络连接
- 验证私钥配置
- 确认合约地址正确

#### Socket.IO连接问题
- 检查CORS配置
- 验证客户端连接参数
- 查看服务器日志

## 许可证 | License

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 联系我们 | Contact Us

- **项目主页**: https://github.com/yb1734492970508/CultureBridge-Backend
- **问题反馈**: https://github.com/yb1734492970508/CultureBridge-Backend/issues
- **邮箱**: developer@culturebridge.com

## 更新日志 | Changelog

### v2.1.0 (2025-06-16)
- ✨ 新增BNB链区块链集成服务
- ✨ 实现CBT代币奖励分发系统
- ✨ 添加增强版翻译服务
- ✨ 集成Socket.IO实时通信
- ✨ 优化API性能和安全性
- 🐛 修复已知问题和漏洞

### v2.0.0 (2024-12-01)
- 🎉 项目重构，采用Express.js
- ✨ 新增JWT身份验证
- ✨ 实现RESTful API设计
- ✨ 添加MongoDB数据存储

---

**为文化交流提供强大的技术支撑！**

**Providing powerful technical support for cultural exchange!**

