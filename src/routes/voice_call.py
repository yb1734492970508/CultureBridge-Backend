"""
CultureBridge Backend Routes - Voice Call
跨国语音通话API路由
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import base64
import json
from datetime import datetime

from ..services.voice_call import voice_call_service
from ..database import db, VoiceCallSession, UserMatchingPreference

voice_call_bp = Blueprint('voice_call', __name__, url_prefix='/api/voice-call')

@voice_call_bp.route('/matching/join', methods=['POST'])
@jwt_required()
def join_matching_queue():
    """加入匹配队列"""
    
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # 验证必需参数
        if not data.get('user_language'):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters',
                'message': 'user_language is required'
            }), 400
        
        # 获取参数
        user_language = data['user_language']
        target_languages = data.get('target_languages', [])
        preferences = data.get('preferences', {})
        
        # 加入匹配队列（同步调用）
        result = voice_call_service.join_matching_queue_sync(
            user_id=user_id,
            user_language=user_language,
            target_languages=target_languages,
            preferences=preferences
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to join matching queue'
        }), 500

@voice_call_bp.route('/matching/leave', methods=['POST'])
@jwt_required()
def leave_matching_queue():
    """离开匹配队列"""
    
    try:
        user_id = get_jwt_identity()
        
        # 离开匹配队列（同步调用）
        result = voice_call_service.leave_matching_queue_sync(user_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to leave matching queue'
        }), 500

@voice_call_bp.route('/matching/status', methods=['GET'])
@jwt_required()
def get_matching_status():
    """获取匹配状态"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取队列状态
        queue_status = voice_call_service.get_queue_status()
        
        # 检查用户是否在队列中
        waiting_users = voice_call_service.waiting_users
        user_in_queue = user_id in waiting_users
        
        # 检查用户是否在通话中
        user_in_call = False
        current_call = None
        
        for call_id, call_info in voice_call_service.active_calls.items():
            if user_id in [call_info['caller_id'], call_info['callee_id']]:
                user_in_call = True
                current_call = {
                    'call_session_id': call_id,
                    'status': call_info['status'],
                    'participants': call_info['participants']
                }
                break
        
        return jsonify({
            'success': True,
            'user_in_queue': user_in_queue,
            'user_in_call': user_in_call,
            'current_call': current_call,
            'queue_status': queue_status,
            'queue_position': list(waiting_users.keys()).index(user_id) + 1 if user_in_queue else 0
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get matching status'
        }), 500

@voice_call_bp.route('/call/<call_session_id>/audio', methods=['POST'])
@jwt_required()
def process_call_audio(call_session_id):
    """处理通话音频"""
    
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # 验证必需参数
        if not data.get('audio_data'):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters',
                'message': 'audio_data is required'
            }), 400
        
        # 解码音频数据
        try:
            audio_data = base64.b64decode(data['audio_data'])
        except Exception as e:
            return jsonify({
                'success': False,
                'error': 'Invalid audio data',
                'message': 'Failed to decode base64 audio data'
            }), 400
        
        # 处理音频（同步调用）
        result = voice_call_service.process_call_audio_sync(
            call_session_id=call_session_id,
            user_id=user_id,
            audio_data=audio_data,
            chunk_index=data.get('chunk_index', 0)
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to process call audio'
        }), 500

@voice_call_bp.route('/call/<call_session_id>/end', methods=['POST'])
@jwt_required()
def end_voice_call(call_session_id):
    """结束语音通话"""
    
    try:
        user_id = get_jwt_identity()
        
        # 结束通话（同步调用）
        result = voice_call_service.end_voice_call_sync(call_session_id, user_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to end voice call'
        }), 500

