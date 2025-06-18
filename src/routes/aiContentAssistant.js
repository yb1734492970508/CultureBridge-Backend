const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// AI内容审核服务
class AIContentModerationService {
    constructor() {
        // 违禁词库 - 实际应用中应从数据库或配置文件加载
        this.forbiddenWords = [
            '违法', '暴力', '色情', '赌博', '毒品', '恐怖主义',
            'stupid', 'hate', 'kill', 'die', 'violence'
        ];
        
        // 敏感词替换建议
        this.replacementSuggestions = {
            'stupid': ['unintelligent', 'unwise', 'foolish'],
            'hate': ['dislike', 'disapprove', 'disagree with'],
            '违法': ['不当', '不合适', '有问题'],
            '暴力': ['激烈', '强烈', '过激']
        };
    }

    // 检测违禁词
    detectForbiddenWords(text) {
        const detectedWords = [];
        const lowerText = text.toLowerCase();
        
        this.forbiddenWords.forEach(word => {
            if (lowerText.includes(word.toLowerCase())) {
                const regex = new RegExp(word, 'gi');
                const matches = [...text.matchAll(regex)];
                matches.forEach(match => {
                    detectedWords.push({
                        word: match[0],
                        position: match.index,
                        suggestions: this.replacementSuggestions[word.toLowerCase()] || []
                    });
                });
            }
        });
        
        return detectedWords;
    }

    // 内容质量评估
    assessContentQuality(text) {
        const score = {
            grammar: this.assessGrammar(text),
            readability: this.assessReadability(text),
            engagement: this.assessEngagement(text),
            overall: 0
        };
        
        score.overall = (score.grammar + score.readability + score.engagement) / 3;
        
        return {
            score,
            suggestions: this.generateQualitySuggestions(score, text)
        };
    }

    // 语法评估
    assessGrammar(text) {
        // 简单的语法检查逻辑
        let score = 100;
        
        // 检查句子长度
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgSentenceLength = text.length / sentences.length;
        
        if (avgSentenceLength > 200) score -= 20; // 句子过长
        if (avgSentenceLength < 10) score -= 15; // 句子过短
        
        // 检查标点符号
        const punctuationRatio = (text.match(/[.!?,:;]/g) || []).length / text.length;
        if (punctuationRatio < 0.02) score -= 10; // 标点符号过少
        
        return Math.max(0, score);
    }

    // 可读性评估
    assessReadability(text) {
        let score = 100;
        
        // 检查段落结构
        const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
        if (paragraphs.length === 1 && text.length > 500) score -= 20; // 缺少段落分隔
        
        // 检查词汇多样性
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        const uniqueWords = new Set(words);
        const diversity = uniqueWords.size / words.length;
        
        if (diversity < 0.3) score -= 15; // 词汇重复度过高
        
        return Math.max(0, score);
    }

    // 吸引力评估
    assessEngagement(text) {
        let score = 70; // 基础分
        
        // 检查情感词汇
        const emotionalWords = ['amazing', 'wonderful', 'exciting', '精彩', '有趣', '令人惊叹'];
        const hasEmotionalWords = emotionalWords.some(word => 
            text.toLowerCase().includes(word.toLowerCase())
        );
        if (hasEmotionalWords) score += 15;
        
        // 检查问句
        if (text.includes('?') || text.includes('？')) score += 10;
        
        // 检查长度适中
        if (text.length >= 100 && text.length <= 1000) score += 5;
        
        return Math.min(100, score);
    }

    // 生成质量改进建议
    generateQualitySuggestions(score, text) {
        const suggestions = [];
        
        if (score.grammar < 80) {
            suggestions.push({
                type: 'grammar',
                message: '建议检查语法和句子结构，确保表达清晰',
                priority: 'high'
            });
        }
        
        if (score.readability < 70) {
            suggestions.push({
                type: 'readability',
                message: '建议增加段落分隔，提高文本可读性',
                priority: 'medium'
            });
        }
        
        if (score.engagement < 60) {
            suggestions.push({
                type: 'engagement',
                message: '建议添加更多情感色彩的词汇，增强内容吸引力',
                priority: 'medium'
            });
        }
        
        if (text.length < 50) {
            suggestions.push({
                type: 'length',
                message: '内容过短，建议增加更多细节和描述',
                priority: 'low'
            });
        }
        
        return suggestions;
    }

