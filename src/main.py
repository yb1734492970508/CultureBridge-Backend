
import os
import sys
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
import pymongo
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt
import json
from datetime import datetime

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'culturebridge-secret-key-2024'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"])

jwt = JWTManager(app)

MONGODB_URI = 'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge'
client = MongoClient(MONGODB_URI)
db = client.culturebridge

# Health Check
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
            "mongodb_integration",
            "course_management"
        ]
    })

# API Info
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
            "translation": "/api/translation",
            "courses": "/api/courses"
        }
    })

# User Registration
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({"error": "Missing required fields"}), 400
        
        existing_user = db.users.find_one({"$or": [{"username": username}, {"email": email}]})
        if existing_user:
            return jsonify({"error": "User already exists"}), 409
        
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user_data = {
            "username": username,
            "email": email,
            "password": hashed_password,
            "points": 230,
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

# User Login
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Missing username or password"}), 400
        
        user = db.users.find_one({"$or": [{"username": username}, {"email": username}]})
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401
        
        if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return jsonify({"error": "Invalid credentials"}), 401
        
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

# Get User Profile
@app.route('/api/users/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        
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

# Course Management APIs
@app.route('/api/courses', methods=['POST'])
@jwt_required()
def create_course():
    try:
        data = request.get_json()
        required_fields = ["title", "country", "points_reward", "content"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required course fields"}), 400
        
        course_data = {
            "title": data['title'],
            "description": data.get('description', ''),
            "country": data['country'],
            "difficulty": data.get('difficulty', 'beginner'),
            "points_reward": data['points_reward'],
            "image_url": data.get('image_url', ''),
            "content": data['content'],
            "duration_minutes": data.get('duration_minutes'),
            "tags": data.get('tags', [])
        }
        
        result = db.courses.insert_one(course_data)
        course_data['_id'] = str(result.inserted_id)
        return jsonify({"success": True, "course": course_data}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courses', methods=['GET'])
def get_all_courses():
    try:
        courses = []
        for course in db.courses.find():
            course['_id'] = str(course['_id'])
            courses.append(course)
        return jsonify({"success": True, "courses": courses}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courses/<course_id>', methods=['GET'])
def get_course_by_id(course_id):
    try:
        course = db.courses.find_one({"_id": ObjectId(course_id)})
        if course:
            course['_id'] = str(course['_id'])
            return jsonify({"success": True, "course": course}), 200
        return jsonify({"error": "Course not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courses/<course_id>', methods=['PUT'])
@jwt_required()
def update_course(course_id):
    try:
        data = request.get_json()
        result = db.courses.update_one({"_id": ObjectId(course_id)}, {"$set": data})
        if result.matched_count:
            updated_course = db.courses.find_one({"_id": ObjectId(course_id)})
            updated_course['_id'] = str(updated_course['_id'])
            return jsonify({"success": True, "message": "Course updated", "course": updated_course}), 200
        return jsonify({"error": "Course not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courses/<course_id>', methods=['DELETE'])
@jwt_required()
def delete_course(course_id):
    try:
        result = db.courses.delete_one({"_id": ObjectId(course_id)})
        if result.deleted_count:
            return jsonify({"success": True, "message": "Course deleted"}), 200
        return jsonify({"error": "Course not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Cultural Content API (Existing - kept for reference, consider integrating with new Course model)
@app.route('/api/culture/content', methods=['GET'])
def get_culture_content():
    try:
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

# Translation API
@app.route('/api/translation/translate', methods=['POST'])
def translate_text():
    try:
        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en')
        
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

# Learning Progress API
@app.route('/api/learning/progress', methods=['GET'])
@jwt_required()
def get_learning_progress():
    try:
        user_id = get_jwt_identity()
        
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

# Chat Rooms API
@app.route('/api/chat/rooms', methods=['GET'])
@jwt_required()
def get_chat_rooms():
    try:
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



