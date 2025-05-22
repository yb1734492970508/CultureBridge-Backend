# CultureBridge区块链API文档

## 概述

本文档描述了CultureBridge平台的区块链API接口，用于前端与区块链系统的集成。这些API基于Web3.js库实现，提供了与BNB Chain上部署的智能合约交互的能力。

## 合约地址配置

在使用API之前，需要配置以下合约地址：

```javascript
const contractAddresses = {
  identity: "0x...", // 身份合约地址
  asset: "0x...",    // 资产合约地址
  exchange: "0x...", // 交流合约地址
  token: "0x...",    // 代币合约地址
  marketplace: "0x..." // 市场合约地址
};
```

## 初始化Web3服务

```javascript
const Web3Service = require('./services/web3Service');

// 初始化Web3服务
const web3Service = new Web3Service(
  'https://data-seed-prebsc-1-s1.binance.org:8545/', // BNB Chain测试网
  contractAddresses
);

// 设置用户账户
web3Service.setAccount('0x...'); // 用户钱包地址
```

## 身份管理API

### 注册用户

```javascript
/**
 * 注册新用户
 * @param {string} name - 用户名
 * @param {string} email - 邮箱
 * @param {string} profileUri - 个人资料URI（IPFS）
 * @returns {Promise<object>} 交易收据
 */
async function registerUser(name, email, profileUri) {
  try {
    const receipt = await web3Service.registerUser(name, email, profileUri);
    return receipt;
  } catch (error) {
    console.error('注册用户失败:', error);
    throw error;
  }
}
```

### 获取用户信息

```javascript
/**
 * 获取用户信息
 * @param {string} address - 用户地址（可选，默认为当前账户）
 * @returns {Promise<object>} 用户信息
 */
async function getUserInfo(address = null) {
  try {
    const userInfo = await web3Service.getUserInfo(address);
    return userInfo;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
}
```

### 更新用户资料

```javascript
/**
 * 更新用户资料
 * @param {string} name - 新用户名
 * @param {string} email - 新邮箱
 * @param {string} profileUri - 新个人资料URI
 * @returns {Promise<object>} 交易收据
 */
async function updateProfile(name, email, profileUri) {
  try {
    const receipt = await web3Service.updateProfile(name, email, profileUri);
    return receipt;
  } catch (error) {
    console.error('更新用户资料失败:', error);
    throw error;
  }
}
```

## 资产管理API

### 创建文化资产

```javascript
/**
 * 创建新的文化资产
 * @param {string} assetType - 资产类型（如"Art", "Music", "Literature"等）
 * @param {string} culturalOrigin - 文化起源（如"Chinese", "Indian", "African"等）
 * @param {string} tokenUri - 代币URI（IPFS）
 * @param {string} metadataHash - 元数据哈希（IPFS）
 * @returns {Promise<object>} 交易收据
 */
async function createAsset(assetType, culturalOrigin, tokenUri, metadataHash) {
  try {
    const receipt = await web3Service.createAsset(assetType, culturalOrigin, tokenUri, metadataHash);
    return receipt;
  } catch (error) {
    console.error('创建资产失败:', error);
    throw error;
  }
}
```

### 获取资产信息

```javascript
/**
 * 获取资产详细信息
 * @param {number} tokenId - 资产ID
 * @returns {Promise<object>} 资产信息
 */
async function getAssetInfo(tokenId) {
  try {
    const assetInfo = await web3Service.getAssetInfo(tokenId);
    return assetInfo;
  } catch (error) {
    console.error('获取资产信息失败:', error);
    throw error;
  }
}
```

### 获取用户的资产

```javascript
/**
 * 获取用户拥有的所有资产
 * @param {string} address - 用户地址（可选，默认为当前账户）
 * @returns {Promise<number[]>} 资产ID数组
 */
async function getUserAssets(address = null) {
  try {
    const assetIds = await web3Service.getUserAssets(address);
    return assetIds;
  } catch (error) {
    console.error('获取用户资产失败:', error);
    throw error;
  }
}
```

## 文化交流API

### 创建文化交流

```javascript
/**
 * 创建新的文化交流活动
 * @param {string} title - 标题
 * @param {string} description - 描述
 * @param {number} startTime - 开始时间（Unix时间戳）
 * @param {number} endTime - 结束时间（Unix时间戳）
 * @param {string} category - 类别
 * @param {string[]} tags - 标签数组
 * @returns {Promise<object>} 交易收据
 */
async function createExchange(title, description, startTime, endTime, category, tags) {
  try {
    const receipt = await web3Service.createExchange(title, description, startTime, endTime, category, tags);
    return receipt;
  } catch (error) {
    console.error('创建文化交流失败:', error);
    throw error;
  }
}
```

### 加入文化交流

```javascript
/**
 * 加入现有的文化交流活动
 * @param {number} exchangeId - 交流ID
 * @returns {Promise<object>} 交易收据
 */
async function joinExchange(exchangeId) {
  try {
    const receipt = await web3Service.joinExchange(exchangeId);
    return receipt;
  } catch (error) {
    console.error('加入文化交流失败:', error);
    throw error;
  }
}
```

