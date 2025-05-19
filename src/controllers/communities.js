const Community = require('../models/Community');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    获取所有社区
// @route   GET /api/v1/communities
// @access  Public
exports.getCommunities = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个社区
// @route   GET /api/v1/communities/:id
// @access  Public
exports.getCommunity = asyncHandler(async (req, res, next) => {
  const community = await Community.findById(req.params.id)
    .populate({
      path: 'creator',
      select: 'username'
    })
    .populate({
      path: 'admins',
      select: 'username'
    });

  if (!community) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的社区`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: community
  });
});

// @desc    创建社区
// @route   POST /api/v1/communities
// @access  Private
exports.createCommunity = asyncHandler(async (req, res, next) => {
  // 添加创建者ID到请求体
  req.body.creator = req.user.id;
  
  // 添加创建者为管理员
  if (!req.body.admins) {
    req.body.admins = [];
  }
  req.body.admins.push(req.user.id);
  
  // 添加创建者为成员
  if (!req.body.members) {
    req.body.members = [];
  }
  req.body.members.push({
    user: req.user.id,
    role: '创建者',
    joinedAt: Date.now()
  });

  const community = await Community.create(req.body);

  res.status(201).json({
    success: true,
    data: community
  });
});

// @desc    更新社区
// @route   PUT /api/v1/communities/:id
// @access  Private
exports.updateCommunity = asyncHandler(async (req, res, next) => {
  let community = await Community.findById(req.params.id);

  if (!community) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的社区`, 404)
    );
  }

  // 确保用户是社区创建者或管理员
  if (
    community.creator.toString() !== req.user.id && 
    !community.admins.includes(req.user.id) && 
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(`用户${req.user.id}无权更新此社区`, 401)
    );
  }

  community = await Community.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: community
  });
});

// @desc    删除社区
// @route   DELETE /api/v1/communities/:id
// @access  Private
exports.deleteCommunity = asyncHandler(async (req, res, next) => {
  const community = await Community.findById(req.params.id);

  if (!community) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的社区`, 404)
    );
  }

  // 确保用户是社区创建者或管理员
  if (
    community.creator.toString() !== req.user.id && 
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(`用户${req.user.id}无权删除此社区`, 401)
    );
  }

  await community.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    加入社区
// @route   PUT /api/v1/communities/:id/join
// @access  Private
exports.joinCommunity = asyncHandler(async (req, res, next) => {
  let community = await Community.findById(req.params.id);

  if (!community) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的社区`, 404)
    );
  }

  // 检查用户是否已是社区成员
  const isMember = community.members.some(
    member => member.user.toString() === req.user.id
  );

  if (isMember) {
    return next(
      new ErrorResponse('您已是该社区成员', 400)
    );
  }

  // 检查社区是否为私有
  if (community.isPrivate) {
    return next(
      new ErrorResponse('该社区为私有社区，需要邀请才能加入', 400)
    );
  }

  community = await Community.findByIdAndUpdate(
    req.params.id,
    { 
      $push: { 
        members: { 
          user: req.user.id, 
          role: '成员',
          joinedAt: Date.now()
        } 
      }
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: community
  });
});

// @desc    离开社区
// @route   PUT /api/v1/communities/:id/leave
// @access  Private
exports.leaveCommunity = asyncHandler(async (req, res, next) => {
  let community = await Community.findById(req.params.id);

  if (!community) {
    return next(
      new ErrorResponse(`未找到ID为${req.params.id}的社区`, 404)
    );
  }

  // 检查用户是否是社区成员
  const isMember = community.members.some(
    member => member.user.toString() === req.user.id
  );

  if (!isMember) {
    return next(
      new ErrorResponse('您不是该社区成员', 400)
    );
  }

  // 创建者不能离开社区
  if (community.creator.toString() === req.user.id) {
    return next(
      new ErrorResponse('社区创建者不能离开社区，请先转让社区或删除社区', 400)
    );
  }

  community = await Community.findByIdAndUpdate(
    req.params.id,
    { 
      $pull: { 
        members: { user: req.user.id } 
      }
    },
    { new: true }
  );

  // 如果用户是管理员，也从管理员列表中移除
  if (community.admins.includes(req.user.id)) {
    community = await Community.findByIdAndUpdate(
      req.params.id,
      { 
        $pull: { admins: req.user.id } 
      },
      { new: true }
    );
  }

  res.status(200).json({
    success: true,
    data: community
  });
});
