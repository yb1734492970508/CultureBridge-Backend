# CultureBridge 后端项目 / CultureBridge Backend Project

**开发者 / Developer**: Bin Yi  
**项目识别码 / Project ID**: CB-BACKEND-001  
**版本 / Version**: 2.1.0  

CultureBridge是一个基于区块链的跨文化交流平台，旨在通过智能语音翻译和代币奖励机制，连接不同文化背景的人们，促进全球文化理解与语言学习。本仓库包含CultureBridge项目的后端代码。

CultureBridge is a blockchain-based cross-cultural communication platform that aims to connect people from different cultural backgrounds through intelligent voice translation and token reward mechanisms, promoting global cultural understanding and language learning. This repository contains the backend code for the CultureBridge project.

## 🚀 核心特性 / Core Features

### 🔗 区块链集成 / Blockchain Integration
- **BNB Smart Chain** 区块链技术集成
- **CBT (CultureBridge Token)** 代币系统
- 智能合约交互和事件监听 / Smart contract interaction and event listening
- 代币奖励和转账功能 / Token rewards and transfer functionality

### 💬 实时聊天系统 / Real-time Chat System
- 文化交流质量评分系统 / Cultural exchange quality scoring system
- 自动CBT代币奖励机制 / Automatic CBT token reward mechanism
- 多语言聊天室支持 / Multi-language chat room support
- 实时用户指标收集 / Real-time user metrics collection

### 🎤 智能语音翻译 / Intelligent Voice Translation
- 支持10种主要语言的实时翻译 / Real-time translation for 10 major languages
- Google Cloud Speech-to-Text集成 / Google Cloud Speech-to-Text integration
- 文化内容检测和分析 / Cultural content detection and analysis
- 语音合成和情感表达 / Speech synthesis and emotional expression

### 🔒 高级安全系统 / Advanced Security System
- OWASP最佳实践实施 / OWASP best practices implementation
- 输入验证与清理 / Input validation and sanitization
- 暴力破解防护 / Brute force protection
- 加密服务和数字签名 / Encryption services and digital signatures

### 🌍 国际化支持 / Internationalization Support
- 完整的中英双语支持 / Complete Chinese-English bilingual support
- 动态语言切换 / Dynamic language switching
- 文化背景感知翻译 / Culturally-aware translation
- 本地化用户体验 / Localized user experience

## 🛠 技术栈 / Technology Stack

### 后端框架 / Backend Framework
- **Node.js** - JavaScript运行环境 / JavaScript runtime environment
- **Express.js** - Web应用框架 / Web application framework
- **Socket.io** - 实时通信 / Real-time communication
- **Cluster** - 多进程支持 / Multi-process support

### 数据存储 / Data Storage
- **MongoDB** - NoSQL数据库 / NoSQL database
- **Mongoose** - MongoDB对象模型工具 / MongoDB object modeling tool
- **Redis** - 缓存和会话存储 / Cache and session storage

### 区块链技术 / Blockchain Technology
- **Web3.js** - 以太坊JavaScript API / Ethereum JavaScript API
- **Ethers.js** - 以太坊库 / Ethereum library
- **BNB Smart Chain** - 区块链网络 / Blockchain network
- **Smart Contracts** - 智能合约 / Smart contracts

### 语音处理 / Voice Processing
- **Google Cloud Speech-to-Text** - 语音识别 / Speech recognition
- **Google Cloud Text-to-Speech** - 语音合成 / Speech synthesis
- **Google Cloud Translate** - 文本翻译 / Text translation

### 安全与认证 / Security & Authentication
- **JWT** - 用户认证 / User authentication
- **Bcrypt** - 密码加密 / Password encryption
- **Helmet** - 安全头设置 / Security headers
- **Rate Limiting** - 速率限制 / Rate limiting
- **CSRF Protection** - CSRF保护 / CSRF protection

## 📁 项目结构 / Project Structure

