const Event = require('../models/Event');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有活动
// @route   GET /api/v1/events
// @access  Public
exports.getEvents = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个活动
// @route   GET /api/v1/events/:id
// @access  Public
exports.getEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id).populate({
    path: 'organizer',
    select: 'username'
  });

  if (!event) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的活动`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: event
  });
});

// @desc    创建活动
// @route   POST /api/v1/events
// @access  Private
exports.createEvent = asyncHandler(async (req, res, next) => {
  // 添加组织者ID到请求体
  req.body.organizer = req.user.id;

  const event = await Event.create(req.body);

  res.status(201).json({
    success: true,
    data: event
  });
});

// @desc    更新活动
// @route   PUT /api/v1/events/:id
// @access  Private
exports.updateEvent = asyncHandler(async (req, res, next) => {
  let event = await Event.findById(req.params.id);

  if (!event) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的活动`, 404)
    );
  }

  // 确保用户是活动组织者
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此活动`, 401)
    );
  }

  event = await Event.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: event
  });
});

// @desc    删除活动
// @route   DELETE /api/v1/events/:id
// @access  Private
exports.deleteEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的活动`, 404)
    );
  }

  // 确保用户是活动组织者
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此活动`, 401)
    );
  }

  await event.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    报名参加活动
// @route   PUT /api/v1/events/:id/join
// @access  Private
exports.joinEvent = asyncHandler(async (req, res, next) => {
  let event = await Event.findById(req.params.id);

  if (!event) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的活动`, 404)
    );
  }

  // 检查用户是否已报名
  const alreadyJoined = event.participants.some(
    participant => participant.user.toString() === req.user.id
  );

  if (alreadyJoined) {
    return next(
      new ErrorResponse('您已报名参加此活动', 400)
    );
  }

  // 检查活动是否已满
  if (event.capacity > 0 && event.participants.length >= event.capacity) {
    return next(
      new ErrorResponse('活动名额已满', 400)
    );
  }

  event = await Event.findByIdAndUpdate(
    req.params.id,
    { 
      $push: { 
        participants: { 
          user: req.user.id, 
          status: '已报名',
          joinedAt: Date.now()
        } 
      }
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: event
  });
});

// @desc    取消参加活动
// @route   PUT /api/v1/events/:id/leave
// @access  Private
exports.leaveEvent = asyncHandler(async (req, res, next) => {
  let event = await Event.findById(req.params.id);

  if (!event) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的活动`, 404)
    );
  }

  // 检查用户是否已报名
  const alreadyJoined = event.participants.some(
    participant => participant.user.toString() === req.user.id
  );

  if (!alreadyJoined) {
    return next(
      new ErrorResponse('您尚未报名参加此活动', 400)
    );
  }

  // 更新参与者状态为已取消
  event = await Event.findOneAndUpdate(
    { 
      _id: req.params.id, 
      'participants.user': req.user.id 
    },
    { 
      $set: { 'participants.$.status': '已取消' } 
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: event
  });
});
