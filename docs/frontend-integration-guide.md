# CultureBridge API 文档 - 前端集成指南

## 项目概述

CultureBridge 是一个基于区块链技术的跨文化交流平台，集成了 AI 语音翻译、实时聊天、文化学习和 CBT 代币奖励机制。

### 技术栈
- **后端**: Node.js + Express.js
- **数据库**: MongoDB + Redis
- **区块链**: BNB Smart Chain (BSC)
- **代币**: CBT (CultureBridge Token) - BEP-20
- **AI服务**: Google Cloud Speech & Translation API

## 基础配置

### 服务器信息
- **开发环境**: http://localhost:5000
- **生产环境**: https://api.culturebridge.io
- **WebSocket**: Socket.IO 支持实时通信

### 认证方式
所有 API 请求需要在 Header 中包含认证信息：
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

## 核心 API 接口

### 1. 用户认证 (`/api/v1/auth`)

#### 注册用户
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "securePassword123",
  "culturalBackground": "Chinese",
  "preferredLanguages": ["zh", "en"]
}
```

**响应示例**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64a1b2c3d4e5f6789012345",
    "username": "user123",
    "email": "user@example.com",
    "culturalBackground": "Chinese",
    "walletAddress": "0x1234567890abcdef...",
    "cbtBalance": "0"
  }
}
```

#### 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### 2. 区块链集成 (`/api/blockchain`)

#### 获取 CBT 代币余额
```http
GET /api/blockchain/balance/:address
Authorization: Bearer <JWT_TOKEN>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef...",
    "balance": "1500.5",
    "balanceWei": "1500500000000000000000",
    "lastUpdated": "2024-06-13T10:30:00Z"
  }
}
```

#### 发送 CBT 代币
```http
POST /api/blockchain/transfer
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "to": "0xabcdef1234567890...",
  "amount": "100",
  "purpose": "Cultural exchange reward",
  "category": "CULTURAL_EXCHANGE"
}
```

### 3. 语音翻译 (`/api/voice`)

#### 语音转文字
```http
POST /api/voice/speech-to-text
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

{
  "audio": <audio_file>,
  "sourceLanguage": "zh-CN",
  "targetLanguage": "en-US"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "originalText": "你好，很高兴认识你",
    "translatedText": "Hello, nice to meet you",
    "confidence": 0.95,
    "audioUrl": "/uploads/audio/processed_audio.mp3"
  }
}
```

#### 文字转语音
```http
POST /api/voice/text-to-speech
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "text": "Hello, welcome to CultureBridge!",
  "language": "en-US",
  "voice": "female"
}
```

### 4. 实时聊天 (`Socket.IO`)

#### 连接 WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});

// 加入聊天室
socket.emit('join-room', {
  roomId: 'cultural-exchange-room-1',
  userId: 'user123'
});

// 发送消息
socket.emit('send-message', {
  roomId: 'cultural-exchange-room-1',
  message: 'Hello everyone!',
  type: 'text'
});

// 接收消息
socket.on('new-message', (data) => {
  console.log('New message:', data);
});
```

### 5. 文化交流活动 (`/api/v1/events`)

#### 获取活动列表
```http
GET /api/v1/events?page=1&limit=10&category=language-exchange
Authorization: Bearer <JWT_TOKEN>
```

#### 创建新活动
```http
POST /api/v1/events
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "title": "Chinese-English Language Exchange",
  "description": "Practice Mandarin and English with native speakers",
  "category": "language-exchange",
  "startTime": "2024-06-15T19:00:00Z",
  "endTime": "2024-06-15T21:00:00Z",
  "maxParticipants": 20,
  "rewardAmount": "50"
}
```

### 6. 交易所集成 (`/api/exchange`)

#### 获取代币信息包
```http
GET /api/exchange/token-info
Authorization: Bearer <JWT_TOKEN>
```

#### 检查上线准备状态
```http
GET /api/exchange/readiness-check
Authorization: Bearer <JWT_TOKEN>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "readinessPercentage": 85,
    "isReady": false,
    "checklist": {
      "contractDeployment": {
        "status": "completed",
        "description": "智能合约部署到主网"
      },
      "liquidityPreparation": {
        "status": "pending",
        "description": "准备初始流动性资金"
      }
    },
    "nextSteps": [
      {
        "task": "liquidityPreparation",
        "description": "准备初始流动性资金",
        "priority": 8
      }
    ]
  }
}
```

## 前端集成示例

### React.js 集成示例

#### 1. 安装依赖
```bash
npm install axios socket.io-client web3
```

#### 2. API 服务配置
```javascript
// services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器 - 添加认证 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### 3. 用户认证 Hook
```javascript
// hooks/useAuth.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/v1/auth/login', {
        email,
        password
      });
      
      localStorage.setItem('authToken', response.token);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // 验证 token 有效性
      api.get('/api/v1/auth/me')
        .then(response => setUser(response.user))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return { user, login, logout, loading };
};
```

