// 用户认证相关中间件
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 保护路由，需要登录才能访问
exports.protect = async (req, res, next) => {
  let token;

  // 从请求头或cookie中获取token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 检查token是否存在
  if (!token) {
    return res.status(401).json({
      success: false,
      error: '未授权访问'
    });
  }

  try {
    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 获取用户信息
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: '未授权访问'
    });
  }
};

// 角色授权
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '您没有权限执行此操作'
      });
    }
    next();
  };
};
