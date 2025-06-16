const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class ChatServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.redis = null;
    this.activeRooms = new Map();
    this.userSessions = new Map();
    this.messageHistory = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeRooms: this.activeRooms.size,
        activeSessions: this.userSessions.size
      });
    });

    // 获取活跃房间列表
    this.app.get('/api/rooms', (req, res) => {
      const rooms = Array.from(this.activeRooms.entries()).map(([id, room]) => ({
        id,
        name: room.name,
        description: room.description,
        language: room.language,
        userCount: room.users.size,
        isPrivate: room.isPrivate,
        createdAt: room.createdAt
      }));
      
      res.json(rooms);
    });

    // 创建新房间
    this.app.post('/api/rooms', (req, res) => {
      const { name, description, language, isPrivate = false } = req.body;
      
      if (!name || !language) {
        return res.status(400).json({ error: '房间名称和语言是必需的' });
      }

      const roomId = uuidv4();
      const room = {
        id: roomId,
        name,
        description: description || '',
        language,
        isPrivate,
        users: new Set(),
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      this.activeRooms.set(roomId, room);
      this.messageHistory.set(roomId, []);

      res.json({ roomId, room });
    });

    // 获取房间消息历史
    this.app.get('/api/rooms/:roomId/messages', (req, res) => {
      const { roomId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const messages = this.messageHistory.get(roomId) || [];
      const paginatedMessages = messages
        .slice(-limit - offset, -offset || undefined)
        .reverse();
      
      res.json({
        messages: paginatedMessages,
        total: messages.length,
        hasMore: messages.length > limit + offset
      });
    });
  }

  /**
   * 设置Socket处理器
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`用户连接: ${socket.id}`);

      // 用户加入房间
      socket.on('join-room', (data) => {
        this.handleJoinRoom(socket, data);
      });

      // 用户离开房间
      socket.on('leave-room', (data) => {
        this.handleLeaveRoom(socket, data);
      });

      // 发送消息
      socket.on('send-message', (data) => {
        this.handleSendMessage(socket, data);
      });

      // 发送语音消息
      socket.on('send-voice-message', (data) => {
        this.handleSendVoiceMessage(socket, data);
      });

      // 请求翻译
      socket.on('request-translation', (data) => {
        this.handleTranslationRequest(socket, data);
      });

      // 用户正在输入
      socket.on('typing', (data) => {
        this.handleTyping(socket, data);
      });

      // 用户停止输入
      socket.on('stop-typing', (data) => {
        this.handleStopTyping(socket, data);
      });

      // 私聊消息
      socket.on('private-message', (data) => {
        this.handlePrivateMessage(socket, data);
      });

      // 用户断开连接
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * 处理用户加入房间
   */
  handleJoinRoom(socket, data) {
    const { roomId, userInfo } = data;
    
    if (!roomId || !userInfo) {
      socket.emit('error', { message: '房间ID和用户信息是必需的' });
      return;
    }

    const room = this.activeRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    // 加入Socket.IO房间
    socket.join(roomId);
    
    // 更新用户会话信息
    this.userSessions.set(socket.id, {
      userId: userInfo.id,
      username: userInfo.username,
      avatar: userInfo.avatar,
      roomId,
      joinedAt: new Date().toISOString()
    });

    // 添加用户到房间
    room.users.add(socket.id);
    room.lastActivity = new Date().toISOString();

    // 通知房间内其他用户
    socket.to(roomId).emit('user-joined', {
      userId: userInfo.id,
      username: userInfo.username,
      avatar: userInfo.avatar,
      timestamp: new Date().toISOString()
    });

    // 发送房间信息给新用户
    socket.emit('room-joined', {
      roomId,
      roomInfo: {
        name: room.name,
        description: room.description,
        language: room.language,
        userCount: room.users.size
      },
      users: this.getRoomUsers(roomId)
    });

    console.log(`用户 ${userInfo.username} 加入房间 ${room.name}`);
  }

  /**
   * 处理用户离开房间
   */
  handleLeaveRoom(socket, data) {
    const { roomId } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession || userSession.roomId !== roomId) {
      return;
    }

    this.removeUserFromRoom(socket, roomId);
  }

  /**
   * 处理发送消息
   */
  handleSendMessage(socket, data) {
    const { roomId, message, messageType = 'text' } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession || userSession.roomId !== roomId) {
      socket.emit('error', { message: '用户未在此房间中' });
      return;
    }

    const messageData = {
      id: uuidv4(),
      userId: userSession.userId,
      username: userSession.username,
      avatar: userSession.avatar,
      content: message,
      type: messageType,
      roomId,
      timestamp: new Date().toISOString(),
      translations: {} // 存储翻译结果
    };

    // 保存消息到历史记录
    const roomMessages = this.messageHistory.get(roomId) || [];
    roomMessages.push(messageData);
    
    // 限制消息历史长度
    if (roomMessages.length > 1000) {
      roomMessages.splice(0, roomMessages.length - 1000);
    }
    
    this.messageHistory.set(roomId, roomMessages);

    // 广播消息到房间
    this.io.to(roomId).emit('new-message', messageData);

    // 更新房间活动时间
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.lastActivity = new Date().toISOString();
    }

    console.log(`消息发送: ${userSession.username} -> ${room?.name}: ${message}`);
  }

  /**
   * 处理语音消息
   */
  handleSendVoiceMessage(socket, data) {
    const { roomId, audioData, duration, language } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession || userSession.roomId !== roomId) {
      socket.emit('error', { message: '用户未在此房间中' });
      return;
    }

    const voiceMessage = {
      id: uuidv4(),
      userId: userSession.userId,
      username: userSession.username,
      avatar: userSession.avatar,
      type: 'voice',
      audioData,
      duration,
      language,
      roomId,
      timestamp: new Date().toISOString(),
      transcription: null, // 语音识别结果
      translations: {} // 翻译结果
    };

    // 保存语音消息
    const roomMessages = this.messageHistory.get(roomId) || [];
    roomMessages.push(voiceMessage);
    this.messageHistory.set(roomId, roomMessages);

    // 广播语音消息
    this.io.to(roomId).emit('new-voice-message', voiceMessage);

    // 触发语音识别（这里可以集成语音识别服务）
    this.processVoiceMessage(voiceMessage);

    console.log(`语音消息发送: ${userSession.username} -> ${this.activeRooms.get(roomId)?.name}`);
  }

  /**
   * 处理翻译请求
   */
  async handleTranslationRequest(socket, data) {
    const { messageId, targetLanguage } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession) {
      socket.emit('error', { message: '用户会话无效' });
      return;
    }

    try {
      // 查找消息
      const roomMessages = this.messageHistory.get(userSession.roomId) || [];
      const message = roomMessages.find(msg => msg.id === messageId);
      
      if (!message) {
        socket.emit('error', { message: '消息不存在' });
        return;
      }

      // 检查是否已有翻译缓存
      if (message.translations[targetLanguage]) {
        socket.emit('translation-result', {
          messageId,
          targetLanguage,
          translation: message.translations[targetLanguage],
          cached: true
        });
        return;
      }

      // 执行翻译（这里需要集成翻译服务）
      const translation = await this.translateText(message.content, targetLanguage);
      
      // 缓存翻译结果
      message.translations[targetLanguage] = translation;
      
      // 发送翻译结果
      socket.emit('translation-result', {
        messageId,
        targetLanguage,
        translation,
        cached: false
      });

    } catch (error) {
      console.error('翻译失败:', error);
      socket.emit('error', { message: '翻译服务暂时不可用' });
    }
  }

  /**
   * 处理用户正在输入
   */
  handleTyping(socket, data) {
    const { roomId } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession || userSession.roomId !== roomId) {
      return;
    }

    socket.to(roomId).emit('user-typing', {
      userId: userSession.userId,
      username: userSession.username
    });
  }

  /**
   * 处理停止输入
   */
  handleStopTyping(socket, data) {
    const { roomId } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession || userSession.roomId !== roomId) {
      return;
    }

    socket.to(roomId).emit('user-stop-typing', {
      userId: userSession.userId,
      username: userSession.username
    });
  }

  /**
   * 处理私聊消息
   */
  handlePrivateMessage(socket, data) {
    const { targetUserId, message } = data;
    const userSession = this.userSessions.get(socket.id);
    
    if (!userSession) {
      socket.emit('error', { message: '用户会话无效' });
      return;
    }

    // 查找目标用户的socket
    const targetSocket = Array.from(this.userSessions.entries())
      .find(([_, session]) => session.userId === targetUserId);
    
    if (!targetSocket) {
      socket.emit('error', { message: '目标用户不在线' });
      return;
    }

    const privateMessage = {
      id: uuidv4(),
      fromUserId: userSession.userId,
      fromUsername: userSession.username,
      toUserId: targetUserId,
      content: message,
      timestamp: new Date().toISOString(),
      type: 'private'
    };

    // 发送给目标用户
    this.io.to(targetSocket[0]).emit('private-message', privateMessage);
    
    // 确认发送给发送者
    socket.emit('private-message-sent', privateMessage);

    console.log(`私聊消息: ${userSession.username} -> ${targetUserId}: ${message}`);
  }

  /**
   * 处理用户断开连接
   */
  handleDisconnect(socket) {
    const userSession = this.userSessions.get(socket.id);
    
    if (userSession) {
      this.removeUserFromRoom(socket, userSession.roomId);
      this.userSessions.delete(socket.id);
      
      console.log(`用户断开连接: ${userSession.username}`);
    }
  }

  /**
   * 从房间移除用户
   */
  removeUserFromRoom(socket, roomId) {
    const room = this.activeRooms.get(roomId);
    const userSession = this.userSessions.get(socket.id);
    
    if (!room || !userSession) {
      return;
    }

    // 从房间移除用户
    room.users.delete(socket.id);
    socket.leave(roomId);

    // 通知房间内其他用户
    socket.to(roomId).emit('user-left', {
      userId: userSession.userId,
      username: userSession.username,
      timestamp: new Date().toISOString()
    });

    // 如果房间为空，删除房间
    if (room.users.size === 0) {
      this.activeRooms.delete(roomId);
      this.messageHistory.delete(roomId);
      console.log(`房间已删除: ${room.name}`);
    }
  }

  /**
   * 获取房间用户列表
   */
  getRoomUsers(roomId) {
    const room = this.activeRooms.get(roomId);
    if (!room) return [];

    return Array.from(room.users).map(socketId => {
      const session = this.userSessions.get(socketId);
      return session ? {
        userId: session.userId,
        username: session.username,
        avatar: session.avatar,
        joinedAt: session.joinedAt
      } : null;
    }).filter(Boolean);
  }

  /**
   * 处理语音消息（语音识别）
   */
  async processVoiceMessage(voiceMessage) {
    try {
      // 这里集成语音识别服务
      // const transcription = await this.speechToText(voiceMessage.audioData, voiceMessage.language);
      // voiceMessage.transcription = transcription;
      
      // 广播语音识别结果
      // this.io.to(voiceMessage.roomId).emit('voice-transcription', {
      //   messageId: voiceMessage.id,
      //   transcription
      // });
      
      console.log('语音消息处理完成');
    } catch (error) {
      console.error('语音识别失败:', error);
    }
  }

  /**
   * 翻译文本（模拟实现）
   */
  async translateText(text, targetLanguage) {
    // 这里应该集成真实的翻译服务
    // 例如 Google Translate API, Azure Translator 等
    
    // 模拟翻译延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 返回模拟翻译结果
    return `[${targetLanguage}] ${text}`;
  }

  /**
   * 启动服务器
   */
  start(port = 3001) {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`聊天服务器启动在端口 ${port}`);
      console.log(`WebSocket服务器地址: ws://localhost:${port}`);
    });
  }

  /**
   * 初始化Redis连接（可选）
   */
  async initializeRedis() {
    try {
      this.redis = Redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      });
      
      await this.redis.connect();
      console.log('Redis连接成功');
    } catch (error) {
      console.warn('Redis连接失败，使用内存存储:', error.message);
    }
  }
}

module.exports = ChatServer;

