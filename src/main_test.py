"""
CultureBridge Backend Test Version
简化版主应用文件，用于测试商业化功能
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

# 导入新的商业化服务
from services.subscription import subscription_bp
from services.ai_tutor import ai_tutor_bp
from services.points_reward import points_bp

def create_app():
    """创建Flask应用"""
    app = Flask(__name__)
    
    # 配置
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'culturebridge-secret-key-2024')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-string')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
    
    # 启用CORS
    CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])
    
    # 初始化JWT
    jwt = JWTManager(app)
    
    # 注册蓝图 - 商业化功能
    app.register_blueprint(subscription_bp)
    app.register_blueprint(ai_tutor_bp)
    app.register_blueprint(points_bp)
    
    # 健康检查端点
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "message": "CultureBridge Backend Test Version is running",
            "version": "2.0.0-test",
            "features": [
                "subscription_management",
                "ai_personal_tutor",
                "points_reward_system"
            ]
        })
    
    # API信息端点
    @app.route('/api/info', methods=['GET'])
    def api_info():
        return jsonify({
            "name": "CultureBridge API Test",
            "version": "2.0.0-test",
            "description": "Test version with premium features",
            "endpoints": {
                "subscription": "/api/subscription",
                "ai_tutor": "/api/ai-tutor",
                "points": "/api/points"
            },
            "premium_features": {
                "ai_personal_tutor": "AI-powered personalized language tutoring",
                "premium_circles": "Exclusive high-quality cultural exchange circles",
                "advanced_analytics": "Detailed learning progress and cultural competence assessment",
                "priority_support": "24/7 priority customer support",
                "unlimited_translation": "No limits on translation usage",
                "offline_content": "Download content for offline learning"
            }
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
    
    return app

if __name__ == '__main__':
    # 创建应用
    app = create_app()
    
    print("Starting CultureBridge Backend Test Server...")
    print("Premium features enabled:")
    print("  - AI Personal Tutor")
    print("  - Subscription Management")
    print("  - Points Reward System")
    
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=True
    )

