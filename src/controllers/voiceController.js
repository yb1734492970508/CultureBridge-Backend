const VoiceService = require('../services/voiceService');
const TranslationService = require('../services/translationService');
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const path = require('path');

class VoiceController {
    constructor() {
        this.voiceService = new VoiceService();
        this.translationService = new TranslationService();
    }

    /**
     * @desc    上传语音文件并转换为文字
     * @route   POST /api/v1/voice/speech-to-text
     * @access  Private
     */
    speechToText = asyncHandler(async (req, res, next) => {
        // 使用multer中间件处理文件上传
        this.voiceService.getUploadMiddleware()(req, res, async (err) => {
            if (err) {
                return next(new ErrorResponse('文件上传失败: ' + err.message, 400));
            }

            if (!req.file) {
                return next(new ErrorResponse('请上传音频文件', 400));
            }

            const { language = 'zh' } = req.body;

            try {
                const result = await this.voiceService.speechToText(req.file.path, language);

                res.status(200).json({
                    success: true,
                    data: {
                        transcription: result.transcription,
                        language: result.language,
                        confidence: result.confidence,
                        duration: result.duration,
                        audioUrl: `/uploads/voice/${path.basename(req.file.path)}`
                    }
                });
            } catch (error) {
                // 删除上传的文件
                await this.voiceService.deleteAudioFile(req.file.path);
                return next(new ErrorResponse('语音识别失败', 500));
            }
        });
    });

    /**
     * @desc    文字转语音
     * @route   POST /api/v1/voice/text-to-speech
     * @access  Private
     */
    textToSpeech = asyncHandler(async (req, res, next) => {
        const { text, language = 'zh', voice = 'female' } = req.body;

        if (!text) {
            return next(new ErrorResponse('请提供要转换的文字', 400));
        }

        if (text.length > 1000) {
            return next(new ErrorResponse('文字长度不能超过1000个字符', 400));
        }

        try {
            const result = await this.voiceService.textToSpeech(text, language, voice);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            return next(new ErrorResponse('语音合成失败', 500));
        }
    });

    /**
     * @desc    语音翻译
     * @route   POST /api/v1/voice/translate
     * @access  Private
     */
    voiceTranslation = asyncHandler(async (req, res, next) => {
        this.voiceService.getUploadMiddleware()(req, res, async (err) => {
            if (err) {
                return next(new ErrorResponse('文件上传失败: ' + err.message, 400));
            }

            if (!req.file) {
                return next(new ErrorResponse('请上传音频文件', 400));
            }

            const { fromLanguage = 'zh', toLanguage = 'en' } = req.body;

            if (fromLanguage === toLanguage) {
                return next(new ErrorResponse('源语言和目标语言不能相同', 400));
            }

            try {
                const result = await this.voiceService.voiceTranslation(
                    req.file.path,
                    fromLanguage,
                    toLanguage
                );

                res.status(200).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                // 删除上传的文件
                await this.voiceService.deleteAudioFile(req.file.path);
                return next(new ErrorResponse('语音翻译失败', 500));
            }
        });
    });

    /**
     * @desc    发送语音消息到聊天室
     * @route   POST /api/v1/voice/chat/:roomId
     * @access  Private
     */
    sendVoiceMessage = asyncHandler(async (req, res, next) => {
        const { roomId } = req.params;

        // 验证聊天室
        const chatRoom = await ChatRoom.findById(roomId);
        if (!chatRoom) {
            return next(new ErrorResponse('聊天室不存在', 404));
        }

        // 检查是否是成员
        const isMember = chatRoom.members.some(
            member => member.user.toString() === req.user.id
        );

        if (!isMember) {
            return next(new ErrorResponse('您不是该聊天室的成员', 403));
        }

        this.voiceService.getUploadMiddleware()(req, res, async (err) => {
            if (err) {
                return next(new ErrorResponse('文件上传失败: ' + err.message, 400));
            }

            if (!req.file) {
                return next(new ErrorResponse('请上传音频文件', 400));
            }

            const { language = 'zh', autoTranslate = true } = req.body;

            try {
                // 语音转文字
                const sttResult = await this.voiceService.speechToText(req.file.path, language);

                // 创建语音消息
                const messageData = {
                    chatRoom: roomId,
                    sender: req.user.id,
                    content: sttResult.transcription,
                    messageType: 'voice',
                    originalLanguage: language,
                    voiceData: {
                        audioUrl: `/uploads/voice/${path.basename(req.file.path)}`,
                        duration: sttResult.duration,
                        transcription: sttResult.transcription,
                        originalAudioUrl: `/uploads/voice/${path.basename(req.file.path)}`
                    }
                };

                // 如果启用自动翻译
                if (autoTranslate && chatRoom.settings.allowTranslation) {
                    const targetLanguages = chatRoom.languages.filter(lang => lang !== language);
                    if (targetLanguages.length > 0) {
                        const translations = await this.translationService.batchTranslate(
                            sttResult.transcription,
                            language,
                            targetLanguages
                        );
                        messageData.translations = translations;
                    }
                }

                const message = await ChatMessage.create(messageData);
                await message.populate('sender', 'username email walletAddress');

                res.status(201).json({
                    success: true,
                    data: message
                });
            } catch (error) {
                // 删除上传的文件
                await this.voiceService.deleteAudioFile(req.file.path);
                return next(new ErrorResponse('发送语音消息失败', 500));
            }
        });
    });

