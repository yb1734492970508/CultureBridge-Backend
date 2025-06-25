"""
CultureBridge Backend Simple Test Application
简化测试应用，避免相对导入问题
"""

import os
import sys
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_simple_test_app():
    """创建简化测试Flask应用"""
    app = Flask(__name__)
    
    # 配置
    app.config['SECRET_KEY'] = 'test-secret-key'
    app.config['JWT_SECRET_KEY'] = 'test-jwt-secret'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    
    # 启用CORS
    CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])
    
    # 初始化JWT
    jwt = JWTManager(app)
    
    # 健康检查端点
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "message": "CultureBridge Test Backend is running",
            "version": "2.0.0-test",
            "features": [
                "Real-time Phone Audio Translation",
                "Real-time External Audio Translation", 
                "Cross-border Voice Call Matching"
            ]
        })
    
    # 测试认证端点
    @app.route('/api/test/auth', methods=['POST'])
    def test_auth():
        # 创建测试用户token
        access_token = create_access_token(identity='test_user_123')
        
        return jsonify({
            'success': True,
            'access_token': access_token,
            'user_id': 'test_user_123'
        })
    
    # 实时翻译API - 手机音频
    @app.route('/api/realtime/phone-audio/start', methods=['POST'])
    @jwt_required()
    def start_phone_audio_session():
        user_id = get_jwt_identity()
        data = request.get_json()
        
        return jsonify({
            'success': True,
            'session_id': f'phone_test_{user_id}',
            'message': '手机音频翻译会话已开始（测试模式）',
            'config': {
                'real_time_threshold': 2.0,
                'buffer_size': 4096,
                'sample_rate': 16000
            }
        })
    
    # 实时翻译API - 外部音频
    @app.route('/api/realtime/external-audio/start', methods=['POST'])
    @jwt_required()
    def start_external_audio_session():
        user_id = get_jwt_identity()
        data = request.get_json()
        
        return jsonify({
            'success': True,
            'session_id': f'external_test_{user_id}',
            'message': '外部音频翻译会话已开始（测试模式）',
            'config': {
                'real_time_threshold': 1.5,
                'buffer_size': 4096,
                'sample_rate': 16000
            }
        })
    
    # 实时翻译API - 处理音频
    @app.route('/api/realtime/session/<session_id>/audio', methods=['POST'])
    @jwt_required()
    def process_audio_chunk(session_id):
        user_id = get_jwt_identity()
        data = request.get_json()
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'translation': {
                'original_text': '[测试] 检测到音频内容',
                'translated_text': '[Test] Audio content detected',
                'source_language': 'zh',
                'target_language': 'en',
                'confidence': 0.8
            },
            'message': '音频处理成功（测试模式）'
        })
    
    # 语音通话API - 加入匹配队列
    @app.route('/api/voice-call/matching/join', methods=['POST'])
    @jwt_required()
    def join_matching_queue():
        user_id = get_jwt_identity()
        data = request.get_json()
        
        return jsonify({
            'success': True,
            'message': '已加入匹配队列（测试模式）',
            'queue_position': 1,
            'estimated_wait_time': 30
        })
    
    # 语音通话API - 获取匹配状态
    @app.route('/api/voice-call/matching/status', methods=['GET'])
    @jwt_required()
    def get_matching_status():
        user_id = get_jwt_identity()
        
        return jsonify({
            'success': True,
            'user_in_queue': False,
            'user_in_call': False,
            'current_call': None,
            'queue_status': {
                'waiting_users': 0,
                'active_calls': 0
            }
        })
    
    # 语音通话API - 获取支持的语言
    @app.route('/api/voice-call/languages', methods=['GET'])
    def get_supported_languages():
        languages = [
            {'code': 'zh', 'name': 'Chinese', 'native_name': '中文', 'flag': '🇨🇳'},
            {'code': 'en', 'name': 'English', 'native_name': 'English', 'flag': '🇺🇸'},
            {'code': 'es', 'name': 'Spanish', 'native_name': 'Español', 'flag': '🇪🇸'},
            {'code': 'fr', 'name': 'French', 'native_name': 'Français', 'flag': '🇫🇷'},
            {'code': 'de', 'name': 'German', 'native_name': 'Deutsch', 'flag': '🇩🇪'},
            {'code': 'ja', 'name': 'Japanese', 'native_name': '日本語', 'flag': '🇯🇵'},
            {'code': 'ko', 'name': 'Korean', 'native_name': '한국어', 'flag': '🇰🇷'}
        ]
        
        return jsonify({
            'success': True,
            'languages': languages,
            'total_languages': len(languages)
        })
    
    # 错误处理
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "error": "Endpoint not found",
            "message": "The requested endpoint does not exist"
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            "success": False,
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }), 500
    
    # JWT错误处理
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "success": False,
            "error": "Token expired",
            "message": "The JWT token has expired"
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            "success": False,
            "error": "Invalid token",
            "message": "The JWT token is invalid"
        }), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            "success": False,
            "error": "Authorization required",
            "message": "JWT token is required"
        }), 401
    
    return app

if __name__ == '__main__':
    # 创建应用
    app = create_simple_test_app()
    
    print("=" * 60)
    print("🚀 CultureBridge Test Backend Server Starting...")
    print("=" * 60)
    print("✨ New Features Available:")
    print("   📱 Real-time Phone Audio Translation")
    print("   🎤 Real-time External Audio Translation")
    print("   🌍 Cross-border Voice Call Matching")
    print("=" * 60)
    print("🔗 API Endpoints:")
    print("   GET  /health - Health check")
    print("   POST /api/test/auth - Get test token")
    print("   POST /api/realtime/phone-audio/start - Start phone audio session")
    print("   POST /api/realtime/external-audio/start - Start external audio session")
    print("   POST /api/voice-call/matching/join - Join voice call queue")
    print("   GET  /api/voice-call/languages - Get supported languages")
    print("=" * 60)
    
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=True
    )

