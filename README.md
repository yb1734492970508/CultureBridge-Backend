# CultureBridge 后端项目

CultureBridge是一个跨文化交流平台，旨在连接不同文化背景的人们，促进文化理解与交流。本仓库包含CultureBridge项目的后端代码。

## 技术栈

- **Node.js** - JavaScript运行环境
- **Express.js** - Web应用框架
- **MongoDB** - NoSQL数据库
- **Mongoose** - MongoDB对象模型工具
- **JWT** - 用户认证
- **Bcrypt** - 密码加密
- **Multer** - 文件上传处理
- **Socket.io** - 实时通信（用于聊天功能）

## 项目结构

```
CultureBridge-Backend/
├── src/                  # 源代码
│   ├── config/           # 配置文件
│   ├── controllers/      # 控制器
│   ├── middleware/       # 中间件
│   ├── models/           # 数据模型
│   ├── routes/           # 路由
│   ├── services/         # 服务
│   ├── utils/            # 工具函数
│   └── app.js            # 应用入口
├── uploads/              # 上传文件存储
├── .env.example          # 环境变量示例
├── .gitignore            # Git忽略文件
├── package.json          # 项目依赖
└── README.md             # 项目说明
```

## 核心功能模块

### 1. 用户认证与个人资料

- 用户注册、登录、登出
- 个人资料管理
- 密码重置
- 社交媒体登录集成

### 2. 文化交流论坛

- 话题创建与管理
- 帖子发布、编辑、删除
- 评论与回复
- 内容搜索与过滤

### 3. 语言学习资源

- 学习资料上传与分享
- 资源分类与标签
- 资源评分与评论
- 学习进度跟踪

### 4. 文化活动日历

- 活动创建与管理
- 活动报名与参与
- 活动提醒
- 活动推荐

### 5. 跨文化社区

- 社区创建与管理
- 成员管理
- 社区内容分享
- 实时聊天

## API文档

API文档将使用Swagger生成，并在开发完成后提供访问地址。

## 数据库设计

使用MongoDB作为数据库，主要集合（Collections）包括：

- Users（用户）
- Profiles（个人资料）
- Topics（话题）
- Posts（帖子）
- Comments（评论）
- Resources（学习资源）
- Events（活动）
- Communities（社区）
- Messages（消息）

## 开发指南

### 环境要求

- Node.js >= 14.x
- MongoDB >= 4.x

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制`.env.example`文件并重命名为`.env`，然后根据需要修改配置。

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm start
```

## 测试

```bash
npm test
```

## 部署

项目支持Docker部署，详细部署文档将在开发完成后提供。

## 贡献指南

1. Fork本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个Pull Request

## 许可证

本项目采用MIT许可证 - 详情请参阅LICENSE文件