    // 获取创作灵感
    getCreativeInspiration(userInterests = [], trendingTopics = []) {
        const inspirations = [
            {
                id: 1,
                title: '分享你的文化传统',
                description: '介绍你家乡独特的文化传统或节日庆典',
                tags: ['文化', '传统', '节日'],
                difficulty: 'easy',
                estimatedTime: '10-15分钟'
            },
            {
                id: 2,
                title: '语言学习心得',
                description: '分享你学习外语的经验和技巧',
                tags: ['语言学习', '经验分享', '技巧'],
                difficulty: 'medium',
                estimatedTime: '15-20分钟'
            },
            {
                id: 3,
                title: '跨文化交流故事',
                description: '讲述一次难忘的跨文化交流经历',
                tags: ['跨文化', '故事', '经历'],
                difficulty: 'medium',
                estimatedTime: '20-30分钟'
            },
            {
                id: 4,
                title: '美食文化探索',
                description: '介绍你喜欢的异国美食及其文化背景',
                tags: ['美食', '文化', '探索'],
                difficulty: 'easy',
                estimatedTime: '10-15分钟'
            },
            {
                id: 5,
                title: '旅行见闻分享',
                description: '分享你在异国他乡的有趣见闻',
                tags: ['旅行', '见闻', '文化差异'],
                difficulty: 'easy',
                estimatedTime: '15-25分钟'
            }
        ];
        
        // 根据用户兴趣和热门话题进行个性化推荐
        return inspirations.map(inspiration => ({
            ...inspiration,
            relevanceScore: this.calculateRelevanceScore(inspiration, userInterests, trendingTopics)
        })).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 计算相关性分数
    calculateRelevanceScore(inspiration, userInterests, trendingTopics) {
        let score = 50; // 基础分
        
        // 根据用户兴趣加分
        userInterests.forEach(interest => {
            if (inspiration.tags.some(tag => tag.includes(interest))) {
                score += 20;
            }
        });
        
        // 根据热门话题加分
        trendingTopics.forEach(topic => {
            if (inspiration.tags.some(tag => tag.includes(topic))) {
                score += 15;
            }
        });
        
        return Math.min(100, score);
    }
}

const aiService = new AIContentModerationService();

// 内容审核接口
router.post('/moderate', [
    body('content').notEmpty().withMessage('内容不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '请求参数错误',
                errors: errors.array()
            });
        }

        const { content } = req.body;
        
        // 检测违禁词
        const forbiddenWords = aiService.detectForbiddenWords(content);
        
        // 评估内容质量
        const qualityAssessment = aiService.assessContentQuality(content);
        
        res.json({
            success: true,
            data: {
                hasForbiddenWords: forbiddenWords.length > 0,
                forbiddenWords,
                qualityAssessment,
                isApproved: forbiddenWords.length === 0 && qualityAssessment.score.overall >= 60
            }
        });
    } catch (error) {
        console.error('内容审核错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 获取创作灵感接口
router.get('/inspiration', async (req, res) => {
    try {
        const { interests, trending } = req.query;
        const userInterests = interests ? interests.split(',') : [];
        const trendingTopics = trending ? trending.split(',') : [];
        
        const inspirations = aiService.getCreativeInspiration(userInterests, trendingTopics);
        
        res.json({
            success: true,
            data: {
                inspirations: inspirations.slice(0, 10) // 返回前10个最相关的灵感
            }
        });
    } catch (error) {
        console.error('获取创作灵感错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 内容优化建议接口
router.post('/optimize', [
    body('content').notEmpty().withMessage('内容不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '请求参数错误',
                errors: errors.array()
            });
        }

        const { content } = req.body;
        
        // 生成优化建议
        const qualityAssessment = aiService.assessContentQuality(content);
        const forbiddenWords = aiService.detectForbiddenWords(content);
        
        const optimizations = [];
        
        // 添加违禁词替换建议
        forbiddenWords.forEach(item => {
            if (item.suggestions.length > 0) {
                optimizations.push({
                    type: 'word_replacement',
                    original: item.word,
                    suggestions: item.suggestions,
                    position: item.position,
                    priority: 'high'
                });
            }
        });
        
        // 添加质量改进建议
        qualityAssessment.suggestions.forEach(suggestion => {
            optimizations.push(suggestion);
        });
        
        res.json({
            success: true,
            data: {
                optimizations,
                currentScore: qualityAssessment.score.overall,
                estimatedImprovement: Math.min(100, qualityAssessment.score.overall + optimizations.length * 5)
            }
        });
    } catch (error) {
        console.error('内容优化错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

module.exports = router;

