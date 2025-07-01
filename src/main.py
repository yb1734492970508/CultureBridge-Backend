import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
import pymongo
from pymongo import MongoClient
import bcrypt
import json
from datetime import datetime

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'culturebridge-secret-key-2024'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# 启用CORS
CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])

# 初始化JWT
jwt = JWTManager(app)

# MongoDB配置
MONGODB_URI = 'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge'
client = MongoClient(MONGODB_URI)
db = client.culturebridge

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
            "mongodb_integration"
        ]
    })

# API信息端点
@app.route('/api/info', methods=['GET'])
def api_info():
    return jsonify({
        "name": "CultureBridge API",
        "version": "3.0.0",
        "description": "Cross-cultural communication platform",
        "endpoints": {
            "authentication": "/api/auth",
            "users": "/api/users",
            "chat": "/api/chat",
            "learning": "/api/learning",
            "culture": "/api/culture",
            "translation": "/api/translation"
        }
    })

# 用户注册
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({"error": "Missing required fields"}), 400
        
        # 检查用户是否已存在
        existing_user = db.users.find_one({"$or": [{"username": username}, {"email": email}]})
        if existing_user:
            return jsonify({"error": "User already exists"}), 409
        
        # 加密密码
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # 创建用户
        user_data = {
            "username": username,
            "email": email,
            "password": hashed_password,
            "points": 230,  # 初始积分
            "level": 1,
            "created_at": datetime.utcnow(),
            "profile": {
                "avatar": "",
                "bio": "",
                "languages": [],
                "interests": []
            }
        }
        
        result = db.users.insert_one(user_data)
        
        # 创建访问令牌
        access_token = create_access_token(identity=str(result.inserted_id))
        
        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "access_token": access_token,
            "user": {
                "id": str(result.inserted_id),
                "username": username,
                "email": email,
                "points": 230,
                "level": 1
            }
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 用户登录
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Missing username or password"}), 400
        
        # 查找用户
        user = db.users.find_one({"$or": [{"username": username}, {"email": username}]})
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401
        
        # 验证密码
        if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return jsonify({"error": "Invalid credentials"}), 401
        
        # 创建访问令牌
        access_token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": str(user['_id']),
                "username": user['username'],
                "email": user['email'],
                "points": user.get('points', 0),
                "level": user.get('level', 1)
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 获取用户信息
@app.route('/api/users/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": pymongo.ObjectId(user_id)})
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "success": True,
            "user": {
                "id": str(user['_id']),
                "username": user['username'],
                "email": user['email'],
                "points": user.get('points', 0),
                "level": user.get('level', 1),
                "profile": user.get('profile', {})
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 文化内容API
@app.route('/api/culture/content', methods=['GET'])
def get_culture_content():
    try:
        # 模拟文化内容数据
        content = [
            {
                "id": "1",
                "title": "中国春节传统",
                "description": "了解中国春节的传统习俗和文化意义",
                "category": "节日文化",
                "country": "中国",
                "image": "/images/spring-festival.jpg",
                "points": 50
            },
            {
                "id": "2", 
                "title": "日本茶道文化",
                "description": "探索日本茶道的精神内涵和仪式流程",
                "category": "传统艺术",
                "country": "日本",
                "image": "/images/tea-ceremony.jpg",
                "points": 40
            },
            {
                "id": "3",
                "title": "美国感恩节",
                "description": "了解美国感恩节的历史起源和庆祝方式",
                "category": "节日文化",
                "country": "美国",
                "image": "/images/thanksgiving.jpg",
                "points": 45
            }
        ]
        
        return jsonify({
            "success": True,
            "content": content
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 翻译API
@app.route('/api/translation/translate', methods=['POST'])
def translate_text():
    try:
        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en')
        
        # 模拟翻译结果
        translations = {
            "你好": "Hello",
            "谢谢": "Thank you",
            "再见": "Goodbye",
            "Hello": "你好",
            "Thank you": "谢谢",
            "Goodbye": "再见"
        }
        
        translated_text = translations.get(text, f"[Translated: {text}]")
        
        return jsonify({
            "success": True,
            "original_text": text,
            "translated_text": translated_text,
            "source_language": source_lang,
            "target_language": target_lang
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 学习进度API
@app.route('/api/learning/progress', methods=['GET'])
@jwt_required()
def get_learning_progress():
    try:
        user_id = get_jwt_identity()
        
        # 模拟学习进度数据
        progress = {
            "total_lessons": 50,
            "completed_lessons": 12,
            "current_level": 2,
            "points_earned": 240,
            "achievements": [
                {"name": "First Steps", "description": "完成第一个课程", "earned": True},
                {"name": "Culture Explorer", "description": "探索5种不同文化", "earned": True},
                {"name": "Language Master", "description": "掌握基础词汇", "earned": False}
            ]
        }
        
        return jsonify({
            "success": True,
            "progress": progress
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 聊天室API
@app.route('/api/chat/rooms', methods=['GET'])
@jwt_required()
def get_chat_rooms():
    try:
        # 模拟聊天室数据
        rooms = [
            {
                "id": "1",
                "name": "中英文化交流",
                "description": "中文和英文使用者的文化交流空间",
                "members": 156,
                "language": "中文/English",
                "active": True
            },
            {
                "id": "2",
                "name": "日语学习角",
                "description": "日语学习者的交流和练习空间",
                "members": 89,
                "language": "日本語",
                "active": True
            },
            {
                "id": "3",
                "name": "Global Culture Hub",
                "description": "全球文化爱好者的聚集地",
                "members": 234,
                "language": "Multiple",
                "active": True
            }
        ]
        
        return jsonify({
            "success": True,
            "rooms": rooms
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            return "index.html not found", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

