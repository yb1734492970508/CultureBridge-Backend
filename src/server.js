require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

// 导入路由
const authRoutes = require('./routes/auth.routes');
const blockchainRoutes = require('./routes/blockchain.routes');
const activityRoutes = require('./routes/activity.routes');
const nftRoutes = require('./routes/nft.routes');

// 初始化区块链服务
const blockchainService = require('./blockchain/service');

// 初始化Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/nft', nftRoutes);

// 根路由
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to CultureBridge API' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // 初始化区块链服务
  const network = process.env.NODE_ENV === 'production' ? 'polygon' : 'mumbai';
  blockchainService.initialize(network)
    .then(success => {
      if (success) {
        console.log(`区块链服务已初始化，连接到 ${network} 网络`);
      } else {
        console.warn('区块链服务初始化失败，部分功能可能不可用');
      }
    })
    .catch(err => {
      console.error('区块链服务初始化错误:', err);
    });
});

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/culturebridge', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

module.exports = app;
