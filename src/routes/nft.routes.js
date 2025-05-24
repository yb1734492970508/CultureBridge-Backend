// src/routes/nft.routes.js
const express = require('express');
const router = express.Router();
const nftController = require('../controllers/nft.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { adminMiddleware } = require('../middleware/admin.middleware');

// 公开路由
router.get('/token/:tokenId', nftController.getNFT);
router.get('/', nftController.getNFTs);
router.get('/market', nftController.getMarketNFTs);
router.get('/stats', nftController.getNFTStats);
router.get('/user/:userId/created', nftController.getUserCreatedNFTs);
router.get('/user/:userId/owned', nftController.getUserOwnedNFTs);
router.get('/activity/:activityId', nftController.getActivityNFTs);

// 需要认证的路由
router.post('/mint', authMiddleware, nftController.mintNFT);
router.post('/mint/activity', authMiddleware, nftController.mintNFTForActivity);
router.post('/mint/batch', authMiddleware, nftController.batchMintNFT);
router.post('/token/:tokenId/link', authMiddleware, nftController.linkNFTToActivity);
router.post('/token/:tokenId/market', authMiddleware, nftController.listNFTOnMarket);
router.delete('/token/:tokenId/market', authMiddleware, nftController.delistNFTFromMarket);
router.delete('/token/:tokenId', authMiddleware, nftController.destroyNFT);

// 需要管理员权限的路由
router.post('/token/:tokenId/verify', authMiddleware, adminMiddleware, nftController.verifyNFT);

module.exports = router;