@voice_call_bp.route('/call/<call_session_id>/status', methods=['GET'])
@jwt_required()
def get_call_status(call_session_id):
    """获取通话状态"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取通话状态（同步调用）
        result = voice_call_service.get_call_status_sync(call_session_id, user_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get call status'
        }), 500

@voice_call_bp.route('/history', methods=['GET'])
@jwt_required()
def get_call_history():
    """获取通话历史"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取查询参数
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # 获取通话历史（同步调用）
        history = voice_call_service.get_user_call_history_sync(
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'success': True,
            'history': history,
            'total_calls': len(history),
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get call history'
        }), 500

@voice_call_bp.route('/preferences', methods=['GET'])
@jwt_required()
def get_user_preferences():
    """获取用户匹配偏好"""
    
    try:
        user_id = get_jwt_identity()
        
        # 查询用户偏好（模拟实现）
        return jsonify({
            'success': True,
            'preferences': {
                'preferred_languages': [],
                'age_range': {'min': 18, 'max': 65},
                'interests': [],
                'availability_hours': {},
                'match_criteria': {}
            }
        }), 200
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get user preferences'
        }), 500

@voice_call_bp.route('/preferences', methods=['POST'])
@jwt_required()
def update_user_preferences():
    """更新用户匹配偏好"""
    
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # 更新偏好设置（同步调用）
        result = voice_call_service.update_user_preferences_sync(
            user_id=user_id,
            preferences=data
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to update user preferences'
        }), 500

@voice_call_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_call_stats():
    """获取通话统计"""
    
    try:
        user_id = get_jwt_identity()
        
        # 返回模拟统计数据
        return jsonify({
            'success': True,
            'stats': {
                'total_calls': 0,
                'completed_calls': 0,
                'total_duration': 0,
                'total_translations': 0,
                'average_call_duration': 0,
                'average_translations_per_call': 0
            },
            'recent_calls': []
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get call stats'
        }), 500

@voice_call_bp.route('/queue/status', methods=['GET'])
def get_queue_status():
    """获取队列状态（公开接口）"""
    
    try:
        queue_status = voice_call_service.get_queue_status()
        
        return jsonify({
            'success': True,
            'queue_status': queue_status
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get queue status'
        }), 500

@voice_call_bp.route('/languages', methods=['GET'])
def get_supported_languages():
    """获取支持的语言列表"""
    
    try:
        # 返回常用语言列表
        languages = [
            {'code': 'zh', 'name': 'Chinese', 'native_name': '中文', 'flag': '🇨🇳'},
            {'code': 'en', 'name': 'English', 'native_name': 'English', 'flag': '🇺🇸'},
            {'code': 'es', 'name': 'Spanish', 'native_name': 'Español', 'flag': '🇪🇸'},
            {'code': 'fr', 'name': 'French', 'native_name': 'Français', 'flag': '🇫🇷'},
            {'code': 'de', 'name': 'German', 'native_name': 'Deutsch', 'flag': '🇩🇪'},
            {'code': 'ja', 'name': 'Japanese', 'native_name': '日本語', 'flag': '🇯🇵'},
            {'code': 'ko', 'name': 'Korean', 'native_name': '한국어', 'flag': '🇰🇷'},
            {'code': 'ar', 'name': 'Arabic', 'native_name': 'العربية', 'flag': '🇸🇦'},
            {'code': 'ru', 'name': 'Russian', 'native_name': 'Русский', 'flag': '🇷🇺'},
            {'code': 'pt', 'name': 'Portuguese', 'native_name': 'Português', 'flag': '🇵🇹'},
            {'code': 'it', 'name': 'Italian', 'native_name': 'Italiano', 'flag': '🇮🇹'},
            {'code': 'hi', 'name': 'Hindi', 'native_name': 'हिन्दी', 'flag': '🇮🇳'},
            {'code': 'th', 'name': 'Thai', 'native_name': 'ไทย', 'flag': '🇹🇭'},
            {'code': 'vi', 'name': 'Vietnamese', 'native_name': 'Tiếng Việt', 'flag': '🇻🇳'}
        ]
        
        return jsonify({
            'success': True,
            'languages': languages,
            'total_languages': len(languages)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get supported languages'
        }), 500

