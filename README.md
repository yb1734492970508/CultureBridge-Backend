# CultureBridge Backend - 文化桥梁后端服务 | CultureBridge Backend Service

## 🚀 项目概述 | Project Overview

CultureBridge Backend是一个现代化的跨文化交流平台后端服务，提供用户管理、文化探索、语言学习、实时聊天等核心功能的API接口。采用Node.js + Express.js开发，支持Socket.IO实时通信。

CultureBridge Backend is a modern cross-cultural exchange platform backend service that provides API interfaces for user management, cultural exploration, language learning, and real-time chat. Built with Node.js + Express.js and supports Socket.IO real-time communication.

## ✨ 核心功能 | Core Features

### 👤 用户管理 | User Management
- **用户信息管理** | User profile management
- **积分系统** | Points system
- **成就系统** | Achievement system
- **学习进度追踪** | Learning progress tracking
- **用户统计数据** | User statistics

### 🌍 文化探索 | Cultural Exploration
- **文化内容管理** | Cultural content management
- **分类筛选** | Category filtering
- **搜索功能** | Search functionality
- **文化详情** | Cultural details
- **参与统计** | Participation statistics

### 📚 语言学习 | Language Learning
- **多语言支持** | Multi-language support
- **学习进度** | Learning progress
- **课程管理** | Course management
- **练习工具** | Practice tools
- **学习统计** | Learning analytics

### 💬 实时聊天 | Real-time Chat
- **多语言聊天室** | Multi-language chat rooms
- **实时消息** | Real-time messaging
- **Socket.IO支持** | Socket.IO support
- **在线用户管理** | Online user management
- **消息历史** | Message history

## 🛠️ 技术栈 | Tech Stack

- **Node.js** - JavaScript运行环境 | JavaScript runtime
- **Express.js** - Web应用框架 | Web application framework
- **Socket.IO** - 实时通信 | Real-time communication
- **CORS** - 跨域资源共享 | Cross-origin resource sharing
- **JSON** - 数据交换格式 | Data exchange format

## 📦 项目结构 | Project Structure

```
CultureBridge-Backend/
├── src/
│   ├── modernBackend.js         # 现代化后端主文件 | Modern backend main file
│   ├── routes/                  # API路由 | API routes
│   ├── models/                  # 数据模型 | Data models
│   ├── controllers/             # 控制器 | Controllers
│   ├── middleware/              # 中间件 | Middleware
│   ├── services/                # 服务层 | Service layer
│   └── utils/                   # 工具函数 | Utility functions
├── package.json                 # 项目配置 | Project configuration
└── README.md                    # 项目文档 | Project documentation
```

## 🔌 API 端点 | API Endpoints

### 健康检查 | Health Check
```
GET /health
```
返回服务器状态信息 | Returns server status information

### 用户相关 | User Related
```
GET    /api/users/:userId        # 获取用户信息 | Get user info
PUT    /api/users/:userId        # 更新用户信息 | Update user info
```

### 积分系统 | Points System
```
GET    /api/points/:userId       # 获取用户积分 | Get user points
POST   /api/points/:userId/add   # 添加积分 | Add points
```

### 文化探索 | Cultural Exploration
```
GET    /api/cultures             # 获取文化列表 | Get culture list
GET    /api/cultures/:cultureId  # 获取文化详情 | Get culture details
```

### 语言学习 | Language Learning
```
GET    /api/languages/:userId    # 获取用户语言学习信息 | Get user language learning info
```

### 聊天系统 | Chat System
```
GET    /api/chat/rooms                    # 获取聊天室列表 | Get chat room list
GET    /api/chat/rooms/:roomId/messages   # 获取聊天室消息 | Get chat room messages
POST   /api/chat/rooms/:roomId/messages   # 发送消息 | Send message
```

## 🔄 Socket.IO 事件 | Socket.IO Events

### 客户端到服务器 | Client to Server
- `join_room` - 加入聊天室 | Join chat room
- `leave_room` - 离开聊天室 | Leave chat room
- `send_message` - 发送消息 | Send message

### 服务器到客户端 | Server to Client
- `new_message` - 新消息通知 | New message notification

## 🚀 快速开始 | Quick Start

### 安装依赖 | Install Dependencies
```bash
npm install
```

### 启动服务器 | Start Server
```bash
node src/modernBackend.js
```

### 访问API | Access API
```
服务器地址 | Server URL: http://localhost:5000
健康检查 | Health Check: http://localhost:5000/health
```

## 📊 数据模型 | Data Models

