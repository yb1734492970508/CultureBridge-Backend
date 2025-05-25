# CultureBridge 治理与代币经济 API 文档

## 概述

本文档详细描述了CultureBridge平台治理与代币经济相关的API接口，包括提案管理、投票、代币转账、质押和奖励等功能。

## 基础信息

- **基础URL**: `/api`
- **认证方式**: JWT Token (在请求头中添加 `Authorization: Bearer <token>`)
- **响应格式**: JSON

## 错误处理

所有API在发生错误时会返回相应的HTTP状态码和错误信息：

```json
{
  "message": "错误描述",
  "error": "详细错误信息（仅在开发环境中返回）"
}
```

常见错误码：
- `400` - 请求参数错误
- `401` - 未认证或认证失败
- `403` - 权限不足
- `404` - 资源不存在
- `500` - 服务器内部错误

## 治理API

### 1. 获取提案列表

获取平台上的治理提案列表，支持分页和筛选。

**请求**:
- 方法: `GET`
- 路径: `/governance/proposals`
- 参数:
  - `status` (可选): 提案状态筛选 (PENDING, ACTIVE, SUCCEEDED, DEFEATED, QUEUED, EXECUTED, EXPIRED, CANCELED)
  - `proposalType` (可选): 提案类型筛选 (PARAMETER_CHANGE, FEATURE_REQUEST, FUND_ALLOCATION, COMMUNITY_INITIATIVE, OTHER)
  - `page` (可选): 页码，默认为1
  - `limit` (可选): 每页数量，默认为10