```
CultureBridge-Backend/
├── src/                          # 源代码 / Source code
│   ├── config/                   # 配置文件 / Configuration files
│   │   ├── database.js           # 数据库配置 / Database configuration
│   │   ├── optimizedDb.js        # 优化的数据库连接 / Optimized database connection
│   │   └── redis.js              # Redis配置 / Redis configuration
│   ├── controllers/              # 控制器 / Controllers
│   ├── middleware/               # 中间件 / Middleware
│   │   ├── advancedSecurity.js   # 高级安全中间件 / Advanced security middleware
│   │   ├── performanceMonitor.js # 性能监控 / Performance monitoring
│   │   ├── memoryMonitor.js      # 内存监控 / Memory monitoring
│   │   └── healthCheck.js        # 健康检查 / Health check
│   ├── models/                   # 数据模型 / Data models
│   ├── routes/                   # 路由 / Routes
│   │   ├── enhancedBlockchain.js # 增强区块链路由 / Enhanced blockchain routes
│   │   ├── enhancedChat.js       # 增强聊天路由 / Enhanced chat routes
│   │   └── enhancedVoice.js      # 增强语音路由 / Enhanced voice routes
│   ├── services/                 # 服务 / Services
│   │   ├── enhancedBlockchainService.js  # 增强区块链服务 / Enhanced blockchain service
│   │   ├── enhancedSocketService.js      # 增强Socket服务 / Enhanced socket service
│   │   ├── enhancedVoiceTranslationService.js # 增强语音翻译服务 / Enhanced voice translation service
│   │   ├── encryptionService.js          # 加密服务 / Encryption service
│   │   └── i18nService.js               # 国际化服务 / Internationalization service
│   ├── locales/                  # 本地化文件 / Localization files
│   │   ├── zh.json              # 中文翻译 / Chinese translations
│   │   └── en.json              # 英文翻译 / English translations
│   ├── utils/                    # 工具函数 / Utility functions
│   ├── app.js                    # 原始应用入口 / Original application entry
│   ├── enhancedApp.js           # 增强应用入口 / Enhanced application entry
│   └── optimizedApp.js          # 优化应用入口 / Optimized application entry
├── blockchain/                   # 区块链相关 / Blockchain related
│   ├── contracts/               # 智能合约 / Smart contracts
│   │   └── CultureBridgeToken.sol # CBT代币合约 / CBT token contract
│   └── migrations/              # 合约迁移 / Contract migrations
├── docs/                        # 文档 / Documentation
│   ├── blockchain-design.md     # 区块链设计文档 / Blockchain design document
│   ├── performance-optimization.md # 性能优化方案 / Performance optimization plan
│   └── security-enhancement.md  # 安全增强方案 / Security enhancement plan
├── uploads/                     # 上传文件存储 / Upload file storage
├── .env.example                 # 环境变量示例 / Environment variables example
├── .gitignore                   # Git忽略文件 / Git ignore file
├── package.json                 # 项目依赖 / Project dependencies
├── CHANGELOG_V2.md             # 版本更新日志 / Version changelog
└── README.md                   # 项目说明 / Project documentation
```

## 🌟 核心功能模块 / Core Functional Modules

### 1. 用户认证与管理 / User Authentication & Management
- 用户注册、登录、登出 / User registration, login, logout
- 双因素认证 (2FA) / Two-factor authentication (2FA)
- 个人资料管理 / Profile management
- 权限控制系统 / Permission control system
- 社交媒体登录集成 / Social media login integration

### 2. 区块链钱包集成 / Blockchain Wallet Integration
- 钱包连接与管理 / Wallet connection and management
- CBT代币转账与接收 / CBT token transfer and receiving
- 交易历史记录 / Transaction history
- 智能合约交互 / Smart contract interaction
- 代币奖励分发 / Token reward distribution

### 3. 实时聊天与文化交流 / Real-time Chat & Cultural Exchange
- 多语言聊天室 / Multi-language chat rooms
- 实时消息翻译 / Real-time message translation
- 文化背景注释 / Cultural context annotations
- 质量评分系统 / Quality scoring system
- 群组管理功能 / Group management features

### 4. 智能语音处理 / Intelligent Voice Processing
- 语音识别与转录 / Speech recognition and transcription
- 实时语音翻译 / Real-time voice translation
- 语音合成与播放 / Speech synthesis and playback
- 语言自动检测 / Automatic language detection
- 发音指导功能 / Pronunciation guidance

### 5. 文化学习资源 / Cultural Learning Resources
- 学习资料管理 / Learning material management
- 文化知识库 / Cultural knowledge base
- 学习进度跟踪 / Learning progress tracking
- 个性化推荐 / Personalized recommendations
- 成就系统 / Achievement system

### 6. 社区与活动 / Community & Events
- 文化活动日历 / Cultural event calendar
- 社区创建与管理 / Community creation and management
- 活动报名与参与 / Event registration and participation
- 社区内容分享 / Community content sharing
- 活动推荐算法 / Event recommendation algorithm

## 🔧 开发指南 / Development Guide

### 环境要求 / Environment Requirements
- **Node.js** >= 18.x
- **MongoDB** >= 5.x
- **Redis** >= 6.x
- **NPM** >= 8.x

### 安装依赖 / Install Dependencies
```bash
npm install
```

### 配置环境变量 / Configure Environment Variables
复制 `.env.example` 文件并重命名为 `.env`，然后根据需要修改配置：
Copy `.env.example` file and rename it to `.env`, then modify the configuration as needed:

```bash
cp .env.example .env
```

### 启动开发服务器 / Start Development Server
```bash
npm run dev
```

### 构建生产版本 / Build Production Version
```bash
npm run build
```

### 启动生产服务器 / Start Production Server
```bash
npm start
```

### 运行测试 / Run Tests
```bash
npm test
```

### 安全审计 / Security Audit
```bash
npm run security-audit
```

## 📊 API文档 / API Documentation

### 认证端点 / Authentication Endpoints
- `POST /api/auth/register` - 用户注册 / User registration
- `POST /api/auth/login` - 用户登录 / User login
- `POST /api/auth/logout` - 用户登出 / User logout
- `POST /api/auth/refresh` - 刷新令牌 / Refresh token

