const express = require('express');
const router = express.Router();
const { 
  getCommunities, 
  getCommunity, 
  createCommunity, 
  updateCommunity, 
  deleteCommunity,
  joinCommunity,
  leaveCommunity
} = require('../controllers/communities');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getCommunities)
  .post(protect, createCommunity);

router.route('/:id')
  .get(getCommunity)
  .put(protect, updateCommunity)
  .delete(protect, deleteCommunity);

router.route('/:id/join')
  .put(protect, joinCommunity);

router.route('/:id/leave')
  .put(protect, leaveCommunity);

module.exports = router;
