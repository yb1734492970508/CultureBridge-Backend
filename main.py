from flask import Flask, request, jsonify
from flask_cors import CORS
from mongoengine import connect, Document, StringField, IntField, BooleanField, DateTimeField, ListField
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MongoDB Atlas connection
MONGO_URI = os.environ.get("MONGODB_URI", "mongodb+srv://Culturebridge:<Yibin199058>@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge")
connect(host=MONGO_URI)

# Define MongoDB models
class User(Document):
    email = StringField(required=True, unique=True)
    full_name = StringField()
    avatar_url = StringField()
    total_points = IntField(default=0)
    level = IntField(default=1)
    learning_streak = IntField(default=0)
    last_learning_date = DateTimeField()
    meta = {"collection": "users"}

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
    meta = {"collection": "courses"}

class UserProgress(Document):
    user_email = StringField(required=True)
    course_id = StringField(required=True)
    status = StringField(choices=("not_started", "in_progress", "completed"), default="not_started")
    progress_percentage = IntField(min_value=0, max_value=100, default=0)
    points_earned = IntField(default=0)
    completion_date = DateTimeField()
    meta = {"collection": "user_progress", "indexes": [("user_email", "course_id")]}

class Reward(Document):
    name = StringField(required=True)
    description = StringField()
    points_cost = IntField(required=True)
    image_url = StringField()
    category = StringField(choices=("digital", "physical", "experience", "discount"), required=True)
    stock = IntField()
    is_active = BooleanField(default=True)
    meta = {"collection": "rewards"}

# Helper to serialize MongoEngine objects
def mongo_to_dict(obj):
    return {k: v for k, v in obj.to_mongo().items() if k != "_id"}

# Routes
@app.route("/api/users/me", methods=["GET"])
def get_current_user():
    # This is a mock. In a real app, user info would come from auth token.
    user = User.objects(email="test@example.com").first()
    if not user:
        user = User(email="test@example.com", full_name="测试用户", avatar_url="https://api.dicebear.com/7.x/initials/svg?seed=测试用户").save()
    return jsonify(mongo_to_dict(user))

