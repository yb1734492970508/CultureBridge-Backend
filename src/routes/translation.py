from flask import Blueprint, request, jsonify
import requests
import json

translation_bp = Blueprint('translation', __name__)

# 模拟翻译服务（实际项目中应该集成Google Translate API或其他翻译服务）
SUPPORTED_LANGUAGES = {
    'zh': '中文',
    'en': 'English',
    'ja': '日本語',
    'ko': '한국어',
    'fr': 'Français',
    'de': 'Deutsch',
    'es': 'Español',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский',
    'ar': 'العربية',
    'hi': 'हिन्दी',
    'th': 'ไทย',
    'vi': 'Tiếng Việt',
    'id': 'Bahasa Indonesia'
}

@translation_bp.route('/languages', methods=['GET'])
def get_supported_languages():
    """获取支持的语言列表"""
    return jsonify({
        'success': True,
        'languages': SUPPORTED_LANGUAGES,
        'total': len(SUPPORTED_LANGUAGES)
    })

@translation_bp.route('/text', methods=['POST'])
def translate_text():
    """文本翻译"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en')
        
        if not text:
            return jsonify({
                'success': False,
                'error': 'Text is required'
            }), 400
        
        # 模拟翻译结果（实际项目中应该调用真实的翻译API）
        translated_text = f"[Translated from {source_lang} to {target_lang}] {text}"
        
        return jsonify({
            'success': True,
            'original_text': text,
            'translated_text': translated_text,
            'source_language': source_lang,
            'target_language': target_lang,
            'confidence': 0.95
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@translation_bp.route('/voice', methods=['POST'])
def translate_voice():
    """语音翻译"""
    try:
        # 这里应该处理音频文件上传和语音识别
        # 目前返回模拟数据
        return jsonify({
            'success': True,
            'original_text': '你好，世界！',
            'translated_text': 'Hello, World!',
            'source_language': 'zh',
            'target_language': 'en',
            'audio_url': '/api/translation/audio/sample.mp3'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@translation_bp.route('/history', methods=['GET'])
def get_translation_history():
    """获取翻译历史"""
    # 模拟翻译历史数据
    history = [
        {
            'id': 1,
            'original_text': '你好',
            'translated_text': 'Hello',
            'source_lang': 'zh',
            'target_lang': 'en',
            'timestamp': '2025-06-25T10:00:00Z'
        },
        {
            'id': 2,
            'original_text': 'Thank you',
            'translated_text': '谢谢',
            'source_lang': 'en',
            'target_lang': 'zh',
            'timestamp': '2025-06-25T09:30:00Z'
        }
    ]
    
    return jsonify({
        'success': True,
        'history': history,
        'total': len(history)
    })

