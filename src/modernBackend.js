const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中间件配置
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 模拟数据库（实际项目中应使用真实数据库）
const users = new Map();
const cultures = new Map();
const chatRooms = new Map();
const messages = new Map();

// 初始化模拟数据
const initializeData = () => {
  // 用户数据
  users.set('user1', {
    id: 'user1',
    name: 'Sarah',
    username: '@sarah_s',
    avatar: '👩🏻‍🦱',
    level: 'Intermediate',
    points: 2300,
    streak: 15,
    languagesLearning: ['Spanish', 'Japanese', 'French'],
    culturesExplored: 12,
    friendsConnected: 89,
    achievements: [
      {
        id: 1,
        title: "Cultural Explorer",
        description: "Explored 10+ different cultures",
        icon: "🌍",
        progress: 12,
        total: 15,
        unlocked: true
      },
      {
        id: 2,
        title: "Language Master",
        description: "Completed 50 language lessons",
        icon: "🗣️",
        progress: 47,
        total: 50,
        unlocked: false
      }
    ]
  });

  // 文化数据
  const cultureData = [
    {
      id: 1,
      title: "Japanese Tea Ceremony",
      description: "Discover the meditative art of Japanese tea preparation and its deep cultural significance.",
      category: "traditions",
      country: "Japan",
      image: "🍵",
      difficulty: "Beginner",
      duration: "45 min",
      participants: 1247
    },
    {
      id: 2,
      title: "Spanish Flamenco",
      description: "Experience the passionate rhythms and expressive movements of traditional Spanish dance.",
      category: "arts",
      country: "Spain",
      image: "💃",
      difficulty: "Intermediate",
      duration: "60 min",
      participants: 892
    },
    {
      id: 3,
      title: "Nordic Hygge",
      description: "Embrace the Danish philosophy of cozy contentment and simple pleasures.",
      category: "lifestyle",
      country: "Denmark",
      image: "🕯️",
      difficulty: "Beginner",
      duration: "30 min",
      participants: 2156
    }
  ];

  cultureData.forEach(culture => {
    cultures.set(culture.id, culture);
  });

  // 聊天室数据
  const roomData = [
    {
      id: 1,
      name: "Spanish Learners",
      language: "🇪🇸",
      members: 1247,
      lastMessage: "¡Hola! ¿Cómo están todos?",
      time: "2 min ago",
      online: 23
    },
    {
      id: 2,
      name: "Japanese Culture",
      language: "🇯🇵",
      members: 892,
      lastMessage: "今日は桜について話しましょう",
      time: "5 min ago",
      online: 18
    }
  ];

  roomData.forEach(room => {
    chatRooms.set(room.id, room);
    messages.set(room.id, []);
  });
};

// API 路由

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'CultureBridge Backend is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// 用户相关API
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    success: true,
    data: user
  });
});

app.put('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const updates = req.body;
  
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const updatedUser = { ...user, ...updates };
  users.set(userId, updatedUser);
  
  res.json({
    success: true,
    data: updatedUser
  });
});

// 积分系统API
app.get('/api/points/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    success: true,
    data: {
      points: user.points,
      level: user.level,
      streak: user.streak,
      achievements: user.achievements
    }
  });
});

app.post('/api/points/:userId/add', (req, res) => {
  const { userId } = req.params;
  const { points, reason } = req.body;
  
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.points += points;
  users.set(userId, user);
  
  res.json({
    success: true,
    data: {
      points: user.points,
      added: points,
      reason: reason
    }
  });
});

// 文化探索API
app.get('/api/cultures', (req, res) => {
  const { category, search } = req.query;
  let cultureList = Array.from(cultures.values());
  
  if (category && category !== 'all') {
    cultureList = cultureList.filter(culture => culture.category === category);
  }
  
  if (search) {
    cultureList = cultureList.filter(culture => 
      culture.title.toLowerCase().includes(search.toLowerCase()) ||
      culture.country.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  res.json({
    success: true,
    data: cultureList
  });
});

app.get('/api/cultures/:cultureId', (req, res) => {
  const { cultureId } = req.params;
  const culture = cultures.get(parseInt(cultureId));
  
  if (!culture) {
    return res.status(404).json({ error: 'Culture not found' });
  }
  
  res.json({
    success: true,
    data: culture
  });
});

// 语言学习API
app.get('/api/languages/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const languages = [
    {
      id: 'spanish',
      name: 'Spanish',
      flag: '🇪🇸',
      level: 'Intermediate',
      progress: 68,
      speakers: '500M+',
      difficulty: 'Medium'
    },
    {
      id: 'japanese',
      name: 'Japanese',
      flag: '🇯🇵',
      level: 'Beginner',
      progress: 23,
      speakers: '125M+',
      difficulty: 'Hard'
    },
    {
      id: 'french',
      name: 'French',
      flag: '🇫🇷',
      level: 'Advanced',
      progress: 89,
      speakers: '280M+',
      difficulty: 'Medium'
    }
  ];
  
  res.json({
    success: true,
    data: languages
  });
});

// 聊天室API
app.get('/api/chat/rooms', (req, res) => {
  const roomList = Array.from(chatRooms.values());
  
  res.json({
    success: true,
    data: roomList
  });
});

app.get('/api/chat/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const roomMessages = messages.get(parseInt(roomId)) || [];
  
  res.json({
    success: true,
    data: roomMessages
  });
});

app.post('/api/chat/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const { userId, message } = req.body;
  
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const newMessage = {
    id: Date.now(),
    userId: userId,
    userName: user.name,
    avatar: user.avatar,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  const roomMessages = messages.get(parseInt(roomId)) || [];
  roomMessages.push(newMessage);
  messages.set(parseInt(roomId), roomMessages);
  
  // 通过Socket.IO广播消息
  io.to(`room_${roomId}`).emit('new_message', newMessage);
  
  res.json({
    success: true,
    data: newMessage
  });
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // 加入聊天室
  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });
  
  // 离开聊天室
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
    console.log(`User ${socket.id} left room ${roomId}`);
  });
  
  // 发送消息
  socket.on('send_message', (data) => {
    const { roomId, userId, message } = data;
    const user = users.get(userId);
    
    if (user) {
      const newMessage = {
        id: Date.now(),
        userId: userId,
        userName: user.name,
        avatar: user.avatar,
        message: message,
        timestamp: new Date().toISOString()
      };
      
      const roomMessages = messages.get(parseInt(roomId)) || [];
      roomMessages.push(newMessage);
      messages.set(parseInt(roomId), roomMessages);
      
      io.to(`room_${roomId}`).emit('new_message', newMessage);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// 初始化数据
initializeData();

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CultureBridge Backend Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for real-time communication`);
  console.log(`🌍 Server accessible at http://0.0.0.0:${PORT}`);
});

module.exports = app;

