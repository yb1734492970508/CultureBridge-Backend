const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    注册新用户
// @access  Public
router.post(
  '/register',
  [
    check('username', '用户名是必填项且长度至少为3个字符').isLength({ min: 3 }),
    check('email', '请提供有效的电子邮件地址').isEmail(),
    check('password', '密码长度至少为6个字符').isLength({ min: 6 })
  ],
  authController.register
);

// @route   POST /api/auth/login
// @desc    用户登录
// @access  Public
router.post(
  '/login',
  [
    check('email', '请提供有效的电子邮件地址').isEmail(),
    check('password', '密码是必填项').exists()
  ],
  authController.login
);

// @route   GET /api/auth/profile
// @desc    获取当前用户资料
// @access  Private
router.get('/profile', auth, authController.getProfile);

// @route   PUT /api/auth/profile
// @desc    更新用户资料
// @access  Private
router.put('/profile', auth, authController.updateProfile);

module.exports = router;
