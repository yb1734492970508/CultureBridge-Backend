const Post = require('../models/Post');
const Topic = require('../models/Topic');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有帖子
// @route   GET /api/v1/posts
// @route   GET /api/v1/topics/:topicId/posts
// @access  Public
exports.getPosts = asyncHandler(async (req, res, next) => {
  if (req.params.topicId) {
    const posts = await Post.find({ topic: req.params.topicId }).populate({
      path: 'user',
      select: 'username'
    });

    return res.status(200).json({
      success: true,
      count: posts.length,
      data: posts
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    获取单个帖子
// @route   GET /api/v1/posts/:id
// @access  Public
exports.getPost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'username'
    })
    .populate({
      path: 'topic',
      select: 'title category'
    });

  if (!post) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的帖子`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: post
  });
});

// @desc    创建帖子
// @route   POST /api/v1/topics/:topicId/posts
// @access  Private
exports.createPost = asyncHandler(async (req, res, next) => {
  req.body.user = req.user.id;
  req.body.topic = req.params.topicId;

  const topic = await Topic.findById(req.params.topicId);

  if (!topic) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.topicId}的话题`, 404)
    );
  }

  const post = await Post.create(req.body);

  res.status(201).json({
    success: true,
    data: post
  });
});

// @desc    更新帖子
// @route   PUT /api/v1/posts/:id
// @access  Private
exports.updatePost = asyncHandler(async (req, res, next) => {
  let post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的帖子`, 404)
    );
  }

  // 确保用户是帖子作者
  if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此帖子`, 401)
    );
  }

  post = await Post.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: post
  });
});

// @desc    删除帖子
// @route   DELETE /api/v1/posts/:id
// @access  Private
exports.deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的帖子`, 404)
    );
  }

  // 确保用户是帖子作者
  if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此帖子`, 401)
    );
  }

  await post.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    点赞帖子
// @route   PUT /api/v1/posts/:id/like
// @access  Private
exports.likePost = asyncHandler(async (req, res, next) => {
  let post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的帖子`, 404)
    );
  }

  // 检查帖子是否已被点赞
  if (post.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('帖子已被点赞', 400)
    );
  }

  post = await Post.findByIdAndUpdate(
    req.params.id,
    { $push: { likes: req.user.id } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: post
  });
});

// @desc    取消点赞帖子
// @route   PUT /api/v1/posts/:id/unlike
// @access  Private
exports.unlikePost = asyncHandler(async (req, res, next) => {
  let post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的帖子`, 404)
    );
  }

  // 检查帖子是否已被点赞
  if (!post.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('帖子尚未被点赞', 400)
    );
  }

  post = await Post.findByIdAndUpdate(
    req.params.id,
    { $pull: { likes: req.user.id } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: post
  });
});
