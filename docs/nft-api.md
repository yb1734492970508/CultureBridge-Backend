# CultureBridge NFT API文档

## 概述

CultureBridge NFT API提供了完整的文化资产NFT管理功能，包括铸造、查询、验证、交易和活动关联等操作。本文档详细说明了各API端点的使用方法、参数要求和响应格式。

## 基础URL

```
https://api.culturebridge.com/api/nft
```

## 认证

除了公开的查询接口外，大多数API端点需要JWT认证。请在HTTP请求头中添加以下字段：

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API端点

### 1. NFT铸造

#### 铸造新NFT

```
POST /mint
```

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| name | String | 是 | NFT资产名称 |
| description | String | 是 | NFT资产描述 |
| assetType | String | 是 | 资产类型，可选值：ARTWORK, CERTIFICATE, COLLECTIBLE, SOUVENIR, HERITAGE |
| culturalTags | Array | 否 | 文化标签数组 |
| rarity | Number | 否 | 稀有度，0-100 |
| mediaUrl | String | 是 | 媒体文件URL |
| thumbnailUrl | String | 否 | 缩略图URL |
| mediaType | String | 否 | 媒体类型，默认为IMAGE，可选值：IMAGE, VIDEO, AUDIO, DOCUMENT, OTHER |

**响应示例**

```json
{
  "success": true,
  "message": "NFT铸造成功",
  "data": {
    "tokenId": "1",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "metadataURI": "ipfs://QmXyZ...",
    "asset": {
      "tokenId": 1,
      "name": "传统京剧面具",
      "description": "代表中国传统文化的京剧面具艺术品",
      "assetType": "ARTWORK",
      "creator": "0x1234...",
      "owner": "0x1234...",
      "mintedAt": "2025-05-24T13:45:00.000Z",
      "contractAddress": "0xabcd...",
      "mintTxHash": "0x1234...",
      "tokenURI": "ipfs://QmXyZ...",
      "culturalTags": ["京剧", "面具", "传统艺术"],
      "rarity": 85,
      "mediaType": "IMAGE",
      "mediaUrl": "https://example.com/image.jpg",
      "thumbnailUrl": "https://example.com/thumbnail.jpg"
    }
  }
}
```

#### 为活动铸造NFT

```
POST /mint/activity
```

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| name | String | 是 | NFT资产名称 |
| description | String | 是 | NFT资产描述 |
| assetType | String | 是 | 资产类型 |
| culturalTags | Array | 否 | 文化标签数组 |
| rarity | Number | 否 | 稀有度 |
| mediaUrl | String | 是 | 媒体文件URL |
| thumbnailUrl | String | 否 | 缩略图URL |
| mediaType | String | 否 | 媒体类型 |
| activityId | String | 是 | 活动ID |
| recipientAddress | String | 否 | 接收者钱包地址，默认为创建者地址 |

**响应格式**

与铸造新NFT相同，但包含活动关联信息。

#### 批量铸造NFT

```
POST /mint/batch
```

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| assets | Array | 是 | NFT资产数组，每个元素包含单个NFT的所有参数 |

**响应示例**

```json
{
  "success": true,
  "message": "批量铸造NFT成功",
  "data": {
    "tokenIds": ["1", "2", "3"],
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "assets": [...]
  }
}
```

### 2. NFT查询

#### 获取NFT详情

```
GET /token/:tokenId
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | String | NFT代币ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "tokenId": 1,
    "name": "传统京剧面具",
    "description": "代表中国传统文化的京剧面具艺术品",
    "assetType": "ARTWORK",
    "creator": "0x1234...",
    "owner": "0x1234...",
    "mintedAt": "2025-05-24T13:45:00.000Z",
    "contractAddress": "0xabcd...",
    "mintTxHash": "0x1234...",
    "tokenURI": "ipfs://QmXyZ...",
    "culturalTags": ["京剧", "面具", "传统艺术"],
    "rarity": 85,
    "verificationStatus": "VERIFIED",
    "verifier": "0x5678...",
    "verifiedAt": "2025-05-24T14:30:00.000Z",
    "mediaType": "IMAGE",
    "mediaUrl": "https://example.com/image.jpg",
    "thumbnailUrl": "https://example.com/thumbnail.jpg",
    "isListed": true,
    "listingPrice": 0.5,
    "listingCurrency": "MATIC",
    "transferHistory": [...],
    "creatorInfo": {
      "id": "60d21b4667d0d8992e610c85",
      "username": "文化创作者",
      "avatar": "https://example.com/avatar.jpg"
    },
    "ownerInfo": {
      "id": "60d21b4667d0d8992e610c85",
      "username": "文化收藏家",
      "avatar": "https://example.com/avatar.jpg"
    },
    "activityInfo": {
      "id": "60d21b4667d0d8992e610c86",
      "title": "2025年春节文化节",
      "date": "2025-02-01T00:00:00.000Z",
      "location": "北京"
    },
    "onchainData": {...}
  }
}
```

#### 获取NFT列表

```
GET /
```

