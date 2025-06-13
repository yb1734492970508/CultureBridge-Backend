# CultureBridge Backend 2.0

🌍 **跨文化交流平台的增强版后端** - 集成区块链技术和AI语音翻译

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.0%2B-green.svg)](https://www.mongodb.com/)
[![BNB Chain](https://img.shields.io/badge/BNB%20Chain-Testnet%2FMainnet-yellow.svg)](https://www.bnbchain.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 🚀 项目概述

CultureBridge 2.0 是一个革命性的跨文化交流平台后端，集成了最新的区块链技术和AI语音翻译功能。通过CBT代币激励机制，促进全球用户进行真实的文化交流和语言学习。

### ✨ 核心特性

- 🔐 **增强版用户认证** - 支持传统登录和Web3钱包登录
- 🪙 **CBT代币经济** - 基于BNB链的奖励代币系统
- 🎤 **AI语音翻译** - 多语言实时语音识别和翻译
- 💬 **实时聊天系统** - 支持文字和语音消息的即时通讯
- 🌍 **文化交流社区** - 促进跨文化理解和学习
- 📚 **语言学习平台** - 个性化的语言学习体验
- ⛓️ **区块链集成** - 完整的Web3功能支持
- 🎁 **智能奖励分发** - 自动化的代币奖励机制

## 🏗️ 技术架构

### 后端技术栈
- **运行时**: Node.js 16+
- **框架**: Express.js
- **数据库**: MongoDB + Redis
- **区块链**: BNB Chain (BSC)
- **智能合约**: Solidity + Hardhat
- **AI服务**: Google Cloud Speech & Translate
- **实时通信**: Socket.IO
- **测试**: Jest + Supertest

### 区块链技术
- **网络**: BNB Smart Chain (BSC)
- **代币标准**: ERC-20 (CBT Token)
- **开发框架**: Hardhat
- **钱包集成**: MetaMask, WalletConnect
- **智能合约**: 代币管理、身份验证、文化市场

## 📦 安装和设置

### 环境要求
- Node.js 16.0.0+
- MongoDB 5.0+
- Redis 6.0+
- Git

### 快速开始

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
# 编辑 .env 文件，配置必要的环境变量
```

4. **编译智能合约**
```bash
npm run compile
```

5. **启动开发服务器**
```bash
npm run dev
```

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```env
# 基础配置
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# 数据库配置
MONGO_URI=mongodb://localhost:27017/culturebridge
REDIS_URL=redis://localhost:6379

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

# 区块链配置
BSC_NETWORK=testnet
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSC_CHAIN_ID=97

# 智能合约地址
CBT_TOKEN_ADDRESS=your_cbt_token_address
IDENTITY_CONTRACT_ADDRESS=your_identity_contract_address
MARKETPLACE_CONTRACT_ADDRESS=your_marketplace_contract_address

# 管理员配置
ADMIN_PRIVATE_KEY=your_admin_private_key
DEPLOYER_PRIVATE_KEY=your_deployer_private_key

# Google Cloud配置
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json

# 加密配置
ENCRYPTION_KEY=your_32_character_encryption_key
```

## 🔧 开发指南

### 项目结构
```
CultureBridge-Backend/
├── src/                          # 源代码
│   ├── controllers/              # 控制器
│   │   ├── enhancedAuth.js       # 增强版认证控制器
│   │   └── ...
│   ├── models/                   # 数据模型
│   ├── routes/                   # 路由定义
│   │   ├── enhancedAuth.js       # 增强版认证路由
│   │   ├── enhancedBlockchain.js # 增强版区块链路由
│   │   ├── enhancedVoice.js      # 增强版语音路由
│   │   └── ...
│   ├── services/                 # 业务服务
│   │   ├── enhancedBlockchainService.js
│   │   ├── enhancedVoiceTranslationService.js
│   │   ├── enhancedSocketService.js
│   │   └── contractDeploymentService.js
│   ├── middleware/               # 中间件
│   ├── utils/                    # 工具函数
│   ├── config/                   # 配置文件
│   ├── app.js                    # 原版应用入口
│   └── enhancedApp.js           # 增强版应用入口
├── blockchain/                   # 区块链相关
│   ├── contracts/               # 智能合约
│   │   └── CultureBridgeToken.sol
│   ├── scripts/                 # 部署脚本
│   │   └── deploy.js
│   └── tests/                   # 合约测试
├── tests/                       # 测试文件
│   ├── api/                     # API测试
│   ├── setup.js                 # 测试设置
│   └── env.js                   # 测试环境
├── docs/                        # 文档
├── uploads/                     # 文件上传目录
├── temp/                        # 临时文件目录
├── package.json
├── hardhat.config.js           # Hardhat配置
├── jest.config.js              # Jest测试配置
└── README.md
```

### API 文档

#### 增强版API (v2)
- **认证**: `/api/v2/auth/*`
- **区块链**: `/api/v2/blockchain/*`
- **语音翻译**: `/api/v2/voice/*`
- **聊天**: `/api/v2/chat/*`

#### 标准API (v1)
- **用户管理**: `/api/v1/auth/*`
- **内容管理**: `/api/v1/posts/*`
- **社区功能**: `/api/v1/communities/*`
- **语言学习**: `/api/v1/language-learning/*`

### 可用脚本

```bash
# 开发
npm run dev                    # 启动开发服务器（增强版）
npm run dev:legacy            # 启动开发服务器（原版）

# 测试
npm test                      # 运行测试
npm run test:watch           # 监视模式运行测试
npm run test:coverage        # 生成覆盖率报告

# 区块链
npm run compile              # 编译智能合约
npm run deploy:testnet       # 部署到BSC测试网
npm run deploy:mainnet       # 部署到BSC主网
npm run blockchain:test      # 运行合约测试

# 工具
npm run lint                 # 代码检查
npm run lint:fix            # 自动修复代码问题
npm run docs                 # 生成API文档
npm run clean               # 清理编译文件

# 监控
npm run health              # 健康检查
npm run status              # 服务状态
```

## 🔗 区块链集成

### CBT代币
- **名称**: CultureBridge Token
- **符号**: CBT
- **标准**: ERC-20
- **网络**: BNB Smart Chain
- **用途**: 奖励文化交流和语言学习

### 智能合约功能
- ✅ 代币铸造和销毁
- ✅ 奖励分发机制
- ✅ 用户身份验证
- ✅ 文化交流市场
- ✅ 治理功能

### 奖励机制
- 🎁 **注册奖励**: 10 CBT
- 🎁 **每日登录**: 1 CBT
- 🎁 **发布内容**: 2-5 CBT
- 🎁 **语音翻译**: 2 CBT
- 🎁 **参与聊天**: 0.5 CBT

## 🎤 AI语音翻译

### 支持的语言
- 🇨🇳 中文（简体/繁体）
- 🇺🇸 英语（美国/英国）
- 🇯🇵 日语
- 🇰🇷 韩语
- 🇫🇷 法语
- 🇩🇪 德语
- 🇪🇸 西班牙语
- 🇮🇹 意大利语
- 🇷🇺 俄语
- 🇦🇪 阿拉伯语

### 功能特性
- 🎯 实时语音识别
- 🔄 多语言文本翻译
- 🔊 自然语音合成
- 📊 翻译质量评分
- 💾 翻译历史记录

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- tests/api/enhancedAuth.test.js

# 生成覆盖率报告
npm run test:coverage

# 监视模式
npm run test:watch
```

### 测试覆盖率目标
- 📊 **分支覆盖率**: 70%+
- 📊 **函数覆盖率**: 70%+
- 📊 **行覆盖率**: 70%+
- 📊 **语句覆盖率**: 70%+

## 🚀 部署

### 生产环境部署

1. **环境准备**
```bash
# 设置生产环境变量
export NODE_ENV=production
export PORT=5000
```

2. **构建和启动**
```bash
npm install --production
npm run compile
npm start
```

3. **使用PM2部署**
```bash
npm install -g pm2
pm2 start src/enhancedApp.js --name "culturebridge-backend"
pm2 startup
pm2 save
```

### Docker部署
```bash
# 构建镜像
docker build -t culturebridge-backend .

# 运行容器
docker run -d -p 5000:5000 --name culturebridge-backend culturebridge-backend
```

## 📊 监控和日志

### 健康检查
- **端点**: `GET /health`
- **服务状态**: `GET /api/status`
- **认证健康**: `GET /api/v2/auth/health`
- **区块链健康**: `GET /api/v2/blockchain/health`
- **语音服务健康**: `GET /api/v2/voice/health`

### 性能监控
- 📈 响应时间监控
- 💾 内存使用监控
- 🔄 请求计数统计
- ⚡ 数据库性能监控

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 ESLint 进行代码检查
- 遵循 JavaScript Standard Style
- 编写单元测试
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持和帮助

### 常见问题

**Q: 如何配置Google Cloud语音服务？**
A: 请参考 [Google Cloud文档](https://cloud.google.com/speech-to-text/docs) 创建服务账户并下载密钥文件。

**Q: 如何部署智能合约到主网？**
A: 确保配置了正确的私钥和RPC URL，然后运行 `npm run deploy:mainnet`。

**Q: 如何获取CBT代币？**
A: 通过平台活动获得奖励，或在去中心化交易所购买。

### 联系我们
- 📧 邮箱: support@culturebridge.io
- 💬 Discord: [CultureBridge Community](https://discord.gg/culturebridge)
- 🐦 Twitter: [@CultureBridgeIO](https://twitter.com/CultureBridgeIO)

## 🎯 路线图

### 已完成 ✅
- [x] 基础后端架构
- [x] 用户认证系统
- [x] 区块链集成
- [x] AI语音翻译
- [x] 实时聊天功能
- [x] 代币奖励机制

### 进行中 🚧
- [ ] 移动端API优化
- [ ] 高级分析功能
- [ ] 多链支持

### 计划中 📋
- [ ] NFT文化收藏品
- [ ] DAO治理机制
- [ ] 跨链桥接
- [ ] AI内容推荐

---

<div align="center">

**🌍 连接世界，分享文化 🌍**

Made with ❤️ by the CultureBridge Team

</div>

