const CBTTokenService = require('../src/services/cbtTokenService');
const OptimizedBlockchainService = require('../src/services/optimizedBlockchainService');

describe('CBT Token Service Unit Tests', () => {
    let cbtTokenService;
    let mockBlockchainService;
    
    beforeEach(() => {
        mockBlockchainService = new OptimizedBlockchainService();
        cbtTokenService = new CBTTokenService();
    });
    
    describe('Reward Distribution', () => {
        test('应该能够分发每日登录奖励', async () => {
            const result = await cbtTokenService.distributeReward(
                'user123',
                'DAILY_LOGIN',
                '5.0',
                '每日登录奖励'
            );
            
            expect(result.success).toBe(true);
            expect(result.amount).toBe('5.0');
            expect(result.type).toBe('DAILY_LOGIN');
        });
        
        test('应该能够分发聊天参与奖励', async () => {
            const result = await cbtTokenService.distributeReward(
                'user123',
                'CHAT_PARTICIPATION',
                '1.0',
                '聊天参与奖励'
            );
            
            expect(result.success).toBe(true);
            expect(result.amount).toBe('1.0');
        });
        
        test('应该拒绝无效的奖励金额', async () => {
            const result = await cbtTokenService.distributeReward(
                'user123',
                'DAILY_LOGIN',
                '-5.0',
                '无效奖励'
            );
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('金额必须大于0');
        });
    });
    
    describe('Balance Management', () => {
        test('应该能够获取用户余额', async () => {
            const result = await cbtTokenService.getUserBalance('user123');
            
            expect(result.success).toBe(true);
            expect(result.balance).toBeDefined();
        });
        
        test('应该能够更新用户余额', async () => {
            const result = await cbtTokenService.updateBalance('user123', '10.0', 'ADD');
            
            expect(result.success).toBe(true);
            expect(parseFloat(result.newBalance)).toBeGreaterThan(0);
        });
    });
    
    describe('Transaction History', () => {
        test('应该能够记录交易', async () => {
            const result = await cbtTokenService.recordTransaction({
                userId: 'user123',
                type: 'REWARD',
                amount: '5.0',
                description: '测试交易',
                metadata: { source: 'test' }
            });
            
            expect(result.success).toBe(true);
            expect(result.transaction).toBeDefined();
        });
        
        test('应该能够获取交易历史', async () => {
            const result = await cbtTokenService.getTransactionHistory('user123');
            
            expect(result.success).toBe(true);
            expect(Array.isArray(result.transactions)).toBe(true);
        });
    });
});

describe('Voice Translation Service Unit Tests', () => {
    let voiceTranslationService;
    
    beforeEach(() => {
        const AdvancedVoiceTranslationService = require('../src/services/advancedVoiceTranslationService');
        voiceTranslationService = new AdvancedVoiceTranslationService();
    });
    
    describe('Text Translation', () => {
        test('应该能够翻译简单文本', async () => {
            const result = await voiceTranslationService.translateText(
                'Hello world',
                'zh-CN',
                'en-US'
            );
            
            expect(result.success).toBe(true);
            expect(result.translatedText).toBeDefined();
            expect(result.sourceLanguage).toBe('en-US');
            expect(result.targetLanguage).toBe('zh-CN');
        });
        
        test('应该能够自动检测源语言', async () => {
            const result = await voiceTranslationService.translateText(
                '你好世界',
                'en-US',
                'auto'
            );
            
            expect(result.success).toBe(true);
            expect(result.sourceLanguage).toBeDefined();
        });
        
        test('应该拒绝空文本', async () => {
            const result = await voiceTranslationService.translateText(
                '',
                'zh-CN',
                'en-US'
            );
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('不能为空');
        });
    });
    
    describe('Language Detection', () => {
        test('应该能够检测中文', async () => {
            const result = await voiceTranslationService.detectLanguage('你好世界');
            
            expect(result.success).toBe(true);
            expect(result.language).toBe('zh-CN');
        });
        
        test('应该能够检测英文', async () => {
            const result = await voiceTranslationService.detectLanguage('Hello world');
            
            expect(result.success).toBe(true);
            expect(result.language).toBe('en-US');
        });
    });
    
    describe('Service Configuration', () => {
        test('应该返回支持的语言列表', () => {
            const languages = voiceTranslationService.getSupportedLanguages();
            
            expect(typeof languages).toBe('object');
            expect(languages['zh-CN']).toBeDefined();
            expect(languages['en-US']).toBeDefined();
        });
        
        test('应该返回服务状态', () => {
            const status = voiceTranslationService.getServiceStatus();
            
            expect(status.supportedLanguages).toBeGreaterThan(0);
            expect(status.cacheSize).toBeDefined();
        });
    });
});

