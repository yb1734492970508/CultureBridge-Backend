const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const LiveStream = require('../models/LiveStream');
const User = require('../models/User');

// 创建直播间
router.post('/create', protect, async (req, res) => {
  try {
    const { title, description, category, isPrivate = false } = req.body;
    
    const liveStream = new LiveStream({
      title,
      description,
      category,
      host: req.user._id,
      isPrivate,
      status: 'waiting',
      streamKey: generateStreamKey(),
      rtmpUrl: `rtmp://localhost:1935/live/${generateStreamKey()}`,
      hlsUrl: `http://localhost:8080/hls/${generateStreamKey()}.m3u8`
    });

    await liveStream.save();
    
    res.status(201).json({
      success: true,
      data: liveStream
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 开始直播
router.post('/:id/start', protect, async (req, res) => {
  try {
    const liveStream = await LiveStream.findById(req.params.id);
    
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: '直播间不存在'
      });
    }
    
    if (liveStream.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '只有主播可以开始直播'
      });
    }
    
    liveStream.status = 'live';
    liveStream.startTime = new Date();
    await liveStream.save();
    
    res.json({
      success: true,
      data: liveStream
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 结束直播
router.post('/:id/end', protect, async (req, res) => {
  try {
    const liveStream = await LiveStream.findById(req.params.id);
    
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: '直播间不存在'
      });
    }
    
    if (liveStream.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '只有主播可以结束直播'
      });
    }
    
    liveStream.status = 'ended';
    liveStream.endTime = new Date();
    await liveStream.save();
    
    res.json({
      success: true,
      data: liveStream
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取直播列表
router.get('/list', async (req, res) => {
  try {
    const { status = 'live', category, page = 1, limit = 10 } = req.query;
    
    const query = { status };
    if (category) {
      query.category = category;
    }
    
    const liveStreams = await LiveStream.find(query)
      .populate('host', 'username avatar')
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await LiveStream.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        liveStreams,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取直播详情
router.get('/:id', async (req, res) => {
  try {
    const liveStream = await LiveStream.findById(req.params.id)
      .populate('host', 'username avatar')
      .populate('viewers', 'username avatar');
    
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: '直播间不存在'
      });
    }
    
    res.json({
      success: true,
      data: liveStream
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 加入直播间
router.post('/:id/join', protect, async (req, res) => {
  try {
    const liveStream = await LiveStream.findById(req.params.id);
    
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: '直播间不存在'
      });
    }
    
    if (!liveStream.viewers.includes(req.user._id)) {
      liveStream.viewers.push(req.user._id);
      liveStream.viewerCount = liveStream.viewers.length;
      await liveStream.save();
    }
    
    res.json({
      success: true,
      message: '成功加入直播间'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 离开直播间
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const liveStream = await LiveStream.findById(req.params.id);
    
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: '直播间不存在'
      });
    }
    
    liveStream.viewers = liveStream.viewers.filter(
      viewer => viewer.toString() !== req.user._id.toString()
    );
    liveStream.viewerCount = liveStream.viewers.length;
    await liveStream.save();
    
    res.json({
      success: true,
      message: '已离开直播间'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 生成流密钥
function generateStreamKey() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

module.exports = router;

