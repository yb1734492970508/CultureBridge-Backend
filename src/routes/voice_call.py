from flask import Blueprint, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import uuid
import random
import requests
import time
from datetime import datetime

voice_call_bp = Blueprint('voice_call', __name__)

# 存储在线用户和匹配队列
online_users = {}
matching_queue = []
active_calls = {}

def get_user_country(ip_address):
    """根据IP地址获取用户所在国家"""
    try:
        # 使用免费的IP地理位置API
        response = requests.get(f'http://ip-api.com/json/{ip_address}')
        if response.status_code == 200:
            data = response.json()
            return data.get('country', 'Unknown'), data.get('countryCode', 'XX')
    except:
        pass
    return 'Unknown', 'XX'

def find_match_for_user(user_id, user_info):
    """为用户寻找匹配的通话对象"""
    user_country = user_info.get('country_code', 'XX')
    
    # 寻找不同国家的用户
    potential_matches = []
    for queued_user_id in matching_queue:
        if queued_user_id != user_id and queued_user_id in online_users:
            queued_user = online_users[queued_user_id]
            if queued_user.get('country_code', 'XX') != user_country:
                potential_matches.append(queued_user_id)
    
    # 如果没有不同国家的用户，则匹配任何可用用户
    if not potential_matches:
        potential_matches = [uid for uid in matching_queue if uid != user_id]
    
    if potential_matches:
        return random.choice(potential_matches)
    
    return None

@voice_call_bp.route('/api/voice-call/join', methods=['POST'])
def join_voice_call():
    """用户加入语音通话系统"""
    data = request.get_json()
    user_id = data.get('user_id', str(uuid.uuid4()))
    user_name = data.get('user_name', f'User_{user_id[:8]}')
    
    # 获取用户IP和地理位置
    user_ip = request.remote_addr
    country, country_code = get_user_country(user_ip)
    
    # 存储用户信息
    user_info = {
        'user_id': user_id,
        'user_name': user_name,
        'country': country,
        'country_code': country_code,
        'joined_at': datetime.now().isoformat(),
        'status': 'online'
    }
    
    online_users[user_id] = user_info
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'user_info': user_info,
        'message': f'欢迎来自{country}的{user_name}！'
    })

@voice_call_bp.route('/api/voice-call/find-match', methods=['POST'])
def find_match():
    """寻找语音通话匹配"""
    data = request.get_json()
    user_id = data.get('user_id')
    
    if user_id not in online_users:
        return jsonify({'success': False, 'message': '用户未找到'})
    
    user_info = online_users[user_id]
    
    # 将用户加入匹配队列
    if user_id not in matching_queue:
        matching_queue.append(user_id)
    
    # 寻找匹配
    matched_user_id = find_match_for_user(user_id, user_info)
    
    if matched_user_id:
        # 创建通话房间
        call_id = str(uuid.uuid4())
        call_info = {
            'call_id': call_id,
            'user1': user_id,
            'user2': matched_user_id,
            'user1_info': user_info,
            'user2_info': online_users[matched_user_id],
            'created_at': datetime.now().isoformat(),
            'status': 'connecting'
        }
        
        active_calls[call_id] = call_info
        
        # 从匹配队列中移除两个用户
        if user_id in matching_queue:
            matching_queue.remove(user_id)
        if matched_user_id in matching_queue:
            matching_queue.remove(matched_user_id)
        
        return jsonify({
            'success': True,
            'matched': True,
            'call_info': call_info,
            'partner_info': online_users[matched_user_id]
        })
    else:
        return jsonify({
            'success': True,
            'matched': False,
            'message': '正在寻找匹配用户...',
            'queue_position': matching_queue.index(user_id) + 1 if user_id in matching_queue else 0
        })

@voice_call_bp.route('/api/voice-call/end-call', methods=['POST'])
def end_call():
    """结束语音通话"""
    data = request.get_json()
    call_id = data.get('call_id')
    user_id = data.get('user_id')
    
    if call_id in active_calls:
        call_info = active_calls[call_id]
        call_info['status'] = 'ended'
        call_info['ended_at'] = datetime.now().isoformat()
        
        # 可以在这里记录通话统计信息
        del active_calls[call_id]
        
        return jsonify({
            'success': True,
            'message': '通话已结束'
        })
    
    return jsonify({'success': False, 'message': '通话未找到'})

@voice_call_bp.route('/api/voice-call/stats', methods=['GET'])
def get_stats():
    """获取语音通话统计信息"""
    return jsonify({
        'online_users': len(online_users),
        'users_in_queue': len(matching_queue),
        'active_calls': len(active_calls),
        'countries_online': len(set(user.get('country_code', 'XX') for user in online_users.values()))
    })

@voice_call_bp.route('/api/voice-call/countries', methods=['GET'])
def get_online_countries():
    """获取在线用户的国家分布"""
    countries = {}
    for user in online_users.values():
        country = user.get('country', 'Unknown')
        country_code = user.get('country_code', 'XX')
        if country_code not in countries:
            countries[country_code] = {
                'name': country,
                'code': country_code,
                'users': 0
            }
        countries[country_code]['users'] += 1
    
    return jsonify({
        'countries': list(countries.values()),
        'total_countries': len(countries)
    })

# WebSocket事件处理
def init_voice_call_socketio(socketio):
    """初始化语音通话的WebSocket事件"""
    
    @socketio.on('join_voice_room')
    def on_join_voice_room(data):
        """用户加入语音房间"""
        call_id = data.get('call_id')
        user_id = data.get('user_id')
        
        if call_id in active_calls:
            join_room(call_id)
            emit('user_joined_voice_room', {
                'user_id': user_id,
                'call_id': call_id
            }, room=call_id)
    
    @socketio.on('voice_offer')
    def on_voice_offer(data):
        """处理WebRTC offer"""
        call_id = data.get('call_id')
        offer = data.get('offer')
        sender_id = data.get('sender_id')
        
        emit('voice_offer', {
            'offer': offer,
            'sender_id': sender_id
        }, room=call_id, include_self=False)
    
    @socketio.on('voice_answer')
    def on_voice_answer(data):
        """处理WebRTC answer"""
        call_id = data.get('call_id')
        answer = data.get('answer')
        sender_id = data.get('sender_id')
        
        emit('voice_answer', {
            'answer': answer,
            'sender_id': sender_id
        }, room=call_id, include_self=False)
    
    @socketio.on('voice_ice_candidate')
    def on_voice_ice_candidate(data):
        """处理ICE候选"""
        call_id = data.get('call_id')
        candidate = data.get('candidate')
        sender_id = data.get('sender_id')
        
        emit('voice_ice_candidate', {
            'candidate': candidate,
            'sender_id': sender_id
        }, room=call_id, include_self=False)
    
    @socketio.on('leave_voice_room')
    def on_leave_voice_room(data):
        """用户离开语音房间"""
        call_id = data.get('call_id')
        user_id = data.get('user_id')
        
        leave_room(call_id)
        emit('user_left_voice_room', {
            'user_id': user_id,
            'call_id': call_id
        }, room=call_id)
        
        # 结束通话
        if call_id in active_calls:
            active_calls[call_id]['status'] = 'ended'
            active_calls[call_id]['ended_at'] = datetime.now().isoformat()
    
    @socketio.on('disconnect')
    def on_disconnect():
        """用户断开连接"""
        # 清理用户数据
        # 注意：这里需要根据session或其他方式识别用户
        pass

