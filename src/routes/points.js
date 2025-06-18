const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");

// 获取用户积分信息
router.get("/", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("points level experience dailyTasks achievements");
    
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "用户不存在"
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        points: user.points || 0,
        level: user.level || 1,
        experience: user.experience || 0,
        dailyTasks: user.dailyTasks || [],
        achievements: user.achievements || []
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "获取积分信息失败",
      error: error.message
    });
  }
});

// 获取每日任务
router.get("/daily-tasks", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const defaultTasks = [
      { id: 1, title: '完成一节语言课程', points: 50, completed: false, icon: '📚' },
      { id: 2, title: '参与文化讨论', points: 30, completed: false, icon: '💬' },
      { id: 3, title: '分享文化内容', points: 40, completed: false, icon: '📤' },
      { id: 4, title: '帮助其他学习者', points: 60, completed: false, icon: '🤝' }
    ];

    // 检查是否是新的一天，如果是则重置任务
    const today = new Date().toDateString();
    const lastTaskDate = user.lastTaskDate ? user.lastTaskDate.toDateString() : null;
    
    if (lastTaskDate !== today) {
      user.dailyTasks = defaultTasks;
      user.lastTaskDate = new Date();
      await user.save();
    }

    res.status(200).json({
      status: "success",
      data: {
        tasks: user.dailyTasks || defaultTasks,
        progress: calculateTaskProgress(user.dailyTasks || defaultTasks)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "获取每日任务失败",
      error: error.message
    });
  }
});

// 完成任务
router.post("/complete-task", protect, async (req, res) => {
  try {
    const { taskId } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "用户不存在"
      });
    }

    // 查找并完成任务
    const taskIndex = user.dailyTasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "任务不存在"
      });
    }

    const task = user.dailyTasks[taskIndex];
    if (task.completed) {
      return res.status(400).json({
        status: "error",
        message: "任务已完成"
      });
    }

    // 标记任务为已完成
    user.dailyTasks[taskIndex].completed = true;
    
    // 增加积分和经验
    user.points = (user.points || 0) + task.points;
    user.experience = (user.experience || 0) + task.points;
    
    // 检查是否升级
    const newLevel = Math.floor(user.experience / 1000) + 1;
    const leveledUp = newLevel > (user.level || 1);
    user.level = newLevel;

    await user.save();

    res.status(200).json({
      status: "success",
      message: `任务完成！获得 ${task.points} 积分`,
      data: {
        pointsEarned: task.points,
        totalPoints: user.points,
        level: user.level,
        leveledUp,
        task: user.dailyTasks[taskIndex]
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "完成任务失败",
      error: error.message
    });
  }
});

// 获取成就列表
router.get("/achievements", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const defaultAchievements = [
      { id: 1, title: '初学者', description: '完成第一节课程', icon: '🌱', unlocked: true },
      { id: 2, title: '文化探索者', description: '探索5种不同文化', icon: '🌍', unlocked: true },
      { id: 3, title: '语言大师', description: '掌握3种语言基础', icon: '🗣️', unlocked: false },
      { id: 4, title: '社区贡献者', description: '帮助100位学习者', icon: '⭐', unlocked: false }
    ];

    res.status(200).json({
      status: "success",
      data: {
        achievements: user.achievements || defaultAchievements
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "获取成就失败",
      error: error.message
    });
  }
});

// 获取积分商店
router.get("/store", protect, async (req, res) => {
  try {
    const storeItems = [
      { id: 1, title: '专属头像框', cost: 100, icon: '🖼️', type: 'cosmetic' },
      { id: 2, title: '高级课程解锁', cost: 200, icon: '🔓', type: 'feature' },
      { id: 3, title: '私人导师1小时', cost: 500, icon: '👨‍🏫', type: 'service' },
      { id: 4, title: '文化体验券', cost: 300, icon: '🎫', type: 'experience' }
    ];

    res.status(200).json({
      status: "success",
      data: {
        items: storeItems
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "获取积分商店失败",
      error: error.message
    });
  }
});

// 购买商店物品
router.post("/purchase", protect, async (req, res) => {
  try {
    const { itemId } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "用户不存在"
      });
    }

    // 获取商店物品信息
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

    // 检查积分是否足够
    if ((user.points || 0) < item.cost) {
      return res.status(400).json({
        status: "error",
        message: "积分不足"
      });
    }

    // 扣除积分
    user.points -= item.cost;
    
    // 添加到用户购买记录
    if (!user.purchases) {
      user.purchases = [];
    }
    user.purchases.push({
      itemId: item.id,
      title: item.title,
      cost: item.cost,
      purchaseDate: new Date()
    });

    await user.save();

    res.status(200).json({
      status: "success",
      message: `成功购买 ${item.title}！`,
      data: {
        item,
        remainingPoints: user.points,
        purchaseDate: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "购买失败",
      error: error.message
    });
  }
});

// 增加积分（管理员或系统调用）
router.post("/add", protect, async (req, res) => {
  try {
    const { points, reason } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "用户不存在"
      });
    }

    user.points = (user.points || 0) + points;
    user.experience = (user.experience || 0) + points;
    
    // 检查是否升级
    const newLevel = Math.floor(user.experience / 1000) + 1;
    const leveledUp = newLevel > (user.level || 1);
    user.level = newLevel;

    await user.save();

    res.status(200).json({
      status: "success",
      message: `获得 ${points} 积分！`,
      data: {
        pointsAdded: points,
        totalPoints: user.points,
        level: user.level,
        leveledUp,
        reason
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "增加积分失败",
      error: error.message
    });
  }
});

// 获取积分历史记录
router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // 这里可以从数据库获取详细的积分历史记录
    // 暂时返回模拟数据
    const history = [
      { date: new Date(), action: '完成语言课程', points: 50, type: 'earn' },
      { date: new Date(Date.now() - 86400000), action: '参与文化讨论', points: 30, type: 'earn' },
      { date: new Date(Date.now() - 172800000), action: '购买专属头像框', points: -100, type: 'spend' }
    ];

    res.status(200).json({
      status: "success",
      data: {
        history,
        totalEarned: user.experience || 0,
        totalSpent: (user.experience || 0) - (user.points || 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "获取积分历史失败",
      error: error.message
    });
  }
});

// 辅助函数：计算任务进度
function calculateTaskProgress(tasks) {
  const completedTasks = tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / tasks.length) * 100);
}

module.exports = router;

