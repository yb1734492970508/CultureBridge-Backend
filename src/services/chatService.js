class ChatService {
    constructor() {
        this.rooms = new Map();
        this.messages = new Map();
        this.userRooms = new Map();
        
        // 初始化默认聊天室
        this.initializeDefaultRooms();
    }
    
    /**
     * 初始化默认聊天室
     */
    initializeDefaultRooms() {
        const defaultRooms = [
            {
                id: 'general',
                name: '综合讨论',
                description: '自由交流各种话题',
                languages: ['zh', 'en'],
                maxUsers: 100,
                isPublic: true
            },
            {
                id: 'chinese-english',
                name: '中英交流',
                description: '中文和英文学习交流',
                languages: ['zh', 'en'],
                maxUsers: 50,
                isPublic: true
            },
            {
                id: 'culture-exchange',
                name: '文化交流',
                description: '分享不同文化背景和习俗',
                languages: ['zh', 'en', 'es', 'fr'],
                maxUsers: 80,
                isPublic: true
            },
            {
                id: 'language-learning',
                name: '语言学习',
                description: '多语言学习互助',
                languages: ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko'],
                maxUsers: 60,
                isPublic: true
            }
        ];
        
        defaultRooms.forEach(room => {
            this.rooms.set(room.id, {
                ...room,
                users: new Set(),
                createdAt: new Date(),
                messageCount: 0
            });
            this.messages.set(room.id, []);
        });
    }
    
    /**
     * 获取聊天室列表
     */
    async getChatRooms() {
        const roomList = [];
        
        for (const [id, room] of this.rooms) {
            if (room.isPublic) {
                roomList.push({
                    id,
                    name: room.name,
                    description: room.description,
                    languages: room.languages,
                    userCount: room.users.size,
                    maxUsers: room.maxUsers,
                    messageCount: room.messageCount,
                    createdAt: room.createdAt
                });
            }
        }
        
        return roomList;
    }
    
    /**
     * 加入聊天室
     */
    async joinRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        if (room.users.size >= room.maxUsers) {
            throw new Error('聊天室已满');
        }
        
        room.users.add(userId);
        
        // 记录用户所在房间
        const userRoomList = this.userRooms.get(userId) || new Set();
        userRoomList.add(roomId);
        this.userRooms.set(userId, userRoomList);
        
        return true;
    }
    
    /**
     * 离开聊天室
     */
    async leaveRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.users.delete(userId);
        }
        
        const userRoomList = this.userRooms.get(userId);
        if (userRoomList) {
            userRoomList.delete(roomId);
        }
    }
    
    /**
     * 保存消息
     */
    async saveMessage(messageData) {
        const { roomId, userId, message, language } = messageData;
        
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const savedMessage = {
            id: messageId,
            roomId,
            userId,
            message,
            language,
            timestamp: new Date(),
            type: 'text'
        };
        
        // 保存到房间消息列表
        const roomMessages = this.messages.get(roomId) || [];
        roomMessages.push(savedMessage);
        this.messages.set(roomId, roomMessages);
        
        // 更新房间消息计数
        const room = this.rooms.get(roomId);
        if (room) {
            room.messageCount++;
        }
        
        return savedMessage;
    }
    
    /**
     * 保存语音消息
     */
    async saveVoiceMessage(messageData) {
        const { roomId, userId, audioData, transcription, language } = messageData;
        
        const messageId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const savedMessage = {
            id: messageId,
            roomId,
            userId,
            audioData,
            transcription,
            language,
            timestamp: new Date(),
            type: 'voice'
        };
        
        // 保存到房间消息列表
        const roomMessages = this.messages.get(roomId) || [];
        roomMessages.push(savedMessage);
        this.messages.set(roomId, roomMessages);
        
        // 更新房间消息计数
        const room = this.rooms.get(roomId);
        if (room) {
            room.messageCount++;
        }
        
        return savedMessage;
    }
    
    /**
     * 获取聊天历史
     */
    async getChatHistory(roomId, page = 1, limit = 50) {
        const roomMessages = this.messages.get(roomId) || [];
        const startIndex = Math.max(0, roomMessages.length - page * limit);
        const endIndex = roomMessages.length - (page - 1) * limit;
        
        return roomMessages
            .slice(startIndex, endIndex)
            .reverse(); // 最新消息在前
    }
    
    /**
     * 获取房间用户列表
     */
    async getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room.users) : [];
    }
    
    /**
     * 获取用户所在房间
     */
    async getUserRooms(userId) {
        const userRoomList = this.userRooms.get(userId) || new Set();
        return Array.from(userRoomList);
    }
    
    /**
     * 创建私人聊天室
     */
    async createPrivateRoom(creatorId, participants, roomName) {
        const roomId = `private_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const room = {
            id: roomId,
            name: roomName || '私人聊天',
            description: '私人聊天室',
            languages: ['zh', 'en'],
            maxUsers: participants.length + 1,
            isPublic: false,
            creatorId,
            users: new Set([creatorId, ...participants]),
            createdAt: new Date(),
            messageCount: 0
        };
        
        this.rooms.set(roomId, room);
        this.messages.set(roomId, []);
        
        // 更新所有参与者的房间列表
        [creatorId, ...participants].forEach(userId => {
            const userRoomList = this.userRooms.get(userId) || new Set();
            userRoomList.add(roomId);
            this.userRooms.set(userId, userRoomList);
        });
        
        return room;
    }
    
    /**
     * 删除消息
     */
    async deleteMessage(messageId, userId) {
        for (const [roomId, messages] of this.messages) {
            const messageIndex = messages.findIndex(msg => 
                msg.id === messageId && msg.userId === userId
            );
            
            if (messageIndex !== -1) {
                messages.splice(messageIndex, 1);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 获取房间统计
     */
    async getRoomStats(roomId) {
        const room = this.rooms.get(roomId);
        const messages = this.messages.get(roomId) || [];
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayMessages = messages.filter(msg => new Date(msg.timestamp) >= today);
        
        return {
            totalMessages: messages.length,
            todayMessages: todayMessages.length,
            activeUsers: room.users.size,
            maxUsers: room.maxUsers,
            createdAt: room.createdAt,
            languages: room.languages
        };
    }
}

module.exports = ChatService;