    /**
     * @desc    获取消息的语音版本
     * @route   POST /api/v1/voice/message/:messageId/audio
     * @access  Private
     */
    getMessageAudio = asyncHandler(async (req, res, next) => {
        const { messageId } = req.params;
        const { language = 'zh', voice = 'female' } = req.body;

        const message = await ChatMessage.findById(messageId);
        if (!message) {
            return next(new ErrorResponse('消息不存在', 404));
        }

        // 检查是否有该语言的翻译
        let textToConvert = message.content;
        if (language !== message.originalLanguage) {
            const translation = message.translations.find(t => t.language === language);
            if (translation) {
                textToConvert = translation.content;
            } else {
                // 如果没有翻译，先翻译再转语音
                const translationResult = await this.translationService.translateText(
                    message.content,
                    message.originalLanguage,
                    language
                );
                textToConvert = translationResult.translatedText;
            }
        }

        try {
            const result = await this.voiceService.textToSpeech(textToConvert, language, voice);

            res.status(200).json({
                success: true,
                data: {
                    messageId,
                    audioUrl: result.audioUrl,
                    text: textToConvert,
                    language,
                    duration: result.duration
                }
            });
        } catch (error) {
            return next(new ErrorResponse('生成语音失败', 500));
        }
    });

    /**
     * @desc    获取支持的语言列表
     * @route   GET /api/v1/voice/languages
     * @access  Public
     */
    getSupportedLanguages = asyncHandler(async (req, res, next) => {
        const languages = this.voiceService.getSupportedLanguages();

        res.status(200).json({
            success: true,
            data: languages
        });
    });

    /**
     * @desc    语音实时翻译（WebSocket支持）
     * @route   POST /api/v1/voice/realtime-translate
     * @access  Private
     */
    realtimeTranslate = asyncHandler(async (req, res, next) => {
        const { fromLanguage = 'zh', toLanguage = 'en' } = req.body;

        if (fromLanguage === toLanguage) {
            return next(new ErrorResponse('源语言和目标语言不能相同', 400));
        }

        // 这里应该建立WebSocket连接进行实时翻译
        // 暂时返回配置信息
        res.status(200).json({
            success: true,
            data: {
                message: '实时翻译功能需要WebSocket连接',
                config: {
                    fromLanguage,
                    toLanguage,
                    endpoint: '/socket.io',
                    events: {
                        connect: 'voice:realtime:connect',
                        stream: 'voice:realtime:stream',
                        result: 'voice:realtime:result'
                    }
                }
            }
        });
    });

    /**
     * @desc    删除语音文件
     * @route   DELETE /api/v1/voice/file/:filename
     * @access  Private
     */
    deleteVoiceFile = asyncHandler(async (req, res, next) => {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../../uploads/voice', filename);

        try {
            // 验证文件是否存在
            const isValid = await this.voiceService.validateAudioFile(filePath);
            if (!isValid) {
                return next(new ErrorResponse('文件不存在', 404));
            }

            await this.voiceService.deleteAudioFile(filePath);

            res.status(200).json({
                success: true,
                data: {
                    message: '文件删除成功'
                }
            });
        } catch (error) {
            return next(new ErrorResponse('删除文件失败', 500));
        }
    });

    /**
     * @desc    获取语音文件信息
     * @route   GET /api/v1/voice/file/:filename/info
     * @access  Private
     */
    getVoiceFileInfo = asyncHandler(async (req, res, next) => {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '../../uploads/voice', filename);

        try {
            const isValid = await this.voiceService.validateAudioFile(filePath);
            if (!isValid) {
                return next(new ErrorResponse('文件不存在', 404));
            }

            const duration = await this.voiceService.getAudioDuration(filePath);
            const fs = require('fs').promises;
            const stats = await fs.stat(filePath);

            res.status(200).json({
                success: true,
                data: {
                    filename,
                    size: stats.size,
                    duration,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                }
            });
        } catch (error) {
            return next(new ErrorResponse('获取文件信息失败', 500));
        }
    });
}

module.exports = new VoiceController();

