const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LiveStream = require('../models/LiveStream');

class LiveStreamSocketHandler {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`用户连接: ${socket.id}`);

      // 用户认证
      socket.on('authenticate', async (token) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.id);
          
          if (user) {
            socket.userId = user._id.toString();
            socket.username = user.username;
            socket.avatar = user.avatar;
            socket.emit('authenticated', { success: true, user: { id: user._id, username: user.username, avatar: user.avatar } });
          } else {
            socket.emit('authenticated', { success: false, message: '用户不存在' });
          }
        } catch (error) {
          socket.emit('authenticated', { success: false, message: '认证失败' });
        }
      });

      // 加入直播间
      socket.on('join-stream', async (streamId) => {
        try {
          const liveStream = await LiveStream.findById(streamId);
          
          if (!liveStream) {
            socket.emit('error', { message: '直播间不存在' });
            return;
          }

          socket.join(streamId);
          socket.currentStream = streamId;

          // 更新观看人数
          if (socket.userId && !liveStream.viewers.includes(socket.userId)) {
            liveStream.viewers.push(socket.userId);
            liveStream.viewerCount = liveStream.viewers.length;
            await liveStream.save();
          }

          // 通知其他用户有新观众加入
          socket.to(streamId).emit('user-joined', {
            userId: socket.userId,
            username: socket.username,
            avatar: socket.avatar,
            viewerCount: liveStream.viewerCount
          });

          // 发送当前直播信息给新加入的用户
          socket.emit('stream-info', {
            streamId: liveStream._id,
            title: liveStream.title,
            host: liveStream.host,
            viewerCount: liveStream.viewerCount,
            status: liveStream.status
          });

        } catch (error) {
          socket.emit('error', { message: '加入直播间失败' });
        }
      });

      // 离开直播间
      socket.on('leave-stream', async (streamId) => {
        try {
          const liveStream = await LiveStream.findById(streamId);
          
          if (liveStream && socket.userId) {
            liveStream.viewers = liveStream.viewers.filter(
              viewer => viewer.toString() !== socket.userId
            );
            liveStream.viewerCount = liveStream.viewers.length;
            await liveStream.save();

            socket.leave(streamId);
            socket.currentStream = null;

            // 通知其他用户有观众离开
            socket.to(streamId).emit('user-left', {
              userId: socket.userId,
              username: socket.username,
              viewerCount: liveStream.viewerCount
            });
          }
        } catch (error) {
          console.error('离开直播间错误:', error);
        }
      });

      // 发送聊天消息
      socket.on('chat-message', async (data) => {
        try {
          const { streamId, message } = data;
          
          if (!socket.userId || !socket.currentStream || socket.currentStream !== streamId) {
            socket.emit('error', { message: '请先加入直播间' });
            return;
          }

          const liveStream = await LiveStream.findById(streamId);
          if (!liveStream) {
            socket.emit('error', { message: '直播间不存在' });
            return;
          }

          // 检查用户是否被禁言
          if (liveStream.bannedUsers.includes(socket.userId)) {
            socket.emit('error', { message: '您已被禁言' });
            return;
          }

          // 保存聊天消息到数据库
          await liveStream.addComment(socket.userId, message);

          const chatMessage = {
            id: Date.now(),
            userId: socket.userId,
            username: socket.username,
            avatar: socket.avatar,
            message: message,
            timestamp: new Date(),
            type: 'chat'
          };

          // 广播消息给直播间所有用户
          this.io.to(streamId).emit('chat-message', chatMessage);

        } catch (error) {
          socket.emit('error', { message: '发送消息失败' });
        }
      });

      // 发送礼物
      socket.on('send-gift', async (data) => {
        try {
          const { streamId, giftType, giftValue } = data;
          
          if (!socket.userId || !socket.currentStream || socket.currentStream !== streamId) {
            socket.emit('error', { message: '请先加入直播间' });
            return;
          }

          const giftMessage = {
            id: Date.now(),
            userId: socket.userId,
            username: socket.username,
            avatar: socket.avatar,
            giftType: giftType,
            giftValue: giftValue,
            timestamp: new Date(),
            type: 'gift'
          };

          // 广播礼物消息给直播间所有用户
          this.io.to(streamId).emit('gift-received', giftMessage);

        } catch (error) {
          socket.emit('error', { message: '发送礼物失败' });
        }
      });

      // 点赞
      socket.on('like-stream', async (streamId) => {
        try {
          const liveStream = await LiveStream.findById(streamId);
          if (liveStream) {
            await liveStream.addLike();
            
            // 广播点赞事件
            this.io.to(streamId).emit('stream-liked', {
              userId: socket.userId,
              username: socket.username,
              likes: liveStream.likes
            });
          }
        } catch (error) {
          socket.emit('error', { message: '点赞失败' });
        }
      });

      // 主播控制功能
      socket.on('host-action', async (data) => {
        try {
          const { streamId, action, targetUserId } = data;
          const liveStream = await LiveStream.findById(streamId);
          
          if (!liveStream || liveStream.host.toString() !== socket.userId) {
            socket.emit('error', { message: '只有主播可以执行此操作' });
            return;
          }

          switch (action) {
            case 'ban-user':
              if (!liveStream.bannedUsers.includes(targetUserId)) {
                liveStream.bannedUsers.push(targetUserId);
                await liveStream.save();
                
                // 通知被禁言的用户
                this.io.to(streamId).emit('user-banned', { userId: targetUserId });
              }
              break;
              
            case 'unban-user':
              liveStream.bannedUsers = liveStream.bannedUsers.filter(
                userId => userId.toString() !== targetUserId
              );
              await liveStream.save();
              
              this.io.to(streamId).emit('user-unbanned', { userId: targetUserId });
              break;
              
            case 'end-stream':
              liveStream.status = 'ended';
              liveStream.endTime = new Date();
              await liveStream.save();
              
              // 通知所有观众直播结束
              this.io.to(streamId).emit('stream-ended', {
                message: '直播已结束',
                duration: liveStream.calculatedDuration
              });
              
              // 清空直播间
              this.io.in(streamId).socketsLeave(streamId);
              break;
          }
        } catch (error) {
          socket.emit('error', { message: '操作失败' });
        }
      });

      // 断开连接
      socket.on('disconnect', async () => {
        console.log(`用户断开连接: ${socket.id}`);
        
        if (socket.currentStream && socket.userId) {
          try {
            const liveStream = await LiveStream.findById(socket.currentStream);
            if (liveStream) {
              liveStream.viewers = liveStream.viewers.filter(
                viewer => viewer.toString() !== socket.userId
              );
              liveStream.viewerCount = liveStream.viewers.length;
              await liveStream.save();

              // 通知其他用户有观众离开
              socket.to(socket.currentStream).emit('user-left', {
                userId: socket.userId,
                username: socket.username,
                viewerCount: liveStream.viewerCount
              });
            }
          } catch (error) {
            console.error('断开连接处理错误:', error);
          }
        }
      });
    });
  }

  // 获取Socket.IO实例
  getIO() {
    return this.io;
  }
}

module.exports = LiveStreamSocketHandler;

