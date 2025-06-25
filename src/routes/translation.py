"""
CultureBridge Backend Translation Routes
翻译相关的API路由
"""

from flask import Blueprint, request, jsonify, current_app
import asyncio
import base64

from src.services.auth import login_required, get_current_user
from src.services.translation import translation_service, TranslationError

# 创建蓝图
translation_bp = Blueprint('translation', __name__)

@translation_bp.route('/translate', methods=['POST'])
@login_required
def translate_text():
    """翻译文本"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['text', 'source_language', 'target_language']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'error': 'missing_field',
                    'message': f'Field {field} is required'
                }), 400
        
        text = data['text'].strip()
        source_lang = data['source_language']
        target_lang = data['target_language']
        method = data.get('method', 'auto')
        
        if not text:
            return jsonify({
                'error': 'empty_text',
                'message': 'Text cannot be empty'
            }), 400
        
        # 执行翻译
        result = asyncio.run(translation_service.translate_text(
            text=text,
            source_lang=source_lang,
            target_lang=target_lang,
            user_id=current_user.id,
            method=method
        ))
        
        return jsonify({
            'message': 'Translation completed successfully',
            'result': result
        }), 200
        
    except TranslationError as e:
        return jsonify({
            'error': 'translation_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Translation error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Translation failed due to internal error'
        }), 500

@translation_bp.route('/batch-translate', methods=['POST'])
@login_required
def batch_translate():
    """批量翻译"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # 验证必需字段
        required_fields = ['texts', 'source_language', 'target_language']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'error': 'missing_field',
                    'message': f'Field {field} is required'
                }), 400
        
        texts = data['texts']
        source_lang = data['source_language']
        target_lang = data['target_language']
        
        if not isinstance(texts, list) or not texts:
            return jsonify({
                'error': 'invalid_texts',
                'message': 'Texts must be a non-empty list'
            }), 400
        
        # 限制批量翻译数量
        if len(texts) > 100:
            return jsonify({
                'error': 'too_many_texts',
                'message': 'Maximum 100 texts allowed per batch'
            }), 400
        
        # 执行批量翻译
        results = asyncio.run(translation_service.translate_batch(
            texts=texts,
            source_lang=source_lang,
            target_lang=target_lang,
            user_id=current_user.id
        ))
        
        return jsonify({
            'message': 'Batch translation completed',
            'results': results,
            'total': len(results),
            'successful': len([r for r in results if r.get('success', False)]),
            'failed': len([r for r in results if not r.get('success', False)])
        }), 200
        
    except TranslationError as e:
        return jsonify({
            'error': 'translation_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Batch translation error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Batch translation failed due to internal error'
        }), 500

@translation_bp.route('/detect-language', methods=['POST'])
@login_required
def detect_language():
    """检测语言"""
    
    try:
        data = request.get_json()
        
        if not data.get('text'):
            return jsonify({
                'error': 'missing_text',
                'message': 'Text is required'
            }), 400
        
        text = data['text'].strip()
        
        if not text:
            return jsonify({
                'error': 'empty_text',
                'message': 'Text cannot be empty'
            }), 400
        
        # 检测语言
        result = asyncio.run(translation_service.detect_language(text))
        
        return jsonify({
            'message': 'Language detection completed',
            'result': result
        }), 200
        
    except TranslationError as e:
        return jsonify({
            'error': 'detection_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Language detection error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Language detection failed due to internal error'
        }), 500

@translation_bp.route('/speech-to-text', methods=['POST'])
@login_required
def speech_to_text():
    """语音转文字"""
    
    try:
        current_user = get_current_user()
        
        # 检查是否有文件上传
        if 'audio' not in request.files:
            return jsonify({
                'error': 'missing_audio',
                'message': 'Audio file is required'
            }), 400
        
        audio_file = request.files['audio']
        language = request.form.get('language', 'auto')
        
        if audio_file.filename == '':
            return jsonify({
                'error': 'no_file_selected',
                'message': 'No audio file selected'
            }), 400
        
        # 读取音频数据
        audio_data = audio_file.read()
        
        # 执行语音识别
        result = asyncio.run(translation_service.speech_to_text(
            audio_data=audio_data,
            language=language,
            user_id=current_user.id
        ))
        
        return jsonify({
            'message': 'Speech to text completed',
            'result': result
        }), 200
        
    except TranslationError as e:
        return jsonify({
            'error': 'speech_to_text_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Speech to text error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Speech to text failed due to internal error'
        }), 500

