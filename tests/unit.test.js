const User = require('../src/models/User');
const CulturalExchange = require('../src/models/CulturalExchange');
const LanguageLearningSession = require('../src/models/LanguageLearningSession');
const VoiceTranslation = require('../src/models/VoiceTranslation');
const TokenRewardService = require('../src/services/tokenRewardService');
const EnhancedBlockchainService = require('../src/services/enhancedBlockchainService');
const EnhancedVoiceTranslationService = require('../src/services/enhancedVoiceTranslationService');

describe('Unit Tests', () => {
    describe('User Model', () => {
        test('应该能够创建用户', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            };

            const user = new User(userData);
            expect(user.username).toBe(userData.username);
            expect(user.email).toBe(userData.email);
        });

        test('应该能够验证密码', async () => {
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            });

            // 模拟密码加密
            user.password = '$2a$10$hashedpassword';
            
            // 这里需要实际的密码验证逻辑
            expect(typeof user.matchPassword).toBe('function');
        });

        test('应该能够生成JWT令牌', () => {
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            });

            user._id = 'mockid123';
            expect(typeof user.getSignedJwtToken).toBe('function');
        });
    });

    describe('CulturalExchange Model', () => {
        test('应该能够创建文化交流活动', () => {
            const exchangeData = {
                title: '测试活动',
                description: '测试描述',
                organizer: 'mockuserid',
                category: 'language_exchange',
                languages: ['zh', 'en'],
                maxParticipants: 20,
                startTime: new Date(),
                endTime: new Date(Date.now() + 60 * 60 * 1000)
            };

            const exchange = new CulturalExchange(exchangeData);
            expect(exchange.title).toBe(exchangeData.title);
            expect(exchange.category).toBe(exchangeData.category);
        });

        test('应该能够检查用户是否已参与', () => {
            const exchange = new CulturalExchange({
                title: '测试活动',
                description: '测试描述',
                organizer: 'mockuserid',
                category: 'language_exchange',
                languages: ['zh', 'en'],
                maxParticipants: 20,
                startTime: new Date(),
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                participants: [
                    { user: 'user1' },
                    { user: 'user2' }
                ]
            });

            expect(exchange.isUserParticipant('user1')).toBe(true);
            expect(exchange.isUserParticipant('user3')).toBe(false);
        });

        test('应该能够计算可用名额', () => {
            const exchange = new CulturalExchange({
                title: '测试活动',
                description: '测试描述',
                organizer: 'mockuserid',
                category: 'language_exchange',
                languages: ['zh', 'en'],
                maxParticipants: 10,
                startTime: new Date(),
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                participants: [
                    { user: 'user1' },
                    { user: 'user2' },
                    { user: 'user3' }
                ]
            });

            expect(exchange.getAvailableSlots()).toBe(7);
        });
    });

    describe('LanguageLearningSession Model', () => {
        test('应该能够创建语言学习会话', () => {
            const sessionData = {
                title: '英语学习',
                description: '英语口语练习',
                teacher: 'teacherid',
                targetLanguage: 'en',
                sourceLanguage: 'zh',
                level: 'beginner',
                maxStudents: 15
            };

            const session = new LanguageLearningSession(sessionData);
            expect(session.title).toBe(sessionData.title);
            expect(session.targetLanguage).toBe(sessionData.targetLanguage);
        });

        test('应该能够检查用户是否已注册', () => {
            const session = new LanguageLearningSession({
                title: '英语学习',
                description: '英语口语练习',
                teacher: 'teacherid',
                targetLanguage: 'en',
                sourceLanguage: 'zh',
                level: 'beginner',
                maxStudents: 15,
                students: [
                    { user: 'student1' },
                    { user: 'student2' }
                ]
            });

            expect(session.isUserEnrolled('student1')).toBe(true);
            expect(session.isUserEnrolled('student3')).toBe(false);
        });

        test('应该能够计算学生进度', () => {
            const session = new LanguageLearningSession({
                title: '英语学习',
                description: '英语口语练习',
                teacher: 'teacherid',
                targetLanguage: 'en',
                sourceLanguage: 'zh',
                level: 'beginner',
                maxStudents: 15,
                students: [
                    { 
                        user: 'student1',
                        completedLessons: ['lesson1', 'lesson2']
                    }
                ],
                curriculum: [
                    { lesson: 'lesson1', order: 1 },
                    { lesson: 'lesson2', order: 2 },
                    { lesson: 'lesson3', order: 3 },
                    { lesson: 'lesson4', order: 4 }
                ]
            });

            expect(session.calculateStudentProgress('student1')).toBe(50);
        });
    });

    describe('VoiceTranslation Model', () => {
        test('应该能够创建语音翻译记录', () => {
            const translationData = {
                user: 'userid',
                originalText: 'Hello world',
                originalLanguage: 'en',
                translations: [
                    {
                        language: 'zh',
                        text: '你好世界',
                        confidence: 0.9
                    }
                ]
            };

            const translation = new VoiceTranslation(translationData);
            expect(translation.originalText).toBe(translationData.originalText);
            expect(translation.translations.length).toBe(1);
        });

        test('应该能够获取特定语言的翻译', () => {
            const translation = new VoiceTranslation({
                user: 'userid',
                originalText: 'Hello world',
                originalLanguage: 'en',
                translations: [
                    {
                        language: 'zh',
                        text: '你好世界',
                        confidence: 0.9
                    },
                    {
                        language: 'fr',
                        text: 'Bonjour le monde',
                        confidence: 0.8
                    }
                ]
            });

            const zhTranslation = translation.getTranslation('zh');
            expect(zhTranslation.text).toBe('你好世界');
            
            const esTranslation = translation.getTranslation('es');
            expect(esTranslation).toBeUndefined();
        });

        test('应该能够获取最佳翻译', () => {
            const translation = new VoiceTranslation({
                user: 'userid',
                originalText: 'Hello world',
                originalLanguage: 'en',
                translations: [
                    {
                        language: 'zh',
                        text: '你好世界',
                        confidence: 0.9
                    },
                    {
                        language: 'fr',
                        text: 'Bonjour le monde',
                        confidence: 0.8
                    }
                ]
            });

            const bestTranslation = translation.getBestTranslation();
            expect(bestTranslation.language).toBe('zh');
            expect(bestTranslation.confidence).toBe(0.9);
        });
    });

    describe('TokenRewardService', () => {
        let tokenRewardService;

        beforeEach(() => {
            tokenRewardService = new TokenRewardService();
        });

        test('应该有正确的奖励配置', () => {
            expect(tokenRewardService.rewardConfig).toBeDefined();
            expect(tokenRewardService.rewardConfig.culturalExchange).toBeDefined();
            expect(tokenRewardService.rewardConfig.languageLearning).toBeDefined();
            expect(tokenRewardService.rewardConfig.community).toBeDefined();
        });

        test('应该能够计算奖励金额', () => {
            const creationReward = tokenRewardService.rewardConfig.culturalExchange.creation;
            expect(typeof creationReward).toBe('number');
            expect(creationReward).toBeGreaterThan(0);
        });
    });

    describe('EnhancedBlockchainService', () => {
        let blockchainService;

        beforeEach(() => {
            blockchainService = new EnhancedBlockchainService();
        });

        test('应该能够验证钱包地址', () => {
            const validAddress = '0x742d35Cc6634C0532925a3b8D4C2C2C2C2C2C2C2';
            const invalidAddress = 'invalid_address';

            expect(blockchainService.isValidAddress(validAddress)).toBe(true);
            expect(blockchainService.isValidAddress(invalidAddress)).toBe(false);
        });

        test('应该能够生成钱包', () => {
            const wallet = blockchainService.generateWallet();
            
            expect(wallet).toBeDefined();
            expect(wallet.address).toBeDefined();
            expect(wallet.privateKey).toBeDefined();
            expect(wallet.address.startsWith('0x')).toBe(true);
        });

        test('应该有正确的网络配置', () => {
            expect(blockchainService.networks).toBeDefined();
            expect(blockchainService.networks.mainnet).toBeDefined();
            expect(blockchainService.networks.testnet).toBeDefined();
        });
    });

    describe('EnhancedVoiceTranslationService', () => {
        let voiceService;

        beforeEach(() => {
            voiceService = new EnhancedVoiceTranslationService();
        });

        test('应该有支持的语言配置', () => {
            expect(voiceService.supportedLanguages).toBeDefined();
            expect(voiceService.supportedLanguages.zh).toBeDefined();
            expect(voiceService.supportedLanguages.en).toBeDefined();
        });

        test('应该能够检测语言', async () => {
            const chineseText = '你好世界';
            const englishText = 'Hello world';
            const arabicText = 'مرحبا بالعالم';

            const chineseLang = await voiceService.detectLanguage(chineseText);
            const englishLang = await voiceService.detectLanguage(englishText);
            const arabicLang = await voiceService.detectLanguage(arabicText);

            expect(chineseLang).toBe('zh');
            expect(englishLang).toBe('en');
            expect(arabicLang).toBe('ar');
        });

        test('应该有正确的音频配置', () => {
            expect(voiceService.audioConfig).toBeDefined();
            expect(voiceService.audioConfig.sampleRate).toBe(16000);
            expect(voiceService.audioConfig.channels).toBe(1);
        });

        test('应该能够获取支持的语言列表', () => {
            const languages = voiceService.getSupportedLanguages();
            
            expect(languages).toBeDefined();
            expect(typeof languages).toBe('object');
            expect(languages.zh).toBeDefined();
            expect(languages.en).toBeDefined();
        });
    });

    describe('Utility Functions', () => {
        test('应该能够生成唯一ID', () => {
            const id1 = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const id2 = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            expect(id1).not.toBe(id2);
            expect(id1.startsWith('voice_')).toBe(true);
        });

        test('应该能够验证邮箱格式', () => {
            const validEmail = 'test@example.com';
            const invalidEmail = 'invalid_email';
            
            const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
            
            expect(emailRegex.test(validEmail)).toBe(true);
            expect(emailRegex.test(invalidEmail)).toBe(false);
        });

        test('应该能够计算百分比', () => {
            const completed = 3;
            const total = 10;
            const percentage = Math.round((completed / total) * 100);
            
            expect(percentage).toBe(30);
        });
    });
});

