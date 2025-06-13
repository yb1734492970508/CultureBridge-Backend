const express = require('express');
const {
  getCulturalExchanges,
  getCulturalExchange,
  createCulturalExchange,
  updateCulturalExchange,
  deleteCulturalExchange,
  joinCulturalExchange,
  leaveCulturalExchange,
  rateCulturalExchange,
  uploadMedia,
  getExchangesByCategory,
  getUpcomingExchanges,
  getUserExchanges
} = require('../controllers/culturalExchangeController');

const CulturalExchange = require('../models/CulturalExchange');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');

// 公开路由
router
  .route('/')
  .get(
    advancedResults(CulturalExchange, [
      { path: 'organizer', select: 'username' },
      { path: 'participants.user', select: 'username' }
    ]),
    getCulturalExchanges
  )
  .post(protect, createCulturalExchange);

router.get('/category/:category', getExchangesByCategory);
router.get('/upcoming', getUpcomingExchanges);

// 需要认证的路由
router.use(protect);

router.get('/my-exchanges', getUserExchanges);

router
  .route('/:id')
  .get(getCulturalExchange)
  .put(updateCulturalExchange)
  .delete(deleteCulturalExchange);

router.post('/:id/join', joinCulturalExchange);
router.post('/:id/leave', leaveCulturalExchange);
router.post('/:id/rate', rateCulturalExchange);
router.post('/:id/media', uploadMedia);

module.exports = router;