describe('Chat Service Unit Tests', () => {
    const ChatRoom = require('../src/models/ChatRoom');
    const ChatMessage = require('../src/models/ChatMessage');
    
    describe('Chat Room Management', () => {
        test('应该能够创建聊天室', async () => {
            const chatRoom = new ChatRoom({
                name: '测试聊天室',
                description: '这是一个测试聊天室',
                creator: 'user123',
                type: 'PUBLIC',
                category: 'GENERAL'
            });
            
            expect(chatRoom.name).toBe('测试聊天室');
            expect(chatRoom.type).toBe('PUBLIC');
            expect(chatRoom.status).toBe('ACTIVE');
        });
        
        test('应该能够添加参与者', async () => {
            const chatRoom = new ChatRoom({
                name: '测试聊天室',
                creator: 'user123'
            });
            
            const added = chatRoom.addParticipant('user456');
            expect(added).toBe(true);
            expect(chatRoom.participants.length).toBe(1);
            expect(chatRoom.participants[0].user.toString()).toBe('user456');
        });
        
        test('应该能够移除参与者', async () => {
            const chatRoom = new ChatRoom({
                name: '测试聊天室',
                creator: 'user123'
            });
            
            chatRoom.addParticipant('user456');
            const removed = chatRoom.removeParticipant('user456');
            
            expect(removed).toBe(true);
            expect(chatRoom.participants.length).toBe(0);
        });
        
        test('应该能够检查用户发言权限', async () => {
            const chatRoom = new ChatRoom({
                name: '测试聊天室',
                creator: 'user123'
            });
            
            chatRoom.addParticipant('user456');
            const canPost = chatRoom.canUserPost('user456');
            
            expect(canPost).toBe(true);
        });
    });
    
    describe('Chat Message Management', () => {
        test('应该能够创建消息', async () => {
            const message = new ChatMessage({
                chatRoom: 'room123',
                sender: 'user123',
                type: 'TEXT',
                content: {
                    text: '你好世界'
                }
            });
            
            expect(message.content.text).toBe('你好世界');
            expect(message.type).toBe('TEXT');
            expect(message.status).toBe('SENT');
        });
        
        test('应该能够添加反应', async () => {
            const message = new ChatMessage({
                chatRoom: 'room123',
                sender: 'user123',
                content: { text: '测试消息' }
            });
            
            const added = message.addReaction('user456', '👍');
            expect(added).toBe(true);
            expect(message.reactions.length).toBe(1);
            expect(message.reactions[0].emoji).toBe('👍');
        });
        
        test('应该能够标记为已读', async () => {
            const message = new ChatMessage({
                chatRoom: 'room123',
                sender: 'user123',
                content: { text: '测试消息' }
            });
            
            const marked = message.markAsRead('user456');
            expect(marked).toBe(true);
            expect(message.readBy.length).toBe(1);
        });
        
        test('应该能够计算质量分数', async () => {
            const message = new ChatMessage({
                chatRoom: 'room123',
                sender: 'user123',
                content: { text: '这是一条很长的测试消息，包含了很多有用的信息，应该能够获得较高的质量分数。' }
            });
            
            const score = message.calculateQualityScore();
            expect(score).toBeGreaterThan(5);
            expect(score).toBeLessThanOrEqual(10);
        });
    });
});

