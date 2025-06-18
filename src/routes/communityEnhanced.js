const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const Event = require('../models/Event');
const User = require('../models/User');

// 高级群组管理服务
class AdvancedGroupService {
    // 创建群组
    async createGroup(groupData, creatorId) {
        const group = new Group({
            ...groupData,
            creator: creatorId,
            admins: [creatorId],
            members: [creatorId],
            createdAt: new Date(),
            settings: {
                requireApproval: groupData.requireApproval || false,
                allowMemberInvite: groupData.allowMemberInvite || true,
                maxMembers: groupData.maxMembers || 500,
                ...groupData.settings
            }
        });
        
        return await group.save();
    }

    // 获取群组推荐
    async getGroupRecommendations(userId, limit = 10) {
        const user = await User.findById(userId);
        if (!user) throw new Error('用户不存在');

        // 基于用户兴趣推荐群组
        const recommendations = await Group.find({
            $and: [
                { members: { $ne: userId } }, // 用户未加入的群组
                {
                    $or: [
                        { tags: { $in: user.interests || [] } },
                        { category: { $in: user.interests || [] } },
                        { language: user.learningLanguages }
                    ]
                }
            ],
            isActive: true
        })
        .populate('creator', 'username avatar')
        .sort({ memberCount: -1, createdAt: -1 })
        .limit(limit);

        return recommendations;
    }

    // 申请加入群组
    async requestToJoinGroup(groupId, userId, message = '') {
        const group = await Group.findById(groupId);
        if (!group) throw new Error('群组不存在');

        if (group.members.includes(userId)) {
            throw new Error('您已经是群组成员');
        }

        if (group.settings.requireApproval) {
            // 需要审核的群组
            if (!group.pendingRequests) group.pendingRequests = [];
            
            const existingRequest = group.pendingRequests.find(req => req.user.toString() === userId);
            if (existingRequest) {
                throw new Error('您已经提交过申请，请等待审核');
            }

            group.pendingRequests.push({
                user: userId,
                message,
                requestedAt: new Date()
            });
            
            await group.save();
            return { status: 'pending', message: '申请已提交，等待管理员审核' };
        } else {
            // 直接加入
            group.members.push(userId);
            group.memberCount = group.members.length;
            await group.save();
            return { status: 'approved', message: '成功加入群组' };
        }
    }

    // 处理加入申请
    async handleJoinRequest(groupId, requestUserId, adminId, action, reason = '') {
        const group = await Group.findById(groupId);
        if (!group) throw new Error('群组不存在');

        if (!group.admins.includes(adminId)) {
            throw new Error('您没有管理权限');
        }

        const requestIndex = group.pendingRequests.findIndex(
            req => req.user.toString() === requestUserId
        );
        
        if (requestIndex === -1) {
            throw new Error('申请不存在');
        }

        const request = group.pendingRequests[requestIndex];
        
        if (action === 'approve') {
            group.members.push(requestUserId);
            group.memberCount = group.members.length;
        }
        
        // 移除申请记录
        group.pendingRequests.splice(requestIndex, 1);
        
        await group.save();
        
        return {
            action,
            user: requestUserId,
            reason,
            processedAt: new Date()
        };
    }
}

// 活动管理服务
class EventService {
    // 创建活动
    async createEvent(eventData, organizerId) {
        const event = new Event({
            ...eventData,
            organizer: organizerId,
            participants: [organizerId],
            createdAt: new Date(),
            status: 'upcoming'
        });
        
        return await event.save();
    }

    // 获取活动推荐
    async getEventRecommendations(userId, limit = 10) {
        const user = await User.findById(userId);
        if (!user) throw new Error('用户不存在');

        const now = new Date();
        const recommendations = await Event.find({
            $and: [
                { participants: { $ne: userId } }, // 用户未参与的活动
                { startTime: { $gt: now } }, // 未开始的活动
                {
                    $or: [
                        { tags: { $in: user.interests || [] } },
                        { category: { $in: user.interests || [] } },
                        { language: user.learningLanguages }
                    ]
                }
            ],
            status: 'upcoming'
        })
        .populate('organizer', 'username avatar')
        .sort({ startTime: 1 })
        .limit(limit);

        return recommendations;
    }

