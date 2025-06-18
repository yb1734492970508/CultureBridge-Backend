const User = require('../models/User');
const UserReward = require('../models/UserReward');
const Course = require('../models/Course');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class EnhancedUserService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
  }

  /**
   * 用户注册
   */
  async register(userData) {
    try {
      const { username, email, password, preferredLanguage = 'zh-CN' } = userData;

      // 检查用户是否已存在
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        throw new Error('用户名或邮箱已存在');
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 12);

      // 创建用户
      const user = new User({
        username,
        email,
        password: hashedPassword,
        settings: {
          preferences: {
            language: preferredLanguage
          }
        }
      });

      await user.save();

      // 创建用户奖励记录
      const userReward = new UserReward({
        userId: user._id,
        points: {
          learning: 100, // 新用户奖励
          engagement: 0,
          contribution: 0
        }
      });

      await userReward.save();

      // 生成JWT令牌
      const token = this.generateToken(user._id);

      return {
        success: true,
        user: user.toSafeObject(),
        token,
        message: '注册成功！欢迎加入CultureBridge！'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 用户登录
   */
  async login(credentials) {
    try {
      const { email, password } = credentials;

      // 查找用户
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查账户状态
      if (user.status !== 'active') {
        throw new Error('账户已被禁用');
      }

      // 检查账户是否被锁定
      if (user.isLocked) {
        throw new Error('账户已被锁定，请稍后再试');
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new Error('密码错误');
      }

      // 重置登录尝试次数
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // 更新登录信息
      user.lastLogin = new Date();
      user.stats.totalLogins += 1;
      await user.updateLastActive();

      // 生成JWT令牌
      const token = this.generateToken(user._id);

      return {
        success: true,
        user: user.toSafeObject(),
        token,
        message: '登录成功！'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const userReward = await UserReward.findOne({ userId });
      
      return {
        success: true,
        user: user.toSafeObject(),
        rewards: userReward || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新用户资料
   */
  async updateUserProfile(userId, updateData) {
    try {
      const allowedUpdates = [
        'profile.firstName',
        'profile.lastName',
        'profile.bio',
        'profile.location',
        'profile.birthday',
        'profile.gender',
        'profile.languages',
        'profile.interests',
        'settings.preferences.language',
        'settings.preferences.theme',
        'settings.notifications',
        'settings.privacy'
      ];

      const updates = {};
      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        success: true,
        user: user.toSafeObject(),
        message: '资料更新成功！'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const userReward = await UserReward.findOne({ userId });
      
      // 获取用户课程统计
      const courseStats = await this.getUserCourseStats(userId);
      
      // 计算等级和经验
      const totalPoints = userReward ? 
        userReward.points.learning + userReward.points.engagement + userReward.points.contribution : 0;
      
      const level = this.calculateLevel(totalPoints);
      const nextLevelExp = this.getNextLevelExperience(level.current);

      return {
        success: true,
        stats: {
          profile: {
            joinDate: user.createdAt,
            lastActive: user.stats.lastActive,
            totalLogins: user.stats.totalLogins
          },
          learning: courseStats,
          rewards: {
            totalPoints,
            level: level.current,
            experience: totalPoints,
            nextLevelExp,
            achievements: userReward?.achievements || []
          },
          social: {
            friendsCount: user.social.friends.length,
            followersCount: user.social.followers.length,
            followingCount: user.social.following.length
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取用户课程统计
   */
  async getUserCourseStats(userId) {
    const user = await User.findById(userId);
    if (!user) return null;

    const currentCourses = user.learning.currentCourses || [];
    const completedCourses = user.learning.completedCourses || [];

    return {
      currentCoursesCount: currentCourses.length,
      completedCoursesCount: completedCourses.length,
      totalStudyTime: user.learning.totalStudyTime || 0,
      studyStreak: user.learning.studyStreak || { current: 0, longest: 0 }
    };
  }

  /**
   * 计算用户等级
   */
  calculateLevel(totalPoints) {
    const levels = [
      { level: 1, minPoints: 0 },
      { level: 2, minPoints: 100 },
      { level: 3, minPoints: 300 },
      { level: 4, minPoints: 600 },
      { level: 5, minPoints: 1000 },
      { level: 6, minPoints: 1500 },
      { level: 7, minPoints: 2100 },
      { level: 8, minPoints: 2800 },
      { level: 9, minPoints: 3600 },
      { level: 10, minPoints: 4500 }
    ];

    let currentLevel = 1;
    for (const level of levels) {
      if (totalPoints >= level.minPoints) {
        currentLevel = level.level;
      } else {
        break;
      }
    }

    return { current: currentLevel };
  }

  /**
   * 获取下一等级所需经验
   */
  getNextLevelExperience(currentLevel) {
    const levelRequirements = {
      1: 100, 2: 300, 3: 600, 4: 1000, 5: 1500,
      6: 2100, 7: 2800, 8: 3600, 9: 4500, 10: 5500
    };

    return levelRequirements[currentLevel + 1] || levelRequirements[10];
  }

  /**
   * 获取用户排行榜
   */
  async getUserLeaderboard(type = 'total', limit = 50) {
    try {
      let sortField;
      switch (type) {
        case 'learning':
          sortField = 'points.learning';
          break;
        case 'engagement':
          sortField = 'points.engagement';
          break;
        case 'contribution':
          sortField = 'points.contribution';
          break;
        default:
          sortField = 'totalPoints';
      }

      const leaderboard = await UserReward.aggregate([
        {
          $addFields: {
            totalPoints: {
              $add: ['$points.learning', '$points.engagement', '$points.contribution']
            }
          }
        },
        { $sort: { [sortField]: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            userId: 1,
            points: 1,
            totalPoints: 1,
            level: 1,
            'user.username': 1,
            'user.avatar': 1,
            'user.profile.firstName': 1,
            'user.profile.lastName': 1
          }
        }
      ]);

      return {
        success: true,
        leaderboard: leaderboard.map((item, index) => ({
          rank: index + 1,
          ...item
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成JWT令牌
   */
  generateToken(userId) {
    return jwt.sign({ userId }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRE });
  }

  /**
   * 验证JWT令牌
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('无效的令牌');
    }
  }

  /**
   * 搜索用户
   */
  async searchUsers(query, currentUserId, limit = 20) {
    try {
      const users = await User.find({
        $and: [
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { 'profile.firstName': { $regex: query, $options: 'i' } },
              { 'profile.lastName': { $regex: query, $options: 'i' } }
            ]
          },
          { _id: { $ne: currentUserId } },
          { status: 'active' }
        ]
      })
      .select('username avatar profile.firstName profile.lastName')
      .limit(limit);

      return {
        success: true,
        users
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EnhancedUserService();

