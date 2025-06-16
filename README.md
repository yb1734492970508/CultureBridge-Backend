# CultureBridge Backend - 文化桥梁后端服务 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Express Version](https://img.shields.io/badge/express-%5E4.18.0-blue)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/database-MongoDB-green)](https://www.mongodb.com/)

> CultureBridge平台的后端API服务，提供用户认证、CBT代币管理、实时聊天、语音翻译等核心功能。

## 🌟 核心功能

### 🔐 用户认证系统
- JWT身份验证
- 用户注册和登录
- 权限管理
- 会话管理

### 💰 CBT代币系统
- 智能奖励机制
- 等级系统管理
- 代币转账功能
- 交易记录追踪

### 🌐 区块链集成
- BNB链智能合约
- Web3服务集成
- 钱包连接支持
- 链上交易验证

### 💬 实时通信
- Socket.IO实时聊天
- 多房间支持
- 消息翻译
- 在线状态管理

### 🎤 语音翻译
- 多语言语音识别
- 实时翻译服务
- 语音合成
- 翻译质量评估

## 🚀 快速开始

### 环境要求
```
Node.js >= 16.0.0
npm >= 8.0.0
MongoDB >= 4.4
```

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/yb1734492970508/CultureBridge-Backend.git
cd CultureBridge-Backend
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
cp .env.example .env
# 编辑 .env 文件配置必要参数
```

4. **启动服务**
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将运行在 `http://localhost:5000`

## ⚙️ 环境配置

### 必需配置
```env
# 数据库配置
MONGO_URI=mongodb://localhost:27017/culturebridge

# JWT配置
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=30d

# 服务端口
PORT=5000
```

### 可选配置
```env
# 区块链配置
BLOCKCHAIN_ENABLED=true
BSC_RPC_URL=https://bsc-dataseed1.binance.org:443
PRIVATE_KEY=your_private_key
CBT_TOKEN_ADDRESS=your_contract_address

# Google Cloud配置（语音翻译）
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Redis配置（可选）
REDIS_URL=redis://localhost:6379
```

## 📁 项目结构

```
src/
├── controllers/           # 控制器层
│   ├── authController.js
│   ├── chatController.js
│   ├── voiceController.js
│   └── tokenController.js
├── models/               # 数据模型
│   ├── User.js
│   ├── ChatMessage.js
│   ├── TokenTransaction.js
│   └── VoiceTranslation.js
├── routes/               # 路由定义
│   ├── auth.js
│   ├── chat.js
│   ├── voice.js
│   ├── tokens.js
│   └── blockchain.js
├── services/             # 业务服务
│   ├── cbtRewardService.js
│   ├── blockchainService.js
│   ├── voiceTranslationService.js
│   └── socketService.js
├── middleware/           # 中间件
│   ├── auth.js
│   ├── error.js
│   ├── security.js
│   └── advancedResults.js
├── config/               # 配置文件
│   └── db.js
└── app.js               # 主应用文件
```

## 📊 API文档

### 认证接口

#### 用户注册
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

#### 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

#### 获取用户信息
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

### 代币接口

#### 获取余额
```http
GET /api/v1/tokens/balance
Authorization: Bearer <token>
```

#### 获取奖励统计
```http
GET /api/v1/tokens/rewards/stats
Authorization: Bearer <token>
```

#### 代币转账
```http
POST /api/v1/tokens/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "toUserId": "user_id",
  "amount": 10.5,
  "message": "转账备注"
}
```

#### 交易历史
```http
GET /api/v1/tokens/transactions?page=1&limit=20
Authorization: Bearer <token>
```

### 聊天接口

#### 获取聊天室列表
```http
GET /api/v1/chat/rooms
Authorization: Bearer <token>
```

#### 发送消息
```http
POST /api/v1/chat/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "roomId": "room_id",
  "content": "Hello world!",
  "type": "text"
}
```

### 语音翻译接口

#### 语音翻译
```http
POST /api/v1/voice/translate
Authorization: Bearer <token>
Content-Type: multipart/form-data

audio: <audio_file>
sourceLanguage: zh
targetLanguages: ["en", "es"]
```

#### 支持的语言
```http
GET /api/v1/voice/languages
```

## 🎯 CBT代币奖励系统

### 奖励类型和金额