    // 报名参加活动
    async joinEvent(eventId, userId) {
        const event = await Event.findById(eventId);
        if (!event) throw new Error('活动不存在');

        if (event.participants.includes(userId)) {
            throw new Error('您已经报名了此活动');
        }

        if (event.maxParticipants && event.participants.length >= event.maxParticipants) {
            throw new Error('活动人数已满');
        }

        if (new Date() > event.registrationDeadline) {
            throw new Error('报名时间已截止');
        }

        event.participants.push(userId);
        event.participantCount = event.participants.length;
        
        await event.save();
        return event;
    }
}

const groupService = new AdvancedGroupService();
const eventService = new EventService();

// 创建群组
router.post('/groups', [
    body('name').notEmpty().withMessage('群组名称不能为空'),
    body('description').notEmpty().withMessage('群组描述不能为空'),
    body('category').notEmpty().withMessage('群组分类不能为空')
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

        const userId = req.user?.id || 'demo_user_id'; // 实际应用中从认证中间件获取
        const group = await groupService.createGroup(req.body, userId);
        
        res.status(201).json({
            success: true,
            data: group,
            message: '群组创建成功'
        });
    } catch (error) {
        console.error('创建群组错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取群组推荐
router.get('/groups/recommendations', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const limit = parseInt(req.query.limit) || 10;
        
        const recommendations = await groupService.getGroupRecommendations(userId, limit);
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('获取群组推荐错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 申请加入群组
router.post('/groups/:groupId/join', [
    body('message').optional().isString()
], async (req, res) => {
    try {
        const { groupId } = req.params;
        const { message } = req.body;
        const userId = req.user?.id || 'demo_user_id';
        
        const result = await groupService.requestToJoinGroup(groupId, userId, message);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('申请加入群组错误:', error);
        res.status(400).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 处理加入申请
router.post('/groups/:groupId/requests/:userId', [
    body('action').isIn(['approve', 'reject']).withMessage('操作类型无效'),
    body('reason').optional().isString()
], async (req, res) => {
    try {
        const { groupId, userId: requestUserId } = req.params;
        const { action, reason } = req.body;
        const adminId = req.user?.id || 'demo_admin_id';
        
        const result = await groupService.handleJoinRequest(groupId, requestUserId, adminId, action, reason);
        
        res.json({
            success: true,
            data: result,
            message: action === 'approve' ? '申请已通过' : '申请已拒绝'
        });
    } catch (error) {
        console.error('处理加入申请错误:', error);
        res.status(400).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 创建活动
router.post('/events', [
    body('title').notEmpty().withMessage('活动标题不能为空'),
    body('description').notEmpty().withMessage('活动描述不能为空'),
    body('startTime').isISO8601().withMessage('开始时间格式无效'),
    body('location').notEmpty().withMessage('活动地点不能为空')
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

        const userId = req.user?.id || 'demo_user_id';
        const event = await eventService.createEvent(req.body, userId);
        
        res.status(201).json({
            success: true,
            data: event,
            message: '活动创建成功'
        });
    } catch (error) {
        console.error('创建活动错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取活动推荐
router.get('/events/recommendations', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const limit = parseInt(req.query.limit) || 10;
        
        const recommendations = await eventService.getEventRecommendations(userId, limit);
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('获取活动推荐错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 报名参加活动
router.post('/events/:eventId/join', async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.id || 'demo_user_id';
        
        const event = await eventService.joinEvent(eventId, userId);
        
        res.json({
            success: true,
            data: event,
            message: '报名成功'
        });
    } catch (error) {
        console.error('报名活动错误:', error);
        res.status(400).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 获取用户的群组列表
router.get('/groups/my', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        
        const groups = await Group.find({
            members: userId
        })
        .populate('creator', 'username avatar')
        .sort({ lastActivity: -1 });
        
        res.json({
            success: true,
            data: groups
        });
    } catch (error) {
        console.error('获取用户群组错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 获取用户的活动列表
router.get('/events/my', async (req, res) => {
    try {
        const userId = req.user?.id || 'demo_user_id';
        const { status } = req.query; // upcoming, ongoing, completed
        
        let query = { participants: userId };
        
        if (status) {
            query.status = status;
        }
        
        const events = await Event.find(query)
        .populate('organizer', 'username avatar')
        .sort({ startTime: -1 });
        
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        console.error('获取用户活动错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

module.exports = router;

