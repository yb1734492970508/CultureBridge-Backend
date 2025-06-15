# CultureBridge Backend

CultureBridge是一个基于区块链技术的文化交流和语言学习平台，集成了CBT代币经济系统、实时聊天、语音翻译等功能。

## 🌟 主要特性

### 🔗 区块链集成
- **BNB链支持**: 基于Binance Smart Chain的CBT代币
- **智能合约**: 自动化的代币分发和奖励机制
- **钱包集成**: 支持MetaMask等主流钱包
- **去中心化**: 透明的代币经济系统

### 💬 实时聊天系统
- **多类型聊天室**: 公开、私有、语言交换、文化讨论
- **实时消息**: WebSocket支持的即时通讯
- **多媒体支持**: 文本、语音、图片、文件分享
- **智能翻译**: 自动翻译聊天消息
- **奖励机制**: 聊天参与获得CBT代币奖励

### 🗣️ 语音翻译
- **多语言支持**: 支持16种主流语言
- **语音识别**: 高精度的语音转文本
- **实时翻译**: 快速准确的文本翻译
- **语音合成**: 自然流畅的文本转语音
- **批量处理**: 支持批量语音翻译

### 🎓 文化学习
- **文化交流**: 多样化的文化分享活动
- **语言学习**: 词汇、语法、对话练习
- **进度跟踪**: 详细的学习进度记录
- **成就系统**: 学习成就和奖励机制

### 🪙 CBT代币系统
- **奖励分发**: 多种活动获得代币奖励
- **钱包管理**: 完整的钱包功能
- **交易记录**: 详细的交易历史
- **统计分析**: 代币使用情况分析

## 🚀 技术栈

### 后端技术
- **Node.js**: 服务器运行环境
- **Express.js**: Web应用框架
- **Socket.IO**: 实时通信
- **MongoDB**: 数据库
- **Mongoose**: ODM框架

### 区块链技术
- **Web3.js**: 区块链交互
- **Ethers.js**: 以太坊库
- **Solidity**: 智能合约开发
- **BNB Chain**: 区块链网络

### AI/ML服务
- **Azure Cognitive Services**: 语音和翻译服务
- **Google Cloud AI**: 备用AI服务
- **百度AI**: 本地化AI支持

### 开发工具
- **Jest**: 单元测试
- **Swagger**: API文档
- **ESLint**: 代码规范
- **Docker**: 容器化部署

## 📦 安装和运行

### 环境要求
- Node.js 18.0+
- MongoDB 5.0+
- Redis 6.0+ (可选)

### 安装依赖
```bash
npm install
```

### 环境配置
创建 `.env` 文件：
```env
# 基础配置
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret_key

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/culturebridge
REDIS_URL=redis://localhost:6379

# 区块链配置
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=your_contract_address

# AI服务配置
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastus
AZURE_TRANSLATOR_KEY=your_azure_translator_key
GOOGLE_TRANSLATE_API_KEY=your_google_api_key
BAIDU_TRANSLATE_APP_ID=your_baidu_app_id
BAIDU_TRANSLATE_SECRET_KEY=your_baidu_secret_key
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 测试
npm test
```

## 📚 API文档

启动服务后访问: http://localhost:3000/api-docs

### 主要API端点

#### 认证相关
- `POST /api/v2/auth/register` - 用户注册
- `POST /api/v2/auth/login` - 用户登录
- `GET /api/v2/auth/profile` - 获取用户信息

#### CBT代币
- `GET /api/v2/cbt/wallet` - 获取钱包信息
- `POST /api/v2/cbt/distribute-reward` - 分发奖励
- `GET /api/v2/cbt/transactions` - 交易历史

#### 聊天系统
- `GET /api/v2/chat/rooms` - 获取聊天室列表
- `POST /api/v2/chat/rooms` - 创建聊天室
- `GET /api/v2/chat/rooms/:id/messages` - 获取聊天消息

#### 语音翻译
- `POST /api/v2/voice/speech-to-text` - 语音识别
- `POST /api/v2/voice/translate-text` - 文本翻译
- `POST /api/v2/voice/text-to-speech` - 语音合成

#### 文化学习
- `GET /api/v2/cultural/exchanges` - 文化交流活动
- `POST /api/v2/cultural/sessions` - 创建学习会话
- `GET /api/v2/cultural/progress` - 学习进度

## 🔧 配置说明

### 数据库配置
```javascript
// MongoDB连接配置
const mongoConfig = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
};
```

### 区块链配置
```javascript
// BSC网络配置
const bscConfig = {
    chainId: 56, // 主网
    // chainId: 97, // 测试网
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    gasPrice: '5000000000', // 5 Gwei
    gasLimit: 200000
};
```

### 安全配置
```javascript
// 安全中间件配置
const securityConfig = {
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100 // 每IP最多100请求
    },
    cors: {
        origin: ['https://culturebridgechain.com'],
        credentials: true
    }
};
```

## 🧪 测试

### 运行测试
```bash
# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 覆盖率测试
npm run test:coverage

# 性能测试
npm run test:performance
```

### 测试覆盖率
- 单元测试覆盖率: 90%+
- 集成测试覆盖率: 85%+
- API测试覆盖率: 95%+

## 🚀 部署

### Docker部署
```bash
# 构建镜像
docker build -t culturebridge-backend .

# 运行容器
docker run -p 3000:3000 --env-file .env culturebridge-backend
```

### PM2部署
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

### 云服务部署
支持部署到以下平台：
- AWS EC2/ECS
- Google Cloud Platform
- Microsoft Azure
- 阿里云
- 腾讯云

## 📊 监控和日志

### 性能监控
- 响应时间监控
- 内存使用监控
- CPU使用监控
- 数据库性能监控

### 日志系统
- 请求日志
- 错误日志
- 安全日志
- 业务日志

### 告警系统
- 服务异常告警
- 性能异常告警
- 安全事件告警

## 🔒 安全特性

### 认证和授权
- JWT令牌认证
- 角色权限控制
- API密钥验证
- 双因素认证

### 数据安全
- 数据加密存储
- 传输加密(HTTPS)
- 输入验证和清理
- SQL/NoSQL注入防护

### 网络安全
- 速率限制
- CORS配置
- 安全头设置
- IP白名单

## 🤝 贡献指南

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

### 代码规范
- 使用ESLint进行代码检查
- 遵循Airbnb JavaScript规范
- 编写单元测试
- 更新文档

### 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建过程或辅助工具的变动
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系我们

- 项目主页: https://culturebridgechain.com
- GitHub: https://github.com/yb1734492970508/CultureBridge-Backend
- 问题反馈: https://github.com/yb1734492970508/CultureBridge-Backend/issues
- 邮箱: support@culturebridgechain.com

## 🙏 致谢

感谢所有为CultureBridge项目做出贡献的开发者和用户！

---

**CultureBridge - 连接世界，分享文化** 🌍

