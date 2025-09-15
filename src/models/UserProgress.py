from mongoengine import Document, StringField, IntField, DateTimeField, ReferenceField
from .User import User
from .Course import Course

class UserProgress(Document):
    user_email = StringField(required=True)
    course_id = StringField(required=True)
    status = StringField(choices=("not_started", "in_progress", "completed"), default="not_started")
    progress_percentage = IntField(min_value=0, max_value=100, default=0)
    points_earned = IntField(default=0)
    completion_date = DateTimeField()

    meta = {
        "collection": "user_progress",
        "indexes": [
            ("user_email", "course_id"),
            "status"
        ]
    }

