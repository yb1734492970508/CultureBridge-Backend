const express = require('express');
const router = express.Router();
const { 
  getProfiles, 
  getProfile, 
  createProfile, 
  updateProfile, 
  deleteProfile 
} = require('../controllers/profiles');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getProfiles)
  .post(protect, createProfile);

router.route('/:id')
  .get(getProfile)
  .put(protect, updateProfile)
  .delete(protect, deleteProfile);

module.exports = router;
