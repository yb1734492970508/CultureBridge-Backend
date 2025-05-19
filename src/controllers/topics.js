const Topic = require('../models/Topic');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有话题
// @route   GET /api/v1/topics
// @access  Public
exports.getTopics = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个话题
// @route   GET /api/v1/topics/:id
// @access  Public
exports.getTopic = asyncHandler(async (req, res, next) => {
  const topic = await Topic.findById(req.params.id).populate({
    path: 'user',
    select: 'username'
  });

  if (!topic) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的话题`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: topic
  });
});

// @desc    创建话题
// @route   POST /api/v1/topics
// @access  Private
exports.createTopic = asyncHandler(async (req, res, next) => {
  // 添加用户ID到请求体
  req.body.user = req.user.id;

  const topic = await Topic.create(req.body);

  res.status(201).json({
    success: true,
    data: topic
  });
});

// @desc    更新话题
// @route   PUT /api/v1/topics/:id
// @access  Private
exports.updateTopic = asyncHandler(async (req, res, next) => {
  let topic = await Topic.findById(req.params.id);

  if (!topic) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的话题`, 404)
    );
  }

  // 确保用户是话题创建者
  if (topic.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此话题`, 401)
    );
  }

  topic = await Topic.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: topic
  });
});

// @desc    删除话题
// @route   DELETE /api/v1/topics/:id
// @access  Private
exports.deleteTopic = asyncHandler(async (req, res, next) => {
  const topic = await Topic.findById(req.params.id);

  if (!topic) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的话题`, 404)
    );
  }

  // 确保用户是话题创建者
  if (topic.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此话题`, 401)
    );
  }

  await topic.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});
