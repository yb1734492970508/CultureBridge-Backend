"""
CultureBridge Backend Main Application - Enhanced with Points System
增强版主应用文件，集成积分系统和MongoDB
"""

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

# 导入数据库配置
from src.database import init_database, close_database

# 导入路由
from src.routes.auth import auth_bp
from src.routes.blockchain import blockchain_bp
from src.routes.points import points_bp
from src.routes.chat import chat_bp
from src.routes.learning import learning_bp
from src.routes.community import community_bp
from src.routes.content import content_bp
from src.routes.realtime import realtime_bp

def create_app():
    """创建Flask应用"""
    app = Flask(__name__)
    
    # 配置
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'culturebridge-secret-key-2024')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-string')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
    
    # MongoDB配置
    app.config['MONGODB_URI'] = os.getenv(
        'MONGODB_URI', 
        'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge'
    )
    
    # Redis配置
    app.config['REDIS_URL'] = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    
    # AI服务配置
    app.config['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY', '')
    app.config['GOOGLE_TRANSLATE_API_KEY'] = os.getenv('GOOGLE_TRANSLATE_API_KEY', '')
    
    # 启用CORS
    CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])
    
    # 初始化JWT
    jwt = JWTManager(app)
    
    # 注册蓝图
    app.register_blueprint(auth_bp)
    app.register_blueprint(blockchain_bp, url_prefix='/api/blockchain')
    app.register_blueprint(points_bp)  # 积分系统路由
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(learning_bp, url_prefix='/api/learning')
    app.register_blueprint(community_bp, url_prefix='/api/community')
    app.register_blueprint(content_bp, url_prefix='/api/content')
    app.register_blueprint(realtime_bp, url_prefix='/api/realtime')
    
    # 健康检查端点
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "message": "CultureBridge Backend is running",
            "version": "3.0.0",
            "features": [
                "authentication",
                "points_system",
                "cultural_content",
                "real_time_translation",
                "community_features",
                "achievement_system",
                "mongodb_integration"
            ]
        })
    
    # API信息端点
    @app.route('/api/info', methods=['GET'])
    def api_info():
        return jsonify({
            "name": "CultureBridge API",
            "version": "3.0.0",
            "description": "Cross-cultural communication platform with points system",
            "endpoints": {
                "authentication": "/api/auth",
                "points": "/api/points",
                "blockchain": "/api/blockchain",
                "chat": "/api/chat",
                "learning": "/api/learning",
                "community": "/api/community",
                "content": "/api/content",
                "realtime": "/api/realtime"
            },
            "features": {
                "points_system": "Earn and spend points for cultural activities",
                "achievement_system": "Unlock achievements for cultural milestones",
                "cultural_content": "Share and discover cultural content",
                "real_time_translation": "Live translation for conversations",
                "community_interaction": "Connect with people from different cultures",
                "learning_progress": "Track your cultural learning journey"
            }
        })
    
    # 积分系统概览端点
    @app.route('/api/points/overview', methods=['GET'])
    def points_overview():
        return jsonify({
            "success": True,
            "data": {
                "system_info": {
                    "currency_name": "积分",
                    "currency_symbol": "积分",
                    "default_starting_points": 230
                },
                "earning_opportunities": {
                    "daily_login": 10,
                    "cultural_post": 50,
                    "language_practice": 20,
                    "community_interaction": 15,
                    "content_share": 25,
                    "achievement_unlock": 100
                },
                "spending_options": [
                    "Premium content access",
                    "Language tutoring sessions",
                    "Cultural event tickets",
                    "Exclusive community features",
                    "Custom avatar items"
                ],
                "achievement_categories": [
                    "Cultural Explorer",
                    "Language Master", 
                    "Community Builder",
                    "Tradition Keeper"
                ]
            }
        })
    
    # 中间件：请求日志
    @app.before_request
    def log_request():
        """记录请求日志"""
        if request.method != 'OPTIONS':
            app.logger.info(f"{request.method} {request.path} - {request.remote_addr}")
    
    # 错误处理
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "error": "endpoint_not_found",
            "message": "The requested endpoint does not exist"
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            "success": False,
            "error": "internal_server_error",
            "message": "An unexpected error occurred"
        }), 500
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "success": False,
            "error": "bad_request",
            "message": "Invalid request data"
        }), 400
    
    # JWT错误处理
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "success": False,
            "error": "token_expired",
            "message": "The JWT token has expired"
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            "success": False,
            "error": "invalid_token",
            "message": "The JWT token is invalid"
        }), 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            "success": False,
            "error": "authorization_required",
            "message": "JWT token is required"
        }), 401
    
    # 应用关闭时清理
    @app.teardown_appcontext
    def close_db(error):
        """关闭数据库连接"""
        if error:
            app.logger.error(f"Application error: {error}")
    
    return app

def init_services():
    """初始化服务"""
    print("Initializing CultureBridge services...")
    
    # 初始化数据库
    if init_database():
        print("✓ MongoDB database initialized")
    else:
        print("✗ Failed to initialize database")
        return False
    
    print("✓ Points system initialized")
    print("✓ Achievement system initialized")
    print("✓ Cultural content system initialized")
    print("✓ Chat system initialized")
    
    print("All services initialized successfully!")
    return True

if __name__ == '__main__':
    # 创建应用
    app = create_app()
    
    # 初始化服务
    if not init_services():
        print("Failed to initialize services. Exiting...")
        exit(1)
    
    # 运行应用
    print("Starting CultureBridge Backend Server...")
    print("Features enabled:")
    print("  - Points System (积分系统)")
    print("  - Achievement System")
    print("  - Cultural Content Sharing")
    print("  - Real-time Translation")
    print("  - Community Features")
    print("  - MongoDB Integration")
    
    try:
        app.run(
            host='0.0.0.0',
            port=int(os.getenv('PORT', 5000)),
            debug=os.getenv('FLASK_ENV') == 'development'
        )
    except KeyboardInterrupt:
        print("\nShutting down server...")
        close_database()
        print("Server stopped.")

