const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const advancedResults = require('./middleware/advancedResults');
const { securityMiddleware } = require('./middleware/security');

// 导入模型
const User = require('./models/User');
const Profile = require('./models/Profile');
const Topic = require('./models/Topic');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const Resource = require('./models/Resource');
const Event = require('./models/Event');
const Community = require('./models/Community');
const Message = require('./models/Message');

// 导入路由文件
const auth = require('./routes/auth');
const profiles = require('./routes/profiles');
const topics = require('./routes/topics');
const posts = require('./routes/posts');
const comments = require('./routes/comments');
const resources = require('./routes/resources');
const events = require('./routes/events');
const communities = require('./routes/communities');
const messages = require('./routes/messages');

// 加载环境变量
dotenv.config();

// 连接数据库
connectDB();

// 初始化Express应用
const app = express();

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 应用安全中间件
securityMiddleware(app);

// 设置静态文件夹
app.use('/uploads', express.static('uploads'));

// 路由
app.get('/', (req, res) => {
  res.send('CultureBridge API 运行中...');
});

// 挂载路由
app.use('/api/v1/auth', auth);
app.use('/api/v1/profiles', advancedResults(Profile, { path: 'user', select: 'username email' }), profiles);
app.use('/api/v1/topics', advancedResults(Topic, { path: 'user', select: 'username' }), topics);
app.use('/api/v1/posts', advancedResults(Post, [
  { path: 'user', select: 'username' },
  { path: 'topic', select: 'title category' }
]), posts);
app.use('/api/v1/topics/:topicId/posts', posts);
app.use('/api/v1/comments', advancedResults(Comment, [
  { path: 'user', select: 'username' },
  { path: 'post', select: 'title' }
]), comments);
app.use('/api/v1/posts/:postId/comments', comments);
app.use('/api/v1/resources', advancedResults(Resource, { path: 'user', select: 'username' }), resources);
app.use('/api/v1/events', advancedResults(Event, { path: 'organizer', select: 'username' }), events);
app.use('/api/v1/communities', advancedResults(Community, { path: 'creator', select: 'username' }), communities);
app.use('/api/v1/messages', messages);

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

// 处理未捕获的异常
process.on('unhandledRejection', (err, promise) => {
  console.log(`错误: ${err.message}`);
  // 关闭服务器并退出进程
  server.close(() => process.exit(1));
});

module.exports = app;