### 获取交流信息

```javascript
/**
 * 获取文化交流详细信息
 * @param {number} exchangeId - 交流ID
 * @returns {Promise<object>} 交流信息
 */
async function getExchangeInfo(exchangeId) {
  try {
    const exchangeInfo = await web3Service.getExchangeInfo(exchangeId);
    return exchangeInfo;
  } catch (error) {
    console.error('获取交流信息失败:', error);
    throw error;
  }
}
```

### 获取活跃的交流

```javascript
/**
 * 获取所有活跃的文化交流
 * @returns {Promise<number[]>} 交流ID数组
 */
async function getActiveExchanges() {
  try {
    const exchangeIds = await web3Service.getActiveExchanges();
    return exchangeIds;
  } catch (error) {
    console.error('获取活跃交流失败:', error);
    throw error;
  }
}
```

## 代币交易API

### 代币转账

```javascript
/**
 * 带有目的的代币转账
 * @param {string} to - 接收者地址
 * @param {string} amount - 代币数量（以CBT为单位）
 * @param {string} purpose - 转账目的
 * @param {string} category - 交易类别
 * @param {string[]} tags - 交易标签数组
 * @returns {Promise<object>} 交易收据
 */
async function transferWithPurpose(to, amount, purpose, category, tags) {
  try {
    const receipt = await web3Service.transferWithPurpose(to, amount, purpose, category, tags);
    return receipt;
  } catch (error) {
    console.error('代币转账失败:', error);
    throw error;
  }
}
```

### 获取代币余额

```javascript
/**
 * 获取用户的代币余额
 * @param {string} address - 用户地址（可选，默认为当前账户）
 * @returns {Promise<string>} 代币余额
 */
async function getTokenBalance(address = null) {
  try {
    const balance = await web3Service.getTokenBalance(address);
    return balance;
  } catch (error) {
    console.error('获取代币余额失败:', error);
    throw error;
  }
}
```

### 获取交易历史

```javascript
/**
 * 获取用户的交易历史
 * @param {string} address - 用户地址（可选，默认为当前账户）
 * @returns {Promise<number[]>} 交易ID数组
 */
async function getUserTransactions(address = null) {
  try {
    const txIds = await web3Service.getUserTransactions(address);
    return txIds;
  } catch (error) {
    console.error('获取交易历史失败:', error);
    throw error;
  }
}
```

## 市场交易API

### 挂单出售资产

```javascript
/**
 * 挂单出售资产
 * @param {number} tokenId - 资产ID
 * @param {string} price - 价格（以CBT为单位）
 * @param {string} description - 描述
 * @returns {Promise<object>} 交易收据
 */
async function listAsset(tokenId, price, description) {
  try {
    const receipt = await web3Service.listAsset(tokenId, price, description);
    return receipt;
  } catch (error) {
    console.error('挂单资产失败:', error);
    throw error;
  }
}
```

### 购买资产

```javascript
/**
 * 购买挂单资产
 * @param {number} tokenId - 资产ID
 * @returns {Promise<object>} 交易收据
 */
async function buyAsset(tokenId) {
  try {
    const receipt = await web3Service.buyAsset(tokenId);
    return receipt;
  } catch (error) {
    console.error('购买资产失败:', error);
    throw error;
  }
}
```

### 获取活跃挂单

```javascript
/**
 * 获取活跃的挂单列表
 * @param {number} start - 起始索引
 * @param {number} limit - 限制数量
 * @returns {Promise<object[]>} 挂单信息数组
 */
async function getActiveListings(start = 0, limit = 10) {
  try {
    const listings = await web3Service.getActiveListings(start, limit);
    return listings;
  } catch (error) {
    console.error('获取活跃挂单失败:', error);
    throw error;
  }
}
```

### 获取市场交易历史

```javascript
/**
 * 获取市场交易历史
 * @param {number} start - 起始索引
 * @param {number} limit - 限制数量
 * @returns {Promise<object[]>} 交易历史数组
 */
async function getTransactionHistory(start = 0, limit = 10) {
  try {
    const history = await web3Service.getTransactionHistory(start, limit);
    return history;
  } catch (error) {
    console.error('获取交易历史失败:', error);
    throw error;
  }
}
```

## 错误处理

所有API调用都应包含适当的错误处理。常见错误包括：

1. **网络错误**：与区块链网络连接失败
2. **合约错误**：智能合约执行失败
3. **权限错误**：用户没有执行操作的权限
4. **余额不足**：代币或ETH余额不足
5. **参数错误**：提供的参数无效

示例错误处理：

```javascript
try {
  const result = await someBlockchainFunction();
  // 处理成功结果
} catch (error) {
  if (error.message.includes('user rejected')) {
    // 用户拒绝交易
    console.error('用户拒绝了交易');
  } else if (error.message.includes('insufficient funds')) {
    // 余额不足
    console.error('余额不足，无法完成交易');
  } else {
    // 其他错误
    console.error('交易失败:', error);
  }
}
```