**查询参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | Number | 否 | 页码，默认为1 |
| limit | Number | 否 | 每页数量，默认为10 |
| sort | String | 否 | 排序字段，默认为createdAt |
| order | String | 否 | 排序方向，asc或desc，默认为desc |
| assetType | String | 否 | 按资产类型筛选 |
| tag | String | 否 | 按文化标签筛选 |
| verified | Boolean | 否 | 按验证状态筛选 |
| listed | Boolean | 否 | 按上架状态筛选 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "assets": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "pages": 10
    }
  }
}
```

#### 获取用户创建的NFT

```
GET /user/:userId/created
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| userId | String | 用户ID |

**查询参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | Number | 否 | 页码，默认为1 |
| limit | Number | 否 | 每页数量，默认为10 |

**响应格式**

与获取NFT列表相同。

#### 获取用户拥有的NFT

```
GET /user/:userId/owned
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| userId | String | 用户ID |

**查询参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | Number | 否 | 页码，默认为1 |
| limit | Number | 否 | 每页数量，默认为10 |

**响应格式**

与获取NFT列表相同。

#### 获取活动关联的NFT

```
GET /activity/:activityId
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| activityId | String | 活动ID |

**查询参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | Number | 否 | 页码，默认为1 |
| limit | Number | 否 | 每页数量，默认为10 |

**响应格式**

与获取NFT列表相同。

#### 获取市场上的NFT

```
GET /market
```

**查询参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | Number | 否 | 页码，默认为1 |
| limit | Number | 否 | 每页数量，默认为10 |
| sort | String | 否 | 排序字段，默认为listingPrice |
| order | String | 否 | 排序方向，asc或desc，默认为asc |
| assetType | String | 否 | 按资产类型筛选 |
| minPrice | Number | 否 | 最低价格 |
| maxPrice | Number | 否 | 最高价格 |
| tags | String | 否 | 按文化标签筛选，多个标签用逗号分隔 |

**响应格式**

与获取NFT列表相同。

#### 获取NFT统计信息

```
GET /stats
```

**响应示例**

```json
{
  "success": true,
  "data": {
    "totalNFTs": 1000,
    "verifiedNFTs": 800,
    "listedNFTs": 150,
    "assetTypeCounts": {
      "ARTWORK": 500,
      "CERTIFICATE": 200,
      "COLLECTIBLE": 150,
      "SOUVENIR": 100,
      "HERITAGE": 50
    },
    "popularTags": [
      { "tag": "传统文化", "count": 300 },
      { "tag": "京剧", "count": 150 },
      { "tag": "书法", "count": 120 }
    ],
    "recentNFTs": [...],
    "valuableNFTs": [...]
  }
}
```

### 3. NFT操作

#### 验证NFT

```
POST /token/:tokenId/verify
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | String | NFT代币ID |

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| status | String | 是 | 验证状态，可选值：PENDING, VERIFIED, REJECTED |

**响应示例**

```json
{
  "success": true,
  "message": "NFT验证成功",
  "data": {
    "tokenId": "1",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "status": "VERIFIED",
    "verifier": "0x5678..."
  }
}
```

#### 将NFT关联到活动

```
POST /token/:tokenId/link
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | String | NFT代币ID |

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| activityId | String | 是 | 活动ID |

**响应示例**

```json
{
  "success": true,
  "message": "NFT关联到活动成功",
  "data": {
    "tokenId": "1",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "activityId": "60d21b4667d0d8992e610c86",
    "activityTitle": "2025年春节文化节"
  }
}
```

#### 上架NFT到市场

```
POST /token/:tokenId/market
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | String | NFT代币ID |

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| price | Number | 是 | 上架价格 |
| currency | String | 否 | 货币类型，默认为MATIC |

**响应示例**

```json
{
  "success": true,
  "message": "NFT上架成功",
  "data": {
    "tokenId": "1",
    "price": 0.5,
    "currency": "MATIC",
    "listedAt": "2025-05-24T15:30:00.000Z"
  }
}
```

#### 从市场下架NFT

```
DELETE /token/:tokenId/market
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | String | NFT代币ID |

**响应示例**

```json
{
  "success": true,
  "message": "NFT下架成功",
  "data": {
    "tokenId": "1",
    "delistedAt": "2025-05-24T16:00:00.000Z"
  }
}
```

#### 销毁NFT

```
DELETE /token/:tokenId
```

**路径参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | String | NFT代币ID |

**响应示例**

```json
{
  "success": true,
  "message": "NFT销毁成功",
  "data": {
    "tokenId": "1",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "destroyedAt": "2025-05-24T16:30:00.000Z"
  }
}
```

## 错误处理

所有API端点在发生错误时都会返回一个包含错误信息的JSON响应：

```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息"
}
```

常见HTTP状态码：

- 200: 请求成功
- 201: 资源创建成功
- 400: 请求参数错误
- 401: 未认证
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误

## 链上数据同步

系统会自动同步链上数据与数据库记录，确保数据一致性。在获取NFT详情时，系统会检查链上最新状态并更新数据库记录。
