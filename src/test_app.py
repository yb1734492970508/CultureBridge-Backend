"""
CultureBridge Backend Test Application
测试应用
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

# 导入路由
from routes.realtime import realtime_bp
from routes.voice_call import voice_call_bp

def create_test_app():
    """创建测试Flask应用"""
    app = Flask(__name__)
    
    # 配置
    app.config['SECRET_KEY'] = 'test-secret-key'
    app.config['JWT_SECRET_KEY'] = 'test-jwt-secret'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    
    # 启用CORS
    CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])
    
    # 初始化JWT
    jwt = JWTManager(app)
    
    # 注册蓝图
    app.register_blueprint(realtime_bp)
    app.register_blueprint(voice_call_bp)
    
    # 健康检查端点
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "message": "CultureBridge Test Backend is running",
            "version": "2.0.0-test"
        })
    
    # 测试认证端点
    @app.route('/api/test/auth', methods=['POST'])
    def test_auth():
        from flask_jwt_extended import create_access_token
        
        # 创建测试用户token
        access_token = create_access_token(identity='test_user_123')
        
        return jsonify({
            'success': True,
            'access_token': access_token,
            'user_id': 'test_user_123'
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
    # 初始化数据库
    from database import init_database
    init_database()
    
    # 创建应用
    app = create_test_app()
    
    print("Starting CultureBridge Test Backend Server...")
    print("New features available:")
    print("  - Real-time Phone Audio Translation")
    print("  - Real-time External Audio Translation")
    print("  - Cross-border Voice Call Matching")
    
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=True
    )

