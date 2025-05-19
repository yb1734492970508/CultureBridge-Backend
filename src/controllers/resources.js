const Resource = require('../models/Resource');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有学习资源
// @route   GET /api/v1/resources
// @access  Public
exports.getResources = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个学习资源
// @route   GET /api/v1/resources/:id
// @access  Public
exports.getResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id).populate({
    path: 'user',
    select: 'username'
  });

  if (!resource) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的学习资源`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: resource
  });
});

// @desc    创建学习资源
// @route   POST /api/v1/resources
// @access  Private
exports.createResource = asyncHandler(async (req, res, next) => {
  // 添加用户ID到请求体
  req.body.user = req.user.id;

  const resource = await Resource.create(req.body);

  res.status(201).json({
    success: true,
    data: resource
  });
});

// @desc    更新学习资源
// @route   PUT /api/v1/resources/:id
// @access  Private
exports.updateResource = asyncHandler(async (req, res, next) => {
  let resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的学习资源`, 404)
    );
  }

  // 确保用户是资源创建者
  if (resource.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此学习资源`, 401)
    );
  }

  resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: resource
  });
});

// @desc    删除学习资源
// @route   DELETE /api/v1/resources/:id
// @access  Private
exports.deleteResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的学习资源`, 404)
    );
  }

  // 确保用户是资源创建者
  if (resource.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此学习资源`, 401)
    );
  }

  await resource.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    评分学习资源
// @route   PUT /api/v1/resources/:id/rate
// @access  Private
exports.rateResource = asyncHandler(async (req, res, next) => {
  const { rating } = req.body;

  // 验证评分
  if (!rating || rating < 1 || rating > 5) {
    return next(
      new ErrorResponse('请提供1-5之间的评分', 400)
    );
  }

  let resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的学习资源`, 404)
    );
  }

  // 检查用户是否已评分
  const alreadyRated = resource.ratings.find(
    item => item.user.toString() === req.user.id
  );

  if (alreadyRated) {
    // 更新现有评分
    resource = await Resource.findOneAndUpdate(
      { _id: req.params.id, 'ratings.user': req.user.id },
      { $set: { 'ratings.$.rating': rating } },
      { new: true }
    );
  } else {
    // 添加新评分
    resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { 
        $push: { ratings: { user: req.user.id, rating } }
      },
      { new: true }
    );
  }

  // 计算平均评分
  const totalRatings = resource.ratings.length;
  const ratingSum = resource.ratings.reduce((sum, item) => sum + item.rating, 0);
  const averageRating = totalRatings > 0 ? (ratingSum / totalRatings) : 0;

  // 更新平均评分
  resource = await Resource.findByIdAndUpdate(
    req.params.id,
    { averageRating },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: resource
  });
});
