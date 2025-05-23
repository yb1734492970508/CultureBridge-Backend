// src/routes/activity.routes.js
const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// 公开路由
router.get('/', activityController.getActivities);
router.get('/:activityId', activityController.getActivity);
router.get('/stats/overview', activityController.getActivityStats);
router.get('/organizer/:userId', activityController.getOrganizerActivities);
router.get('/participant/:userId', activityController.getParticipantActivities);

// 需要登录的路由
router.post('/', protect, activityController.createActivity);
router.put('/:activityId', protect, activityController.updateActivity);
router.patch('/:activityId/status', protect, activityController.changeActivityStatus);
router.post('/:activityId/join', protect, activityController.joinActivity);
router.post('/:activityId/feedback', protect, activityController.submitFeedback);

// 需要管理员或验证人权限的路由
router.post('/:activityId/verify', protect, activityController.verifyActivity);
router.post('/:activityId/attendance/:userId', protect, activityController.recordAttendance);

module.exports = router;
