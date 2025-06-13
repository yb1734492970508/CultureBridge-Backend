const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const CulturalExchange = require('../models/CulturalExchange');
const User = require('../models/User');
const TokenRewardService = require('../services/tokenRewardService');

const tokenRewardService = new TokenRewardService();

// @desc    获取所有文化交流活动
// @route   GET /api/v1/cultural-exchanges
// @access  Public
exports.getCulturalExchanges = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个文化交流活动
// @route   GET /api/v1/cultural-exchanges/:id
// @access  Public
exports.getCulturalExchange = asyncHandler(async (req, res, next) => {
  const exchange = await CulturalExchange.findById(req.params.id)
    .populate('organizer', 'username')
    .populate('participants.user', 'username')
    .populate('ratings.user', 'username');

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  res.status(200).json({
    success: true,
    data: exchange
  });
});

// @desc    创建文化交流活动
// @route   POST /api/v1/cultural-exchanges
// @access  Private
exports.createCulturalExchange = asyncHandler(async (req, res, next) => {
  // 添加用户ID到请求体
  req.body.organizer = req.user.id;

  const exchange = await CulturalExchange.create(req.body);

  // 奖励组织者CBT代币
  try {
    await tokenRewardService.awardTokens(
      req.user.id,
      exchange.tokenRewards.organizerReward,
      `创建文化交流活动: ${exchange.title}`,
      'cultural_exchange_creation'
    );
  } catch (error) {
    console.error('奖励代币失败:', error);
  }

  res.status(201).json({
    success: true,
    data: exchange
  });
});

// @desc    更新文化交流活动
// @route   PUT /api/v1/cultural-exchanges/:id
// @access  Private
exports.updateCulturalExchange = asyncHandler(async (req, res, next) => {
  let exchange = await CulturalExchange.findById(req.params.id);

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  // 确保用户是活动组织者
  if (exchange.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('无权限更新此活动', 401));
  }

  exchange = await CulturalExchange.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: exchange
  });
});

// @desc    删除文化交流活动
// @route   DELETE /api/v1/cultural-exchanges/:id
// @access  Private
exports.deleteCulturalExchange = asyncHandler(async (req, res, next) => {
  const exchange = await CulturalExchange.findById(req.params.id);

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  // 确保用户是活动组织者
  if (exchange.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('无权限删除此活动', 401));
  }

  await exchange.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    加入文化交流活动
// @route   POST /api/v1/cultural-exchanges/:id/join
// @access  Private
exports.joinCulturalExchange = asyncHandler(async (req, res, next) => {
  const exchange = await CulturalExchange.findById(req.params.id);

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  // 检查活动是否已满
  if (exchange.participants.length >= exchange.maxParticipants) {
    return next(new ErrorResponse('活动已满员', 400));
  }

  // 检查用户是否已参与
  if (exchange.isUserParticipant(req.user.id)) {
    return next(new ErrorResponse('您已参与此活动', 400));
  }

  // 检查活动状态
  if (exchange.status !== 'upcoming') {
    return next(new ErrorResponse('只能加入即将开始的活动', 400));
  }

  exchange.participants.push({
    user: req.user.id,
    contribution: req.body.contribution || ''
  });

  await exchange.save();

  // 奖励参与者CBT代币
  try {
    await tokenRewardService.awardTokens(
      req.user.id,
      exchange.tokenRewards.participantReward,
      `参与文化交流活动: ${exchange.title}`,
      'cultural_exchange_participation'
    );
  } catch (error) {
    console.error('奖励代币失败:', error);
  }

  res.status(200).json({
    success: true,
    data: exchange
  });
});

// @desc    离开文化交流活动
// @route   POST /api/v1/cultural-exchanges/:id/leave
// @access  Private
exports.leaveCulturalExchange = asyncHandler(async (req, res, next) => {
  const exchange = await CulturalExchange.findById(req.params.id);

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  // 检查用户是否已参与
  if (!exchange.isUserParticipant(req.user.id)) {
    return next(new ErrorResponse('您未参与此活动', 400));
  }

  // 检查活动状态
  if (exchange.status === 'completed') {
    return next(new ErrorResponse('已完成的活动无法退出', 400));
  }

  exchange.participants = exchange.participants.filter(
    participant => participant.user.toString() !== req.user.id
  );

  await exchange.save();

  res.status(200).json({
    success: true,
    data: exchange
  });
});

// @desc    评价文化交流活动
// @route   POST /api/v1/cultural-exchanges/:id/rate
// @access  Private
exports.rateCulturalExchange = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
  const exchange = await CulturalExchange.findById(req.params.id);

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  // 检查用户是否参与了活动
  if (!exchange.isUserParticipant(req.user.id) && exchange.organizer.toString() !== req.user.id) {
    return next(new ErrorResponse('只有参与者可以评价活动', 400));
  }

  // 检查活动是否已完成
  if (exchange.status !== 'completed') {
    return next(new ErrorResponse('只能评价已完成的活动', 400));
  }

  // 检查用户是否已评价
  const existingRating = exchange.ratings.find(
    r => r.user.toString() === req.user.id
  );

  if (existingRating) {
    return next(new ErrorResponse('您已评价过此活动', 400));
  }

  exchange.ratings.push({
    user: req.user.id,
    rating,
    comment
  });

  exchange.calculateAverageRating();
  await exchange.save();

  res.status(200).json({
    success: true,
    data: exchange
  });
});

