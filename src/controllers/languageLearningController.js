const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const LanguageLearningSession = require('../models/LanguageLearningSession');
const User = require('../models/User');
const TokenRewardService = require('../services/tokenRewardService');

const tokenRewardService = new TokenRewardService();

// @desc    获取所有语言学习会话
// @route   GET /api/v1/language-learning
// @access  Public
exports.getLearningSessions = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    获取单个语言学习会话
// @route   GET /api/v1/language-learning/:id
// @access  Public
exports.getLearningSession = asyncHandler(async (req, res, next) => {
  const session = await LanguageLearningSession.findById(req.params.id)
    .populate('teacher', 'username')
    .populate('students.user', 'username')
    .populate('ratings.student', 'username')
    .populate('discussions.user', 'username')
    .populate('discussions.replies.user', 'username');

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    创建语言学习会话
// @route   POST /api/v1/language-learning
// @access  Private
exports.createLearningSession = asyncHandler(async (req, res, next) => {
  // 添加教师ID到请求体
  req.body.teacher = req.user.id;

  const session = await LanguageLearningSession.create(req.body);

  // 奖励教师CBT代币
  try {
    await tokenRewardService.awardTokens(
      req.user.id,
      session.tokenRewards.teacherReward,
      `创建语言学习会话: ${session.title}`,
      'language_session_creation'
    );
  } catch (error) {
    console.error('奖励代币失败:', error);
  }

  res.status(201).json({
    success: true,
    data: session
  });
});

// @desc    更新语言学习会话
// @route   PUT /api/v1/language-learning/:id
// @access  Private
exports.updateLearningSession = asyncHandler(async (req, res, next) => {
  let session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 确保用户是教师
  if (session.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('无权限更新此会话', 401));
  }

  session = await LanguageLearningSession.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    删除语言学习会话
// @route   DELETE /api/v1/language-learning/:id
// @access  Private
exports.deleteLearningSession = asyncHandler(async (req, res, next) => {
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 确保用户是教师
  if (session.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('无权限删除此会话', 401));
  }

  await session.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    注册语言学习会话
// @route   POST /api/v1/language-learning/:id/enroll
// @access  Private
exports.enrollInSession = asyncHandler(async (req, res, next) => {
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查会话是否已满
  if (session.students.length >= session.maxStudents) {
    return next(new ErrorResponse('会话已满员', 400));
  }

  // 检查用户是否已注册
  if (session.isUserEnrolled(req.user.id)) {
    return next(new ErrorResponse('您已注册此会话', 400));
  }

  // 检查会话状态
  if (session.status !== 'published') {
    return next(new ErrorResponse('只能注册已发布的会话', 400));
  }

  session.students.push({
    user: req.user.id,
    currentLevel: req.body.currentLevel || 'beginner'
  });

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    取消注册语言学习会话
// @route   POST /api/v1/language-learning/:id/unenroll
// @access  Private
exports.unenrollFromSession = asyncHandler(async (req, res, next) => {
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查用户是否已注册
  if (!session.isUserEnrolled(req.user.id)) {
    return next(new ErrorResponse('您未注册此会话', 400));
  }

  // 检查会话状态
  if (session.status === 'completed') {
    return next(new ErrorResponse('已完成的会话无法取消注册', 400));
  }

  session.students = session.students.filter(
    student => student.user.toString() !== req.user.id
  );

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    标记课程完成
// @route   POST /api/v1/language-learning/:id/complete-lesson
// @access  Private
exports.markLessonComplete = asyncHandler(async (req, res, next) => {
  const { lessonId } = req.body;
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查用户是否已注册
  if (!session.isUserEnrolled(req.user.id)) {
    return next(new ErrorResponse('您未注册此会话', 400));
  }

  const student = session.students.find(s => s.user.toString() === req.user.id);
  
  if (!student.completedLessons.includes(lessonId)) {
    student.completedLessons.push(lessonId);
    
    // 更新进度
    student.progress = session.calculateStudentProgress(req.user.id);
    
    await session.save();

    // 奖励学生CBT代币
    try {
      await tokenRewardService.awardTokens(
        req.user.id,
        session.tokenRewards.studentCompletionReward,
        `完成课程: ${session.title} - ${lessonId}`,
        'lesson_completion'
      );

      // 检查是否达到进度里程碑
      if (student.progress % 25 === 0 && student.progress > 0) {
        await tokenRewardService.awardTokens(
          req.user.id,
          session.tokenRewards.progressMilestoneReward,
          `学习进度里程碑: ${student.progress}%`,
          'progress_milestone'
        );
      }
    } catch (error) {
      console.error('奖励代币失败:', error);
    }
  }

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    提交作业
// @route   POST /api/v1/language-learning/:id/submit-assignment
// @access  Private
exports.submitAssignment = asyncHandler(async (req, res, next) => {
  const { assignmentId, content } = req.body;
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查用户是否已注册
  if (!session.isUserEnrolled(req.user.id)) {
    return next(new ErrorResponse('您未注册此会话', 400));
  }

  const assignment = session.assignments.id(assignmentId);
  if (!assignment) {
    return next(new ErrorResponse('作业不存在', 404));
  }

  // 检查是否已提交
  const existingSubmission = assignment.submissions.find(
    sub => sub.student.toString() === req.user.id
  );

  if (existingSubmission) {
    return next(new ErrorResponse('您已提交过此作业', 400));
  }

  assignment.submissions.push({
    student: req.user.id,
    content
  });

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    评分作业
// @route   POST /api/v1/language-learning/:id/grade-assignment
// @access  Private (Teacher/Admin)
exports.gradeAssignment = asyncHandler(async (req, res, next) => {
  const { assignmentId, studentId, grade, feedback } = req.body;
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 确保用户是教师
  if (session.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('无权限评分作业', 401));
  }

  const assignment = session.assignments.id(assignmentId);
  if (!assignment) {
    return next(new ErrorResponse('作业不存在', 404));
  }

  const submission = assignment.submissions.find(
    sub => sub.student.toString() === studentId
  );

  if (!submission) {
    return next(new ErrorResponse('提交记录不存在', 404));
  }

  submission.grade = grade;
  submission.feedback = feedback;

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    添加讨论
// @route   POST /api/v1/language-learning/:id/discussion
// @access  Private
exports.addDiscussion = asyncHandler(async (req, res, next) => {
  const { message } = req.body;
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查用户权限
  if (!session.isUserEnrolled(req.user.id) && 
      session.teacher.toString() !== req.user.id) {
    return next(new ErrorResponse('无权限参与讨论', 401));
  }

  session.discussions.push({
    user: req.user.id,
    message
  });

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    回复讨论
// @route   POST /api/v1/language-learning/:id/discussion/:discussionId/reply
// @access  Private
exports.replyToDiscussion = asyncHandler(async (req, res, next) => {
  const { message } = req.body;
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查用户权限
  if (!session.isUserEnrolled(req.user.id) && 
      session.teacher.toString() !== req.user.id) {
    return next(new ErrorResponse('无权限参与讨论', 401));
  }

  const discussion = session.discussions.id(req.params.discussionId);
  if (!discussion) {
    return next(new ErrorResponse('讨论不存在', 404));
  }

  discussion.replies.push({
    user: req.user.id,
    message
  });

  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    评价会话
// @route   POST /api/v1/language-learning/:id/rate
// @access  Private
exports.rateSession = asyncHandler(async (req, res, next) => {
  const { teachingQuality, materialQuality, engagement, overallRating, comment } = req.body;
  const session = await LanguageLearningSession.findById(req.params.id);

  if (!session) {
    return next(new ErrorResponse('语言学习会话不存在', 404));
  }

  // 检查用户是否是学生
  if (!session.isUserEnrolled(req.user.id)) {
    return next(new ErrorResponse('只有注册学生可以评价会话', 400));
  }

  // 检查会话是否已完成
  if (session.status !== 'completed') {
    return next(new ErrorResponse('只能评价已完成的会话', 400));
  }

  // 检查用户是否已评价
  const existingRating = session.ratings.find(
    r => r.student.toString() === req.user.id
  );

  if (existingRating) {
    return next(new ErrorResponse('您已评价过此会话', 400));
  }

  session.ratings.push({
    student: req.user.id,
    teachingQuality,
    materialQuality,
    engagement,
    overallRating,
    comment
  });

  session.calculateAverageRating();
  await session.save();

  res.status(200).json({
    success: true,
    data: session
  });
});

// @desc    按语言获取学习会话
// @route   GET /api/v1/language-learning/language/:language
// @access  Public
exports.getSessionsByLanguage = asyncHandler(async (req, res, next) => {
  const sessions = await LanguageLearningSession.find({ 
    targetLanguage: req.params.language,
    isPublic: true,
    status: 'published'
  })
    .populate('teacher', 'username')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: sessions.length,
    data: sessions
  });
});

// @desc    按级别获取学习会话
// @route   GET /api/v1/language-learning/level/:level
// @access  Public
exports.getSessionsByLevel = asyncHandler(async (req, res, next) => {
  const sessions = await LanguageLearningSession.find({ 
    level: req.params.level,
    isPublic: true,
    status: 'published'
  })
    .populate('teacher', 'username')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: sessions.length,
    data: sessions
  });
});

// @desc    获取用户的学习会话
// @route   GET /api/v1/language-learning/my-sessions
// @access  Private
exports.getUserSessions = asyncHandler(async (req, res, next) => {
  const teachingSessions = await LanguageLearningSession.find({ teacher: req.user.id })
    .populate('students.user', 'username')
    .sort('-createdAt');

  const learningSessions = await LanguageLearningSession.find({
    'students.user': req.user.id
  })
    .populate('teacher', 'username')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: {
      teaching: teachingSessions,
      learning: learningSessions
    }
  });
});

