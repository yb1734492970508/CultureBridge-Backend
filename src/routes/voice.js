const express = require('express');
const {
    speechToText,
    textToSpeech,
    voiceTranslation,
    sendVoiceMessage,
    getMessageAudio,
    getSupportedLanguages,
    realtimeTranslate,
    deleteVoiceFile,
    getVoiceFileInfo
} = require('../controllers/voiceController');

const { protect } = require('../middleware/auth');

const router = express.Router();

// 公开路由
router.get('/languages', getSupportedLanguages);

// 需要认证的路由
router.use(protect);

// 语音处理路由
router.post('/speech-to-text', speechToText);
router.post('/text-to-speech', textToSpeech);
router.post('/translate', voiceTranslation);
router.post('/realtime-translate', realtimeTranslate);

// 聊天相关语音路由
router.post('/chat/:roomId', sendVoiceMessage);
router.post('/message/:messageId/audio', getMessageAudio);

// 文件管理路由
router.delete('/file/:filename', deleteVoiceFile);
router.get('/file/:filename/info', getVoiceFileInfo);

module.exports = router;

