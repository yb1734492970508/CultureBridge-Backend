const axios = require('axios');

class TranslationService {
    constructor() {
        // 支持的翻译服务
        this.services = {
            google: {
                url: 'https://translate.googleapis.com/translate_a/single',
                key: process.env.GOOGLE_TRANSLATE_API_KEY
            },
            baidu: {
                url: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
                appid: process.env.BAIDU_TRANSLATE_APPID,
                key: process.env.BAIDU_TRANSLATE_KEY
            }
        };
        
        // 语言代码映射
        this.languageCodes = {
            'zh': 'zh-CN',
            'en': 'en',
            'ja': 'ja',
            'ko': 'ko',
            'fr': 'fr',
            'de': 'de',
            'es': 'es',
            'ru': 'ru',
            'ar': 'ar',
            'pt': 'pt',
            'it': 'it',
            'th': 'th',
            'vi': 'vi'
        };
    }

    /**
     * 翻译文本
     * @param {string} text 要翻译的文本
     * @param {string} fromLang 源语言
     * @param {string} toLang 目标语言
     * @param {string} service 翻译服务 ('google' | 'baidu')
     * @returns {Promise<Object>} 翻译结果
     */
    async translateText(text, fromLang, toLang, service = 'google') {
        try {
            if (service === 'google') {
                return await this.translateWithGoogle(text, fromLang, toLang);
            } else if (service === 'baidu') {
                return await this.translateWithBaidu(text, fromLang, toLang);
            } else {
                throw new Error('不支持的翻译服务');
            }
        } catch (error) {
            console.error('翻译失败:', error);
            throw error;
        }
    }

    /**
     * 使用Google翻译
     * @param {string} text 要翻译的文本
     * @param {string} fromLang 源语言
     * @param {string} toLang 目标语言
     * @returns {Promise<Object>} 翻译结果
     */
    async translateWithGoogle(text, fromLang, toLang) {
        try {
            // 简化版Google翻译实现（实际使用时需要API密钥）
            const response = await axios.get(this.services.google.url, {
                params: {
                    client: 'gtx',
                    sl: this.languageCodes[fromLang] || fromLang,
                    tl: this.languageCodes[toLang] || toLang,
                    dt: 't',
                    q: text
                }
            });

            const translatedText = response.data[0][0][0];
            const confidence = response.data[0][0][2] || 0.8;

            return {
                translatedText,
                confidence,
                service: 'google',
                fromLanguage: fromLang,
                toLanguage: toLang,
                originalText: text
            };
        } catch (error) {
            console.error('Google翻译失败:', error);
            throw new Error('Google翻译服务不可用');
        }
    }

    /**
     * 使用百度翻译
     * @param {string} text 要翻译的文本
     * @param {string} fromLang 源语言
     * @param {string} toLang 目标语言
     * @returns {Promise<Object>} 翻译结果
     */
    async translateWithBaidu(text, fromLang, toLang) {
        try {
            const crypto = require('crypto');
            const appid = this.services.baidu.appid;
            const key = this.services.baidu.key;
            const salt = Date.now();
            const query = text;
            
            // 生成签名
            const sign = crypto.createHash('md5')
                .update(appid + query + salt + key)
                .digest('hex');

            const response = await axios.post(this.services.baidu.url, null, {
                params: {
                    q: query,
                    from: fromLang,
                    to: toLang,
                    appid: appid,
                    salt: salt,
                    sign: sign
                }
            });

            if (response.data.error_code) {
                throw new Error(`百度翻译错误: ${response.data.error_msg}`);
            }

            const translatedText = response.data.trans_result[0].dst;

            return {
                translatedText,
                confidence: 0.9, // 百度翻译不提供置信度，设置默认值
                service: 'baidu',
                fromLanguage: fromLang,
                toLanguage: toLang,
                originalText: text
            };
        } catch (error) {
            console.error('百度翻译失败:', error);
            throw new Error('百度翻译服务不可用');
        }
    }

    /**
     * 批量翻译
     * @param {string} text 要翻译的文本
     * @param {string} fromLang 源语言
     * @param {string[]} targetLanguages 目标语言数组
     * @param {string} service 翻译服务
     * @returns {Promise<Array>} 翻译结果数组
     */
    async batchTranslate(text, fromLang, targetLanguages, service = 'google') {
        const translations = [];
        
        for (const toLang of targetLanguages) {
            if (toLang === fromLang) {
                // 如果目标语言与源语言相同，跳过翻译
                continue;
            }
            
            try {
                const result = await this.translateText(text, fromLang, toLang, service);
                translations.push({
                    language: toLang,
                    content: result.translatedText,
                    confidence: result.confidence
                });
            } catch (error) {
                console.warn(`翻译到${toLang}失败:`, error);
                // 翻译失败时添加错误信息
                translations.push({
                    language: toLang,
                    content: text, // 保持原文
                    confidence: 0,
                    error: error.message
                });
            }
        }
        
        return translations;
    }

    /**
     * 检测语言
     * @param {string} text 要检测的文本
     * @returns {Promise<string>} 检测到的语言代码
     */
    async detectLanguage(text) {
        try {
            // 简单的语言检测逻辑
            const chineseRegex = /[\u4e00-\u9fff]/;
            const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
            const koreanRegex = /[\uac00-\ud7af]/;
            const arabicRegex = /[\u0600-\u06ff]/;
            const russianRegex = /[\u0400-\u04ff]/;
            
            if (chineseRegex.test(text)) {
                return 'zh';
            } else if (japaneseRegex.test(text)) {
                return 'ja';
            } else if (koreanRegex.test(text)) {
                return 'ko';
            } else if (arabicRegex.test(text)) {
                return 'ar';
            } else if (russianRegex.test(text)) {
                return 'ru';
            } else {
                return 'en'; // 默认为英语
            }
        } catch (error) {
            console.error('语言检测失败:', error);
            return 'en'; // 默认返回英语
        }
    }

    /**
     * 获取支持的语言列表
     * @returns {Array} 支持的语言列表
     */
    getSupportedLanguages() {
        return Object.keys(this.languageCodes).map(code => ({
            code,
            name: this.getLanguageName(code)
        }));
    }

    /**
     * 获取语言名称
     * @param {string} code 语言代码
     * @returns {string} 语言名称
     */
    getLanguageName(code) {
        const names = {
            'zh': '中文',
            'en': 'English',
            'ja': '日本語',
            'ko': '한국어',
            'fr': 'Français',
            'de': 'Deutsch',
            'es': 'Español',
            'ru': 'Русский',
            'ar': 'العربية',
            'pt': 'Português',
            'it': 'Italiano',
            'th': 'ไทย',
            'vi': 'Tiếng Việt'
        };
        return names[code] || code;
    }

    /**
     * 翻译聊天消息
     * @param {Object} message 聊天消息对象
     * @param {string[]} targetLanguages 目标语言数组
     * @returns {Promise<Object>} 包含翻译的消息对象
     */
    async translateChatMessage(message, targetLanguages) {
        try {
            const translations = await this.batchTranslate(
                message.content,
                message.originalLanguage,
                targetLanguages
            );

            return {
                ...message,
                translations
            };
        } catch (error) {
            console.error('翻译聊天消息失败:', error);
            throw error;
        }
    }
}

module.exports = TranslationService;

