# CultureBridge区块链身份与声誉系统API文档

## 概述

本文档描述了CultureBridge平台区块链身份与声誉系统的API接口。这些接口允许用户管理区块链钱包、创建链上身份、更新声誉分数和记录贡献。

## 基础URL

```
https://api.culturebridge.com/api
```

## 认证

除了特别标注的公开接口外，所有API请求都需要在HTTP头部包含JWT令牌：

```
Authorization: Bearer <token>
```

## 钱包管理API

### 生成钱包地址

**请求**:
- 方法: `POST`
- 路径: `/blockchain/wallet/generate`
- 权限: 已登录用户

**响应**:
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "privateKey": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  },
  "message": "钱包地址生成成功"
}
```

### 验证钱包地址

**请求**:
- 方法: `POST`
- 路径: `/blockchain/wallet/validate`
- 权限: 公开
- 请求体:
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "isValid": true
  },
  "message": "钱包地址有效"
}
```

### 获取钱包余额

**请求**:
- 方法: `GET`
- 路径: `/blockchain/wallet/:address/balance`
- 权限: 公开

**响应**:
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "balance": "0.05"
  },
  "message": "获取钱包余额成功"
}
```

## 用户身份API

### 创建用户链上身份

**请求**:
- 方法: `POST`
- 路径: `/blockchain/identity/:userId`
- 权限: 管理员

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "60d5ec9af682fbd12a0a9fb8",
    "username": "zhang_wei",
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "blockchainIdentityId": 42
  },
  "message": "用户链上身份创建成功"
}
```

### 更新用户声誉分数

**请求**:
- 方法: `PUT`
- 路径: `/blockchain/identity/:userId/reputation`
- 权限: 管理员
- 请求体:
```json
{
  "reputationScore": 85
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "60d5ec9af682fbd12a0a9fb8",
    "username": "zhang_wei",
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "reputationScore": 85
  },
  "message": "用户声誉分数更新成功"
}
```

### 添加用户贡献记录

**请求**:
- 方法: `POST`
- 路径: `/blockchain/identity/:userId/contribution`
- 权限: 管理员
- 请求体:
```json
{
  "contributionType": "文化活动组织",
  "description": "组织了2023年春节文化交流活动"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "60d5ec9af682fbd12a0a9fb8",
    "username": "zhang_wei",
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "contributionCount": 3,
    "contributionType": "文化活动组织",
    "description": "组织了2023年春节文化交流活动"
  },
  "message": "用户贡献记录添加成功"
}
```

### 获取用户链上身份信息

**请求**:
- 方法: `GET`
- 路径: `/blockchain/identity/:userId`
- 权限: 已登录用户

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "60d5ec9af682fbd12a0a9fb8",
    "username": "zhang_wei",
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "blockchainIdentityId": 42,
    "reputationScore": 85,
    "contributionCount": 3,
    "createdAt": "2023-01-15T08:30:45.123Z",
    "updatedAt": "2023-05-20T14:22:10.456Z"
  },
  "message": "获取用户链上身份信息成功"
}
```

## 错误响应

所有API在遇到错误时会返回适当的HTTP状态码和JSON格式的错误信息：

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

常见错误状态码：
- `400 Bad Request`: 请求参数无效
- `401 Unauthorized`: 未提供认证或认证无效
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

## 区块链交互说明

所有涉及区块链操作的API都会在后端与Polygon网络上的智能合约进行交互。这些操作可能需要一定时间来完成，因为它们依赖于区块链的确认过程。

在生产环境中，系统连接到Polygon主网；在开发和测试环境中，系统连接到Mumbai测试网。
