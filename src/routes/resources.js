const express = require('express');
const router = express.Router();
const { 
  getResources, 
  getResource, 
  createResource, 
  updateResource, 
  deleteResource,
  rateResource
} = require('../controllers/resources');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getResources)
  .post(protect, createResource);

router.route('/:id')
  .get(getResource)
  .put(protect, updateResource)
  .delete(protect, deleteResource);

router.route('/:id/rate')
  .put(protect, rateResource);

module.exports = router;
