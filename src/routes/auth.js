const express = require('express');
const router = express.Router();

// 简化的认证路由，用于测试
router.post('/register', (req, res) => {
    res.json({
        success: true,
        message: '注册功能暂未实现',
        data: { token: 'mock-token' }
    });
});

router.post('/login', (req, res) => {
    res.json({
        success: true,
        message: '登录成功',
        data: { 
            token: 'mock-token',
            user: {
                id: '1',
                username: 'testuser',
                email: 'test@example.com'
            }
        }
    });
});

router.get('/logout', (req, res) => {
    res.json({
        success: true,
        message: '退出登录成功'
    });
});

router.get('/me', (req, res) => {
    res.json({
        success: true,
        data: {
            id: '1',
            username: 'testuser',
            email: 'test@example.com'
        }
    });
});

module.exports = router;

