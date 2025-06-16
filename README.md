# CultureBridge Backend

## 项目简介 | Project Overview

CultureBridge后端是一个基于Node.js和Express的RESTful API服务器，为CultureBridge文化交流平台提供完整的后端支持，包括区块链集成、实时聊天、语音翻译和用户管理等功能。

CultureBridge Backend is a Node.js and Express-based RESTful API server that provides comprehensive backend support for the CultureBridge cultural exchange platform, including blockchain integration, real-time chat, voice translation, and user management.

## 主要功能 | Key Features

### 🔗 区块链集成 | Blockchain Integration
- BNB Smart Chain集成
- CBT代币智能合约
- Web3钱包验证
- 区块链交易处理

### 💬 实时聊天系统 | Real-time Chat System
- WebSocket实时通信
- 多语言聊天室
- 消息历史记录
- 在线用户管理

### 🎤 语音翻译服务 | Voice Translation Service
- 语音识别转文字
- 多语言文本翻译
- 文字转语音合成
- 语言自动检测

### 🎁 奖励系统 | Reward System
- CBT代币奖励分发
- 用户行为追踪
- 每日签到奖励
- 成就系统

### 👤 用户管理 | User Management
- 钱包身份验证
- JWT令牌管理
- 用户等级系统
- 统计数据分析

## 技术栈 | Technology Stack

### 核心框架 | Core Framework
- **Node.js** - 运行时环境
- **Express.js** - Web框架
- **WebSocket (ws)** - 实时通信
- **JWT** - 身份验证

### 区块链 | Blockchain
- **Web3.js** - 区块链交互
- **Ethers.js** - 以太坊库
- **Solidity** - 智能合约
- **BNB Smart Chain** - 区块链网络

### 数据存储 | Data Storage
- **Redis** - 缓存和会话存储
- **内存存储** - 开发环境数据存储
- **文件系统** - 日志和临时文件

### 安全性 | Security
- **Helmet** - 安全头设置
- **CORS** - 跨域资源共享
- **Rate Limiting** - 速率限制
- **Input Validation** - 输入验证

## 快速开始 | Quick Start

### 环境要求 | Prerequisites
- Node.js 16+
- npm 或 yarn
- Redis (可选)

### 安装步骤 | Installation

1. 克隆仓库 | Clone the repository
```bash
git clone https://github.com/yb1734492970508/CultureBridge-Backend.git
cd CultureBridge-Backend
```

2. 安装依赖 | Install dependencies
```bash
npm install
```

3. 配置环境变量 | Configure environment variables
```bash
cp .env.example .env
# 编辑 .env 文件配置必要的环境变量
```

4. 启动开发服务器 | Start development server
```bash
npm run dev
```

5. 启动生产服务器 | Start production server
```bash
npm start
```

## 项目结构 | Project Structure

```
src/
├── services/                   # 业务服务层
│   ├── userService.js         # 用户管理服务
│   ├── rewardService.js       # 奖励系统服务
│   ├── chatService.js         # 聊天服务
│   ├── translationService.js  # 翻译服务
│   └── enhancedBlockchainService.js # 区块链服务
├── middleware/                 # 中间件
│   ├── auth.js                # 身份验证中间件
│   ├── validation.js          # 输入验证中间件
│   └── rateLimit.js           # 速率限制中间件
├── routes/                     # 路由定义
│   ├── auth.js                # 认证路由
│   ├── users.js               # 用户路由
│   ├── chat.js                # 聊天路由
│   ├── translation.js         # 翻译路由
│   ├── blockchain.js          # 区块链路由
│   └── rewards.js             # 奖励路由
├── enhancedServer.js          # 增强版服务器
├── enhancedApp.js             # 增强版应用
└── app.js                     # 原始应用入口
blockchain/
├── contracts/                  # 智能合约
│   ├── CultureBridgeToken.sol # CBT代币合约
│   ├── CultureBridgeExchange.sol # 交易所合约
│   ├── CultureBridgeMarketplace.sol # 市场合约
│   └── CultureBridgeIdentity.sol # 身份合约
├── scripts/                   # 部署脚本
└── tests/                     # 合约测试
```

## API文档 | API Documentation

### 认证端点 | Authentication Endpoints

#### POST /api/auth/wallet-login
钱包登录认证
```json
{
  "walletAddress": "0x...",
  "signature": "0x...",
  "message": "Login message"
}
```

#### POST /api/auth/refresh
刷新JWT令牌
```json
{
  "refreshToken": "..."
}
```

### 用户端点 | User Endpoints

#### GET /api/users/profile
获取用户资料
```bash
Authorization: Bearer <token>
```

#### GET /api/users/stats
获取用户统计
```bash
Authorization: Bearer <token>
```

#### GET /api/users/leaderboard
获取排行榜
```bash
Authorization: Bearer <token>
```

### 聊天端点 | Chat Endpoints

#### GET /api/chat/rooms
获取聊天室列表
```bash
Authorization: Bearer <token>
```

#### GET /api/chat/rooms/:roomId/messages
获取聊天历史
```bash
Authorization: Bearer <token>
```

#### POST /api/chat/rooms/:roomId/join
加入聊天室
```bash
Authorization: Bearer <token>
```

### 翻译端点 | Translation Endpoints

#### GET /api/translation/languages
获取支持的语言列表

