const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();

// CORS配置 - 允许所有来源
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 基础中间件
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 模拟用户数据
let mockUser = {
  id: "user123",
  name: "Sarah",
  username: "@sarah_s",
  points: 2300,
  level: 5,
  experience: 2550,
  dailyTasks: [
    { id: 1, title: '完成一节语言课程', points: 50, completed: false, icon: '📚' },
    { id: 2, title: '参与文化讨论', points: 30, completed: false, icon: '💬' },
    { id: 3, title: '分享文化内容', points: 40, completed: false, icon: '📤' },
    { id: 4, title: '帮助其他学习者', points: 60, completed: false, icon: '🤝' }
  ],
  achievements: [
    { id: 1, title: '初学者', description: '完成第一节课程', icon: '🌱', unlocked: true },
    { id: 2, title: '文化探索者', description: '探索5种不同文化', icon: '🌍', unlocked: true },
    { id: 3, title: '语言大师', description: '掌握3种语言基础', icon: '🗣️', unlocked: false },
    { id: 4, title: '社区贡献者', description: '帮助100位学习者', icon: '⭐', unlocked: false }
  ]
};

// 积分系统API路由
app.get("/api/points", (req, res) => {
  res.json({
    status: "success",
    data: {
      points: mockUser.points,
      level: mockUser.level,
      experience: mockUser.experience,
      dailyTasks: mockUser.dailyTasks,
      achievements: mockUser.achievements
    }
  });
});

app.get("/api/points/daily-tasks", (req, res) => {
  const completedTasks = mockUser.dailyTasks.filter(task => task.completed).length;
  const progress = Math.round((completedTasks / mockUser.dailyTasks.length) * 100);
  
  res.json({
    status: "success",
    data: {
      tasks: mockUser.dailyTasks,
      progress
    }
  });
});

app.post("/api/points/complete-task", (req, res) => {
  const { taskId } = req.body;
  const taskIndex = mockUser.dailyTasks.findIndex(task => task.id === taskId);
  
  if (taskIndex === -1) {
    return res.status(404).json({
      status: "error",
      message: "任务不存在"
    });
  }

  const task = mockUser.dailyTasks[taskIndex];
  if (task.completed) {
    return res.status(400).json({
      status: "error",
      message: "任务已完成"
    });
  }

  // 完成任务
  mockUser.dailyTasks[taskIndex].completed = true;
  mockUser.points += task.points;
  mockUser.experience += task.points;
  
  // 检查升级
  const newLevel = Math.floor(mockUser.experience / 1000) + 1;
  const leveledUp = newLevel > mockUser.level;
  mockUser.level = newLevel;

  res.json({
    status: "success",
    message: `任务完成！获得 ${task.points} 积分`,
    data: {
      pointsEarned: task.points,
      totalPoints: mockUser.points,
      level: mockUser.level,
      leveledUp,
      task: mockUser.dailyTasks[taskIndex]
    }
  });
});

app.get("/api/points/store", (req, res) => {
  const storeItems = [
    { id: 1, title: '专属头像框', cost: 100, icon: '🖼️', type: 'cosmetic' },
    { id: 2, title: '高级课程解锁', cost: 200, icon: '🔓', type: 'feature' },
    { id: 3, title: '私人导师1小时', cost: 500, icon: '👨‍🏫', type: 'service' },
    { id: 4, title: '文化体验券', cost: 300, icon: '🎫', type: 'experience' }
  ];

  res.json({
    status: "success",
    data: { items: storeItems }
  });
});

app.post("/api/points/purchase", (req, res) => {
  const { itemId } = req.body;
  const storeItems = [
    { id: 1, title: '专属头像框', cost: 100, icon: '🖼️', type: 'cosmetic' },
    { id: 2, title: '高级课程解锁', cost: 200, icon: '🔓', type: 'feature' },
    { id: 3, title: '私人导师1小时', cost: 500, icon: '👨‍🏫', type: 'service' },
    { id: 4, title: '文化体验券', cost: 300, icon: '🎫', type: 'experience' }
  ];

  const item = storeItems.find(item => item.id === itemId);
  if (!item) {
    return res.status(404).json({
      status: "error",
      message: "商品不存在"
    });
  }

  if (mockUser.points < item.cost) {
    return res.status(400).json({
      status: "error",
      message: "积分不足"
    });
  }

  mockUser.points -= item.cost;

  res.json({
    status: "success",
    message: `成功购买 ${item.title}！`,
    data: {
      item,
      remainingPoints: mockUser.points,
      purchaseDate: new Date()
    }
  });
});

// 用户信息API
app.get("/api/user/profile", (req, res) => {
  res.json({
    status: "success",
    data: mockUser
  });
});

// 健康检查
app.get("/health", (req, res) => {
  res.json({
    status: "success",
    message: "CultureBridge后端服务运行正常",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: {
      pointsSystem: true,
      languageLearning: true,
      culturalExchange: true
    }
  });
});

// 404处理
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `找不到路由: ${req.originalUrl}`
  });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO配置
const io = require("socket.io")(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log(`✅ 用户连接: ${socket.id}`);

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`👥 用户 ${socket.id} 加入房间: ${roomId}`);
  });

  socket.on("send_message", (data) => {
    io.to(data.roomId).emit("receive_message", {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    console.log(`❌ 用户断开连接: ${socket.id}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 CultureBridge服务器运行在端口 ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`⭐ 积分系统已激活`);
});

module.exports = app;