@translation_bp.route('/text-to-speech', methods=['POST'])
@login_required
def text_to_speech():
    """文字转语音"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('text') or not data.get('language'):
            return jsonify({
                'error': 'missing_data',
                'message': 'Text and language are required'
            }), 400
        
        text = data['text'].strip()
        language = data['language']
        voice = data.get('voice', 'default')
        
        if not text:
            return jsonify({
                'error': 'empty_text',
                'message': 'Text cannot be empty'
            }), 400
        
        # 执行文字转语音
        audio_data = asyncio.run(translation_service.text_to_speech(
            text=text,
            language=language,
            voice=voice,
            user_id=current_user.id
        ))
        
        # 将音频数据编码为base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        return jsonify({
            'message': 'Text to speech completed',
            'audio_data': audio_base64,
            'format': 'wav'
        }), 200
        
    except TranslationError as e:
        return jsonify({
            'error': 'text_to_speech_failed',
            'message': str(e)
        }), 400
    except Exception as e:
        current_app.logger.error(f'Text to speech error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Text to speech failed due to internal error'
        }), 500

@translation_bp.route('/languages', methods=['GET'])
def get_supported_languages():
    """获取支持的语言列表"""
    
    try:
        languages = asyncio.run(translation_service.get_supported_languages())
        
        return jsonify({
            'languages': languages,
            'total': len(languages)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get supported languages error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get supported languages'
        }), 500

@translation_bp.route('/history', methods=['GET'])
@login_required
def get_translation_history():
    """获取翻译历史"""
    
    try:
        current_user = get_current_user()
        
        # 获取查询参数
        limit = min(request.args.get('limit', 50, type=int), 100)
        offset = request.args.get('offset', 0, type=int)
        
        # 获取翻译历史
        history = asyncio.run(translation_service.get_translation_history(
            user_id=current_user.id,
            limit=limit,
            offset=offset
        ))
        
        return jsonify({
            'history': history,
            'limit': limit,
            'offset': offset,
            'total': len(history)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get translation history error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get translation history'
        }), 500

@translation_bp.route('/history/<translation_id>', methods=['DELETE'])
@login_required
def delete_translation_history(translation_id):
    """删除翻译历史记录"""
    
    try:
        current_user = get_current_user()
        
        from src.models import Translation
        
        translation = Translation.query.filter_by(
            id=translation_id,
            user_id=current_user.id
        ).first()
        
        if not translation:
            return jsonify({
                'error': 'translation_not_found',
                'message': 'Translation record not found'
            }), 404
        
        from src.models import db
        db.session.delete(translation)
        db.session.commit()
        
        return jsonify({
            'message': 'Translation record deleted successfully'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Delete translation history error: {str(e)}')
        from src.models import db
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to delete translation record'
        }), 500

@translation_bp.route('/history/<translation_id>/rate', methods=['POST'])
@login_required
def rate_translation(translation_id):
    """评价翻译质量"""
    
    try:
        current_user = get_current_user()
        data = request.get_json()
        
        if not data.get('rating'):
            return jsonify({
                'error': 'missing_rating',
                'message': 'Rating is required'
            }), 400
        
        rating = data['rating']
        feedback = data.get('feedback', '')
        
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({
                'error': 'invalid_rating',
                'message': 'Rating must be an integer between 1 and 5'
            }), 400
        
        from src.models import Translation, db
        
        translation = Translation.query.filter_by(
            id=translation_id,
            user_id=current_user.id
        ).first()
        
        if not translation:
            return jsonify({
                'error': 'translation_not_found',
                'message': 'Translation record not found'
            }), 404
        
        # 更新评分
        translation.user_rating = rating
        translation.user_feedback = feedback
        
        db.session.commit()
        
        return jsonify({
            'message': 'Translation rated successfully',
            'rating': rating,
            'feedback': feedback
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Rate translation error: {str(e)}')
        from src.models import db
        db.session.rollback()
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to rate translation'
        }), 500

@translation_bp.route('/stats', methods=['GET'])
@login_required
def get_translation_stats():
    """获取翻译统计"""
    
    try:
        current_user = get_current_user()
        
        from src.models import Translation, db
        from sqlalchemy import func
        
        # 基础统计
        total_translations = Translation.query.filter_by(user_id=current_user.id).count()
        
        # 按语言对统计
        language_pairs = db.session.query(
            Translation.source_language,
            Translation.target_language,
            func.count(Translation.id).label('count')
        ).filter_by(user_id=current_user.id).group_by(
            Translation.source_language,
            Translation.target_language
        ).all()
        
        # 按翻译方法统计
        methods = db.session.query(
            Translation.translation_method,
            func.count(Translation.id).label('count')
        ).filter_by(user_id=current_user.id).group_by(
            Translation.translation_method
        ).all()
        
        # 平均评分
        avg_rating = db.session.query(
            func.avg(Translation.user_rating)
        ).filter_by(user_id=current_user.id).scalar()
        
        stats = {
            'total_translations': total_translations,
            'language_pairs': [
                {
                    'source_language': pair[0],
                    'target_language': pair[1],
                    'count': pair[2]
                }
                for pair in language_pairs
            ],
            'methods': [
                {
                    'method': method[0],
                    'count': method[1]
                }
                for method in methods
            ],
            'average_rating': float(avg_rating) if avg_rating else None
        }
        
        return jsonify({
            'stats': stats
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Get translation stats error: {str(e)}')
        return jsonify({
            'error': 'internal_error',
            'message': 'Failed to get translation stats'
        }), 500

