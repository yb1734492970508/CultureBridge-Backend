// 错误处理中间件
const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误信息
  console.log(err);

  // Mongoose错误ID
  if (err.name === 'CastError') {
    const message = `未找到ID为${err.value}的资源`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose重复键
  if (err.code === 11000) {
    const message = '输入的值已存在';
    error = new ErrorResponse(message, 400);
  }

  // Mongoose验证错误
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || '服务器错误'
  });
};

module.exports = errorHandler;
