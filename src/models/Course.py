from mongoengine import Document, StringField, IntField, ListField

class Course(Document):
    title = StringField(required=True)
    description = StringField()
    image_url = StringField()
    country = StringField(required=True)
    difficulty = StringField(choices=("beginner", "intermediate", "advanced"), default="beginner")
    points_reward = IntField(required=True)
    duration_minutes = IntField()
    content = StringField(required=True)
    tags = ListField(StringField())

    meta = {
        "collection": "courses",
        "indexes": [
            "$title",  # text index on title
            "country",
            "difficulty"
        ]
    }

