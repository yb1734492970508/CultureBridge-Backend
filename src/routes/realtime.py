"""
CultureBridge Backend Routes - Realtime Translation
实时翻译API路由
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import base64
import json
from datetime import datetime

from ..services.realtime_translation import realtime_translation_service
from ..database import db, RealtimeSession, RealtimeTranslation

realtime_bp = Blueprint('realtime', __name__, url_prefix='/api/realtime')

@realtime_bp.route('/phone-audio/start', methods=['POST'])
@jwt_required()
def start_phone_audio_session():
    """开始手机播放内容实时翻译会话"""
    
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # 验证必需参数
        if not data.get('source_language') or not data.get('target_language'):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters',
                'message': 'source_language and target_language are required'
            }), 400
        
        # 获取会话配置
        session_config = data.get('config', {})
        
        # 启动会话（同步调用）
        result = realtime_translation_service.start_phone_audio_session_sync(
            user_id=user_id,
            source_lang=data['source_language'],
            target_lang=data['target_language'],
            session_config=session_config
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to start phone audio session'
        }), 500

@realtime_bp.route('/external-audio/start', methods=['POST'])
@jwt_required()
def start_external_audio_session():
    """开始外部音频实时翻译会话"""
    
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # 验证必需参数
        if not data.get('source_language') or not data.get('target_language'):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters',
                'message': 'source_language and target_language are required'
            }), 400
        
        # 获取会话配置
        session_config = data.get('config', {})
        
        # 启动会话（同步调用）
        result = realtime_translation_service.start_external_audio_session_sync(
            user_id=user_id,
            source_lang=data['source_language'],
            target_lang=data['target_language'],
            session_config=session_config
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to start external audio session'
        }), 500

@realtime_bp.route('/session/<session_id>/audio', methods=['POST'])
@jwt_required()
def process_audio_chunk(session_id):
    """处理音频块"""
    
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
        result = realtime_translation_service.process_audio_chunk_sync(
            session_id=session_id,
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
            'message': 'Failed to process audio chunk'
        }), 500

@realtime_bp.route('/session/<session_id>/stop', methods=['POST'])
@jwt_required()
def stop_session(session_id):
    """停止翻译会话"""
    
    try:
        user_id = get_jwt_identity()
        
        # 停止会话（同步调用）
        result = realtime_translation_service.stop_session_sync(session_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to stop session'
        }), 500

@realtime_bp.route('/session/<session_id>/status', methods=['GET'])
@jwt_required()
def get_session_status(session_id):
    """获取会话状态"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取会话状态（同步调用）
        result = realtime_translation_service.get_session_status_sync(session_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get session status'
        }), 500

@realtime_bp.route('/session/<session_id>/translations', methods=['GET'])
@jwt_required()
def get_session_translations(session_id):
    """获取会话翻译历史"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取查询参数
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # 获取翻译历史（同步调用）
        result = realtime_translation_service.get_session_translations_sync(
            session_id=session_id,
            limit=limit,
            offset=offset
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get session translations'
        }), 500

@realtime_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_user_sessions():
    """获取用户的翻译会话列表"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取查询参数
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        session_type = request.args.get('type', None)
        
        # 获取用户会话（同步调用）
        result = realtime_translation_service.get_user_sessions_sync(
            user_id=user_id,
            limit=limit,
            offset=offset,
            session_type=session_type
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get user sessions'
        }), 500

@realtime_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_user_stats():
    """获取用户翻译统计"""
    
    try:
        user_id = get_jwt_identity()
        
        # 获取用户统计（同步调用）
        result = realtime_translation_service.get_user_stats_sync(user_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to get user stats'
        }), 500

