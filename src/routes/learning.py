"""
CultureBridge Backend Learning Routes
学习相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app

from src.services.auth import login_required, get_current_user

# 创建蓝图
learning_bp = Blueprint('learning', __name__)

@learning_bp.route('/sessions', methods=['GET'])
@login_required
def get_learning_sessions():
    """获取学习会话"""
    
    try:
        current_user = get_current_user()
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        from src.models import LearningSession
        
        # 查询学习会话
        pagination = LearningSession.query.filter_by(user_id=current_user.id)\
            .order_by(LearningSession.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        sessions = [session.to_dict() for session in pagination.items]
        
        return jsonify({
            'sessions': sessions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get learning sessions error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get learning sessions'
        }), 500

@learning_bp.route('/sessions', methods=['POST'])
@login_required
def create_learning_session():
    """创建学习会话"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['language_id', 'session_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'error': 'missing_field',
                    'message': f'Field {field} is required'
                }), 400
        
        from src.models import LearningSession, db
        
        # 创建学习会话
        session = LearningSession(
            user_id=current_user.id,
            language_id=data['language_id'],
            session_type=data['session_type'],
            duration_minutes=data.get('duration_minutes', 0),
            content=data.get('content', {}),
            progress=data.get('progress', {})
        )
        
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Learning session created successfully',
            'session': session.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Create learning session error: {str(e)}')
        from src.models import db
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to create learning session'
        }), 500

