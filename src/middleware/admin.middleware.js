// src/middleware/admin.middleware.js
/**
 * 管理员权限中间件
 * 验证用户是否具有管理员权限
 */
module.exports = (req, res, next) => {
  try {
    // 检查用户是否已通过身份验证
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未授权，请先登录'
      });
    }

    // 检查用户是否具有管理员角色
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，需要管理员权限'
      });
    }

    // 用户具有管理员权限，继续执行
    next();
  } catch (err) {
    console.error('管理员权限验证失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};
