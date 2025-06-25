from flask import Blueprint, request, jsonify
from datetime import datetime

content_bp = Blueprint('content', __name__)

# 模拟文化内容数据
CULTURAL_CONTENT = [
    {
        'id': 1,
        'title': '中国书法艺术入门',
        'description': '了解中国书法的基本知识和练习方法',
        'type': 'course',
        'category': '艺术文化',
        'difficulty': 'beginner',
        'duration': '30分钟',
        'instructor': '书法大师张老师',
        'rating': 4.8,
        'students': 1234,
        'thumbnail': '/api/images/calligraphy_course.jpg',
        'price': 0,  # 免费课程
        'tags': ['书法', '中国文化', '艺术'],
        'created_at': '2025-06-20T10:00:00Z'
    },
    {
        'id': 2,
        'title': '日本料理制作技巧',
        'description': '学习制作正宗日本料理的技巧和文化背景',
        'type': 'course',
        'category': '美食文化',
        'difficulty': 'intermediate',
        'duration': '45分钟',
        'instructor': '料理专家田中先生',
        'rating': 4.9,
        'students': 856,
        'thumbnail': '/api/images/japanese_cooking.jpg',
        'price': 99,  # 付费课程
        'tags': ['日本料理', '美食', '文化'],
        'created_at': '2025-06-18T14:30:00Z'
    },
    {
        'id': 3,
        'title': '法国香水文化探秘',
        'description': '深入了解法国香水的历史和制作工艺',
        'type': 'article',
        'category': '生活文化',
        'difficulty': 'beginner',
        'duration': '15分钟',
        'author': '文化研究者Marie',
        'rating': 4.6,
        'views': 2341,
        'thumbnail': '/api/images/french_perfume.jpg',
        'price': 0,
        'tags': ['法国', '香水', '文化历史'],
        'created_at': '2025-06-22T09:15:00Z'
    }
]

CONTENT_CATEGORIES = [
    {'id': 1, 'name': '艺术文化', 'count': 45},
    {'id': 2, 'name': '美食文化', 'count': 67},
    {'id': 3, 'name': '生活文化', 'count': 89},
    {'id': 4, 'name': '历史文化', 'count': 34},
    {'id': 5, 'name': '语言文化', 'count': 56},
    {'id': 6, 'name': '节日文化', 'count': 23}
]

@content_bp.route('/list', methods=['GET'])
def get_content_list():
    """获取文化内容列表"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 12, type=int)
    category = request.args.get('category', '')
    content_type = request.args.get('type', '')  # course, article, video
    difficulty = request.args.get('difficulty', '')  # beginner, intermediate, advanced
    
    # 过滤内容
    filtered_content = CULTURAL_CONTENT
    
    if category:
        filtered_content = [c for c in filtered_content if c['category'] == category]
    
    if content_type:
        filtered_content = [c for c in filtered_content if c['type'] == content_type]
    
    if difficulty:
        filtered_content = [c for c in filtered_content if c['difficulty'] == difficulty]
    
    # 分页
    start = (page - 1) * limit
    end = start + limit
    content_list = filtered_content[start:end]
    
    return jsonify({
        'success': True,
        'content': content_list,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': len(filtered_content),
            'pages': (len(filtered_content) + limit - 1) // limit
        }
    })

@content_bp.route('/<int:content_id>', methods=['GET'])
def get_content_detail(content_id):
    """获取内容详情"""
    content = next((c for c in CULTURAL_CONTENT if c['id'] == content_id), None)
    
    if not content:
        return jsonify({
            'success': False,
            'error': 'Content not found'
        }), 404
    
    # 模拟详细内容
    detailed_content = content.copy()
    detailed_content.update({
        'content_body': '这里是详细的内容正文...',
        'chapters': [
            {'id': 1, 'title': '第一章：基础知识', 'duration': '10分钟'},
            {'id': 2, 'title': '第二章：实践练习', 'duration': '15分钟'},
            {'id': 3, 'title': '第三章：进阶技巧', 'duration': '20分钟'}
        ] if content['type'] == 'course' else None,
        'related_content': [
            {'id': 4, 'title': '相关内容1', 'thumbnail': '/api/images/related1.jpg'},
            {'id': 5, 'title': '相关内容2', 'thumbnail': '/api/images/related2.jpg'}
        ]
    })
    
    return jsonify({
        'success': True,
        'content': detailed_content
    })

@content_bp.route('/categories', methods=['GET'])
def get_content_categories():
    """获取内容分类"""
    return jsonify({
        'success': True,
        'categories': CONTENT_CATEGORIES
    })

@content_bp.route('/featured', methods=['GET'])
def get_featured_content():
    """获取精选内容"""
    # 返回评分最高的内容
    featured = sorted(CULTURAL_CONTENT, key=lambda x: x.get('rating', 0), reverse=True)[:6]
    
    return jsonify({
        'success': True,
        'featured': featured
    })

@content_bp.route('/search', methods=['GET'])
def search_content():
    """搜索内容"""
    query = request.args.get('q', '').lower()
    
    if not query:
        return jsonify({
            'success': False,
            'error': 'Search query is required'
        }), 400
    
    # 简单的搜索实现
    results = []
    for content in CULTURAL_CONTENT:
        if (query in content['title'].lower() or 
            query in content['description'].lower() or 
            any(query in tag.lower() for tag in content['tags'])):
            results.append(content)
    
    return jsonify({
        'success': True,
        'results': results,
        'total': len(results),
        'query': query
    })

@content_bp.route('/<int:content_id>/enroll', methods=['POST'])
def enroll_content(content_id):
    """报名/收藏内容"""
    content = next((c for c in CULTURAL_CONTENT if c['id'] == content_id), None)
    
    if not content:
        return jsonify({
            'success': False,
            'error': 'Content not found'
        }), 404
    
    # 模拟报名逻辑
    return jsonify({
        'success': True,
        'message': f'成功报名《{content["title"]}》！',
        'enrollment_date': datetime.now().isoformat() + 'Z'
    })

@content_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """获取个性化推荐"""
    user_id = request.args.get('user_id', 1, type=int)
    
    # 模拟个性化推荐算法
    recommendations = CULTURAL_CONTENT[:3]  # 简单返回前3个
    
    return jsonify({
        'success': True,
        'recommendations': recommendations,
        'reason': '基于您的兴趣和学习历史推荐'
    })

