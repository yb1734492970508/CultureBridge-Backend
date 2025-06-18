const rewardService = require('./rewardService');

/**
 * 增强版AI翻译服务
 * Enhanced AI Translation Service with rewards
 */
class EnhancedTranslationService {
    constructor() {
        // 初始化奖励服务
        this.rewardService = rewardService;
        
        // 支持的语言配置
        this.supportedLanguages = {
            'zh-CN': { name: '中文（简体）', code: 'zh' },
            'zh-TW': { name: '中文（繁体）', code: 'zh-TW' },
            'en': { name: '英语', code: 'en' },
            'ja': { name: '日语', code: 'ja' },
            'ko': { name: '韩语', code: 'ko' },
            'fr': { name: '法语', code: 'fr' },
            'de': { name: '德语', code: 'de' },
            'es': { name: '西班牙语', code: 'es' },
            'it': { name: '意大利语', code: 'it' },
            'pt': { name: '葡萄牙语', code: 'pt' },
            'ru': { name: '俄语', code: 'ru' },
            'ar': { name: '阿拉伯语', code: 'ar' },
            'hi': { name: '印地语', code: 'hi' },
            'th': { name: '泰语', code: 'th' },
            'vi': { name: '越南语', code: 'vi' }
        };
        
        // 翻译质量评分权重
        this.qualityWeights = {
            length: 0.2,      // 文本长度
            complexity: 0.3,  // 复杂度
            accuracy: 0.5     // 准确性
        };
        
        // 奖励配置
        this.rewardConfig = {
            baseReward: 0.5,        // 基础奖励 0.5 CBT
            qualityMultiplier: 2.0, // 质量倍数
            lengthBonus: 0.1,       // 长度奖励（每100字符）
            dailyLimit: 50.0        // 每日翻译奖励上限
        };
        
        console.log('🌐 增强版翻译服务已初始化');
    }

    /**
     * 文本翻译
     */
    async translateText(text, fromLang, toLang, userId = null) {
        try {
            // 验证输入
            if (!text || text.trim().length === 0) {
                throw new Error('翻译文本不能为空');
            }
            
            if (!this.supportedLanguages[fromLang] || !this.supportedLanguages[toLang]) {
                throw new Error('不支持的语言');
            }
            
            if (fromLang === toLang) {
                throw new Error('源语言和目标语言不能相同');
            }
            
            // 文本预处理
            const processedText = this.preprocessText(text);
            
            // 执行翻译（这里使用模拟翻译，实际应该调用真实的翻译API）
            const translatedText = await this.performTranslation(processedText, fromLang, toLang);
            
            // 计算翻译质量分数
            const qualityScore = this.calculateQualityScore(processedText, translatedText, fromLang, toLang);
            
            // 创建翻译记录
            const translationRecord = {
                originalText: text,
                translatedText: translatedText,
                fromLanguage: fromLang,
                toLanguage: toLang,
                qualityScore: qualityScore,
                userId: userId,
                timestamp: new Date(),
                type: 'text'
            };
            
            // 如果有用户ID，分发奖励
            if (userId) {
                try {
                    const reward = await this.calculateAndDistributeReward(translationRecord, userId);
                    translationRecord.reward = reward;
                } catch (rewardError) {
                    console.warn('翻译奖励分发失败:', rewardError.message);
                }
            }
            
            console.log(`✅ 文本翻译完成: ${fromLang} -> ${toLang}`);
            
            return {
                success: true,
                data: translationRecord
            };
            
        } catch (error) {
            console.error('❌ 文本翻译失败:', error);
            throw error;
        }
    }

