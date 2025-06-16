const express = require('express');
const router = express.Router();

// 简化的路由文件
router.get('/', (req, res) => {
    res.json({ success: true, message: 'Profiles API' });
});

module.exports = router;

