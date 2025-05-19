const Comment = require('../models/Comment');
const Post = require('../models/Post');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有评论
// @route   GET /api/v1/comments
// @route   GET /api/v1/posts/:postId/comments
// @access  Public
exports.getComments = asyncHandler(async (req, res, next) => {
  if (req.params.postId) {
    const comments = await Comment.find({ post: req.params.postId }).populate({
      path: 'user',
      select: 'username'
    });

    return res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    获取单个评论
// @route   GET /api/v1/comments/:id
// @access  Public
exports.getComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'username'
    })
    .populate({
      path: 'post',
      select: 'title'
    });

  if (!comment) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的评论`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: comment
  });
});

// @desc    创建评论
// @route   POST /api/v1/posts/:postId/comments
// @access  Private
exports.createComment = asyncHandler(async (req, res, next) => {
  req.body.user = req.user.id;
  req.body.post = req.params.postId;

  const post = await Post.findById(req.params.postId);

  if (!post) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.postId}的帖子`, 404)
    );
  }

  const comment = await Comment.create(req.body);

  res.status(201).json({
    success: true,
    data: comment
  });
});

// @desc    更新评论
// @route   PUT /api/v1/comments/:id
// @access  Private
exports.updateComment = asyncHandler(async (req, res, next) => {
  let comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的评论`, 404)
    );
  }

  // 确保用户是评论作者
  if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此评论`, 401)
    );
  }

  comment = await Comment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: comment
  });
});

// @desc    删除评论
// @route   DELETE /api/v1/comments/:id
// @access  Private
exports.deleteComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的评论`, 404)
    );
  }

  // 确保用户是评论作者
  if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此评论`, 401)
    );
  }

  await comment.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    点赞评论
// @route   PUT /api/v1/comments/:id/like
// @access  Private
exports.likeComment = asyncHandler(async (req, res, next) => {
  let comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的评论`, 404)
    );
  }

  // 检查评论是否已被点赞
  if (comment.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('评论已被点赞', 400)
    );
  }

  comment = await Comment.findByIdAndUpdate(
    req.params.id,
    { $push: { likes: req.user.id } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: comment
  });
});

// @desc    取消点赞评论
// @route   PUT /api/v1/comments/:id/unlike
// @access  Private
exports.unlikeComment = asyncHandler(async (req, res, next) => {
  let comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的评论`, 404)
    );
  }

  // 检查评论是否已被点赞
  if (!comment.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('评论尚未被点赞', 400)
    );
  }

  comment = await Comment.findByIdAndUpdate(
    req.params.id,
    { $pull: { likes: req.user.id } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: comment
  });
});
