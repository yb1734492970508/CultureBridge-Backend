const express = require('express');
const voiceController = require('../controllers/voiceController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// 公开路由
router.get('/languages', voiceController.getSupportedLanguages);

// 需要认证的路由
router.use(protect);

// 语音翻译路由
router.post('/translate', voiceController.upload.single('audio'), voiceController.translateVoice);
router.post('/transcribe', voiceController.upload.single('audio'), voiceController.transcribeVoice);
router.post('/synthesize', voiceController.synthesizeVoice);

// 语音翻译历史和管理
router.get('/history', voiceController.getVoiceHistory);
router.delete('/translation/:id', voiceController.deleteVoiceTranslation);
router.get('/translation/:id/status', voiceController.getTranslationStatus);

module.exports = router;

