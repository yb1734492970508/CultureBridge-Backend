const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/translation/languages
 * @desc    获取支持的语言列表
 * @access  Public
 */
router.get('/languages', async (req, res) => {
    try {
        const languages = [
            { code: 'zh-CN', name: '中文（简体）', flag: '🇨🇳' },
            { code: 'zh-TW', name: '中文（繁体）', flag: '🇹🇼' },
            { code: 'en', name: 'English', flag: '🇺🇸' },
            { code: 'ja', name: '日本語', flag: '🇯🇵' },
            { code: 'ko', name: '한국어', flag: '🇰🇷' },
            { code: 'fr', name: 'Français', flag: '🇫🇷' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'es', name: 'Español', flag: '🇪🇸' }
        ];
        
        res.json({
            success: true,
            data: {
                languages: languages,
                total: languages.length
            }
        });
    } catch (error) {
        console.error('获取语言列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取语言列表失败'
        });
    }
});

/**
 * @route   POST /api/translation/translate
 * @desc    翻译文本
 * @access  Public
 */
router.post('/translate', async (req, res) => {
    try {
        const { text, fromLang, toLang } = req.body;
        
        if (!text || !fromLang || !toLang) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        // 模拟翻译结果
        const mockTranslations = {
            'zh-CN': {
                'en': {
                    '你好': 'Hello',
                    '谢谢': 'Thank you',
                    '再见': 'Goodbye'
                }
            },
            'en': {
                'zh-CN': {
                    'Hello': '你好',
                    'Thank you': '谢谢',
                    'Goodbye': '再见'
                }
            }
        };
        
        let translatedText = text;
        if (mockTranslations[fromLang] && mockTranslations[fromLang][toLang]) {
            translatedText = mockTranslations[fromLang][toLang][text] || `[翻译] ${text}`;
        }
        
        const result = {
            originalText: text,
            translatedText: translatedText,
            fromLanguage: fromLang,
            toLanguage: toLang,
            confidence: 0.95,
            processingTime: Math.random() * 2 + 0.5
        };
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('翻译失败:', error);
        res.status(500).json({
            success: false,
            error: '翻译失败'
        });
    }
});

/**
 * @route   POST /api/translation/voice
 * @desc    语音翻译
 * @access  Public
 */
router.post('/voice', async (req, res) => {
    try {
        const { audioData, fromLang, toLang } = req.body;
        
        if (!audioData || !fromLang || !toLang) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        // 模拟语音翻译结果
        const result = {
            originalText: '你好，很高兴认识你！',
            translatedText: 'Hello, nice to meet you!',
            originalAudio: audioData,
            translatedAudio: 'data:audio/wav;base64,mock_audio_data',
            fromLanguage: fromLang,
            toLanguage: toLang,
            confidence: 0.92,
            processingTime: 2.1
        };
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('语音翻译失败:', error);
        res.status(500).json({
            success: false,
            error: '语音翻译失败'
        });
    }
});

/**
 * @route   GET /api/translation/history
 * @desc    获取翻译历史
 * @access  Private
 */
router.get('/history', async (req, res) => {
    try {
        // 模拟翻译历史
        const mockHistory = [
            {
                id: 1,
                originalText: '你好',
                translatedText: 'Hello',
                fromLang: 'zh-CN',
                toLang: 'en',
                timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                type: 'text'
            },
            {
                id: 2,
                originalText: 'Thank you',
                translatedText: '谢谢',
                fromLang: 'en',
                toLang: 'zh-CN',
                timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                type: 'voice'
            }
        ];
        
        res.json({
            success: true,
            data: {
                history: mockHistory,
                total: mockHistory.length
            }
        });
    } catch (error) {
        console.error('获取翻译历史失败:', error);
        res.status(500).json({
            success: false,
            error: '获取翻译历史失败'
        });
    }
});

module.exports = router;

