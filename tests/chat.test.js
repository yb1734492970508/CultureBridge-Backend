const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../src/app');
const User = require('../src/models/User');
const ChatRoom = require('../src/models/ChatRoom');
const ChatMessage = require('../src/models/ChatMessage');

let mongoServer;
let authToken;
let userId;

describe('Chat Tests', () => {
    beforeAll(async () => {
        // 启动内存数据库
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        // 连接到测试数据库
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        // 清理和关闭连接
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // 清理数据
        await User.deleteMany({});
        await ChatRoom.deleteMany({});
        await ChatMessage.deleteMany({});

        // 创建测试用户并获取token
        const user = new User({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        });
        await user.save();
        userId = user._id;

        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });

        authToken = loginResponse.body.data.token;
    });

    describe('POST /api/v1/chat/rooms', () => {
        it('应该成功创建聊天室', async () => {
            const roomData = {
                name: '测试聊天室',
                description: '这是一个测试聊天室',
                type: 'public',
                languages: ['zh', 'en']
            };

            const response = await request(app)
                .post('/api/v1/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .send(roomData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(roomData.name);
            expect(response.body.data.creator._id).toBe(userId.toString());
        });

        it('应该拒绝没有名称的聊天室', async () => {
            const roomData = {
                description: '没有名称的聊天室'
            };

            const response = await request(app)
                .post('/api/v1/chat/rooms')
                .set('Authorization', `Bearer ${authToken}`)
                .send(roomData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/chat/rooms', () => {
        beforeEach(async () => {
            // 创建一些测试聊天室
            const room1 = new ChatRoom({
                name: '中文聊天室',
                type: 'public',
                languages: ['zh'],
                creator: userId,
                members: [{ user: userId, role: 'admin' }]
            });

            const room2 = new ChatRoom({
                name: '英文聊天室',
                type: 'public',
                languages: ['en'],
                creator: userId,
                members: [{ user: userId, role: 'admin' }]
            });

            await room1.save();
            await room2.save();
        });

        it('应该返回聊天室列表', async () => {
            const response = await request(app)
                .get('/api/v1/chat/rooms')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
        });

        it('应该支持按语言过滤', async () => {
            const response = await request(app)
                .get('/api/v1/chat/rooms?language=zh')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].name).toBe('中文聊天室');
        });
    });

    describe('POST /api/v1/chat/rooms/:id/join', () => {
        let roomId;

        beforeEach(async () => {
            // 创建另一个用户作为房间创建者
            const creator = new User({
                username: 'creator',
                email: 'creator@example.com',
                password: 'password123'
            });
            await creator.save();

            const room = new ChatRoom({
                name: '测试聊天室',
                type: 'public',
                creator: creator._id,
                members: [{ user: creator._id, role: 'admin' }]
            });
            await room.save();
            roomId = room._id;
        });

        it('应该成功加入聊天室', async () => {
            const response = await request(app)
                .post(`/api/v1/chat/rooms/${roomId}/join`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.roomId).toBe(roomId.toString());
        });

        it('应该拒绝重复加入', async () => {
            // 第一次加入
            await request(app)
                .post(`/api/v1/chat/rooms/${roomId}/join`)
                .set('Authorization', `Bearer ${authToken}`);

            // 第二次加入
            const response = await request(app)
                .post(`/api/v1/chat/rooms/${roomId}/join`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/v1/chat/rooms/:id/messages', () => {
        let roomId;

        beforeEach(async () => {
            const room = new ChatRoom({
                name: '测试聊天室',
                type: 'public',
                creator: userId,
                members: [{ user: userId, role: 'admin' }]
            });
            await room.save();
            roomId = room._id;
        });

        it('应该成功发送消息', async () => {
            const messageData = {
                content: '这是一条测试消息',
                language: 'zh'
            };

            const response = await request(app)
                .post(`/api/v1/chat/rooms/${roomId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(messageData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.content).toBe(messageData.content);
            expect(response.body.data.sender._id).toBe(userId.toString());
        });

        it('应该拒绝空消息', async () => {
            const messageData = {
                content: ''
            };

            const response = await request(app)
                .post(`/api/v1/chat/rooms/${roomId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(messageData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/chat/rooms/:id/messages', () => {
        let roomId;

        beforeEach(async () => {
            const room = new ChatRoom({
                name: '测试聊天室',
                type: 'public',
                creator: userId,
                members: [{ user: userId, role: 'admin' }]
            });
            await room.save();
            roomId = room._id;

            // 创建一些测试消息
            const messages = [
                new ChatMessage({
                    chatRoom: roomId,
                    sender: userId,
                    content: '第一条消息',
                    originalLanguage: 'zh'
                }),
                new ChatMessage({
                    chatRoom: roomId,
                    sender: userId,
                    content: '第二条消息',
                    originalLanguage: 'zh'
                })
            ];

            await ChatMessage.insertMany(messages);
        });

        it('应该返回聊天消息', async () => {
            const response = await request(app)
                .get(`/api/v1/chat/rooms/${roomId}/messages`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
        });
    });
});

