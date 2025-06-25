"""
CultureBridge Backend Chat Routes
聊天相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app

from src.services.auth import login_required, get_current_user

# 创建蓝图
chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/conversations', methods=['GET'])
@login_required
def get_conversations():
    """获取对话列表"""
    
    try:
        current_user = get_current_user()
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        from src.models import Conversation
        
        # 查询用户参与的对话
        conversations = current_user.conversations
        
        # 简单分页（实际应该在数据库层面分页）
        start = (page - 1) * per_page
        end = start + per_page
        paginated_conversations = conversations[start:end]
        
        conversation_list = [conv.to_dict(current_user.id) for conv in paginated_conversations]
        
        return jsonify({
            'conversations': conversation_list,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': len(conversations),
                'pages': (len(conversations) + per_page - 1) // per_page,
                'has_next': end < len(conversations),
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get conversations error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get conversations'
        }), 500

@chat_bp.route('/conversations', methods=['POST'])
@login_required
def create_conversation():
    """创建对话"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        from src.models import Conversation, User, db
        
        # 创建对话
        conversation = Conversation(
            title=data.get('title', ''),
            is_group=data.get('is_group', False),
            description=data.get('description', ''),
            settings=data.get('settings', {})
        )
        
        # 添加创建者为参与者
        conversation.participants.append(current_user)
        
        # 添加其他参与者
        participant_ids = data.get('participant_ids', [])
        for participant_id in participant_ids:
            participant = User.query.get(participant_id)
            if participant and participant != current_user:
                conversation.participants.append(participant)
        
        db.session.add(conversation)
        db.session.commit()
        
        return jsonify({
            'message': 'Conversation created successfully',
            'conversation': conversation.to_dict(current_user.id)
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Create conversation error: {str(e)}')
        from src.models import db
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to create conversation'
        }), 500

@chat_bp.route('/conversations/<conversation_id>/messages', methods=['GET'])
@login_required
def get_messages(conversation_id):
    """获取对话消息"""
    
    try:
        current_user = get_current_user()
        
        from src.models import Conversation, Message
        
        # 检查对话是否存在且用户有权限访问
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({
                'error': 'conversation_not_found',
                'message': 'Conversation not found'
            }), 404
        
        if current_user not in conversation.participants:
            return jsonify({
                'error': 'permission_denied',
                'message': 'You are not a participant in this conversation'
            }), 403
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        
        # 查询消息
        pagination = Message.query.filter_by(conversation_id=conversation_id)\
            .order_by(Message.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        messages = [message.to_dict() for message in pagination.items]
        
        return jsonify({
            'messages': messages,
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
        current_app.logger.error(f'Get messages error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get messages'
        }), 500

@chat_bp.route('/conversations/<conversation_id>/messages', methods=['POST'])
@login_required
def send_message(conversation_id):
    """发送消息"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        from src.models import Conversation, Message, db
        
        # 检查对话是否存在且用户有权限访问
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({
                'error': 'conversation_not_found',
                'message': 'Conversation not found'
            }), 404
        
        if current_user not in conversation.participants:
            return jsonify({
                'error': 'permission_denied',
                'message': 'You are not a participant in this conversation'
            }), 403
        
        # 验证必需字段
        if not data.get('content'):
            return jsonify({
                'error': 'missing_content',
                'message': 'Message content is required'
            }), 400
        
        # 创建消息
        message = Message(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            content=data['content'],
            content_type=data.get('content_type', 'text'),
            original_language=data.get('original_language', 'en'),
            reply_to_id=data.get('reply_to_id')
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify({
            'message': 'Message sent successfully',
            'message_data': message.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f'Send message error: {str(e)}')
        from src.models import db
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to send message'
        }), 500