#### POST /api/translation/text
文本翻译
```json
{
  "text": "Hello world",
  "from": "en",
  "to": "zh"
}
```

#### POST /api/translation/voice
语音翻译
```json
{
  "audioData": "base64...",
  "from": "en",
  "to": "zh"
}
```

### 区块链端点 | Blockchain Endpoints

#### GET /api/blockchain/balance/:address
获取CBT余额
```bash
Authorization: Bearer <token>
```

#### POST /api/blockchain/reward
分发奖励
```json
{
  "recipient": "0x...",
  "amount": 1.0,
  "reason": "Chat message"
}
```

#### GET /api/blockchain/transactions/:address
获取交易历史
```bash
Authorization: Bearer <token>
```

### 奖励端点 | Reward Endpoints

#### GET /api/rewards/history
获取奖励历史
```bash
Authorization: Bearer <token>
```

#### POST /api/rewards/daily-claim
领取每日奖励
```bash
Authorization: Bearer <token>
```

#### GET /api/rewards/stats
获取奖励统计
```bash
Authorization: Bearer <token>
```

## 环境配置 | Environment Configuration

### 环境变量 | Environment Variables

```env
# 服务器配置
PORT=5000
NODE_ENV=development

# 数据库配置
REDIS_URL=redis://localhost:6379

# JWT配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# 区块链配置
BLOCKCHAIN_NETWORK=bsc-testnet
PRIVATE_KEY=your-private-key
CBT_CONTRACT_ADDRESS=0x...

# 翻译服务配置
TRANSLATION_API_KEY=your-api-key

# 安全配置
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

## 智能合约 | Smart Contracts

### CBT代币合约 | CBT Token Contract
- **名称**: CultureBridge Token
- **符号**: CBT
- **小数位**: 18
- **总供应量**: 1,000,000,000 CBT
- **功能**: ERC20标准 + 奖励分发

### 主要合约功能 | Main Contract Features
- 代币铸造和销毁
- 奖励自动分发
- 治理投票功能
- 质押奖励机制

## WebSocket事件 | WebSocket Events

### 客户端发送事件 | Client Events
- `join_room` - 加入聊天室
- `leave_room` - 离开聊天室
- `send_message` - 发送消息
- `voice_message` - 发送语音消息
- `typing_start` - 开始输入
- `typing_stop` - 停止输入

### 服务器发送事件 | Server Events
- `room_joined` - 成功加入房间
- `new_message` - 新消息
- `new_voice_message` - 新语音消息
- `user_joined` - 用户加入
- `user_left` - 用户离开
- `typing_start` - 用户开始输入
- `typing_stop` - 用户停止输入

## 安全特性 | Security Features

### 身份验证 | Authentication
- JWT令牌验证
- 钱包签名验证
- 刷新令牌机制
- 会话管理

### 输入验证 | Input Validation
- 请求参数验证
- 数据类型检查
- 长度限制
- 特殊字符过滤

### 速率限制 | Rate Limiting
- API调用频率限制
- IP地址限制
- 用户级别限制
- 动态调整机制

## 性能优化 | Performance Optimization

### 缓存策略 | Caching Strategy
- Redis缓存
- 内存缓存
- API响应缓存
- 数据库查询缓存

### 负载均衡 | Load Balancing
- 集群模式支持
- 进程管理
- 健康检查
- 故障转移

## 监控和日志 | Monitoring and Logging

### 日志记录 | Logging
- 请求日志
- 错误日志
- 性能日志
- 安全日志

### 健康检查 | Health Check
- 服务状态监控
- 数据库连接检查
- 外部服务检查
- 性能指标收集

## 部署指南 | Deployment Guide

### Docker部署 | Docker Deployment
```bash
# 构建镜像
docker build -t culturebridge-backend .

# 运行容器
docker run -p 5000:5000 culturebridge-backend
```

### PM2部署 | PM2 Deployment
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 监控应用
pm2 monit
```

## 开发指南 | Development Guide

### 代码规范 | Code Standards
- 使用ES6+语法
- 遵循RESTful API设计
- 实现错误处理
- 编写单元测试

### 测试 | Testing
```bash
# 运行测试
npm test

# 运行覆盖率测试
npm run test:coverage

# 运行集成测试
npm run test:integration
```

## 贡献指南 | Contributing

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证 | License

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 联系我们 | Contact

- 项目链接: [https://github.com/yb1734492970508/CultureBridge-Backend](https://github.com/yb1734492970508/CultureBridge-Backend)
- 前端仓库: [https://github.com/yb1734492970508/CultureBridge-Frontend1](https://github.com/yb1734492970508/CultureBridge-Frontend1)

## 更新日志 | Changelog

### v2.1.0 (2025-06-16)
- ✨ 新增增强版服务器架构
- ✨ 新增完整的用户管理系统
- ✨ 新增奖励系统和CBT代币集成
- ✨ 新增实时聊天WebSocket支持
- ✨ 新增语音翻译服务
- 🔧 优化API性能和响应速度
- 🔒 增强安全性和输入验证
- 📝 完善API文档和错误处理

### v2.0.0 (2025-06-15)
- 🎉 项目重构，采用微服务架构
- ✨ 集成BNB链区块链技术
- ✨ 实现智能合约交互
- ✨ 添加JWT身份验证
- 📊 实现用户统计和分析

---

**构建连接世界的技术基础设施！**

**Building the technical infrastructure that connects the world!**