#### 4. Socket.IO 集成
```javascript
// hooks/useSocket.js
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (token) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (token) {
      const newSocket = io(process.env.REACT_APP_API_URL, {
        auth: { token }
      });

      newSocket.on('connect', () => {
        setConnected(true);
        console.log('Socket connected');
      });

      newSocket.on('disconnect', () => {
        setConnected(false);
        console.log('Socket disconnected');
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [token]);

  return { socket, connected };
};
```

#### 5. 语音翻译组件
```javascript
// components/VoiceTranslator.jsx
import React, { useState } from 'react';
import api from '../services/api';

const VoiceTranslator = () => {
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);

  const startRecording = async () => {
    setRecording(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('sourceLanguage', 'zh-CN');
        formData.append('targetLanguage', 'en-US');

        try {
          const response = await api.post('/api/voice/speech-to-text', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          setResult(response.data);
        } catch (error) {
          console.error('Translation error:', error);
        }
      };

      mediaRecorder.start();
      
      setTimeout(() => {
        mediaRecorder.stop();
        setRecording(false);
      }, 5000); // 5秒录音
      
    } catch (error) {
      console.error('Recording error:', error);
      setRecording(false);
    }
  };

  return (
    <div className="voice-translator">
      <button 
        onClick={startRecording} 
        disabled={recording}
        className={`record-btn ${recording ? 'recording' : ''}`}
      >
        {recording ? '录音中...' : '开始录音'}
      </button>
      
      {result && (
        <div className="translation-result">
          <p><strong>原文:</strong> {result.originalText}</p>
          <p><strong>翻译:</strong> {result.translatedText}</p>
          <audio controls src={result.audioUrl} />
        </div>
      )}
    </div>
  );
};

export default VoiceTranslator;
```

## 错误处理

### 标准错误响应格式
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

### 常见错误代码
- `AUTH_REQUIRED`: 需要认证
- `INVALID_TOKEN`: 无效的认证令牌
- `INSUFFICIENT_BALANCE`: CBT 余额不足
- `RATE_LIMIT_EXCEEDED`: 请求频率超限
- `VALIDATION_ERROR`: 输入验证错误
- `BLOCKCHAIN_ERROR`: 区块链交易错误

## 部署配置

### 环境变量
```env
# 前端环境变量
REACT_APP_API_URL=https://api.culturebridge.io
REACT_APP_SOCKET_URL=https://api.culturebridge.io
REACT_APP_CHAIN_ID=56
REACT_APP_CBT_CONTRACT_ADDRESS=0x...
```

### 构建和部署
```bash
# 构建生产版本
npm run build

# 部署到服务器
npm run deploy
```

## 测试指南

### API 测试
使用 Postman 或类似工具测试 API 接口：
1. 导入 API 集合文件
2. 设置环境变量
3. 运行测试套件

### 前端测试
```bash
# 运行单元测试
npm test

# 运行端到端测试
npm run test:e2e
```

## 支持和联系

- **技术文档**: https://docs.culturebridge.io
- **GitHub**: https://github.com/yb1734492970508/CultureBridge-Backend
- **问题反馈**: https://github.com/yb1734492970508/CultureBridge-Backend/issues
- **社区讨论**: https://t.me/CultureBridgeOfficial

---

*最后更新: 2024-06-13*
*版本: v2.0.0*