@app.route("/api/users/<email>", methods=["PUT"])
def update_user_data(email):
    user = User.objects(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = request.get_json()
    user.update(**data)
    user.reload()
    return jsonify(mongo_to_dict(user))

@app.route("/api/courses", methods=["GET"])
def get_courses():
    courses = Course.objects()
    return jsonify([mongo_to_dict(c) for c in courses])

@app.route("/api/courses/<id>", methods=["GET"])
def get_course(id):
    course = Course.objects(id=id).first()
    if not course:
        return jsonify({"error": "Course not found"}), 404
    return jsonify(mongo_to_dict(course))

@app.route("/api/user-progress", methods=["GET"])
def get_user_progress():
    user_email = request.args.get("user_email")
    course_id = request.args.get("course_id")
    query = {}
    if user_email: query["user_email"] = user_email
    if course_id: query["course_id"] = course_id
    progress = UserProgress.objects(**query)
    return jsonify([mongo_to_dict(p) for p in progress])

@app.route("/api/user-progress", methods=["POST"])
def create_user_progress():
    data = request.get_json()
    progress = UserProgress(**data).save()
    return jsonify(mongo_to_dict(progress)), 201

@app.route("/api/user-progress/<id>", methods=["PUT"])
def update_user_progress(id):
    progress = UserProgress.objects(id=id).first()
    if not progress:
        return jsonify({"error": "User progress not found"}), 404
    data = request.get_json()
    progress.update(**data)
    progress.reload()
    return jsonify(mongo_to_dict(progress))

@app.route("/api/rewards", methods=["GET"])
def get_rewards():
    rewards = Reward.objects()
    return jsonify([mongo_to_dict(r) for r in rewards])

@app.route("/api/rewards/<id>", methods=["PUT"])
def update_reward(id):
    reward = Reward.objects(id=id).first()
    if not reward:
        return jsonify({"error": "Reward not found"}), 404
    data = request.get_json()
    reward.update(**data)
    reward.reload()
    return jsonify(mongo_to_dict(reward))

if __name__ == "__main__":
    # Example data initialization (run once)
    if Course.objects.count() == 0:
        Course(
            title="中国传统文化",
            description="深入了解中国的历史、哲学、艺术和风俗习惯。",
            image_url="https://images.unsplash.com/photo-1547989453-010379057888?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="china",
            difficulty="beginner",
            points_reward=100,
            duration_minutes=60,
            content="本课程将带您领略中国传统文化的博大精深，从儒家思想、道家哲学到诗词歌赋、书法绘画，再到传统节日和民间艺术，全面展现中华文明的独特魅力。您将学习到中国传统文化的形成与发展，理解其核心价值观，并欣赏到丰富多彩的文化遗产。",
            tags=["历史", "哲学", "艺术", "风俗"]
        ).save()
        Course(
            title="美国流行文化",
            description="探索美国电影、音乐、时尚和科技如何影响全球。",
            image_url="https://images.unsplash.com/photo-1516251193007-455270677a17?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="usa",
            difficulty="intermediate",
            points_reward=150,
            duration_minutes=90,
            content="本课程将深入剖析美国流行文化的方方面面，包括好莱坞电影的演变、摇滚乐和嘻哈音乐的兴起、时尚潮流的变迁以及硅谷科技的创新。您将了解到美国流行文化如何在全球范围内传播并产生深远影响，同时探讨其背后的社会、经济和政治因素。",
            tags=["电影", "音乐", "时尚", "科技"]
        ).save()
        Course(
            title="日本动漫与次文化",
            description="了解日本动漫、漫画、J-Pop和独特青年文化。",
            image_url="https://images.unsplash.com/photo-1503756234508-e32369269eb3?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="japan",
            difficulty="beginner",
            points_reward=120,
            duration_minutes=75,
            content="本课程将带您走进日本动漫的奇妙世界，从经典作品到最新潮流，深入探讨其艺术风格、叙事技巧和全球影响力。同时，您还将了解到日本独特的次文化，如Cosplay、偶像文化和电子游戏，以及它们如何塑造了日本年轻一代的生活方式和价值观。",
            tags=["动漫", "漫画", "J-Pop", "青年文化"]
        ).save()
        Course(
            title="法国艺术与美食",
            description="品味法国的绘画、雕塑、建筑和世界闻名的烹饪艺术。",
            image_url="https://images.unsplash.com/photo-1502602898664-343733af70e7?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="france",
            difficulty="advanced",
            points_reward=200,
            duration_minutes=120,
            content="本课程将带领您沉浸在法国的艺术与美食之中。您将探索法国绘画大师的杰作、哥特式教堂的宏伟建筑、卢浮宫的珍藏，并了解法国艺术史的演变。此外，课程还将介绍法国烹饪的精髓，从米其林星级餐厅到地方特色小吃，让您领略法式美食的独特魅力和文化内涵。",
            tags=["艺术", "美食", "绘画", "建筑"]
        ).save()
        Course(
            title="德国工业与哲学",
            description="解析德国的工业革命、古典哲学和现代科技创新。",
            image_url="https://images.unsplash.com/photo-1523784003020-81992013919e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="germany",
            difficulty="intermediate",
            points_reward=160,
            duration_minutes=100,
            content="本课程将带您回顾德国的工业发展历程，从蒸汽机时代到汽车工业的崛起，再到现代高科技制造。同时，您将深入学习康德、黑格尔等德国古典哲学家的思想，理解其对西方文明的深远影响。课程还将探讨德国在可再生能源、人工智能等领域的最新科技创新。",
            tags=["工业", "哲学", "科技", "历史"]
        ).save()
        Course(
            title="意大利文艺复兴",
            description="重温意大利文艺复兴时期的辉煌艺术、文学和科学成就。",
            image_url="https://images.unsplash.com/photo-1529253355930-dd3811186320?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="italy",
            difficulty="advanced",
            points_reward=180,
            duration_minutes=110,
            content="本课程将带您穿越时空，回到意大利文艺复兴的黄金时代。您将学习达芬奇、米开朗基罗、拉斐尔等艺术巨匠的生平与作品，了解《神曲》、《君主论》等文学经典，并探讨哥白尼、伽利略等科学家在天文学和物理学领域的突破。课程将全面展现文艺复兴对欧洲乃至世界文明的深远影响。",
            tags=["文艺复兴", "艺术", "文学", "科学"]
        ).save()
        Course(
            title="西班牙弗拉门戈与斗牛",
            description="体验西班牙独特的弗拉门戈舞蹈、音乐和传统斗牛文化。",
            image_url="https://images.unsplash.com/photo-1560928960-93716942004a?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="spain",
            difficulty="beginner",
            points_reward=90,
            duration_minutes=50,
            content="本课程将带您走进热情奔放的西班牙文化。您将学习弗拉门戈舞蹈的历史渊源、音乐特点和表演形式，感受其独特的艺术魅力。同时，课程还将介绍西班牙传统斗牛的起源、规则和文化象征意义，探讨其在西班牙社会中的地位和争议。",
            tags=["舞蹈", "音乐", "斗牛", "传统"]
        ).save()
        Course(
            title="韩国流行音乐与时尚",
            description="分析K-Pop、韩剧、韩国美妆和时尚潮流的全球影响力。",
            image_url="https://images.unsplash.com/photo-1580971033971-06769123013a?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="korea",
            difficulty="intermediate",
            points_reward=140,
            duration_minutes=80,
            content="本课程将深入探讨韩国流行文化在全球范围内的崛起。您将了解K-Pop音乐的制作流程、偶像团体的成功秘诀、韩剧的叙事特点和传播策略。同时，课程还将介绍韩国美妆和时尚产业的最新趋势，分析其如何影响全球年轻人的审美和消费习惯。",
            tags=["K-Pop", "韩剧", "美妆", "时尚"]
        ).save()
        Course(
            title="印度瑜伽与哲学",
            description="学习印度瑜伽的起源、体式、冥想和古老哲学思想。",
            image_url="https://images.unsplash.com/photo-1552196563-55cd13ea31ad?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="india",
            difficulty="beginner",
            points_reward=110,
            duration_minutes=65,
            content="本课程将带您探索印度瑜伽的古老智慧。您将学习瑜伽的起源和发展，掌握基本的瑜伽体式和呼吸法，体验冥想的益处。同时，课程还将介绍印度教和佛教的哲学思想，理解其对瑜伽实践和印度文化的影响。",
            tags=["瑜伽", "哲学", "冥想", "宗教"]
        ).save()
        Course(
            title="巴西桑巴与狂欢节",
            description="感受巴西桑巴舞的节奏、狂欢节的激情和多元文化。",
            image_url="https://images.unsplash.com/photo-1517457373958-b7bdd458ce93?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            country="brazil",
            difficulty="intermediate",
            points_reward=130,
            duration_minutes=70,
            content="本课程将带您体验巴西的活力与激情。您将学习桑巴舞的历史、舞步和音乐特点，感受其独特的魅力。同时，课程还将介绍巴西狂欢节的起源、传统和庆祝方式，了解其在巴西文化中的重要地位。此外，您还将探索巴西多元文化的融合与发展。",
            tags=["桑巴", "狂欢节", "舞蹈", "音乐"]
        ).save()

    if Reward.objects.count() == 0:
        Reward(
            name="文化探索者徽章",
            description="完成5门课程后获得的荣誉徽章，象征着您对世界文化的热爱。",
            points_cost=200,
            image_url="https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="digital",
            stock=-1,
            is_active=True
        ).save()
        Reward(
            name="全球文化地图",
            description="一张精美的全球文化地图，标记了世界各地的文化遗产和风俗。",
            points_cost=500,
            image_url="https://images.unsplash.com/photo-1593640408187-3a270fa2172f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="physical",
            stock=10,
            is_active=True
        ).save()
        Reward(
            name="文化交流线上沙龙入场券",
            description="参与每月一次的线上文化交流沙龙，与全球文化爱好者互动。",
            points_cost=300,
            image_url="https://images.unsplash.com/photo-1522204523234-8729aa6e993f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="experience",
            stock=50,
            is_active=True
        ).save()
        Reward(
            name="文化周边商品八折优惠券",
            description="在CultureBridge周边商城购买任意商品可享八折优惠。",
            points_cost=150,
            image_url="https://images.unsplash.com/photo-1563297007-0686b7015608?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="discount",
            stock=-1,
            is_active=True
        ).save()
        Reward(
            name="定制文化明信片",
            description="选择您喜欢的国家，定制一张专属的文化主题明信片。",
            points_cost=250,
            image_url="https://images.unsplash.com/photo-1587563020088-517176717647?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="physical",
            stock=20,
            is_active=True
        ).save()
        Reward(
            name="文化知识挑战赛资格",
            description="获得参与CultureBridge文化知识挑战赛的资格，赢取更多积分。",
            points_cost=100,
            image_url="https://images.unsplash.com/photo-1546410531-bb4695029a9a?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="digital",
            stock=-1,
            is_active=True
        ).save()
        Reward(
            name="文化主题电子书",
            description="一本关于世界各地文化习俗和历史的精选电子书。",
            points_cost=180,
            image_url="https://images.unsplash.com/photo-1507842217343-583fd0462b34?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="digital",
            stock=-1,
            is_active=True
        ).save()
        Reward(
            name="文化主题T恤",
            description="一件印有独特文化图案的T恤，展现您的文化品味。",
            points_cost=400,
            image_url="https://images.unsplash.com/photo-1576566588028-cdfd7ee8467d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="physical",
            stock=5,
            is_active=True
        ).save()
        Reward(
            name="文化纪录片观看券",
            description="免费观看一部精选的文化主题纪录片。",
            points_cost=80,
            image_url="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="digital",
            stock=-1,
            is_active=True
        ).save()
        Reward(
            name="文化美食体验券",
            description="在指定合作餐厅享受一次异国文化美食体验。",
            points_cost=600,
            image_url="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            category="experience",
            stock=3,
            is_active=True
        ).save()

    app.run(debug=True, host="0.0.0.0", port=5000)


