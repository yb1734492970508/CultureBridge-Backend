const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

class ChatService {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    this.connectedUsers = new Map();
    this.chatRooms = new Map();
    this.messageHistory = new Map();
    
    this.initializeRooms();
    this.setupSocketHandlers();
  }

  initializeRooms() {
    const defaultRooms = [
      { id: 'general', name: '综合讨论', description: '自由交流各种话题' },
      { id: 'language-exchange', name: '语言交换', description: '练习语言，互相学习' },
      { id: 'culture-share', name: '文化分享', description: '分享各国文化特色' },
      { id: 'tech-talk', name: '科技讨论', description: '讨论最新科技趋势' },
      { id: 'travel-stories', name: '旅行故事', description: '分享旅行经历和见闻' }
    ];

    defaultRooms.forEach(room => {
      this.chatRooms.set(room.id, {
        ...room,
        users: new Set(),
        messages: []
      });
      this.messageHistory.set(room.id, []);
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`用户连接: ${socket.id}`);

      // 用户认证
      socket.on('authenticate', (token) => {
        try {
          if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            socket.username = decoded.username || '用户';
          } else {
            socket.userId = socket.id;
            socket.username = '匿名用户';
          }
          
          this.connectedUsers.set(socket.id, {
            userId: socket.userId,
            username: socket.username,
            socketId: socket.id,
            currentRoom: null,
            language: 'zh',
            joinedAt: new Date()
          });

          socket.emit('authenticated', {
            userId: socket.userId,
            username: socket.username
          });

        } catch (error) {
          console.error('认证失败:', error);
          socket.userId = socket.id;
          socket.username = '匿名用户';
        }
      });

      // 加入聊天室
      socket.on('joinRoom', (roomId) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user) return;

        // 离开之前的房间
        if (user.currentRoom) {
          socket.leave(user.currentRoom);
          const prevRoom = this.chatRooms.get(user.currentRoom);
          if (prevRoom) {
            prevRoom.users.delete(socket.id);
            socket.to(user.currentRoom).emit('userLeft', {
              userId: user.userId,
              username: user.username
            });
          }
        }

        // 加入新房间
        socket.join(roomId);
        user.currentRoom = roomId;
        
        const room = this.chatRooms.get(roomId);
        if (room) {
          room.users.add(socket.id);
          
          // 发送历史消息
          const history = this.messageHistory.get(roomId) || [];
          socket.emit('messageHistory', history.slice(-50)); // 最近50条消息

          // 通知其他用户
          socket.to(roomId).emit('userJoined', {
            userId: user.userId,
            username: user.username
          });

          // 发送在线用户列表
          const onlineUsers = Array.from(room.users).map(socketId => {
            const userData = this.connectedUsers.get(socketId);
            return userData ? {
              userId: userData.userId,
              username: userData.username
            } : null;
          }).filter(Boolean);

          this.io.to(roomId).emit('onlineUsers', onlineUsers);
        }
      });

      // 发送消息
      socket.on('sendMessage', async (messageData) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.currentRoom) return;

        const message = {
          id: Date.now() + Math.random(),
          userId: user.userId,
          username: user.username,
          content: messageData.content,
          room: messageData.room || user.currentRoom,
          language: messageData.language || 'zh',
          timestamp: new Date(),
          type: messageData.type || 'text'
        };

        // 保存消息到历史记录
        const history = this.messageHistory.get(message.room) || [];
        history.push(message);
        if (history.length > 1000) {
          history.splice(0, history.length - 1000); // 保持最近1000条消息
        }
        this.messageHistory.set(message.room, history);

        // 广播消息到房间内所有用户
        this.io.to(message.room).emit('message', message);

        // 如果是语音消息，处理语音数据
        if (message.type === 'voice') {
          this.handleVoiceMessage(message);
        }
      });

      // 请求翻译
      socket.on('requestTranslation', async (data) => {
        const { messageId, targetLanguage } = data;
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.currentRoom) return;

        try {
          // 查找消息
          const history = this.messageHistory.get(user.currentRoom) || [];
          const message = history.find(msg => msg.id === messageId);
          
          if (message) {
            const translation = await this.translateMessage(message.content, message.language, targetLanguage);
            
            socket.emit('translatedMessage', {
              messageId: messageId,
              translation: translation,
              targetLanguage: targetLanguage
            });
          }
        } catch (error) {
          console.error('翻译请求失败:', error);
          socket.emit('translationError', {
            messageId: messageId,
            error: '翻译失败，请重试'
          });
        }
      });

      // 设置用户语言
      socket.on('setLanguage', (language) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          user.language = language;
        }
      });

      // 获取房间列表
      socket.on('getRooms', () => {
        const rooms = Array.from(this.chatRooms.values()).map(room => ({
          id: room.id,
          name: room.name,
          description: room.description,
          userCount: room.users.size
        }));
        
        socket.emit('roomList', rooms);
      });

      // 用户断开连接
      socket.on('disconnect', () => {
        console.log(`用户断开连接: ${socket.id}`);
        
        const user = this.connectedUsers.get(socket.id);
        if (user && user.currentRoom) {
          const room = this.chatRooms.get(user.currentRoom);
          if (room) {
            room.users.delete(socket.id);
            socket.to(user.currentRoom).emit('userLeft', {
              userId: user.userId,
              username: user.username
            });

            // 更新在线用户列表
            const onlineUsers = Array.from(room.users).map(socketId => {
              const userData = this.connectedUsers.get(socketId);
              return userData ? {
                userId: userData.userId,
                username: userData.username
              } : null;
            }).filter(Boolean);

            this.io.to(user.currentRoom).emit('onlineUsers', onlineUsers);
          }
        }
        
        this.connectedUsers.delete(socket.id);
      });
    });
  }

  async translateMessage(text, sourceLanguage, targetLanguage) {
    // 模拟翻译API调用
    const mockTranslations = {
      'zh-en': {
        '大家好！欢迎来到CultureBridge文化交流平台！': 'Hello everyone! Welcome to CultureBridge cultural exchange platform!',
        '这是一个很棒的应用！': 'This is an awesome application!',
        '我来自中国，很高兴认识大家': 'I am from China, nice to meet everyone',
        '今天天气真不错': 'The weather is really nice today'
      },
      'en-zh': {
        'Hello everyone! Welcome to CultureBridge cultural exchange platform!': '大家好！欢迎来到CultureBridge文化交流平台！',
        'This is an awesome application!': '这是一个很棒的应用！',
        'I am from the United States': '我来自美国',
        'Nice to meet you all': '很高兴认识大家'
      },
      'zh-es': {
        '大家好！欢迎来到CultureBridge文化交流平台！': '¡Hola a todos! ¡Bienvenidos a la plataforma de intercambio cultural CultureBridge!',
        '这是一个很棒的应用！': '¡Esta es una aplicación increíble!',
        '我来自中国': 'Soy de China'
      },
      'en-es': {
        'Hello everyone! Welcome to CultureBridge cultural exchange platform!': '¡Hola a todos! ¡Bienvenidos a la plataforma de intercambio cultural CultureBridge!',
        'This is an awesome application!': '¡Esta es una aplicación increíble!'
      }
    };

    const translationKey = `${sourceLanguage}-${targetLanguage}`;
    const translation = mockTranslations[translationKey]?.[text];
    
    if (translation) {
      return translation;
    }

    // 如果没有预设翻译，返回带标记的原文
    return `[${targetLanguage.toUpperCase()}] ${text}`;
  }

  async handleVoiceMessage(message) {
    // 处理语音消息，可以进行语音识别等操作
    console.log('处理语音消息:', message.id);
    
    // 这里可以添加语音识别逻辑
    // 例如调用语音识别API，然后将识别结果作为文本消息发送
  }

  // 获取聊天统计信息
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalRooms: this.chatRooms.size,
      totalMessages: Array.from(this.messageHistory.values()).reduce((total, history) => total + history.length, 0),
      roomStats: Array.from(this.chatRooms.entries()).map(([roomId, room]) => ({
        roomId,
        name: room.name,
        userCount: room.users.size,
        messageCount: this.messageHistory.get(roomId)?.length || 0
      }))
    };
  }

  // 向特定用户发送消息
  sendToUser(userId, event, data) {
    for (const [socketId, user] of this.connectedUsers) {
      if (user.userId === userId) {
        this.io.to(socketId).emit(event, data);
        break;
      }
    }
  }

  // 向特定房间发送消息
  sendToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }

  // 广播系统消息
  broadcastSystemMessage(message, roomId = null) {
    const systemMessage = {
      id: Date.now(),
      type: 'system',
      content: message,
      timestamp: new Date()
    };

    if (roomId) {
      this.io.to(roomId).emit('message', systemMessage);
    } else {
      this.io.emit('message', systemMessage);
    }
  }
}

module.exports = ChatService;

