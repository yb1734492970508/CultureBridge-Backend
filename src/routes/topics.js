const express = require('express');
const router = express.Router();
const { 
  getTopics, 
  getTopic, 
  createTopic, 
  updateTopic, 
  deleteTopic 
} = require('../controllers/topics');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getTopics)
  .post(protect, createTopic);

router.route('/:id')
  .get(getTopic)
  .put(protect, updateTopic)
  .delete(protect, deleteTopic);

module.exports = router;
