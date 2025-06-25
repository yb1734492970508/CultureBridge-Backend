const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class CrossBorderVoiceCallService extends EventEmitter {
    constructor() {
        super();
        this.waitingUsers = new Map(); // 等待匹配的用户
        this.activeMatches = new Map(); // 活跃的匹配
        this.activeCalls = new Map(); // 活跃的通话
        this.userProfiles = new Map(); // 用户资料
        this.callHistory = new Map(); // 通话历史
        this.translationSessions = new Map(); // 翻译会话
        
        // 支持的语言和国家
        this.supportedLanguages = [
            { code: 'zh-CN', name: '中文(简体)', flag: '🇨🇳', country: 'China' },
            { code: 'en-US', name: 'English', flag: '🇺🇸', country: 'United States' },
            { code: 'ja-JP', name: '日本語', flag: '🇯🇵', country: 'Japan' },
            { code: 'ko-KR', name: '한국어', flag: '🇰🇷', country: 'South Korea' },
            { code: 'fr-FR', name: 'Français', flag: '🇫🇷', country: 'France' },
            { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪', country: 'Germany' },
            { code: 'es-ES', name: 'Español', flag: '🇪🇸', country: 'Spain' },
            { code: 'it-IT', name: 'Italiano', flag: '🇮🇹', country: 'Italy' },
            { code: 'pt-PT', name: 'Português', flag: '🇵🇹', country: 'Portugal' },
            { code: 'ru-RU', name: 'Русский', flag: '🇷🇺', country: 'Russia' },
            { code: 'ar-SA', name: 'العربية', flag: '🇸🇦', country: 'Saudi Arabia' },
            { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳', country: 'India' }
        ];

        // 匹配配置
        this.matchingConfig = {
            maxWaitTime: 60000, // 最大等待时间 1分钟
            preferredMatchTime: 10000, // 优先匹配时间 10秒
            maxRetries: 3, // 最大重试次数
            languageWeight: 0.6, // 语言匹配权重
            countryWeight: 0.3, // 国家匹配权重
            interestWeight: 0.1 // 兴趣匹配权重
        };

        // 启动匹配引擎
        this.startMatchingEngine();
    }

    // 用户加入匹配队列
    async joinMatchingQueue(userId, userProfile) {
        try {
            const {
                nativeLanguage,
                targetLanguage,
                country,
                interests = [],
                ageGroup = 'adult',
                gender = 'any',
                callPreferences = {
                    enableTranslation: true,
                    callDuration: 'medium', // short, medium, long
                    topicPreference: 'any' // culture, language, travel, business, casual
                }
            } = userProfile;

            // 验证必要字段
            if (!nativeLanguage || !targetLanguage || !country) {
                throw new Error('缺少必要的用户信息');
            }

            // 检查用户是否已在队列中
            if (this.waitingUsers.has(userId)) {
                throw new Error('用户已在匹配队列中');
            }

            const queueEntry = {
                userId,
                nativeLanguage,
                targetLanguage,
                country,
                interests,
                ageGroup,
                gender,
                callPreferences,
                joinTime: Date.now(),
                retryCount: 0,
                status: 'waiting'
            };

            this.waitingUsers.set(userId, queueEntry);
            this.userProfiles.set(userId, userProfile);

            // 立即尝试匹配
            const match = await this.findMatch(userId);
            
            if (match) {
                return {
                    status: 'matched',
                    matchId: match.matchId,
                    partner: match.partner,
                    message: '找到匹配用户'
                };
            }

            return {
                status: 'waiting',
                queuePosition: this.getQueuePosition(userId),
                estimatedWaitTime: this.estimateWaitTime(queueEntry),
                message: '已加入匹配队列，正在寻找合适的通话伙伴'
            };

        } catch (error) {
            console.error('加入匹配队列失败:', error);
            throw new Error(`加入匹配队列失败: ${error.message}`);
        }
    }

    // 寻找匹配
    async findMatch(userId) {
        try {
            const user = this.waitingUsers.get(userId);
            if (!user) return null;

            // 获取所有等待中的用户（除了当前用户）
            const candidates = Array.from(this.waitingUsers.values())
                .filter(candidate => 
                    candidate.userId !== userId && 
                    candidate.status === 'waiting'
                );

            if (candidates.length === 0) return null;

            // 计算匹配分数
            const scoredCandidates = candidates.map(candidate => ({
                ...candidate,
                matchScore: this.calculateMatchScore(user, candidate)
            }));

            // 按匹配分数排序
            scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

            // 选择最佳匹配（分数 > 0.5）
            const bestMatch = scoredCandidates[0];
            if (bestMatch && bestMatch.matchScore > 0.5) {
                return await this.createMatch(user, bestMatch);
            }

            return null;

        } catch (error) {
            console.error('寻找匹配失败:', error);
            return null;
        }
    }

    // 计算匹配分数
    calculateMatchScore(user1, user2) {
        let score = 0;

        // 语言匹配（互补性）
        const languageScore = this.calculateLanguageScore(user1, user2);
        score += languageScore * this.matchingConfig.languageWeight;

        // 国家匹配（不同国家优先）
        const countryScore = user1.country !== user2.country ? 1 : 0.3;
        score += countryScore * this.matchingConfig.countryWeight;

        // 兴趣匹配
        const interestScore = this.calculateInterestScore(user1.interests, user2.interests);
        score += interestScore * this.matchingConfig.interestWeight;

        // 年龄组匹配
        const ageScore = user1.ageGroup === user2.ageGroup ? 0.8 : 0.5;
        score += ageScore * 0.1;

        // 通话偏好匹配
        const preferenceScore = this.calculatePreferenceScore(
            user1.callPreferences, 
            user2.callPreferences
        );
        score += preferenceScore * 0.1;

        return Math.min(score, 1.0);
    }

    // 计算语言匹配分数
    calculateLanguageScore(user1, user2) {
        // 理想情况：用户1的目标语言是用户2的母语，反之亦然
        if (user1.targetLanguage === user2.nativeLanguage && 
            user2.targetLanguage === user1.nativeLanguage) {
            return 1.0;
        }

        // 部分匹配：至少一个方向匹配
        if (user1.targetLanguage === user2.nativeLanguage || 
            user2.targetLanguage === user1.nativeLanguage) {
            return 0.8;
        }

        // 相同目标语言
        if (user1.targetLanguage === user2.targetLanguage) {
            return 0.6;
        }

        // 相同母语（不理想，但可以接受）
        if (user1.nativeLanguage === user2.nativeLanguage) {
            return 0.3;
        }

        return 0.1;
    }

    // 计算兴趣匹配分数
    calculateInterestScore(interests1, interests2) {
        if (!interests1.length || !interests2.length) return 0.5;

        const commonInterests = interests1.filter(interest => 
            interests2.includes(interest)
        );

        return commonInterests.length / Math.max(interests1.length, interests2.length);
    }

    // 计算偏好匹配分数
    calculatePreferenceScore(pref1, pref2) {
        let score = 0;
        let factors = 0;

        // 翻译偏好
        if (pref1.enableTranslation === pref2.enableTranslation) {
            score += 1;
        }
        factors++;

        // 通话时长偏好
        if (pref1.callDuration === pref2.callDuration) {
            score += 1;
        } else if (
            (pref1.callDuration === 'medium' && pref2.callDuration !== 'medium') ||
            (pref2.callDuration === 'medium' && pref1.callDuration !== 'medium')
        ) {
            score += 0.7;
        } else {
            score += 0.3;
        }
        factors++;

        // 话题偏好
        if (pref1.topicPreference === pref2.topicPreference || 
            pref1.topicPreference === 'any' || 
            pref2.topicPreference === 'any') {
            score += 1;
        } else {
            score += 0.5;
        }
        factors++;

        return score / factors;
    }

    // 创建匹配
    async createMatch(user1, user2) {
        try {
            const matchId = uuidv4();
            const match = {
                matchId,
                user1: {
                    userId: user1.userId,
                    nativeLanguage: user1.nativeLanguage,
                    targetLanguage: user1.targetLanguage,
                    country: user1.country
                },
                user2: {
                    userId: user2.userId,
                    nativeLanguage: user2.nativeLanguage,
                    targetLanguage: user2.targetLanguage,
                    country: user2.country
                },
                matchScore: this.calculateMatchScore(user1, user2),
                createdAt: Date.now(),
                status: 'matched',
                translationEnabled: user1.callPreferences.enableTranslation && 
                                  user2.callPreferences.enableTranslation
            };

            this.activeMatches.set(matchId, match);

            // 从等待队列中移除用户
            this.waitingUsers.delete(user1.userId);
            this.waitingUsers.delete(user2.userId);

            // 通知双方用户
            this.emit('match_found', {
                matchId,
                user1Id: user1.userId,
                user2Id: user2.userId,
                match
            });

            return {
                matchId,
                partner: user2,
                match
            };

        } catch (error) {
            console.error('创建匹配失败:', error);
            throw new Error(`创建匹配失败: ${error.message}`);
        }
    }

    // 开始通话
    async startCall(matchId, initiatorId, callOptions = {}) {
        try {
            const match = this.activeMatches.get(matchId);
            if (!match) {
                throw new Error('匹配不存在');
            }

            if (match.user1.userId !== initiatorId && match.user2.userId !== initiatorId) {
                throw new Error('无权限发起此通话');
            }

            const callId = uuidv4();
            const call = {
                callId,
                matchId,
                participants: [match.user1, match.user2],
                initiator: initiatorId,
                startTime: Date.now(),
                status: 'connecting',
                translationEnabled: match.translationEnabled,
                callOptions: {
                    videoEnabled: callOptions.videoEnabled || false,
                    recordingEnabled: callOptions.recordingEnabled || false,
                    translationMode: callOptions.translationMode || 'realtime'
                },
                webrtcData: {
                    offers: new Map(),
                    answers: new Map(),
                    iceCandidates: new Map()
                }
            };

            this.activeCalls.set(callId, call);

            // 如果启用翻译，创建翻译会话
            if (call.translationEnabled) {
                await this.createTranslationSession(callId, match);
            }

            // 更新匹配状态
            match.status = 'in_call';
            match.callId = callId;

            // 通知参与者
            this.emit('call_initiated', {
                callId,
                matchId,
                initiator: initiatorId,
                participants: call.participants,
                call
            });

            return {
                callId,
                status: 'connecting',
                participants: call.participants,
                translationEnabled: call.translationEnabled,
                message: '通话正在建立连接'
            };

        } catch (error) {
            console.error('开始通话失败:', error);
            throw new Error(`开始通话失败: ${error.message}`);
        }
    }

    // 创建翻译会话
    async createTranslationSession(callId, match) {
        try {
            const translationSession = {
                sessionId: `call_translation_${callId}`,
                callId,
                participants: [
                    {
                        userId: match.user1.userId,
                        nativeLanguage: match.user1.nativeLanguage,
                        targetLanguage: match.user1.targetLanguage
                    },
                    {
                        userId: match.user2.userId,
                        nativeLanguage: match.user2.nativeLanguage,
                        targetLanguage: match.user2.targetLanguage
                    }
                ],
                translationHistory: [],
                isActive: true,
                createdAt: Date.now()
            };

            this.translationSessions.set(callId, translationSession);

            return translationSession;

        } catch (error) {
            console.error('创建翻译会话失败:', error);
            throw error;
        }
    }

    // 处理WebRTC信令
    async handleWebRTCSignaling(callId, userId, signalType, signalData) {
        try {
            const call = this.activeCalls.get(callId);
            if (!call) {
                throw new Error('通话不存在');
            }

            const participant = call.participants.find(p => p.userId === userId);
            if (!participant) {
                throw new Error('用户不在此通话中');
            }

            switch (signalType) {
                case 'offer':
                    call.webrtcData.offers.set(userId, signalData);
                    break;
                case 'answer':
                    call.webrtcData.answers.set(userId, signalData);
                    break;
                case 'ice-candidate':
                    if (!call.webrtcData.iceCandidates.has(userId)) {
                        call.webrtcData.iceCandidates.set(userId, []);
                    }
                    call.webrtcData.iceCandidates.get(userId).push(signalData);
                    break;
                default:
                    throw new Error('未知的信令类型');
            }

            // 转发信令给其他参与者
            const otherParticipants = call.participants.filter(p => p.userId !== userId);
            this.emit('webrtc_signal', {
                callId,
                fromUserId: userId,
                toUserIds: otherParticipants.map(p => p.userId),
                signalType,
                signalData
            });

            return {
                success: true,
                message: '信令处理成功'
            };

        } catch (error) {
            console.error('处理WebRTC信令失败:', error);
            throw new Error(`信令处理失败: ${error.message}`);
        }
    }

    // 处理通话中的翻译
    async processCallTranslation(callId, userId, audioData, options = {}) {
        try {
            const call = this.activeCalls.get(callId);
            if (!call || !call.translationEnabled) {
                throw new Error('通话不存在或未启用翻译');
            }

            const translationSession = this.translationSessions.get(callId);
            if (!translationSession) {
                throw new Error('翻译会话不存在');
            }

            const participant = translationSession.participants.find(p => p.userId === userId);
            if (!participant) {
                throw new Error('用户不在翻译会话中');
            }

            const otherParticipant = translationSession.participants.find(p => p.userId !== userId);

            // 模拟语音识别和翻译
            const transcriptionResult = await this.transcribeCallAudio(
                audioData, 
                participant.nativeLanguage
            );

            const translationResult = await this.translateCallText(
                transcriptionResult.text,
                participant.nativeLanguage,
                otherParticipant.nativeLanguage
            );

            // 生成翻译语音
            const translatedAudioPath = await this.generateCallSpeech(
                translationResult.translatedText,
                otherParticipant.nativeLanguage
            );

            // 记录翻译历史
            const translationRecord = {
                id: uuidv4(),
                timestamp: Date.now(),
                fromUserId: userId,
                toUserId: otherParticipant.userId,
                originalText: transcriptionResult.text,
                translatedText: translationResult.translatedText,
                sourceLanguage: participant.nativeLanguage,
                targetLanguage: otherParticipant.nativeLanguage,
                confidence: translationResult.confidence,
                audioPath: translatedAudioPath
            };

            translationSession.translationHistory.push(translationRecord);

            // 通知接收方
            this.emit('translation_ready', {
                callId,
                fromUserId: userId,
                toUserId: otherParticipant.userId,
                translation: translationRecord
            });

            return {
                success: true,
                translation: translationRecord,
                message: '翻译处理完成'
            };

        } catch (error) {
            console.error('处理通话翻译失败:', error);
            throw new Error(`翻译处理失败: ${error.message}`);
        }
    }

    // 结束通话
    async endCall(callId, userId, reason = 'user_ended') {
        try {
            const call = this.activeCalls.get(callId);
            if (!call) {
                throw new Error('通话不存在');
            }

            const participant = call.participants.find(p => p.userId === userId);
            if (!participant) {
                throw new Error('用户不在此通话中');
            }

            const endTime = Date.now();
            const duration = endTime - call.startTime;

            // 更新通话状态
            call.status = 'ended';
            call.endTime = endTime;
            call.duration = duration;
            call.endReason = reason;

            // 保存通话历史
            const callRecord = {
                callId,
                matchId: call.matchId,
                participants: call.participants,
                startTime: call.startTime,
                endTime,
                duration,
                endReason: reason,
                translationEnabled: call.translationEnabled,
                translationCount: 0
            };

            // 如果有翻译会话，保存翻译统计
            const translationSession = this.translationSessions.get(callId);
            if (translationSession) {
                callRecord.translationCount = translationSession.translationHistory.length;
                callRecord.translationHistory = translationSession.translationHistory;
                
                // 清理翻译会话
                this.translationSessions.delete(callId);
            }

            // 保存到历史记录
            this.callHistory.set(callId, callRecord);

            // 清理活跃通话
            this.activeCalls.delete(callId);

            // 清理匹配
            if (call.matchId) {
                this.activeMatches.delete(call.matchId);
            }

            // 通知所有参与者
            this.emit('call_ended', {
                callId,
                participants: call.participants,
                duration,
                reason,
                callRecord
            });

            return {
                success: true,
                duration,
                translationCount: callRecord.translationCount,
                message: '通话已结束'
            };

        } catch (error) {
            console.error('结束通话失败:', error);
            throw new Error(`结束通话失败: ${error.message}`);
        }
    }

    // 离开匹配队列
    async leaveMatchingQueue(userId) {
        try {
            const user = this.waitingUsers.get(userId);
            if (!user) {
                return {
                    success: false,
                    message: '用户不在匹配队列中'
                };
            }

            this.waitingUsers.delete(userId);

            return {
                success: true,
                message: '已离开匹配队列'
            };

        } catch (error) {
            console.error('离开匹配队列失败:', error);
            throw new Error(`离开匹配队列失败: ${error.message}`);
        }
    }

    // 启动匹配引擎
    startMatchingEngine() {
        setInterval(() => {
            this.processMatchingQueue();
        }, 5000); // 每5秒处理一次匹配队列

        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60000); // 每分钟清理过期会话
    }

    // 处理匹配队列
    async processMatchingQueue() {
        try {
            const waitingUsers = Array.from(this.waitingUsers.values());
            
            for (const user of waitingUsers) {
                // 检查等待时间
                const waitTime = Date.now() - user.joinTime;
                
                if (waitTime > this.matchingConfig.maxWaitTime) {
                    // 超时，移除用户
                    this.waitingUsers.delete(user.userId);
                    this.emit('matching_timeout', {
                        userId: user.userId,
                        waitTime
                    });
                    continue;
                }

                // 尝试匹配
                if (user.status === 'waiting') {
                    const match = await this.findMatch(user.userId);
                    if (match) {
                        this.emit('match_found', {
                            matchId: match.matchId,
                            user1Id: user.userId,
                            user2Id: match.partner.userId,
                            match: match.match
                        });
                    }
                }
            }

        } catch (error) {
            console.error('处理匹配队列失败:', error);
        }
    }

    // 清理过期会话
    cleanupExpiredSessions() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        // 清理过期的通话历史
        for (const [callId, record] of this.callHistory.entries()) {
            if (now - record.endTime > maxAge) {
                this.callHistory.delete(callId);
            }
        }

        // 清理过期的用户资料
        for (const [userId, profile] of this.userProfiles.entries()) {
            if (now - (profile.lastActive || 0) > maxAge) {
                this.userProfiles.delete(userId);
            }
        }
    }

    // 辅助方法
    getQueuePosition(userId) {
        const waitingUsers = Array.from(this.waitingUsers.values())
            .sort((a, b) => a.joinTime - b.joinTime);
        
        return waitingUsers.findIndex(user => user.userId === userId) + 1;
    }

    estimateWaitTime(userEntry) {
        const similarUsers = Array.from(this.waitingUsers.values())
            .filter(user => 
                user.targetLanguage === userEntry.targetLanguage ||
                user.nativeLanguage === userEntry.nativeLanguage
            );

        // 基于相似用户数量估算等待时间
        const baseWaitTime = 30000; // 30秒基础等待时间
        const additionalTime = Math.max(0, (similarUsers.length - 1) * 15000); // 每个相似用户增加15秒
        
        return Math.min(baseWaitTime + additionalTime, this.matchingConfig.maxWaitTime);
    }

    // 模拟方法（实际应用中需要集成真实服务）
    async transcribeCallAudio(audioData, language) {
        // 模拟语音识别
        const mockTexts = {
            'zh-CN': ['你好，很高兴和你通话', '今天天气怎么样？', '你的国家有什么特色美食吗？'],
            'en-US': ['Hello, nice to talk with you', 'How is the weather today?', 'What special food does your country have?'],
            'ja-JP': ['こんにちは、お話しできて嬉しいです', '今日の天気はどうですか？', 'あなたの国の特別な料理は何ですか？']
        };

        const texts = mockTexts[language] || mockTexts['en-US'];
        const randomText = texts[Math.floor(Math.random() * texts.length)];

        return {
            text: randomText,
            confidence: 0.9,
            language: language
        };
    }

    async translateCallText(text, sourceLanguage, targetLanguage) {
        // 模拟翻译
        const translations = {
            'zh-CN_en-US': {
                '你好，很高兴和你通话': 'Hello, nice to talk with you',
                '今天天气怎么样？': 'How is the weather today?',
                '你的国家有什么特色美食吗？': 'What special food does your country have?'
            },
            'en-US_zh-CN': {
                'Hello, nice to talk with you': '你好，很高兴和你通话',
                'How is the weather today?': '今天天气怎么样？',
                'What special food does your country have?': '你的国家有什么特色美食吗？'
            }
        };

        const key = `${sourceLanguage}_${targetLanguage}`;
        const translatedText = translations[key]?.[text] || `[${targetLanguage}] ${text}`;

        return {
            translatedText,
            confidence: 0.85
        };
    }

    async generateCallSpeech(text, language) {
        // 模拟语音生成
        const audioId = uuidv4();
        return `/temp/call_speech_${audioId}.mp3`;
    }

    // 获取统计信息
    getStatistics() {
        return {
            waitingUsers: this.waitingUsers.size,
            activeMatches: this.activeMatches.size,
            activeCalls: this.activeCalls.size,
            totalCallHistory: this.callHistory.size,
            activeTranslationSessions: this.translationSessions.size,
            supportedLanguages: this.supportedLanguages.length
        };
    }

    // 获取支持的语言列表
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 获取用户状态
    getUserStatus(userId) {
        if (this.waitingUsers.has(userId)) {
            return { status: 'waiting', data: this.waitingUsers.get(userId) };
        }

        for (const match of this.activeMatches.values()) {
            if (match.user1.userId === userId || match.user2.userId === userId) {
                return { status: 'matched', data: match };
            }
        }

        for (const call of this.activeCalls.values()) {
            if (call.participants.some(p => p.userId === userId)) {
                return { status: 'in_call', data: call };
            }
        }

        return { status: 'offline', data: null };
    }
}

module.exports = new CrossBorderVoiceCallService();

