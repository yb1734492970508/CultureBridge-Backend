const Message = require('../models/Message');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取用户的所有消息
// @route   GET /api/v1/messages
// @access  Private
exports.getMessages = asyncHandler(async (req, res, next) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user.id },
      { receiver: req.user.id }
    ]
  })
  .populate({
    path: 'sender',
    select: 'username'
  })
  .populate({
    path: 'receiver',
    select: 'username'
  })
  .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages
  });
});

// @desc    获取与特定用户的对话
// @route   GET /api/v1/messages/:userId
// @access  Private
exports.getConversation = asyncHandler(async (req, res, next) => {
  const userId = req.params.userId;

  // 检查用户是否存在
  const user = await User.findById(userId);
  if (!user) {
    return next(
      new ErrorResponse(`未找到ID为${userId}的用户`, 404)
    );
  }

  const messages = await Message.find({
    $or: [
      { sender: req.user.id, receiver: userId },
      { sender: userId, receiver: req.user.id }
    ]
  })
  .populate({
    path: 'sender',
    select: 'username'
  })
  .populate({
    path: 'receiver',
    select: 'username'
  })
  .sort('-createdAt');

  // 将所有接收到的消息标记为已读
  await Message.updateMany(
    { sender: userId, receiver: req.user.id, isRead: false },
    { isRead: true }
  );

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages
  });
});

// @desc    发送消息
// @route   POST /api/v1/messages
// @access  Private
exports.sendMessage = asyncHandler(async (req, res, next) => {
  req.body.sender = req.user.id;

  const { receiver, content } = req.body;

  // 检查接收者是否存在
  const user = await User.findById(receiver);
  if (!user) {
    return next(
      new ErrorResponse(`未找到ID为${receiver}的用户`, 404)
    );
  }

  const message = await Message.create(req.body);

  res.status(201).json({
    success: true,
    data: message
  });
});

// @desc    删除消息
// @route   DELETE /api/v1/messages/:id
// @access  Private
exports.deleteMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的消息`, 404)
    );
  }

  // 确保用户是消息的发送者或接收者
  if (
    message.sender.toString() !== req.user.id && 
    message.receiver.toString() !== req.user.id
  ) {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此消息`, 401)
    );
  }

  await message.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    标记消息为已读
// @route   PUT /api/v1/messages/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res, next) => {
  let message = await Message.findById(req.params.id);

  if (!message) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的消息`, 404)
    );
  }

  // 确保用户是消息的接收者
  if (message.receiver.toString() !== req.user.id) {
    return next(
      new ErrorResponse(`用户${req.user.id}无权标记此消息`, 401)
    );
  }

  message = await Message.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: message
  });
});