### 用户模型 | User Model
```javascript
{
  id: String,
  name: String,
  username: String,
  avatar: String,
  level: String,
  points: Number,
  streak: Number,
  languagesLearning: Array,
  culturesExplored: Number,
  friendsConnected: Number,
  achievements: Array
}
```

### 文化模型 | Culture Model
```javascript
{
  id: Number,
  title: String,
  description: String,
  category: String,
  country: String,
  image: String,
  difficulty: String,
  duration: String,
  participants: Number
}
```

### 聊天室模型 | Chat Room Model
```javascript
{
  id: Number,
  name: String,
  language: String,
  members: Number,
  lastMessage: String,
  time: String,
  online: Number
}
```

### 消息模型 | Message Model
```javascript
{
  id: Number,
  userId: String,
  userName: String,
  avatar: String,
  message: String,
  timestamp: String
}
```

## 🔧 配置选项 | Configuration Options

### 服务器配置 | Server Configuration
- **端口** | Port: 5000 (可通过环境变量PORT修改 | Configurable via PORT environment variable)
- **主机** | Host: 0.0.0.0 (允许外部访问 | Allows external access)
- **CORS** | CORS: 允许所有来源 | Allows all origins

### Socket.IO配置 | Socket.IO Configuration
- **CORS** | CORS: 允许所有来源和方法 | Allows all origins and methods
- **传输方式** | Transport: WebSocket, Polling

## 🛡️ 安全性 | Security

### CORS配置 | CORS Configuration
- 允许所有来源访问 | Allows access from all origins
- 支持凭据传递 | Supports credential passing
- 适用于开发和测试环境 | Suitable for development and testing

### 错误处理 | Error Handling
- 全局错误处理中间件 | Global error handling middleware
- 404错误处理 | 404 error handling
- 详细错误日志 | Detailed error logging

## 📈 性能优化 | Performance Optimization

### 内存数据存储 | In-Memory Data Storage
- 使用Map数据结构 | Uses Map data structure
- 快速数据访问 | Fast data access
- 适合原型开发 | Suitable for prototype development

### 实时通信优化 | Real-time Communication Optimization
- Socket.IO房间管理 | Socket.IO room management
- 事件驱动架构 | Event-driven architecture
- 高效消息广播 | Efficient message broadcasting

## 🔄 扩展性 | Scalability

### 数据库集成 | Database Integration
- 支持MongoDB集成 | Supports MongoDB integration
- 支持MySQL集成 | Supports MySQL integration
- 模块化数据访问层 | Modular data access layer

### 微服务架构 | Microservices Architecture
- 模块化设计 | Modular design
- 服务分离 | Service separation
- API网关支持 | API gateway support

## 🧪 测试 | Testing

### API测试 | API Testing
```bash
# 健康检查 | Health check
curl http://localhost:5000/health

# 获取用户信息 | Get user info
curl http://localhost:5000/api/users/user1

# 获取文化列表 | Get culture list
curl http://localhost:5000/api/cultures
```

### Socket.IO测试 | Socket.IO Testing
- 使用Socket.IO客户端测试 | Test with Socket.IO client
- 实时消息功能验证 | Real-time messaging verification
- 房间管理功能测试 | Room management testing

## 📝 开发指南 | Development Guide

### 添加新API | Adding New APIs
1. 在相应路由文件中定义端点 | Define endpoints in route files
2. 实现业务逻辑 | Implement business logic
3. 添加错误处理 | Add error handling
4. 更新API文档 | Update API documentation

### 数据模型扩展 | Data Model Extension
1. 定义新的数据结构 | Define new data structures
2. 更新初始化数据 | Update initialization data
3. 实现CRUD操作 | Implement CRUD operations
4. 添加数据验证 | Add data validation

## 🌍 国际化 | Internationalization

### 多语言支持 | Multi-language Support
- API响应支持多语言 | Multi-language API responses
- 错误消息本地化 | Localized error messages
- 文化内容多语言 | Multi-language cultural content

## 📞 联系我们 | Contact Us

- **项目仓库** | Project Repository: [GitHub](https://github.com/yb1734492970508/CultureBridge-Backend)
- **问题反馈** | Issue Reporting: GitHub Issues
- **功能建议** | Feature Requests: GitHub Discussions

## 📄 许可证 | License

本项目采用 MIT 许可证 | This project is licensed under the MIT License.

---

**CultureBridge Backend - 连接世界的技术桥梁 | Technical Bridge Connecting the World** 🌉