    /**
     * 批量翻译
     */
    async batchTranslate(texts, fromLang, toLang, userId = null) {
        try {
            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('翻译文本列表不能为空');
            }
            
            if (texts.length > 100) {
                throw new Error('批量翻译最多支持100条文本');
            }
            
            const results = [];
            let totalReward = 0;
            
            for (const text of texts) {
                try {
                    const result = await this.translateText(text, fromLang, toLang, userId);
                    results.push(result);
                    
                    if (result.data.reward) {
                        totalReward += result.data.reward.amount || 0;
                    }
                } catch (error) {
                    results.push({
                        success: false,
                        error: error.message,
                        originalText: text
                    });
                }
            }
            
            return {
                success: true,
                data: {
                    results: results,
                    totalTranslations: texts.length,
                    successCount: results.filter(r => r.success).length,
                    totalReward: totalReward
                }
            };
            
        } catch (error) {
            console.error('❌ 批量翻译失败:', error);
            throw error;
        }
    }

    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return Object.keys(this.supportedLanguages).map(code => ({
            code: code,
            name: this.supportedLanguages[code].name,
            nativeName: this.supportedLanguages[code].nativeName || this.supportedLanguages[code].name
        }));
    }

    /**
     * 检测语言
     */
    async detectLanguage(text) {
        try {
            if (!text || text.trim().length === 0) {
                throw new Error('检测文本不能为空');
            }
            
            // 简单的语言检测逻辑（实际应该使用专业的语言检测API）
            const detectedLang = this.simpleLanguageDetection(text);
            
            return {
                success: true,
                data: {
                    language: detectedLang,
                    confidence: 0.85,
                    alternatives: []
                }
            };
            
        } catch (error) {
            console.error('❌ 语言检测失败:', error);
            throw error;
        }
    }

    /**
     * 获取翻译历史
     */
    async getTranslationHistory(userId, limit = 50, offset = 0) {
        try {
            // 这里应该从数据库获取翻译历史
            // 暂时返回模拟数据
            
            return {
                success: true,
                data: {
                    translations: [],
                    total: 0,
                    limit: limit,
                    offset: offset
                }
            };
            
        } catch (error) {
            console.error('❌ 获取翻译历史失败:', error);
            throw error;
        }
    }

    /**
     * 获取翻译统计
     */
    async getTranslationStats(userId) {
        try {
            // 这里应该从数据库获取统计数据
            
            return {
                success: true,
                data: {
                    totalTranslations: 0,
                    totalRewards: 0,
                    averageQuality: 0,
                    languagePairs: {},
                    dailyStats: []
                }
            };
            
        } catch (error) {
            console.error('❌ 获取翻译统计失败:', error);
            throw error;
        }
    }

    /**
     * 文本预处理
     */
    preprocessText(text) {
        // 移除多余的空白字符
        let processed = text.trim().replace(/\s+/g, ' ');
        
        // 处理特殊字符
        processed = processed.replace(/[""]/g, '"');
        processed = processed.replace(/['']/g, "'");
        
        return processed;
    }

    /**
     * 执行翻译（模拟实现）
     */
    async performTranslation(text, fromLang, toLang) {
        // 这里应该调用真实的翻译API，如Google Translate、百度翻译等
        // 现在使用模拟翻译
        
        await new Promise(resolve => setTimeout(resolve, 100)); // 模拟API延迟
        
        // 简单的模拟翻译逻辑
        const translations = {
            'zh-CN': {
                'en': this.simulateTranslation(text, 'Chinese to English'),
                'ja': this.simulateTranslation(text, 'Chinese to Japanese'),
                'ko': this.simulateTranslation(text, 'Chinese to Korean')
            },
            'en': {
                'zh-CN': this.simulateTranslation(text, 'English to Chinese'),
                'ja': this.simulateTranslation(text, 'English to Japanese'),
                'ko': this.simulateTranslation(text, 'English to Korean')
            }
        };
        
        if (translations[fromLang] && translations[fromLang][toLang]) {
            return translations[fromLang][toLang];
        }
        
        // 默认返回带标记的原文
        return `[${fromLang}->${toLang}] ${text}`;
    }

    /**
     * 模拟翻译
     */
    simulateTranslation(text, direction) {
        const templates = {
            'Chinese to English': `[EN] ${text}`,
            'English to Chinese': `[中文] ${text}`,
            'Chinese to Japanese': `[日本語] ${text}`,
            'English to Japanese': `[日本語] ${text}`,
            'Chinese to Korean': `[한국어] ${text}`,
            'English to Korean': `[한국어] ${text}`
        };
        
        return templates[direction] || `[Translated] ${text}`;
    }

    /**
     * 简单语言检测
     */
    simpleLanguageDetection(text) {
        // 简单的语言检测逻辑
        const chineseRegex = /[\u4e00-\u9fff]/;
        const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
        const koreanRegex = /[\uac00-\ud7af]/;
        const arabicRegex = /[\u0600-\u06ff]/;
        const russianRegex = /[\u0400-\u04ff]/;
        
        if (chineseRegex.test(text)) {
            return 'zh-CN';
        } else if (japaneseRegex.test(text)) {
            return 'ja';
        } else if (koreanRegex.test(text)) {
            return 'ko';
        } else if (arabicRegex.test(text)) {
            return 'ar';
        } else if (russianRegex.test(text)) {
            return 'ru';
        } else {
            return 'en'; // 默认英语
        }
    }

    /**
     * 计算翻译质量分数
     */
    calculateQualityScore(originalText, translatedText, fromLang, toLang) {
        try {
            // 长度评分
            const lengthScore = Math.min(originalText.length / 100, 1.0);
            
            // 复杂度评分（基于字符种类和标点符号）
            const complexityScore = this.calculateComplexityScore(originalText);
            
            // 准确性评分（简化实现，实际应该使用更复杂的算法）
            const accuracyScore = this.calculateAccuracyScore(originalText, translatedText);
            
            // 综合评分
            const totalScore = (
                lengthScore * this.qualityWeights.length +
                complexityScore * this.qualityWeights.complexity +
                accuracyScore * this.qualityWeights.accuracy
            );
            
            return Math.round(totalScore * 100) / 100; // 保留两位小数
            
        } catch (error) {
            console.warn('质量评分计算失败:', error);
            return 0.5; // 默认分数
        }
    }

    /**
     * 计算复杂度分数
     */
    calculateComplexityScore(text) {
        let score = 0.5; // 基础分数
        
        // 检查标点符号
        const punctuationCount = (text.match(/[.,!?;:]/g) || []).length;
        score += Math.min(punctuationCount * 0.05, 0.2);
        
        // 检查数字
        const numberCount = (text.match(/\d/g) || []).length;
        score += Math.min(numberCount * 0.02, 0.1);
        
        // 检查特殊字符
        const specialCharCount = (text.match(/[#@$%^&*()]/g) || []).length;
        score += Math.min(specialCharCount * 0.03, 0.1);
        
        return Math.min(score, 1.0);
    }

    /**
     * 计算准确性分数（简化实现）
     */
    calculateAccuracyScore(originalText, translatedText) {
        // 简化的准确性评估
        const lengthRatio = translatedText.length / originalText.length;
        
        // 理想的长度比例在0.5-2.0之间
        if (lengthRatio >= 0.5 && lengthRatio <= 2.0) {
            return 0.8;
        } else if (lengthRatio >= 0.3 && lengthRatio <= 3.0) {
            return 0.6;
        } else {
            return 0.4;
        }
    }

    /**
     * 计算并分发奖励
     */
    async calculateAndDistributeReward(translationRecord, userId) {
        try {
            // 计算奖励金额
            const baseReward = this.rewardConfig.baseReward;
            const qualityBonus = translationRecord.qualityScore * this.rewardConfig.qualityMultiplier;
            const lengthBonus = Math.floor(translationRecord.originalText.length / 100) * this.rewardConfig.lengthBonus;
            
            const totalReward = baseReward + qualityBonus + lengthBonus;
            
            // 检查每日限额
            const dailyEarned = await this.getDailyTranslationRewards(userId);
            if (dailyEarned + totalReward > this.rewardConfig.dailyLimit) {
                throw new Error('超出每日翻译奖励限额');
            }
            
            // 分发奖励
            const rewardResult = await this.blockchainService.distributeReward(
                userId, // 这里需要用户的钱包地址
                1, // LEARNING_REWARD category
                `Text translation: ${translationRecord.fromLanguage} -> ${translationRecord.toLanguage}`
            );
            
            return {
                amount: totalReward,
                breakdown: {
                    base: baseReward,
                    quality: qualityBonus,
                    length: lengthBonus
                },
                transaction: rewardResult
            };
            
        } catch (error) {
            console.error('奖励计算和分发失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户今日翻译奖励
     */
    async getDailyTranslationRewards(userId) {
        try {
            // 这里应该从数据库查询用户今日的翻译奖励总额
            // 暂时返回0
            return 0;
        } catch (error) {
            console.warn('获取每日翻译奖励失败:', error);
            return 0;
        }
    }

    /**
     * 验证翻译请求
     */
    validateTranslationRequest(text, fromLang, toLang) {
        const errors = [];
        
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            errors.push('翻译文本不能为空');
        }
        
        if (text && text.length > 5000) {
            errors.push('翻译文本长度不能超过5000字符');
        }
        
        if (!fromLang || !this.supportedLanguages[fromLang]) {
            errors.push('不支持的源语言');
        }
        
        if (!toLang || !this.supportedLanguages[toLang]) {
            errors.push('不支持的目标语言');
        }
        
        if (fromLang === toLang) {
            errors.push('源语言和目标语言不能相同');
        }
        
        return errors;
    }

    /**
     * 获取翻译建议
     */
    getTranslationSuggestions(text, fromLang) {
        const suggestions = [];
        
        // 基于文本内容提供翻译建议
        if (text.includes('你好') || text.includes('hello')) {
            suggestions.push({
                type: 'greeting',
                message: '检测到问候语，建议使用礼貌的翻译方式'
            });
        }
        
        if (text.includes('谢谢') || text.includes('thank')) {
            suggestions.push({
                type: 'gratitude',
                message: '检测到感谢用语，建议保持感情色彩'
            });
        }
        
        return suggestions;
    }

    /**
     * 关闭服务
     */
    async close() {
        try {
            if (this.blockchainService) {
                await this.blockchainService.close();
            }
            console.log('🔒 翻译服务已关闭');
        } catch (error) {
            console.error('❌ 关闭翻译服务失败:', error);
        }
    }
}

module.exports = EnhancedTranslationService;

