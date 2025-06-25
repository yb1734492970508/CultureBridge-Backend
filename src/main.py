"""
CultureBridge Backend Main Application
增强版主应用文件，整合所有服务和功能
"""

import os
import sys
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from flask_mail import Mail
from flask_socketio import SocketIO
import redis

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.config import get_config
from src.models import db, init_db
from src.services.auth import auth_service
from src.services.translation import translation_service
from src.services.blockchain import blockchain_service

# 导入路由蓝图
from src.routes.auth import auth_bp
from src.routes.user import user_bp
from src.routes.translation import translation_bp
from src.routes.community import community_bp
from src.routes.content import content_bp
from src.routes.blockchain import blockchain_bp
from src.routes.learning import learning_bp
from src.routes.chat import chat_bp

def create_app(config_name: str = None) -> Flask:
    """应用工厂函数"""
    
    # 获取配置
    config = get_config()
    
    # 验证配置
    if not config.validate():
        sys.exit(1)
    
    # 创建Flask应用
    app = Flask(__name__, 
                static_folder=os.path.join(os.path.dirname(__file__), 'static'),
                static_url_path='/static')
    
    # 应用配置
    app.config.update(config.get_flask_config())
    
    # 配置日志
    setup_logging(app, config)
    
    # 初始化扩展
    init_extensions(app, config)
    
    # 注册蓝图
    register_blueprints(app)
    
    # 注册错误处理器
    register_error_handlers(app)
    
    # 注册中间件
    register_middleware(app)
    
    # 创建数据库表
    with app.app_context():
        init_db()
    
    app.logger.info("CultureBridge Backend Application initialized successfully")
    
    return app

def setup_logging(app: Flask, config):
    """设置日志"""
    
    # 设置日志级别
    log_level = getattr(logging, config.logging.LOG_LEVEL.upper())
    app.logger.setLevel(log_level)
    
    # 创建格式化器
    formatter = logging.Formatter(config.logging.LOG_FORMAT)
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    app.logger.addHandler(console_handler)
    
    # 文件处理器（如果配置了日志文件）
    if config.logging.LOG_FILE:
        from logging.handlers import RotatingFileHandler
        file_handler = RotatingFileHandler(
            config.logging.LOG_FILE,
            maxBytes=config.logging.LOG_MAX_BYTES,
            backupCount=config.logging.LOG_BACKUP_COUNT
        )
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)

def init_extensions(app: Flask, config):
    """初始化Flask扩展"""
    
    # 数据库
    db.init_app(app)
    
    # CORS
    CORS(app, 
         origins=config.security.CORS_ORIGINS,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # 认证服务
    auth_service.init_app(app)
    
    # 速率限制
    limiter = Limiter(
        app,
        key_func=get_remote_address,
        storage_uri=config.security.RATELIMIT_STORAGE_URL,
        default_limits=["1000 per hour", "100 per minute"]
    )
    app.limiter = limiter
    
    # 缓存
    cache = Cache(app)
    app.cache = cache
    
    # 邮件
    if config.ENABLE_EMAIL_NOTIFICATIONS:
        mail = Mail(app)
        app.mail = mail
    
    # WebSocket
    if config.ENABLE_REAL_TIME_CHAT:
        socketio = SocketIO(
            app,
            cors_allowed_origins=config.security.CORS_ORIGINS,
            async_mode='eventlet'
        )
        app.socketio = socketio
        
        # 注册WebSocket事件
        register_socketio_events(socketio)

def register_blueprints(app: Flask):
    """注册蓝图"""
    
    # API版本前缀
    api_prefix = f'/api/{app.config.get("API_VERSION", "v1")}'
    
    # 认证路由
    app.register_blueprint(auth_bp, url_prefix=f'{api_prefix}/auth')
    
    # 用户路由
    app.register_blueprint(user_bp, url_prefix=f'{api_prefix}/users')
    
    # 翻译路由
    app.register_blueprint(translation_bp, url_prefix=f'{api_prefix}/translation')
    
    # 社区路由
    app.register_blueprint(community_bp, url_prefix=f'{api_prefix}/community')
    
    # 内容路由
    app.register_blueprint(content_bp, url_prefix=f'{api_prefix}/content')
    
    # 区块链路由
    if blockchain_service and blockchain_service.is_enabled():
        app.register_blueprint(blockchain_bp, url_prefix=f'{api_prefix}/blockchain')
    
    # 学习路由
    app.register_blueprint(learning_bp, url_prefix=f'{api_prefix}/learning')
    
    # 聊天路由
    app.register_blueprint(chat_bp, url_prefix=f'{api_prefix}/chat')

def register_error_handlers(app: Flask):
    """注册错误处理器"""
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            'error': 'bad_request',
            'message': 'Bad request',
            'status_code': 400
        }), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'error': 'unauthorized',
            'message': 'Authentication required',
            'status_code': 401
        }), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'error': 'forbidden',
            'message': 'Insufficient permissions',
            'status_code': 403
        }), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'not_found',
            'message': 'Resource not found',
            'status_code': 404
        }), 404
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return jsonify({
            'error': 'rate_limit_exceeded',
            'message': 'Rate limit exceeded',
            'status_code': 429,
            'retry_after': error.retry_after
        }), 429
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Internal server error: {str(error)}')
        return jsonify({
            'error': 'internal_server_error',
            'message': 'Internal server error',
            'status_code': 500
        }), 500

