const express = require('express');
const {
    createChatRoom,
    getChatRooms,
    joinChatRoom,
    leaveChatRoom,
    sendMessage,
    getChatMessages,
    deleteMessage,
    addReaction,
    removeReaction
} = require('../controllers/chatController');

const { protect } = require('../middleware/auth');

const router = express.Router();

// 公开路由
router.get('/rooms', getChatRooms);

// 需要认证的路由
router.use(protect);

// 聊天室路由
router.post('/rooms', createChatRoom);
router.post('/rooms/:id/join', joinChatRoom);
router.post('/rooms/:id/leave', leaveChatRoom);
router.post('/rooms/:id/messages', sendMessage);
router.get('/rooms/:id/messages', getChatMessages);

// 消息路由
router.delete('/messages/:id', deleteMessage);
router.post('/messages/:id/reactions', addReaction);
router.delete('/messages/:id/reactions/:emoji', removeReaction);

module.exports = router;

