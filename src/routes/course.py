from flask import Blueprint, request, jsonify
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from ..models import Course
from ..database import SessionLocal

course_bp = Blueprint('course', __name__)

@course_bp.route('/courses', methods=['POST'])
def create_course():
    session = SessionLocal()
    try:
        data = request.get_json()
        new_course = Course(
            title=data['title'],
            description=data.get('description'),
            country=data['country'],
            difficulty=data.get('difficulty', 'beginner'),
            points_reward=data['points_reward'],
            image_url=data.get('image_url'),
            content=data['content'],
            duration_minutes=data.get('duration_minutes'),
            tags=data.get('tags', [])
        )
        session.add(new_course)
        session.commit()
        session.refresh(new_course)
        return jsonify(new_course.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        session.close()

@course_bp.route('/courses', methods=['GET'])
def get_courses():
    session = SessionLocal()
    try:
        courses = session.query(Course).all()
        return jsonify([course.to_dict() for course in courses]), 200
    finally:
        session.close()

@course_bp.route('/courses/<int:course_id>', methods=['GET'])
def get_course(course_id):
    session = SessionLocal()
    try:
        course = session.query(Course).filter(Course.id == course_id).first()
        if course:
            return jsonify(course.to_dict()), 200
        return jsonify({"message": "Course not found"}), 404
    finally:
        session.close()

@course_bp.route('/courses/<int:course_id>', methods=['PUT'])
def update_course(course_id):
    session = SessionLocal()
    try:
        course = session.query(Course).filter(Course.id == course_id).first()
        if not course:
            return jsonify({"message": "Course not found"}), 404

        data = request.get_json()
        for key, value in data.items():
            setattr(course, key, value)
        session.commit()
        session.refresh(course)
        return jsonify(course.to_dict()), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        session.close()

@course_bp.route('/courses/<int:course_id>', methods=['DELETE'])
def delete_course(course_id):
    session = SessionLocal()
    try:
        course = session.query(Course).filter(Course.id == course_id).first()
        if not course:
            return jsonify({"message": "Course not found"}), 404

        session.delete(course)
        session.commit()
        return jsonify({"message": "Course deleted"}), 204
    finally:
        session.close()

# Add to_dict method to Course model for JSON serialization
def course_to_dict(self):
    return {
        "id": self.id,
        "title": self.title,
        "description": self.description,
        "country": self.country.value if self.country else None, # Access enum value
        "difficulty": self.difficulty.value if self.difficulty else None, # Access enum value
        "points_reward": self.points_reward,
        "image_url": self.image_url,
        "content": self.content,
        "duration_minutes": self.duration_minutes,
        "tags": self.tags
    }

Course.to_dict = course_to_dict


