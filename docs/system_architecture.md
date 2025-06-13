# CultureBridge 系统架构设计文档

## 项目概述

CultureBridge是一个基于BNB链区块链技术的跨文化交流平台，旨在通过CBT代币激励机制促进全球用户的文化交流和语言学习。平台集成了实时聊天、语音翻译、文化资源分享等功能，为用户提供沉浸式的跨文化学习体验。

## 系统架构设计

### 整体架构

CultureBridge采用微服务架构设计，主要包含以下核心模块：

1. **用户认证与管理模块** - 处理用户注册、登录、个人资料管理
2. **区块链集成模块** - 管理CBT代币交易、钱包操作、智能合约交互
3. **实时通信模块** - 提供聊天室、私聊、群组聊天功能
4. **语音翻译模块** - 集成语音识别、文本翻译、语音合成服务
5. **文化交流模块** - 管理论坛、话题、帖子、评论
6. **学习资源模块** - 提供语言学习材料、文化资源分享
7. **活动管理模块** - 组织文化活动、语言交换活动
8. **社区管理模块** - 管理用户社区、兴趣小组

### 技术栈选择

#### 后端技术栈
- **Node.js** - 服务器运行环境，提供高性能的异步I/O处理
- **Express.js** - Web应用框架，简化API开发
- **MongoDB** - NoSQL数据库，适合存储用户生成内容和社交数据
- **Mongoose** - MongoDB对象建模工具
- **Socket.io** - 实时双向通信库，支持WebSocket和轮询
- **JWT** - 无状态用户认证
- **Bcrypt** - 密码加密
- **Multer** - 文件上传处理

#### 区块链技术栈
- **BNB Smart Chain** - 主要区块链网络，提供低费用、高性能的交易
- **Web3.js** - 与区块链交互的JavaScript库
- **Ethers.js** - 现代化的以太坊库，提供更好的TypeScript支持
- **Solidity** - 智能合约开发语言
- **OpenZeppelin** - 安全的智能合约库

#### 语音翻译技术栈
- **Google Cloud Speech-to-Text** - 语音识别服务
- **Google Translate API** - 文本翻译服务
- **Google Cloud Text-to-Speech** - 语音合成服务
- **WebRTC** - 实时音视频通信

## 数据库设计

### 用户相关集合

