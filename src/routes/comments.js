const express = require('express');
const router = express.Router({ mergeParams: true });
const { 
  getComments, 
  getComment, 
  createComment, 
  updateComment, 
  deleteComment,
  likeComment,
  unlikeComment
} = require('../controllers/comments');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getComments)
  .post(protect, createComment);

router.route('/:id')
  .get(getComment)
  .put(protect, updateComment)
  .delete(protect, deleteComment);

router.route('/:id/like')
  .put(protect, likeComment);

router.route('/:id/unlike')
  .put(protect, unlikeComment);

module.exports = router;
