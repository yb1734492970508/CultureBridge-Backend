from mongoengine import Document, StringField, IntField, DateTimeField

class User(Document):
    email = StringField(required=True, unique=True)
    full_name = StringField()
    avatar_url = StringField()
    total_points = IntField(default=0)
    level = IntField(default=1)
    learning_streak = IntField(default=0)
    last_learning_date = DateTimeField()

    meta = {
        "collection": "users",
        "indexes": [
            "email",
            "total_points",
            "level"
        ]
    }

