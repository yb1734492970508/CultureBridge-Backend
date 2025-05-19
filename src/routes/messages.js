const express = require('express');
const router = express.Router();
const { 
  getMessages, 
  getConversation, 
  sendMessage, 
  deleteMessage,
  markAsRead
} = require('../controllers/messages');

const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getMessages)
  .post(protect, sendMessage);

router.route('/:id')
  .delete(protect, deleteMessage);

router.route('/:id/read')
  .put(protect, markAsRead);

router.route('/:userId')
  .get(protect, getConversation);

module.exports = router;
