const express = require('express');
const router = express.Router();
const { 
  getEvents, 
  getEvent, 
  createEvent, 
  updateEvent, 
  deleteEvent,
  joinEvent,
  leaveEvent
} = require('../controllers/events');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getEvents)
  .post(protect, createEvent);

router.route('/:id')
  .get(getEvent)
  .put(protect, updateEvent)
  .delete(protect, deleteEvent);

router.route('/:id/join')
  .put(protect, joinEvent);

router.route('/:id/leave')
  .put(protect, leaveEvent);

module.exports = router;
