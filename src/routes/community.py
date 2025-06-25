from flask import Blueprint, request, jsonify
from datetime import datetime

community_bp = Blueprint('community', __name__)

# 模拟社区数据
COMMUNITY_POSTS = [
    {
        'id': 1,
        'title': '中国春节文化分享',
        'content': '春节是中国最重要的传统节日，有着丰富的文化内涵...',
        'author': '文化爱好者小李',
        'author_avatar': '/api/avatars/user1.jpg',
        'category': '传统节日',
        'tags': ['春节', '中国文化', '传统'],
        'likes': 128,
        'comments': 45,
        'shares': 23,
        'created_at': '2025-06-25T08:00:00Z',
        'images': ['/api/images/spring_festival_1.jpg']
    },
    {
        'id': 2,
        'title': '日本茶道体验分享',
        'content': '今天参加了一场正宗的日本茶道体验，感受到了日本文化的精髓...',
        'author': '旅行达人小王',
        'author_avatar': '/api/avatars/user2.jpg',
        'category': '文化体验',
        'tags': ['日本', '茶道', '文化体验'],
        'likes': 89,
        'comments': 32,
        'shares': 15,
        'created_at': '2025-06-25T07:30:00Z',
        'images': ['/api/images/tea_ceremony_1.jpg']
    }
]

CULTURAL_CATEGORIES = [
    {'id': 1, 'name': '传统节日', 'icon': '🎉', 'count': 156},
    {'id': 2, 'name': '美食文化', 'icon': '🍜', 'count': 234},
    {'id': 3, 'name': '艺术表演', 'icon': '🎭', 'count': 89},
    {'id': 4, 'name': '语言学习', 'icon': '📚', 'count': 178},
    {'id': 5, 'name': '旅行见闻', 'icon': '✈️', 'count': 267},
    {'id': 6, 'name': '历史文化', 'icon': '🏛️', 'count': 145}
]

@community_bp.route('/posts', methods=['GET'])
def get_community_posts():
    """获取社区帖子列表"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    category = request.args.get('category', '')
    
    # 模拟分页
    start = (page - 1) * limit
    end = start + limit
    
    filtered_posts = COMMUNITY_POSTS
    if category:
        filtered_posts = [post for post in COMMUNITY_POSTS if post['category'] == category]
    
    posts = filtered_posts[start:end]
    
    return jsonify({
        'success': True,
        'posts': posts,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': len(filtered_posts),
            'pages': (len(filtered_posts) + limit - 1) // limit
        }
    })

@community_bp.route('/posts/<int:post_id>', methods=['GET'])
def get_post_detail(post_id):
    """获取帖子详情"""
    post = next((p for p in COMMUNITY_POSTS if p['id'] == post_id), None)
    
    if not post:
        return jsonify({
            'success': False,
            'error': 'Post not found'
        }), 404
    
    # 模拟评论数据
    comments = [
        {
            'id': 1,
            'content': '非常有趣的分享！',
            'author': '用户A',
            'author_avatar': '/api/avatars/user3.jpg',
            'created_at': '2025-06-25T09:00:00Z',
            'likes': 5
        },
        {
            'id': 2,
            'content': '学到了很多新知识',
            'author': '用户B',
            'author_avatar': '/api/avatars/user4.jpg',
            'created_at': '2025-06-25T09:15:00Z',
            'likes': 3
        }
    ]
    
    return jsonify({
        'success': True,
        'post': post,
        'comments': comments
    })

@community_bp.route('/categories', methods=['GET'])
def get_categories():
    """获取文化分类"""
    return jsonify({
        'success': True,
        'categories': CULTURAL_CATEGORIES
    })

@community_bp.route('/posts', methods=['POST'])
def create_post():
    """创建新帖子"""
    try:
        data = request.get_json()
        
        new_post = {
            'id': len(COMMUNITY_POSTS) + 1,
            'title': data.get('title', ''),
            'content': data.get('content', ''),
            'author': data.get('author', '匿名用户'),
            'author_avatar': '/api/avatars/default.jpg',
            'category': data.get('category', '其他'),
            'tags': data.get('tags', []),
            'likes': 0,
            'comments': 0,
            'shares': 0,
            'created_at': datetime.now().isoformat() + 'Z',
            'images': data.get('images', [])
        }
        
        COMMUNITY_POSTS.insert(0, new_post)
        
        return jsonify({
            'success': True,
            'post': new_post,
            'message': '帖子发布成功！'
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@community_bp.route('/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    """点赞帖子"""
    post = next((p for p in COMMUNITY_POSTS if p['id'] == post_id), None)
    
    if not post:
        return jsonify({
            'success': False,
            'error': 'Post not found'
        }), 404
    
    post['likes'] += 1
    
    return jsonify({
        'success': True,
        'likes': post['likes'],
        'message': '点赞成功！'
    })

@community_bp.route('/trending', methods=['GET'])
def get_trending_topics():
    """获取热门话题"""
    trending = [
        {'tag': '春节', 'count': 156, 'trend': 'up'},
        {'tag': '日本文化', 'count': 134, 'trend': 'up'},
        {'tag': '美食', 'count': 128, 'trend': 'stable'},
        {'tag': '语言学习', 'count': 98, 'trend': 'up'},
        {'tag': '旅行', 'count': 87, 'trend': 'down'}
    ]
    
    return jsonify({
        'success': True,
        'trending': trending
    })