**响应**:
```json
{
  "proposals": [
    {
      "proposalId": "123456789",
      "title": "增加活动验证奖励",
      "description": "提议将活动验证的奖励从5 CBT增加到10 CBT，以鼓励更多用户参与验证",
      "proposalType": "PARAMETER_CHANGE",
      "proposer": "0x1234567890abcdef1234567890abcdef12345678",
      "startBlock": 12345678,
      "endBlock": 12346678,
      "startTime": "2025-05-20T10:00:00Z",
      "endTime": "2025-05-25T10:00:00Z",
      "status": "ACTIVE",
      "forVotes": 25000,
      "againstVotes": 5000,
      "abstainVotes": 1000,
      "createdAt": "2025-05-19T08:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

### 2. 获取提案详情

获取特定提案的详细信息，包括投票情况和提案者信息。

**请求**:
- 方法: `GET`
- 路径: `/governance/proposals/:proposalId`
- 参数:
  - `proposalId`: 提案ID

**响应**:
```json
{
  "proposal": {
    "proposalId": "123456789",
    "title": "增加活动验证奖励",
    "description": "提议将活动验证的奖励从5 CBT增加到10 CBT，以鼓励更多用户参与验证",
    "proposalType": "PARAMETER_CHANGE",
    "proposer": {
      "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "username": "文化使者",
      "avatar": "https://example.com/avatar.jpg",
      "reputationScore": 850
    },
    "targets": ["0xabcdef1234567890abcdef1234567890abcdef12"],
    "values": ["0"],
    "calldatas": ["0x1234abcd..."],
    "startBlock": 12345678,
    "endBlock": 12346678,
    "startTime": "2025-05-20T10:00:00Z",
    "endTime": "2025-05-25T10:00:00Z",
    "status": "ACTIVE",
    "forVotes": 25000,
    "againstVotes": 5000,
    "abstainVotes": 1000,
    "quorum": 30000,
    "totalVotes": 31000,
    "supportRate": 80.65,
    "createdAt": "2025-05-19T08:30:00Z",
    "updatedAt": "2025-05-22T14:15:00Z"
  }
}
```

### 3. 创建提案

创建新的治理提案，需要用户拥有足够的投票权重。

**请求**:
- 方法: `POST`
- 路径: `/governance/proposals`
- 认证: 需要
- 内容类型: `application/json`
- 请求体:
```json
{
  "title": "增加活动验证奖励",
  "description": "提议将活动验证的奖励从5 CBT增加到10 CBT，以鼓励更多用户参与验证",
  "proposalType": "PARAMETER_CHANGE",
  "targets": ["0xabcdef1234567890abcdef1234567890abcdef12"],
  "values": ["0"],
  "calldatas": ["0x1234abcd..."]
}
```

**响应**:
```json
{
  "message": "提案创建成功",
  "proposal": {
    "id": "123456789",
    "title": "增加活动验证奖励",
    "description": "提议将活动验证的奖励从5 CBT增加到10 CBT，以鼓励更多用户参与验证",
    "proposalType": "PARAMETER_CHANGE",
    "startBlock": 12345678,
    "endBlock": 12346678,
    "startTime": "2025-05-20T10:00:00Z",
    "endTime": "2025-05-25T10:00:00Z",
    "status": "PENDING",
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }
}
```

### 4. 投票

对活跃状态的提案进行投票。

**请求**:
- 方法: `POST`
- 路径: `/governance/vote`
- 认证: 需要
- 内容类型: `application/json`
- 请求体:
```json
{
  "proposalId": "123456789",
  "support": "FOR" // 可选值: FOR, AGAINST, ABSTAIN
}
```

**响应**:
```json
{
  "message": "投票成功",
  "vote": {
    "proposalId": "123456789",
    "voter": "0x1234567890abcdef1234567890abcdef12345678",
    "support": "FOR",
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  },
  "currentVotes": {
    "forVotes": 25100,
    "againstVotes": 5000,
    "abstainVotes": 1000,
    "totalVotes": 31100
  }
}
```

### 5. 执行提案

执行已通过的提案，仅管理员可操作。

**请求**:
- 方法: `POST`
- 路径: `/governance/proposals/:proposalId/execute`
- 认证: 需要（管理员权限）
- 参数:
  - `proposalId`: 提案ID

**响应**:
```json
{
  "message": "提案执行成功",
  "proposal": {
    "id": "123456789",
    "title": "增加活动验证奖励",
    "status": "EXECUTED",
    "executionTime": "2025-05-26T10:15:00Z",
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }
}
```

### 6. 获取用户提案

获取当前用户创建的所有提案。

**请求**:
- 方法: `GET`
- 路径: `/governance/user/proposals`
- 认证: 需要

**响应**:
```json
{
  "proposals": [
    {
      "proposalId": "123456789",
      "title": "增加活动验证奖励",
      "description": "提议将活动验证的奖励从5 CBT增加到10 CBT，以鼓励更多用户参与验证",
      "proposalType": "PARAMETER_CHANGE",
      "status": "ACTIVE",
      "forVotes": 25000,
      "againstVotes": 5000,
      "abstainVotes": 1000,
      "createdAt": "2025-05-19T08:30:00Z"
    }
  ]
}
```

### 7. 获取治理统计信息

获取平台治理相关的统计数据。

**请求**:
- 方法: `GET`
- 路径: `/governance/stats`

**响应**:
```json
{
  "proposals": {
    "total": 42,
    "active": 5,
    "executed": 28,
    "byType": {
      "PARAMETER_CHANGE": 15,
      "FEATURE_REQUEST": 12,
      "FUND_ALLOCATION": 10,
      "COMMUNITY_INITIATIVE": 5
    }
  },
  "token": {
    "totalSupply": "100000000",
    "totalStaked": "35000000",
    "participationRate": "35.00"
  }
}
```

## 代币API

### 1. 获取用户代币余额

获取当前用户的代币余额、质押和奖励信息。

**请求**:
- 方法: `GET`
- 路径: `/token/balance`
- 认证: 需要

**响应**:
```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "balance": "1000.5",
  "staked": "500.0",
  "votingPower": "650.0",
  "rewards": "25.75"
}
```

### 2. 转移代币

将代币转移给其他用户。

**请求**:
- 方法: `POST`
- 路径: `/token/transfer`
- 认证: 需要
- 内容类型: `application/json`
- 请求体:
```json
{
  "to": "0xabcdef1234567890abcdef1234567890abcdef12",
  "amount": "50.5",
  "reason": "活动奖励"
}
```

**响应**:
```json
{
  "message": "转账成功",
  "transaction": {
    "from": "0x1234567890abcdef1234567890abcdef12345678",
    "to": "0xabcdef1234567890abcdef1234567890abcdef12",
    "amount": "50.5",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }
}
```

### 3. 质押代币

质押代币以获取投票权和奖励。

**请求**:
- 方法: `POST`
- 路径: `/token/stake`
- 认证: 需要
- 内容类型: `application/json`
- 请求体:
```json
{
  "amount": "100.0",
  "lockPeriodIndex": 2
}
```

**响应**:
```json
{
  "message": "质押成功",
  "stake": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "amount": "100.0",
    "lockPeriodIndex": 2,
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }
}
```

### 4. 获取质押信息

获取当前用户的质押详情。

**请求**:
- 方法: `GET`
- 路径: `/token/stake`
- 认证: 需要

**响应**:
```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "stakeInfo": {
    "amount": "600.0",
    "startTime": "2025-04-15T08:30:00Z",
    "lastRewardTime": "2025-05-24T14:20:00Z",
    "accumulatedRewards": "30.5",
    "lockPeriodIndex": 2,
    "lockEndTime": "2025-07-15T08:30:00Z",
    "lockPeriod": {
      "days": 90,
      "multiplier": 1.5,
      "name": "90天"
    }
  }
}
```

### 5. 领取奖励

领取质押奖励。

**请求**:
- 方法: `POST`
- 路径: `/token/rewards/claim`
- 认证: 需要

**响应**:
```json
{
  "message": "奖励领取成功",
  "reward": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "amount": "30.5",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }
}
```

### 6. 获取交易历史

获取当前用户的代币交易历史。

**请求**:
- 方法: `GET`
- 路径: `/token/transactions`
- 认证: 需要
- 参数:
  - `page` (可选): 页码，默认为1
  - `limit` (可选): 每页数量，默认为10
  - `type` (可选): 交易类型筛选 (TRANSFER, MINT, BURN, STAKE, UNSTAKE, REWARD, GOVERNANCE)

**响应**:
```json
{
  "transactions": [
    {
      "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "from": "0x1234567890abcdef1234567890abcdef12345678",
      "to": "0xabcdef1234567890abcdef1234567890abcdef12",
      "amount": "50.5",
      "tokenType": "CBT",
      "transactionType": "TRANSFER",
      "status": "CONFIRMED",
      "timestamp": "2025-05-24T10:15:30Z",
      "reason": "活动奖励"
    }
  ],
  "pagination": {
    "total": 28,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

### 7. 获取代币统计信息

获取平台代币相关的统计数据。

**请求**:
- 方法: `GET`
- 路径: `/token/stats`

**响应**:
```json
{
  "supply": {
    "total": "100000000",
    "staked": "35000000",
    "stakingRate": "35.00"
  },
  "transactions": {
    "transfer": 1250,
    "stake": 450,
    "reward": 380,
    "total": 2080
  },
  "recent": [
    {
      "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "from": "0x1234567890abcdef1234567890abcdef12345678",
      "to": "0xabcdef1234567890abcdef1234567890abcdef12",
      "amount": "50.5",
      "tokenType": "CBT",
      "transactionType": "TRANSFER",
      "timestamp": "2025-05-24T10:15:30Z"
    }
  ]
}
```

## 锁定期选项

质押代币时可选择的锁定期及其对应的奖励倍数：

| 索引 | 锁定期 | 奖励倍数 | 名称 |
|------|--------|----------|------|
| 0    | 0天    | 1.0倍    | 无锁定 |
| 1    | 30天   | 1.2倍    | 30天 |
| 2    | 90天   | 1.5倍    | 90天 |
| 3    | 180天  | 2.0倍    | 180天 |
| 4    | 365天  | 3.0倍    | 365天 |

## 提案类型

平台支持的提案类型及其说明：

| 类型 | 说明 |
|------|------|
| PARAMETER_CHANGE | 参数调整提案，用于修改平台参数 |
| FEATURE_REQUEST | 功能请求提案，用于建议新功能或改进现有功能 |
| FUND_ALLOCATION | 资金分配提案，用于申请社区治理池资金 |
| COMMUNITY_INITIATIVE | 社区倡议提案，用于社区活动和倡议 |
| OTHER | 其他类型提案 |

## 提案状态

提案在生命周期中的可能状态：

| 状态 | 说明 |
|------|------|
| PENDING | 等待中，提案已创建但尚未进入投票期 |
| ACTIVE | 活跃中，提案正在投票期内 |
| SUCCEEDED | 已通过，提案投票通过但尚未执行 |
| DEFEATED | 已拒绝，提案投票未通过 |
| QUEUED | 已排队，提案通过并等待执行 |
| EXECUTED | 已执行，提案已成功执行 |
| EXPIRED | 已过期，提案通过但未在有效期内执行 |
| CANCELED | 已取消，提案被取消 |

## 业务流程示例

### 提案创建与投票流程

1. 用户创建提案：
   - 调用 `POST /governance/proposals` 接口
   - 提供提案标题、描述、类型和执行参数
   - 系统检查用户投票权重是否满足提案门槛
   - 提案创建成功后进入等待期

2. 提案进入投票期：
   - 系统自动在达到开始区块后将提案状态更新为 ACTIVE
   - 用户可通过 `GET /governance/proposals/:proposalId` 查看提案状态

3. 用户投票：
   - 调用 `POST /governance/vote` 接口
   - 提供提案ID和投票选项（支持、反对或弃权）
   - 系统记录投票并更新提案投票数据

4. 提案结果处理：
   - 投票期结束后，系统自动计算结果
   - 如果提案通过（支持票超过反对票且达到法定人数），状态更新为 SUCCEEDED
   - 如果提案未通过，状态更新为 DEFEATED

5. 提案执行：
   - 管理员调用 `POST /governance/proposals/:proposalId/execute` 接口
   - 系统执行提案内容并更新状态为 EXECUTED

### 代币质押与奖励流程

1. 用户质押代币：
   - 调用 `POST /token/stake` 接口
   - 提供质押金额和锁定期选项
   - 系统锁定用户代币并开始计算奖励

2. 查看质押信息：
   - 调用 `GET /token/stake` 接口
   - 获取质押金额、开始时间、累计奖励和锁定期信息

3. 领取奖励：
   - 调用 `POST /token/rewards/claim` 接口
   - 系统计算并发放累计奖励

4. 查看交易历史：
   - 调用 `GET /token/transactions` 接口
   - 筛选特定类型的交易记录

## 注意事项

1. 所有涉及区块链交互的操作都需要等待交易确认，可能需要一定时间
2. 投票权重受用户代币余额、质押量、锁定期和声誉分数影响
3. 提案创建需要满足最低投票权重门槛
4. 提案执行需要管理员权限
5. 代币转账和质押操作不可逆，请谨慎操作
6. 锁定期内的质押代币无法取消质押