describe('Cultural Learning Service Unit Tests', () => {
    const CulturalExchange = require('../src/models/CulturalExchange');
    const LanguageLearningSession = require('../src/models/LanguageLearningSession');
    
    describe('Cultural Exchange Management', () => {
        test('应该能够创建文化交流活动', async () => {
            const exchange = new CulturalExchange({
                title: '中国传统节日',
                description: '介绍中国的传统节日文化',
                creator: 'user123',
                type: 'CULTURAL_SHARING',
                targetLanguage: 'en-US',
                sourceLanguage: 'zh-CN'
            });
            
            expect(exchange.title).toBe('中国传统节日');
            expect(exchange.type).toBe('CULTURAL_SHARING');
            expect(exchange.status).toBe('ACTIVE');
        });
        
        test('应该能够添加参与者', async () => {
            const exchange = new CulturalExchange({
                title: '测试活动',
                creator: 'user123'
            });
            
            const added = exchange.addParticipant('user456', 'LEARNER');
            expect(added).toBe(true);
            expect(exchange.participants.length).toBe(1);
        });
    });
    
    describe('Language Learning Session Management', () => {
        test('应该能够创建学习会话', async () => {
            const session = new LanguageLearningSession({
                user: 'user123',
                type: 'VOCABULARY',
                targetLanguage: 'en-US',
                sourceLanguage: 'zh-CN',
                content: {
                    words: [
                        { word: 'hello', translation: '你好', pronunciation: 'həˈloʊ' }
                    ]
                }
            });
            
            expect(session.type).toBe('VOCABULARY');
            expect(session.content.words.length).toBe(1);
        });
        
        test('应该能够记录学习进度', async () => {
            const session = new LanguageLearningSession({
                user: 'user123',
                type: 'VOCABULARY',
                targetLanguage: 'en-US'
            });
            
            session.recordProgress(85, 10, 8);
            
            expect(session.progress.score).toBe(85);
            expect(session.progress.totalQuestions).toBe(10);
            expect(session.progress.correctAnswers).toBe(8);
        });
    });
});

describe('Blockchain Service Unit Tests', () => {
    let blockchainService;
    
    beforeEach(() => {
        blockchainService = new OptimizedBlockchainService();
    });
    
    describe('Network Status', () => {
        test('应该能够获取网络状态', async () => {
            const status = await blockchainService.getNetworkStatus();
            
            expect(status.success).toBe(true);
            expect(status.network).toBeDefined();
            expect(status.blockNumber).toBeDefined();
        });
        
        test('应该能够获取代币信息', async () => {
            const info = await blockchainService.getTokenInfo();
            
            expect(info.success).toBe(true);
            expect(info.name).toBe('CultureBridge Token');
            expect(info.symbol).toBe('CBT');
        });
    });
    
    describe('Balance Operations', () => {
        test('应该能够获取余额', async () => {
            const balance = await blockchainService.getBalance('0x123456789abcdef');
            
            expect(balance.success).toBe(true);
            expect(balance.balance).toBeDefined();
        });
        
        test('应该能够执行转账', async () => {
            const result = await blockchainService.transfer(
                '0x123456789abcdef',
                '0xfedcba987654321',
                '10.0'
            );
            
            expect(result.success).toBe(true);
            expect(result.transactionHash).toBeDefined();
        });
    });
});

describe('Performance Tests', () => {
    test('CBT Token Service 性能测试', async () => {
        const cbtTokenService = new CBTTokenService();
        const startTime = Date.now();
        
        // 执行100次余额查询
        const promises = [];
        for (let i = 0; i < 100; i++) {
            promises.push(cbtTokenService.getUserBalance(`user${i}`));
        }
        
        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(5000); // 5秒内完成
    });
    
    test('Voice Translation Service 性能测试', async () => {
        const AdvancedVoiceTranslationService = require('../src/services/advancedVoiceTranslationService');
        const voiceService = new AdvancedVoiceTranslationService();
        const startTime = Date.now();
        
        // 执行50次文本翻译
        const promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(voiceService.translateText(
                `Test message ${i}`,
                'zh-CN',
                'en-US'
            ));
        }
        
        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(10000); // 10秒内完成
    });
});

describe('Memory Usage Tests', () => {
    test('应该不会出现内存泄漏', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // 执行大量操作
        const CBTTokenService = require('../src/services/cbtTokenService');
        const cbtService = new CBTTokenService();
        
        for (let i = 0; i < 1000; i++) {
            await cbtService.getUserBalance(`user${i}`);
        }
        
        // 强制垃圾回收
        if (global.gc) {
            global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        
        // 内存增长不应超过50MB
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
});