| 活动类型 | 基础奖励 | 每日限制 | 描述 |
|---------|---------|---------|------|
| DAILY_LOGIN | 1.0 CBT | 1次 | 每日登录奖励 |
| CHAT_MESSAGE | 0.1 CBT | 50次 | 发送聊天消息 |
| VOICE_MESSAGE | 0.5 CBT | 20次 | 发送语音消息 |
| VOICE_TRANSLATION | 0.5 CBT | 30次 | 语音翻译使用 |
| TEXT_TRANSLATION | 0.3 CBT | 30次 | 文本翻译使用 |
| CULTURAL_SHARE | 3.0 CBT | 无限制 | 文化内容分享 |
| CULTURAL_INSIGHT | 5.0 CBT | 无限制 | 深度文化见解 |
| LANGUAGE_MILESTONE | 20.0 CBT | 无限制 | 语言学习里程碑 |

### 等级系统

| 等级 | 所需总收益 | 奖励倍数 | 特权 |
|-----|-----------|---------|------|
| BRONZE | 0 CBT | 1.0x | 基础功能 |
| SILVER | 100 CBT | 1.2x | 20%奖励加成 |
| GOLD | 500 CBT | 1.5x | 50%奖励加成 + 专属徽章 |
| PLATINUM | 2000 CBT | 2.0x | 100%奖励加成 + 优先客服 |
| DIAMOND | 10000 CBT | 3.0x | 200%奖励加成 + 专属活动 |

### 奖励倍数系统

#### 连续活跃奖励
- 7天连续: 1.1x
- 30天连续: 1.3x
- 90天连续: 1.5x
- 365天连续: 2.0x

#### 特殊时期奖励
- 周末奖励: 1.2x
- 节假日奖励: 1.5x
- 活动期间: 2.0x

## 🔧 服务配置

### 数据库模型

#### 用户模型 (User)
```javascript
{
  username: String,
  email: String,
  password: String,
  walletAddress: String,
  level: String,
  tokenBalance: {
    cbt: Number,
    lastUpdated: Date
  },
  stats: {
    totalEarned: Number,
    totalTransactions: Number,
    lastActivityDate: Date,
    lastRewardDate: Date
  },
  consecutiveActiveDays: Number
}
```

#### 代币交易模型 (TokenTransaction)
```javascript
{
  user: ObjectId,
  type: String, // REWARD, TRANSFER, PURCHASE, WITHDRAWAL
  amount: Number,
  activityType: String,
  description: String,
  status: String,
  blockchain: {
    txHash: String,
    blockNumber: Number,
    status: String
  },
  fromUser: ObjectId,
  toUser: ObjectId
}
```

### 区块链集成

#### 智能合约接口
```javascript
// CBT代币合约方法
contract.methods.mint(address, amount)
contract.methods.transfer(to, amount)
contract.methods.balanceOf(address)
contract.methods.totalSupply()
```

#### 事件监听
```javascript
// 监听代币转账事件
contract.events.Transfer({
  fromBlock: 'latest'
}, (error, event) => {
  // 处理转账事件
});
```

## 🛡️ 安全特性

### 认证和授权
- JWT令牌认证
- 角色权限控制
- 会话管理
- 密码加密存储

### API安全
- 请求速率限制
- 输入数据验证
- SQL注入防护
- XSS攻击防护

### 数据安全
- 敏感数据加密
- 安全头设置
- CORS配置
- 日志记录

## 📈 性能优化

### 数据库优化
- 索引优化
- 查询优化
- 连接池管理
- 缓存策略

### API优化
- 响应压缩
- 分页查询
- 异步处理
- 错误处理

## 🔍 监控和日志

### 日志系统
- 请求日志
- 错误日志
- 性能日志
- 安全日志

### 健康检查
```http
GET /health
```

响应示例：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "onlineUsers": 150,
  "environment": "production"
}
```

## 🧪 测试

### 运行测试
```bash
# 单元测试
npm test

# 集成测试
npm run test:integration

# 覆盖率测试
npm run test:coverage
```

### 测试环境
```bash
# 设置测试环境
NODE_ENV=test npm test
```

## 🚀 部署

### Docker部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### 环境部署
```bash
# 构建生产版本
npm run build

# 启动生产服务
npm run start:prod
```

## 📋 开发指南

### 代码规范
- ESLint代码检查
- Prettier代码格式化
- Git提交规范
- 代码审查流程

### 开发流程
1. 创建功能分支
2. 编写代码和测试
3. 提交代码审查
4. 合并到主分支
5. 部署到测试环境

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系我们

- **项目主页**: https://github.com/yb1734492970508/CultureBridge-Backend
- **问题反馈**: https://github.com/yb1734492970508/CultureBridge-Backend/issues
- **邮箱**: developer@culturebridge.com

---

**构建连接世界的文化桥梁！** 🌍✨

