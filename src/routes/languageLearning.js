const express = require('express');
const {
  getLearningSessions,
  getLearningSession,
  createLearningSession,
  updateLearningSession,
  deleteLearningSession,
  enrollInSession,
  unenrollFromSession,
  markLessonComplete,
  submitAssignment,
  gradeAssignment,
  addDiscussion,
  replyToDiscussion,
  rateSession,
  getSessionsByLanguage,
  getSessionsByLevel,
  getUserSessions
} = require('../controllers/languageLearningController');

const LanguageLearningSession = require('../models/LanguageLearningSession');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');

// 公开路由
router
  .route('/')
  .get(
    advancedResults(LanguageLearningSession, [
      { path: 'teacher', select: 'username' },
      { path: 'students.user', select: 'username' }
    ]),
    getLearningSessions
  )
  .post(protect, createLearningSession);

router.get('/language/:language', getSessionsByLanguage);
router.get('/level/:level', getSessionsByLevel);

// 需要认证的路由
router.use(protect);

router.get('/my-sessions', getUserSessions);

router
  .route('/:id')
  .get(getLearningSession)
  .put(updateLearningSession)
  .delete(deleteLearningSession);

router.post('/:id/enroll', enrollInSession);
router.post('/:id/unenroll', unenrollFromSession);
router.post('/:id/complete-lesson', markLessonComplete);
router.post('/:id/submit-assignment', submitAssignment);
router.post('/:id/grade-assignment', authorize('teacher', 'admin'), gradeAssignment);
router.post('/:id/discussion', addDiscussion);
router.post('/:id/discussion/:discussionId/reply', replyToDiscussion);
router.post('/:id/rate', rateSession);

module.exports = router;

