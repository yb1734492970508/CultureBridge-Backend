const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// 验证JWT中间件
const auth = async (req, res, next) => {
  try {
    // 从请求头获取token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '无访问权限，请提供有效令牌' 
      });
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '无效的用户令牌' 
      });
    }

    // 将用户信息添加到请求对象
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ 
      success: false, 
      message: '令牌无效或已过期' 
    });
  }
};

module.exports = auth;
