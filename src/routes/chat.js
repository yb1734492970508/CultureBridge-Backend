const express = require('express');
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// 公开路由
router.get('/rooms', chatController.getChatRooms);

// 需要认证的路由
router.use(protect);

// 聊天室路由
router.post('/rooms', chatController.createChatRoom);
router.get('/my-rooms', chatController.getMyRooms);
router.post('/rooms/:id/join', chatController.joinChatRoom);
router.post('/rooms/:id/leave', chatController.leaveChatRoom);
router.post('/rooms/:id/messages', chatController.sendMessage);
router.get('/rooms/:id/messages', chatController.getChatMessages);

// 消息路由
router.delete('/messages/:id', chatController.deleteMessage);
router.post('/messages/:id/reactions', chatController.addReaction);
router.delete('/messages/:id/reactions/:emoji', chatController.removeReaction);

module.exports = router;