#### Users集合
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String, // 加密存储
  role: String, // 'user' | 'admin'
  walletAddress: String, // BNB链钱包地址
  privateKey: String, // 加密存储的私钥
  nativeLanguages: [String],
  learningLanguages: [String],
  languageProficiency: [{
    language: String,
    level: String // 'beginner' | 'intermediate' | 'advanced' | 'native'
  }],
  tokenRewards: [{
    amount: Number,
    reason: String,
    transactionHash: String,
    timestamp: Date
  }],
  tokenTransfers: [{
    from: String,
    to: String,
    amount: Number,
    purpose: String,
    category: String,
    tags: [String],
    transactionHash: String,
    blockchainTransactionId: Number,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

#### Profiles集合
```javascript
{
  _id: ObjectId,
  user: ObjectId, // 关联Users
  firstName: String,
  lastName: String,
  avatar: String, // 头像URL
  bio: String,
  country: String,
  city: String,
  timezone: String,
  interests: [String],
  culturalBackground: String,
  socialLinks: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
  },
  privacySettings: {
    showEmail: Boolean,
    showLocation: Boolean,
    allowDirectMessages: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 聊天相关集合

#### ChatRooms集合
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  type: String, // 'public' | 'private' | 'group'
  creator: ObjectId, // 关联Users
  members: [ObjectId], // 关联Users
  admins: [ObjectId], // 关联Users
  language: String, // 主要使用语言
  category: String, // 'cultural_exchange' | 'language_learning' | 'general'
  settings: {
    maxMembers: Number,
    allowVoiceTranslation: Boolean,
    autoTranslate: Boolean,
    moderationLevel: String // 'none' | 'basic' | 'strict'
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### ChatMessages集合
```javascript
{
  _id: ObjectId,
  chatRoom: ObjectId, // 关联ChatRooms
  sender: ObjectId, // 关联Users
  content: {
    text: String,
    originalText: String, // 翻译前的原文
    originalLanguage: String,
    translatedVersions: [{
      language: String,
      text: String,
      confidence: Number
    }],
    audioUrl: String, // 语音消息URL
    audioTranscript: String, // 语音转文字
    attachments: [{
      type: String, // 'image' | 'file' | 'video'
      url: String,
      filename: String,
      size: Number
    }]
  },
  messageType: String, // 'text' | 'voice' | 'image' | 'file' | 'system'
  replyTo: ObjectId, // 关联ChatMessages，回复消息
  reactions: [{
    user: ObjectId,
    emoji: String,
    timestamp: Date
  }],
  isEdited: Boolean,
  editHistory: [{
    content: String,
    timestamp: Date
  }],
  isDeleted: Boolean,
  timestamp: Date
}
```

### 文化交流相关集合

#### Topics集合
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: String, // 'culture' | 'language' | 'travel' | 'food' | 'tradition'
  tags: [String],
  user: ObjectId, // 关联Users，创建者
  language: String,
  isSticky: Boolean, // 置顶
  isLocked: Boolean, // 锁定
  viewCount: Number,
  postCount: Number,
  lastActivity: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Posts集合
```javascript
{
  _id: ObjectId,
  title: String,
  content: String,
  topic: ObjectId, // 关联Topics
  user: ObjectId, // 关联Users
  language: String,
  translatedVersions: [{
    language: String,
    title: String,
    content: String
  }],
  attachments: [{
    type: String,
    url: String,
    filename: String
  }],
  likes: [ObjectId], // 关联Users
  dislikes: [ObjectId], // 关联Users
  commentCount: Number,
  viewCount: Number,
  isEdited: Boolean,
  editHistory: [{
    content: String,
    timestamp: Date
  }],
  isDeleted: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 学习资源相关集合

#### Resources集合
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  type: String, // 'video' | 'audio' | 'document' | 'interactive'
  category: String, // 'grammar' | 'vocabulary' | 'pronunciation' | 'culture'
  language: String, // 目标语言
  difficulty: String, // 'beginner' | 'intermediate' | 'advanced'
  user: ObjectId, // 关联Users，上传者
  fileUrl: String,
  thumbnailUrl: String,
  duration: Number, // 秒数，适用于音视频
  fileSize: Number,
  downloadCount: Number,
  rating: {
    average: Number,
    count: Number,
    ratings: [{
      user: ObjectId,
      score: Number, // 1-5
      review: String,
      timestamp: Date
    }]
  },
  tags: [String],
  isApproved: Boolean, // 管理员审核
  isPremium: Boolean, // 需要CBT代币购买
  price: Number, // CBT代币价格
  createdAt: Date,
  updatedAt: Date
}
```

### 活动相关集合

#### Events集合
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  type: String, // 'language_exchange' | 'cultural_workshop' | 'virtual_tour' | 'cooking_class'
  organizer: ObjectId, // 关联Users
  startDate: Date,
  endDate: Date,
  timezone: String,
  location: {
    type: String, // 'online' | 'offline' | 'hybrid'
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    meetingLink: String // 在线会议链接
  },
  capacity: Number,
  participants: [{
    user: ObjectId,
    registrationDate: Date,
    status: String // 'registered' | 'attended' | 'cancelled'
  }],
  languages: [String], // 涉及的语言
  requirements: String,
  materials: [String], // 需要的材料
  fee: {
    amount: Number, // CBT代币
    currency: String // 'CBT'
  },
  images: [String],
  isApproved: Boolean,
  isCancelled: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 社区相关集合

#### Communities集合
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String, // 'country' | 'language' | 'interest' | 'skill_level'
  creator: ObjectId, // 关联Users
  moderators: [ObjectId], // 关联Users
  members: [{
    user: ObjectId,
    joinDate: Date,
    role: String, // 'member' | 'moderator' | 'admin'
    isActive: Boolean
  }],
  settings: {
    isPrivate: Boolean,
    requireApproval: Boolean,
    allowPosting: String, // 'all' | 'moderators' | 'admins'
    allowInvites: Boolean
  },
  stats: {
    memberCount: Number,
    postCount: Number,
    activeMembers: Number
  },
  avatar: String,
  banner: String,
  rules: [String],
  tags: [String],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## CBT代币经济模型设计

### 代币获取机制

用户可以通过以下方式获得CBT代币：

1. **注册奖励** - 新用户注册完成个人资料后获得10 CBT
2. **每日签到** - 连续签到获得1-5 CBT，连续签到天数越多奖励越高
3. **发布优质内容** - 发布帖子、分享资源获得2-10 CBT
4. **参与讨论** - 评论、回复获得0.5-2 CBT
5. **语言学习成就** - 完成学习任务、通过测试获得5-20 CBT
6. **帮助他人** - 回答问题、提供翻译帮助获得1-5 CBT
7. **参加活动** - 参与文化活动、语言交换获得5-15 CBT
8. **邀请好友** - 成功邀请新用户注册获得20 CBT

### 代币消费场景

用户可以使用CBT代币进行以下消费：

1. **购买高级学习资源** - 付费课程、专业教材等
2. **解锁高级功能** - 高级翻译服务、语音识别等
3. **参加付费活动** - 专业讲座、一对一辅导等
4. **购买虚拟礼品** - 在聊天中发送特殊表情、礼品等
5. **提升账户等级** - 获得更多权限和特权
6. **广告推广** - 推广自己的内容或活动

### 智能合约设计

#### CBT代币合约功能

```solidity
// CBT代币主要功能
contract CBTToken {
    // 基础ERC20功能
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    // 文化交流专用功能
    function transferWithPurpose(
        address to, 
        uint256 amount, 
        string memory purpose,
        string memory category,
        string[] memory tags
    ) external returns (uint256 transactionId);
    
    // 奖励功能（仅管理员）
    function awardTokens(
        address to, 
        uint256 amount, 
        string memory reason
    ) external onlyAdmin;
    
    // 查询功能
    function getTransaction(uint256 id) external view returns (Transaction memory);
    function getUserTransactions(address user) external view returns (uint256[] memory);
    function getUserRewards(address user) external view returns (Reward[] memory);
}
```

## 语音翻译系统设计

### 语音翻译流程

1. **语音采集** - 使用WebRTC API采集用户语音
2. **语音上传** - 将音频数据上传到服务器
3. **语音识别** - 调用Google Cloud Speech-to-Text API转换为文字
4. **语言检测** - 自动检测源语言
5. **文本翻译** - 调用Google Translate API翻译文本
6. **语音合成** - 调用Google Cloud Text-to-Speech API生成目标语言语音
7. **实时传输** - 通过Socket.io实时传输翻译结果

### 语音翻译API设计

#### 语音上传接口
```javascript
POST /api/v1/voice/upload
Content-Type: multipart/form-data

{
  audio: File, // 音频文件
  sourceLanguage: String, // 源语言（可选，自动检测）
  targetLanguage: String, // 目标语言
  chatRoomId: String // 聊天室ID
}

Response:
{
  success: true,
  data: {
    transcription: String, // 语音转文字结果
    translation: String, // 翻译结果
    audioUrl: String, // 合成语音URL
    confidence: Number, // 识别置信度
    detectedLanguage: String // 检测到的源语言
  }
}
```

#### 实时语音翻译接口
```javascript
// Socket.io事件
socket.emit('voice:start', {
  chatRoomId: String,
  targetLanguage: String
});

socket.on('voice:chunk', {
  audioChunk: ArrayBuffer,
  isLast: Boolean
});

socket.on('voice:result', {
  transcription: String,
  translation: String,
  audioUrl: String,
  timestamp: Date
});
```

### 语音翻译服务实现

#### VoiceTranslationService类
```javascript
class VoiceTranslationService {
    constructor() {
        this.speechClient = new speech.SpeechClient();
        this.translateClient = new translate.Translate();
        this.ttsClient = new textToSpeech.TextToSpeechClient();
    }
    
    async transcribeAudio(audioBuffer, language = 'auto') {
        // 语音转文字实现
    }
    
    async translateText(text, sourceLanguage, targetLanguage) {
        // 文本翻译实现
    }
    
    async synthesizeSpeech(text, language, voiceType = 'neutral') {
        // 文字转语音实现
    }
    
    async processVoiceMessage(audioBuffer, sourceLanguage, targetLanguage) {
        // 完整的语音翻译流程
    }
}
```

## 实时通信系统设计

### Socket.io事件设计

#### 聊天相关事件
```javascript
// 加入聊天室
socket.emit('chat:join', { roomId: String, userId: String });

// 发送消息
socket.emit('chat:message', {
  roomId: String,
  content: String,
  type: 'text' | 'voice' | 'image',
  replyTo: String // 可选，回复消息ID
});

// 接收消息
socket.on('chat:message', {
  messageId: String,
  sender: Object,
  content: String,
  translations: Array,
  timestamp: Date
});

// 用户状态
socket.emit('user:status', { status: 'online' | 'away' | 'busy' });
socket.on('user:status', { userId: String, status: String });

// 输入状态
socket.emit('chat:typing', { roomId: String, isTyping: Boolean });
socket.on('chat:typing', { userId: String, isTyping: Boolean });
```

#### 语音翻译相关事件
```javascript
// 开始语音翻译
socket.emit('voice:start', {
  roomId: String,
  targetLanguage: String
});

// 语音数据流
socket.emit('voice:stream', {
  audioChunk: ArrayBuffer,
  sequence: Number
});

// 结束语音翻译
socket.emit('voice:end', { roomId: String });

// 接收翻译结果
socket.on('voice:translation', {
  originalText: String,
  translatedText: String,
  audioUrl: String,
  confidence: Number
});
```

### 消息队列设计

为了处理高并发的实时消息，系统将使用Redis作为消息队列：

1. **消息缓存** - 临时存储待处理的消息
2. **用户状态管理** - 跟踪在线用户状态
3. **房间管理** - 管理聊天室成员列表
4. **消息分发** - 确保消息正确分发到所有房间成员

## 安全性设计

### 用户认证与授权

1. **JWT令牌** - 使用JSON Web Token进行无状态认证
2. **刷新令牌** - 实现令牌自动刷新机制
3. **角色权限** - 基于角色的访问控制（RBAC）
4. **API限流** - 防止API滥用和DDoS攻击

### 区块链安全

1. **私钥管理** - 私钥加密存储，不在客户端暴露
2. **交易验证** - 所有区块链交易都需要验证签名
3. **智能合约审计** - 定期进行安全审计
4. **多重签名** - 重要操作需要多重签名确认

### 数据安全

1. **数据加密** - 敏感数据加密存储
2. **HTTPS** - 所有通信使用HTTPS加密
3. **输入验证** - 严格验证所有用户输入
4. **SQL注入防护** - 使用参数化查询防止注入攻击

## 性能优化设计

### 数据库优化

1. **索引优化** - 为常用查询字段创建索引
2. **分片策略** - 大型集合使用分片提高性能
3. **缓存策略** - 使用Redis缓存热点数据
4. **连接池** - 优化数据库连接管理

### API性能优化

1. **分页查询** - 大数据量查询使用分页
2. **字段选择** - 只返回必要的字段
3. **压缩传输** - 启用Gzip压缩
4. **CDN加速** - 静态资源使用CDN分发

### 实时通信优化

1. **连接管理** - 优化WebSocket连接数量
2. **消息压缩** - 压缩传输的消息内容
3. **负载均衡** - 多服务器负载均衡
4. **消息去重** - 防止重复消息发送

## 监控与日志设计

### 系统监控

1. **性能监控** - 监控API响应时间、数据库查询性能
2. **错误监控** - 实时监控系统错误和异常
3. **用户行为监控** - 跟踪用户使用模式
4. **区块链监控** - 监控代币交易和智能合约状态

### 日志管理

1. **结构化日志** - 使用JSON格式记录日志
2. **日志分级** - 按重要性分级记录日志
3. **日志聚合** - 集中收集和分析日志
4. **日志保留** - 设置合理的日志保留策略

这个系统架构设计为CultureBridge项目提供了完整的技术框架，涵盖了区块链集成、实时通信、语音翻译等核心功能。通过模块化设计和微服务架构，系统具有良好的可扩展性和维护性，能够支持大规模用户的跨文化交流需求。