def register_middleware(app: Flask):
    """注册中间件"""
    
    @app.before_request
    def before_request():
        """请求前处理"""
        
        # 记录请求日志
        app.logger.info(f'{request.method} {request.path} - {request.remote_addr}')
        
        # 健康检查请求不需要处理
        if request.path in ['/health', '/api/status']:
            return
        
        # 静态文件请求不需要处理
        if request.path.startswith('/static/'):
            return
    
    @app.after_request
    def after_request(response):
        """请求后处理"""
        
        # 添加安全头
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # 记录响应日志
        app.logger.info(f'{request.method} {request.path} - {response.status_code}')
        
        return response

def register_socketio_events(socketio):
    """注册WebSocket事件"""
    
    @socketio.on('connect')
    def handle_connect():
        app.logger.info(f'Client connected: {request.sid}')
    
    @socketio.on('disconnect')
    def handle_disconnect():
        app.logger.info(f'Client disconnected: {request.sid}')
    
    @socketio.on('join_room')
    def handle_join_room(data):
        from flask_socketio import join_room
        room = data.get('room')
        if room:
            join_room(room)
            app.logger.info(f'Client {request.sid} joined room {room}')
    
    @socketio.on('leave_room')
    def handle_leave_room(data):
        from flask_socketio import leave_room
        room = data.get('room')
        if room:
            leave_room(room)
            app.logger.info(f'Client {request.sid} left room {room}')

# 创建应用实例
app = create_app()

# 根路由
@app.route('/')
def index():
    """根路径"""
    return jsonify({
        'message': 'CultureBridge API Server',
        'version': '4.0.0',
        'status': 'running',
        'timestamp': datetime.utcnow().isoformat(),
        'features': app.config.get('FEATURE_FLAGS', {}),
        'documentation': '/api/v1/docs'
    })

# 健康检查
@app.route('/health')
def health_check():
    """健康检查端点"""
    
    health_status = {
        'status': 'healthy',
        'service': 'CultureBridge Backend',
        'version': '4.0.0',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': {}
    }
    
    # 数据库检查
    try:
        db.session.execute('SELECT 1')
        health_status['checks']['database'] = 'healthy'
    except Exception as e:
        health_status['checks']['database'] = f'unhealthy: {str(e)}'
        health_status['status'] = 'unhealthy'
    
    # Redis检查（如果启用）
    try:
        if hasattr(app, 'cache') and app.cache.cache._write_client:
            app.cache.cache._write_client.ping()
            health_status['checks']['redis'] = 'healthy'
    except Exception as e:
        health_status['checks']['redis'] = f'unhealthy: {str(e)}'
    
    # 区块链检查（如果启用）
    if blockchain_service and blockchain_service.is_enabled():
        try:
            if blockchain_service.w3.is_connected():
                health_status['checks']['blockchain'] = 'healthy'
            else:
                health_status['checks']['blockchain'] = 'unhealthy: not connected'
        except Exception as e:
            health_status['checks']['blockchain'] = f'unhealthy: {str(e)}'
    
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return jsonify(health_status), status_code

# API状态端点
@app.route('/api/status')
@app.route('/api/v1/status')
def api_status():
    """API状态端点"""
    
    config = get_config()
    
    return jsonify({
        'api_version': '4.0.0',
        'api_title': config.API_TITLE,
        'api_description': config.API_DESCRIPTION,
        'endpoints': {
            'auth': '/api/v1/auth',
            'users': '/api/v1/users',
            'translation': '/api/v1/translation',
            'community': '/api/v1/community',
            'content': '/api/v1/content',
            'learning': '/api/v1/learning',
            'chat': '/api/v1/chat',
            'blockchain': '/api/v1/blockchain' if blockchain_service and blockchain_service.is_enabled() else None
        },
        'features': config.get_feature_flags(),
        'limits': {
            'max_file_size': app.config.get('MAX_CONTENT_LENGTH', 16777216),
            'rate_limits': {
                'default': '1000 per hour, 100 per minute'
            }
        },
        'supported_languages': [
            'en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'ar', 'ru', 'pt'
        ]
    })

# 静态文件服务
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    """服务静态文件"""
    
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return jsonify({
            'error': 'static_folder_not_configured',
            'message': 'Static folder not configured'
        }), 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            # 返回API信息而不是404
            return jsonify({
                'message': 'CultureBridge API Server',
                'version': '4.0.0',
                'documentation': '/api/v1/status',
                'available_endpoints': [
                    '/health',
                    '/api/v1/status',
                    '/api/v1/auth',
                    '/api/v1/users',
                    '/api/v1/translation',
                    '/api/v1/community',
                    '/api/v1/content',
                    '/api/v1/learning',
                    '/api/v1/chat'
                ]
            })

if __name__ == '__main__':
    config = get_config()
    
    print("🌍 CultureBridge Backend Server Starting...")
    print(f"🚀 Version: 4.0.0")
    print(f"🔧 Environment: {os.getenv('FLASK_ENV', 'development')}")
    print(f"🌐 Features: {', '.join([k for k, v in config.get_feature_flags().items() if v])}")
    print(f"📡 Server running on http://{config.HOST}:{config.PORT}")
    
    if config.ENABLE_REAL_TIME_CHAT and hasattr(app, 'socketio'):
        # 使用SocketIO运行
        app.socketio.run(
            app,
            host=config.HOST,
            port=config.PORT,
            debug=config.DEBUG
        )
    else:
        # 使用标准Flask运行
        app.run(
            host=config.HOST,
            port=config.PORT,
            debug=config.DEBUG
        )