### 区块链端点 / Blockchain Endpoints
- `GET /api/blockchain/balance` - 获取代币余额 / Get token balance
- `POST /api/blockchain/transfer` - 转账代币 / Transfer tokens
- `GET /api/blockchain/transactions` - 交易历史 / Transaction history
- `POST /api/blockchain/reward` - 发放奖励 / Distribute rewards

### 聊天端点 / Chat Endpoints
- `GET /api/chat/rooms` - 获取聊天室列表 / Get chat room list
- `POST /api/chat/rooms` - 创建聊天室 / Create chat room
- `GET /api/chat/messages/:roomId` - 获取消息历史 / Get message history
- `POST /api/chat/messages` - 发送消息 / Send message

### 语音端点 / Voice Endpoints
- `POST /api/voice/transcribe` - 语音转文字 / Speech to text
- `POST /api/voice/translate` - 语音翻译 / Voice translation
- `POST /api/voice/synthesize` - 文字转语音 / Text to speech
- `GET /api/voice/languages` - 支持的语言 / Supported languages

### 健康检查端点 / Health Check Endpoints
- `GET /health` - 简单健康检查 / Simple health check
- `GET /health/detailed` - 详细健康检查 / Detailed health check
- `GET /health/ready` - 就绪检查 / Readiness check
- `GET /health/live` - 存活检查 / Liveness check

## 🗄 数据库设计 / Database Design

### 主要集合 / Main Collections
- **Users** - 用户信息 / User information
- **Profiles** - 个人资料 / User profiles
- **ChatRooms** - 聊天室 / Chat rooms
- **Messages** - 消息记录 / Message records
- **Transactions** - 区块链交易 / Blockchain transactions
- **VoiceRecords** - 语音记录 / Voice records
- **CulturalNotes** - 文化注释 / Cultural notes
- **Achievements** - 成就记录 / Achievement records

## 🔒 安全特性 / Security Features

### 输入验证 / Input Validation
- 严格的数据验证 / Strict data validation
- SQL/NoSQL注入防护 / SQL/NoSQL injection protection
- XSS攻击防护 / XSS attack protection
- 参数污染防护 / Parameter pollution protection

### 认证与授权 / Authentication & Authorization
- JWT令牌管理 / JWT token management
- 双因素认证 / Two-factor authentication
- 基于角色的访问控制 / Role-based access control
- API密钥管理 / API key management

### 数据保护 / Data Protection
- 敏感数据加密 / Sensitive data encryption
- 传输层安全 / Transport layer security
- 密码安全存储 / Secure password storage
- 数据备份与恢复 / Data backup and recovery

### 监控与审计 / Monitoring & Auditing
- 实时威胁检测 / Real-time threat detection
- 安全事件记录 / Security event logging
- 异常行为分析 / Anomaly behavior analysis
- 自动告警机制 / Automatic alert mechanism

## 🚀 部署指南 / Deployment Guide

### Docker部署 / Docker Deployment
```bash
# 构建镜像 / Build image
docker build -t culturebridge-backend .

# 运行容器 / Run container
docker run -p 3000:3000 culturebridge-backend
```

### 生产环境配置 / Production Configuration
- 负载均衡配置 / Load balancer configuration
- SSL证书配置 / SSL certificate configuration
- 环境变量安全管理 / Secure environment variable management
- 监控和日志配置 / Monitoring and logging configuration

## 📈 性能优化 / Performance Optimization

### 缓存策略 / Caching Strategy
- Redis缓存实现 / Redis cache implementation
- 数据库查询优化 / Database query optimization
- 静态资源缓存 / Static resource caching
- API响应缓存 / API response caching

### 并发处理 / Concurrency Handling
- 集群模式支持 / Cluster mode support
- 连接池管理 / Connection pool management
- 异步处理优化 / Asynchronous processing optimization
- 内存使用优化 / Memory usage optimization

## 🤝 贡献指南 / Contributing Guide

1. Fork本仓库 / Fork this repository
2. 创建您的特性分支 / Create your feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. 提交您的更改 / Commit your changes
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. 推送到分支 / Push to the branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. 开启一个Pull Request / Open a Pull Request

### 代码规范 / Code Standards
- 遵循ESLint配置 / Follow ESLint configuration
- 编写单元测试 / Write unit tests
- 添加适当的注释 / Add appropriate comments
- 更新相关文档 / Update relevant documentation

## 📄 许可证 / License

本项目采用MIT许可证 - 详情请参阅 [LICENSE](LICENSE) 文件  
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 📞 联系方式 / Contact Information

**开发者 / Developer**: Bin Yi  
**邮箱 / Email**: binyi@culturebridge.com  
**项目主页 / Project Homepage**: https://github.com/yb1734492970508/CultureBridge-Backend  

## 🙏 致谢 / Acknowledgments

感谢所有为CultureBridge项目做出贡献的开发者和社区成员。  
Thanks to all developers and community members who contributed to the CultureBridge project.

---

**CultureBridge - 连接世界，交流文化 / Connecting the World, Exchanging Cultures**

