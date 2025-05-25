// src/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.routes');
const blockchainRoutes = require('./routes/blockchain.routes');
const activityRoutes = require('./routes/activity.routes');
const nftRoutes = require('./routes/nft.routes');
const governanceRoutes = require('./routes/governance.routes');
const tokenRoutes = require('./routes/token.routes');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 连接数据库
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('成功连接到MongoDB');
})
.catch(err => {
  console.error('MongoDB连接失败:', err);
  process.exit(1);
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/token', tokenRoutes);

// 根路由
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to CultureBridge API' });
});

// 启动服务器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;
