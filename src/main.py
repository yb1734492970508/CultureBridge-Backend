import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from src.models.user import db
from src.routes.user import user_bp
from src.routes.translation import translation_bp
from src.routes.community import community_bp
from src.routes.content import content_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'culturebridge_secret_key_2025'

# 启用CORS支持跨域请求
CORS(app, origins="*")

# 注册蓝图
app.register_blueprint(user_bp, url_prefix='/api/users')
app.register_blueprint(translation_bp, url_prefix='/api/translation')
app.register_blueprint(community_bp, url_prefix='/api/community')
app.register_blueprint(content_bp, url_prefix='/api/content')

# 数据库配置
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

# 健康检查端点
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'CultureBridge Backend',
        'version': '3.0.0',
        'features': [
            'AI Translation',
            'Cultural Community',
            'Content Sharing',
            'Points System'
        ]
    })

# API状态端点
@app.route('/api/status')
def api_status():
    return jsonify({
        'api_version': '3.0.0',
        'endpoints': {
            'users': '/api/users',
            'translation': '/api/translation',
            'community': '/api/community',
            'content': '/api/content'
        },
        'features': {
            'real_time_translation': True,
            'cultural_community': True,
            'content_sharing': True,
            'points_system': True,
            'ai_recommendations': True
        }
    })

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return jsonify({
                'message': 'CultureBridge API Server',
                'version': '3.0.0',
                'documentation': '/api/status'
            })

if __name__ == '__main__':
    print("🌍 CultureBridge Backend Server Starting...")
    print("🚀 Features: AI Translation, Cultural Community, Content Sharing")
    print("📡 Server running on http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)