// @desc    上传媒体文件
// @route   POST /api/v1/cultural-exchanges/:id/media
// @access  Private
exports.uploadMedia = asyncHandler(async (req, res, next) => {
  const exchange = await CulturalExchange.findById(req.params.id);

  if (!exchange) {
    return next(new ErrorResponse('文化交流活动不存在', 404));
  }

  // 检查用户权限
  if (!exchange.isUserParticipant(req.user.id) && 
      exchange.organizer.toString() !== req.user.id && 
      req.user.role !== 'admin') {
    return next(new ErrorResponse('无权限上传媒体文件', 401));
  }

  const { type, url, caption } = req.body;

  exchange.media.push({
    type,
    url,
    caption,
    uploadedBy: req.user.id
  });

  await exchange.save();

  res.status(200).json({
    success: true,
    data: exchange
  });
});

// @desc    按类别获取文化交流活动
// @route   GET /api/v1/cultural-exchanges/category/:category
// @access  Public
exports.getExchangesByCategory = asyncHandler(async (req, res, next) => {
  const exchanges = await CulturalExchange.find({ 
    category: req.params.category,
    isPublic: true 
  })
    .populate('organizer', 'username')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: exchanges.length,
    data: exchanges
  });
});

// @desc    获取即将开始的文化交流活动
// @route   GET /api/v1/cultural-exchanges/upcoming
// @access  Public
exports.getUpcomingExchanges = asyncHandler(async (req, res, next) => {
  const exchanges = await CulturalExchange.find({
    status: 'upcoming',
    startTime: { $gte: new Date() },
    isPublic: true
  })
    .populate('organizer', 'username')
    .sort('startTime')
    .limit(10);

  res.status(200).json({
    success: true,
    count: exchanges.length,
    data: exchanges
  });
});

// @desc    获取用户的文化交流活动
// @route   GET /api/v1/cultural-exchanges/my-exchanges
// @access  Private
exports.getUserExchanges = asyncHandler(async (req, res, next) => {
  const organizedExchanges = await CulturalExchange.find({ organizer: req.user.id })
    .populate('participants.user', 'username')
    .sort('-createdAt');

  const participatedExchanges = await CulturalExchange.find({
    'participants.user': req.user.id
  })
    .populate('organizer', 'username')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: {
      organized: organizedExchanges,
      participated: participatedExchanges
    }
  });
});

