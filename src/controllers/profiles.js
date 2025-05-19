const Profile = require('../models/Profile');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有个人资料
// @route   GET /api/v1/profiles
// @access  Public
exports.getProfiles = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个个人资料
// @route   GET /api/v1/profiles/:id
// @access  Public
exports.getProfile = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findById(req.params.id).populate({
    path: 'user',
    select: 'username email'
  });

  if (!profile) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的个人资料`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: profile
  });
});

// @desc    创建个人资料
// @route   POST /api/v1/profiles
// @access  Private
exports.createProfile = asyncHandler(async (req, res, next) => {
  // 添加用户ID到请求体
  req.body.user = req.user.id;

  // 检查是否已存在该用户的个人资料
  const existingProfile = await Profile.findOne({ user: req.user.id });

  if (existingProfile) {
    return next(
      new ErrorResponse(`用户ID为${req.user.id}的个人资料已存在`, 400)
    );
  }

  const profile = await Profile.create(req.body);

  res.status(201).json({
    success: true,
    data: profile
  });
});

// @desc    更新个人资料
// @route   PUT /api/v1/profiles/:id
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  let profile = await Profile.findById(req.params.id);

  if (!profile) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的个人资料`, 404)
    );
  }

  // 确保用户是个人资料所有者
  if (profile.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此个人资料`, 401)
    );
  }

  profile = await Profile.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: profile
  });
});

// @desc    删除个人资料
// @route   DELETE /api/v1/profiles/:id
// @access  Private
exports.deleteProfile = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findById(req.params.id);

  if (!profile) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的个人资料`, 404)
    );
  }

  // 确保用户是个人资料所有者
  if (profile.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此个人资料`, 401)
    );
  }

  await profile.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});