## 事件监听

可以监听智能合约事件以获取实时更新：

```javascript
// 监听资产创建事件
web3Service.assetContract.events.AssetCreated({
  fromBlock: 'latest'
})
.on('data', function(event) {
  console.log('新资产创建:', event.returnValues);
})
.on('error', console.error);
```

## 部署与环境配置

### 测试网配置

```javascript
// BNB Chain测试网
const testnetProvider = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

// 测试网合约地址
const testnetAddresses = {
  identity: "0x...",
  asset: "0x...",
  exchange: "0x...",
  token: "0x...",
  marketplace: "0x..."
};
```

### 主网配置

```javascript
// BNB Chain主网
const mainnetProvider = 'https://bsc-dataseed.binance.org/';

// 主网合约地址
const mainnetAddresses = {
  identity: "0x...",
  asset: "0x...",
  exchange: "0x...",
  token: "0x...",
  marketplace: "0x..."
};
```

## 集成示例

### 用户注册与资产创建流程

```javascript
async function registerAndCreateAsset() {
  try {
    // 1. 注册用户
    const registerReceipt = await web3Service.registerUser(
      "John Doe",
      "john@example.com",
      "ipfs://QmUserProfile"
    );
    console.log('用户注册成功:', registerReceipt);
    
    // 2. 等待验证（在实际应用中，这一步需要管理员操作）
    // ...
    
    // 3. 创建资产
    const createAssetReceipt = await web3Service.createAsset(
      "Art",
      "Chinese",
      "ipfs://QmAssetUri",
      "ipfs://QmMetadataHash"
    );
    console.log('资产创建成功:', createAssetReceipt);
    
    // 4. 获取资产ID（从事件中提取）
    const tokenId = createAssetReceipt.events.AssetCreated.returnValues.tokenId;
    
    // 5. 挂单出售资产
    const listReceipt = await web3Service.listAsset(
      tokenId,
      "10", // 10 CBT
      "Beautiful Chinese Art"
    );
    console.log('资产挂单成功:', listReceipt);
    
  } catch (error) {
    console.error('流程执行失败:', error);
  }
}
```

### 文化交流创建与参与流程

```javascript
async function createAndJoinExchange() {
  try {
    // 1. 创建文化交流
    const now = Math.floor(Date.now() / 1000);
    const oneWeekLater = now + 7 * 24 * 60 * 60;
    
    const createReceipt = await web3Service.createExchange(
      "Chinese Calligraphy Workshop",
      "Learn the art of Chinese calligraphy",
      now,
      oneWeekLater,
      "Workshop",
      ["calligraphy", "chinese", "art"]
    );
    console.log('文化交流创建成功:', createReceipt);
    
    // 2. 获取交流ID（从事件中提取）
    const exchangeId = createReceipt.events.ExchangeCreated.returnValues.exchangeId;
    
    // 3. 其他用户加入交流
    // 切换到另一个用户账户
    web3Service.setAccount('0x...'); // 另一个用户的地址
    
    const joinReceipt = await web3Service.joinExchange(exchangeId);
    console.log('加入文化交流成功:', joinReceipt);
    
  } catch (error) {
    console.error('流程执行失败:', error);
  }
}
```

## 安全考虑

1. **私钥管理**：永远不要在前端代码中硬编码私钥
2. **输入验证**：在发送到区块链之前验证所有用户输入
3. **Gas限制**：设置合理的gas限制以防止交易失败
4. **错误处理**：实现全面的错误处理策略
5. **权限检查**：在UI层实现权限检查，避免用户尝试未授权操作

## 性能优化

1. **批量查询**：使用批量查询减少网络请求
2. **缓存**：缓存不经常变化的数据
3. **事件索引**：使用事件索引加速数据检索
4. **分页**：实现分页以处理大量数据

## 附录

### 数据结构

#### 用户信息

```javascript
{
  userId: "1",
  name: "John Doe",
  email: "john@example.com",
  profileUri: "ipfs://QmUserProfile",
  isVerified: true
}
```

#### 资产信息

```javascript
{
  id: "1",
  assetType: "Art",
  culturalOrigin: "Chinese",
  creator: "0x...",
  creationTime: "1621234567",
  isVerified: true,
  metadataHash: "ipfs://QmMetadataHash"
}
```

#### 交流信息

```javascript
{
  id: "1",
  title: "Chinese Calligraphy Workshop",
  description: "Learn the art of Chinese calligraphy",
  organizer: "0x...",
  startTime: "1621234567",
  endTime: "1621834567",
  isActive: true,
  participantCount: "5",
  assetCount: "3",
  category: "Workshop"
}
```

#### 交易信息

```javascript
{
  id: "1",
  from: "0x...",
  to: "0x...",
  amount: "10",
  purpose: "Payment for calligraphy lesson",
  timestamp: "1621234567",
  category: "Education"
}
```

#### 挂单信息

```javascript
{
  tokenId: "1",
  seller: "0x...",
  price: "10",
  isActive: true,
  listedAt: "1621234567",
  description: "Beautiful Chinese Art"
}
```
