from mongoengine import Document, StringField, IntField, BooleanField

class Reward(Document):
    name = StringField(required=True)
    description = StringField()
    points_cost = IntField(required=True)
    image_url = StringField()
    category = StringField(choices=("digital", "physical", "experience", "discount"), required=True)
    stock = IntField()
    is_active = BooleanField(default=True)

    meta = {
        "collection": "rewards",
        "indexes": [
            "category",
            "points_cost"
        ]
    }

