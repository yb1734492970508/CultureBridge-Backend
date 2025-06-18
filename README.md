# CultureBridge Backend API

[English](#english) | [中文](#chinese)

---

## English

### 🚀 CultureBridge Backend Server

This is the backend server for CultureBridge, a revolutionary cultural exchange platform that combines modern technology, real-time communication, and language learning to create a centralized, secure, and user-friendly experience.

### 🏗️ Architecture

The backend follows a modular architecture with the following components:

- **API Layer**: RESTful APIs for client communication
- **WebSocket Layer**: Real-time communication for chat and notifications
- **Reward System**: Centralized point-based reward management
- **Database Layer**: MongoDB for data persistence
- **Authentication Layer**: JWT-based user authentication
- **Translation Service**: Multi-language translation capabilities

### 📁 Project Structure

```
CultureBridge-Backend/
├── src/
│   ├── controllers/          # Request handlers
│   ├── models/              # Database models
│   │   └── UserReward.js    # User reward system model
│   ├── routes/              # API routes
│   │   └── rewards.js       # Reward system routes
│   ├── services/            # Business logic
│   │   ├── rewardService.js # Reward management service
│   │   ├── chatServer.js
│   │   ├── contentService.js
│   │   └── translationService.js
│   ├── middleware/          # Custom middleware
│   ├── utils/               # Utility functions
│   └── enhancedApp.js       # Express app configuration
├── tests/                   # Test files
├── docs/                    # API documentation
└── package.json
```

### 🔧 Installation & Setup

#### Prerequisites
- Node.js 18+
- MongoDB 5.0+
- npm or yarn

#### Installation
```bash
# Clone the repository
git clone https://github.com/yb1734492970508/CultureBridge-Backend.git
cd CultureBridge-Backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start MongoDB (if running locally)
mongod

# Run the server
npm run dev
```

#### Environment Variables
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/culturebridge

# Authentication
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d

# Translation Service
GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
AZURE_TRANSLATE_KEY=your_azure_key

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Redis (for caching)
REDIS_URL=redis://localhost:6379
```

### 📚 API Documentation

#### Authentication Endpoints

##### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "preferredLanguage": "string"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "username": "string",
    "email": "string"
  }
}
```

##### POST /api/auth/login
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

#### Reward System Endpoints

##### GET /api/rewards/user
Get current user's reward information.

**Response:**
```json
{
  "success": true,
  "data": {
    "points": {
      "learning": 1250,
      "engagement": 800,
      "contribution": 500,
      "total": 2550
    },
    "level": {
      "current": 5,
      "experience": 2550,
      "nextLevelExp": 3000
    },
    "achievements": ["first_lesson", "daily_streak_7"],
    "checkInData": {
      "streak": 7,
      "lastCheckIn": "2024-01-15",
      "totalCheckIns": 45
    }
  }
}
```

##### POST /api/rewards/checkin
Perform daily check-in.

##### POST /api/rewards/points
Add points to user account.

**Request Body:**
```json
{
  "type": "learning",
  "amount": 50,
  "reason": "Completed lesson"
}
```

##### GET /api/rewards/shop
Get available rewards in the shop.

##### GET /api/rewards/leaderboard
Get user leaderboard.

#### User Endpoints

##### GET /api/users/profile
Get current user profile (requires authentication).

##### PUT /api/users/profile
Update user profile.

##### GET /api/users/stats
Get user statistics (learning progress, points balance, etc.).

#### Chat Endpoints

##### GET /api/chat/rooms
Get list of available chat rooms.

##### POST /api/chat/rooms
Create a new chat room.

##### GET /api/chat/rooms/:id/messages
Get messages from a specific chat room.

##### POST /api/chat/translate
Translate a message to target language.

#### Learning Endpoints

##### GET /api/learning/courses
Get available language courses.

##### POST /api/learning/progress
Update learning progress.

##### GET /api/learning/achievements
Get user achievements.

### 🔌 WebSocket Events

#### Connection
```javascript
const socket = io('http://localhost:5000');
```

#### Chat Events
- `join_room`: Join a chat room
- `leave_room`: Leave a chat room
- `send_message`: Send a message
- `receive_message`: Receive a message
- `typing`: User typing indicator
- `user_joined`: User joined room
- `user_left`: User left room

#### Translation Events
- `translate_request`: Request message translation
- `translate_response`: Receive translation result

#### Notification Events
- `notification`: Receive real-time notifications
- `points_earned`: Points earned notification

### 🧪 Testing

#### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/auth.test.js
```

#### Test Structure
```
tests/
├── unit/                    # Unit tests
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/             # Integration tests
│   ├── auth.test.js
│   ├── chat.test.js
│   └── rewards.test.js
└── fixtures/               # Test data
```

### 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Sanitize and validate all inputs
- **CORS Protection**: Configure cross-origin requests
- **Helmet.js**: Security headers
- **bcrypt**: Password hashing
- **MongoDB Injection Protection**: Prevent NoSQL injection

### 📊 Performance Monitoring

- **Response Time Monitoring**: Track API response times
- **Error Logging**: Comprehensive error tracking
- **Database Query Optimization**: Indexed queries
- **Caching**: Redis-based caching for frequently accessed data
- **Load Balancing**: Support for horizontal scaling

### 🚀 Deployment

#### Docker Deployment
```bash
# Build Docker image
docker build -t culturebridge-backend .

# Run container
docker run -p 5000:5000 culturebridge-backend
```

#### Production Environment
```bash
# Install PM2 for process management
npm install -g pm2

# Start application with PM2
pm2 start ecosystem.config.js

# Monitor application
pm2 monit
```

### 📈 Monitoring & Logging

- **Winston**: Structured logging
- **Morgan**: HTTP request logging
- **Health Check Endpoint**: `/api/health`
- **Metrics Endpoint**: `/api/metrics`

---

## Chinese

### 🚀 CultureBridge 后端服务器

这是CultureBridge的后端服务器，一个结合现代技术、实时通信和语言学习的革命性文化交流平台，提供中心化、安全且用户友好的体验。

### 🏗️ 架构

后端采用模块化架构，包含以下组件：

- **API层**: 客户端通信的RESTful API
- **WebSocket层**: 聊天和通知的实时通信
- **奖励系统**: 中心化的基于积分的奖励管理
- **数据库层**: MongoDB数据持久化
- **认证层**: 基于JWT的用户认证
- **翻译服务**: 多语言翻译功能

### 📁 项目结构

```
CultureBridge-Backend/
├── src/
│   ├── controllers/          # 请求处理器
│   ├── models/              # 数据库模型
│   │   └── UserReward.js    # 用户奖励系统模型
│   ├── routes/              # API路由
│   │   └── rewards.js       # 奖励系统路由
│   ├── services/            # 业务逻辑
│   │   ├── rewardService.js # 奖励管理服务
│   │   ├── chatServer.js
│   │   ├── contentService.js
│   │   └── translationService.js
│   ├── middleware/          # 自定义中间件
│   ├── utils/               # 工具函数
│   └── enhancedApp.js       # Express应用配置
├── tests/                   # 测试文件
├── docs/                    # API文档
└── package.json
```

### 🔧 安装和设置

#### 前置要求
- Node.js 18+
- MongoDB 5.0+
- npm或yarn

#### 安装
```bash
# 克隆仓库
git clone https://github.com/yb1734492970508/CultureBridge-Backend.git
cd CultureBridge-Backend

# 安装依赖
npm install

# 设置环境变量
cp .env.example .env
# 编辑.env文件配置

# 启动MongoDB（如果本地运行）
mongod

# 运行服务器
npm run dev
```

### 🎁 奖励系统

#### 积分类型
- **学习积分**: 通过完成课程和练习获得
- **互动积分**: 通过社区参与和聊天获得
- **贡献积分**: 通过帮助他人和创建内容获得

#### 等级系统
- 基于总积分的用户等级
- 每个等级解锁新的特权和奖励
- 经验值系统跟踪进度

#### 成就系统
- 多样化的成就徽章
- 特殊里程碑奖励
- 社区认可系统

### 🧪 测试

#### 运行测试
```bash
# 运行所有测试
npm test

# 运行覆盖率测试
npm run test:coverage

# 运行特定测试文件
npm test tests/auth.test.js
```

### 🔒 安全功能

- **JWT认证**: 安全的基于令牌的认证
- **速率限制**: 防止API滥用
- **输入验证**: 清理和验证所有输入
- **CORS保护**: 配置跨域请求
- **Helmet.js**: 安全头部
- **bcrypt**: 密码哈希
- **MongoDB注入保护**: 防止NoSQL注入

### 🚀 部署

#### Docker部署
```bash
# 构建Docker镜像
docker build -t culturebridge-backend .

# 运行容器
docker run -p 5000:5000 culturebridge-backend
```

#### 生产环境
```bash
# 安装PM2进程管理
npm install -g pm2

# 使用PM2启动应用
pm2 start ecosystem.config.js

# 监控应用
pm2 monit
```

---

*CultureBridge Backend - 强大的文化交流平台后端服务 | Powerful Backend for Cultural Exchange Platform*

