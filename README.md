# CultureBridge Backend

这是CultureBridge平台的后端API服务，提供用户认证、文化活动管理和论坛系统等功能。

## 技术栈

- Node.js
- Express.js
- MongoDB
- JWT认证

## 项目结构

```
CultureBridge-Backend/
├── src/
│   ├── controllers/    # 控制器
│   ├── models/         # 数据模型
│   ├── routes/         # 路由
│   ├── middleware/     # 中间件
│   ├── config/         # 配置文件
│   ├── utils/          # 工具函数
│   └── server.js       # 服务器入口
├── .env                # 环境变量
└── package.json        # 项目依赖
```

## 安装与运行

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建`.env`文件并设置以下变量：

```
MONGODB_URI=mongodb://localhost:27017/culturebridge
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
```

### 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API文档

### 认证API

#### 注册用户

- **URL**: `/api/auth/register`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "username": "用户名",
    "email": "邮箱",
    "password": "密码"
  }
  ```
- **响应**: 返回JWT令牌

#### 用户登录

- **URL**: `/api/auth/login`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "email": "邮箱",
    "password": "密码"
  }
  ```
- **响应**: 返回JWT令牌

#### 获取用户资料

- **URL**: `/api/auth/profile`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**: 返回用户资料

#### 更新用户资料

- **URL**: `/api/auth/profile`
- **方法**: `PUT`
- **认证**: 需要JWT令牌
- **请求体**:
  ```json
  {
    "username": "新用户名",
    "bio": "个人简介",
    "location": "所在地",
    "languages": ["中文", "英语"]
  }
  ```
- **响应**: 返回更新后的用户资料

## 许可证

MIT
