const rateLimit = require('express-rate-limit');
const { check, validationResult } = require('express-validator');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

// 安全中间件配置
const securityMiddleware = (app) => {
  // 设置安全HTTP头
  app.use(helmet());

  // 防止XSS攻击
  app.use(xss());

  // 防止NoSQL注入
  app.use(mongoSanitize());

  // 防止HTTP参数污染
  app.use(hpp());

  // 启用CORS
  app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // API请求速率限制
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP在windowMs内最多100个请求
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: '请求过于频繁，请稍后再试'
    }
  });
  
  // 登录请求速率限制（更严格）
  const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 10, // 每个IP在windowMs内最多10个请求
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: '登录尝试次数过多，请1小时后再试'
    }
  });

  // 应用通用API限制
  app.use('/api', apiLimiter);
  
  // 对认证路由应用更严格的限制
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
};

// 请求验证中间件
const validateRequest = (validations) => {
  return async (req, res, next) => {
    // 执行所有验证
    await Promise.all(validations.map(validation => validation.run(req)));

    // 检查验证结果
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // 如果有错误，返回400状态码和错误信息
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  };
};

// 常用验证规则
const validationRules = {
  // 用户相关验证
  user: {
    register: [
      check('username')
        .trim()
        .notEmpty().withMessage('用户名不能为空')
        .isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('用户名只能包含字母、数字、下划线和连字符'),
      check('email')
        .trim()
        .notEmpty().withMessage('邮箱不能为空')
        .isEmail().withMessage('请提供有效的邮箱地址'),
      check('password')
        .trim()
        .notEmpty().withMessage('密码不能为空')
        .isLength({ min: 6 }).withMessage('密码长度必须至少为6个字符')
        .matches(/\d/).withMessage('密码必须包含至少一个数字')
        .matches(/[a-zA-Z]/).withMessage('密码必须包含至少一个字母')
    ],
    login: [
      check('email')
        .trim()
        .notEmpty().withMessage('邮箱不能为空')
        .isEmail().withMessage('请提供有效的邮箱地址'),
      check('password')
        .trim()
        .notEmpty().withMessage('密码不能为空')
    ],
    updatePassword: [
      check('currentPassword')
        .trim()
        .notEmpty().withMessage('当前密码不能为空'),
      check('newPassword')
        .trim()
        .notEmpty().withMessage('新密码不能为空')
        .isLength({ min: 6 }).withMessage('新密码长度必须至少为6个字符')
        .matches(/\d/).withMessage('新密码必须包含至少一个数字')
        .matches(/[a-zA-Z]/).withMessage('新密码必须包含至少一个字母')
    ]
  },
  
  // 个人资料相关验证
  profile: {
    create: [
      check('name')
        .trim()
        .notEmpty().withMessage('姓名不能为空')
        .isLength({ max: 100 }).withMessage('姓名不能超过100个字符'),
      check('bio')
        .optional()
        .isLength({ max: 500 }).withMessage('个人简介不能超过500个字符'),
      check('languages.*.language')
        .optional()
        .notEmpty().withMessage('语言名称不能为空'),
      check('languages.*.proficiency')
        .optional()
        .isIn(['初级', '中级', '高级', '母语']).withMessage('语言熟练度必须是初级、中级、高级或母语之一')
    ]
  },
  
  // 话题相关验证
  topic: {
    create: [
      check('title')
        .trim()
        .notEmpty().withMessage('标题不能为空')
        .isLength({ max: 100 }).withMessage('标题不能超过100个字符'),
      check('description')
        .trim()
        .notEmpty().withMessage('描述不能为空')
        .isLength({ max: 1000 }).withMessage('描述不能超过1000个字符'),
      check('category')
        .trim()
        .notEmpty().withMessage('分类不能为空')
        .isIn(['文化交流', '语言学习', '风俗习惯', '艺术欣赏', '美食探索', '旅行体验', '其他']).withMessage('无效的分类')
    ]
  },
  
  // 帖子相关验证
  post: {
    create: [
      check('title')
        .trim()
        .notEmpty().withMessage('标题不能为空')
        .isLength({ max: 200 }).withMessage('标题不能超过200个字符'),
      check('content')
        .trim()
        .notEmpty().withMessage('内容不能为空')
        .isLength({ max: 5000 }).withMessage('内容不能超过5000个字符')
    ]
  },
  
  // 评论相关验证
  comment: {
    create: [
      check('content')
        .trim()
        .notEmpty().withMessage('评论内容不能为空')
        .isLength({ max: 1000 }).withMessage('评论内容不能超过1000个字符')
    ]
  },
  
  // 资源相关验证
  resource: {
    create: [
      check('title')
        .trim()
        .notEmpty().withMessage('标题不能为空')
        .isLength({ max: 200 }).withMessage('标题不能超过200个字符'),
      check('description')
        .trim()
        .notEmpty().withMessage('描述不能为空')
        .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
      check('type')
        .trim()
        .notEmpty().withMessage('类型不能为空')
        .isIn(['文章', '视频', '音频', '文档', '图片', '链接', '其他']).withMessage('无效的资源类型'),
      check('category')
        .trim()
        .notEmpty().withMessage('分类不能为空')
        .isIn(['语言学习', '文化知识', '历史传统', '艺术欣赏', '生活习惯', '其他']).withMessage('无效的资源分类'),
      check('language')
        .trim()
        .notEmpty().withMessage('语言不能为空')
    ]
  },
  
  // 活动相关验证
  event: {
    create: [
      check('title')
        .trim()
        .notEmpty().withMessage('标题不能为空')
        .isLength({ max: 200 }).withMessage('标题不能超过200个字符'),
      check('description')
        .trim()
        .notEmpty().withMessage('描述不能为空')
        .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
      check('location')
        .trim()
        .notEmpty().withMessage('地点不能为空'),
      check('startDate')
        .notEmpty().withMessage('开始时间不能为空')
        .isISO8601().withMessage('开始时间必须是有效的日期格式'),
      check('endDate')
        .notEmpty().withMessage('结束时间不能为空')
        .isISO8601().withMessage('结束时间必须是有效的日期格式')
        .custom((value, { req }) => {
          if (new Date(value) <= new Date(req.body.startDate)) {
            throw new Error('结束时间必须晚于开始时间');
          }
          return true;
        }),
      check('category')
        .trim()
        .notEmpty().withMessage('分类不能为空')
        .isIn(['文化交流', '语言学习', '艺术表演', '美食品鉴', '旅行探索', '节日庆典', '其他']).withMessage('无效的活动分类')
    ]
  },
  
  // 社区相关验证
  community: {
    create: [
      check('name')
        .trim()
        .notEmpty().withMessage('名称不能为空')
        .isLength({ max: 100 }).withMessage('名称不能超过100个字符'),
      check('description')
        .trim()
        .notEmpty().withMessage('描述不能为空')
        .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
      check('category')
        .trim()
        .notEmpty().withMessage('分类不能为空')
        .isIn(['文化交流', '语言学习', '艺术爱好', '美食探索', '旅行体验', '生活习惯', '其他']).withMessage('无效的社区分类')
    ]
  },
  
  // 消息相关验证
  message: {
    create: [
      check('receiver')
        .notEmpty().withMessage('接收者不能为空')
        .isMongoId().withMessage('接收者ID格式无效'),
      check('content')
        .trim()
        .notEmpty().withMessage('消息内容不能为空')
        .isLength({ max: 1000 }).withMessage('消息内容不能超过1000个字符')
    ]
  }
};

module.exports = {
  securityMiddleware,
  validateRequest,
  validationRules
};
