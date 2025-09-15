from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import os

# Pydantic model for MongoDB ObjectId
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema: dict):
        field_schema.update(type="string")

# P Base Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    total_points: int = 0
    level: int = 1
    learning_streak: int = 0
    last_learning_date: Optional[datetime] = None

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    hashed_password: str

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class CourseBase(BaseModel):
    title: str
    description: str
    content: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    difficulty: str
    category: str
    country: str
    duration_minutes: int
    points_reward: int
    tags: List[str] = []
    created_date: datetime = Field(default_factory=datetime.utcnow)

class CourseInDB(CourseBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class UserProgressBase(BaseModel):
    user_email: EmailStr
    course_id: str  # Store as string, convert to ObjectId when querying
    status: str = "not_started"  # e.g., not_started, in_progress, completed
    progress_percentage: int = 0
    points_earned: int = 0
    completion_date: Optional[datetime] = None

class UserProgressInDB(UserProgressBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class RewardBase(BaseModel):
    name: str
    description: str
    image_url: Optional[str] = None
    points_cost: int
    category: str # e.g., digital, physical, experience, discount
    stock: Optional[int] = None # For physical rewards
    is_active: bool = True
    created_date: datetime = Field(default_factory=datetime.utcnow)

class RewardInDB(RewardBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PostBase(BaseModel):
    user_email: EmailStr
    user_name: str
    user_avatar_url: Optional[str] = None
    content: str
    likes: int = 0
    comments: int = 0
    created_date: datetime = Field(default_factory=datetime.utcnow)

class PostInDB(PostBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# FastAPI App
app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# MongoDB Connection
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb+srv://Culturebridge:<Yibin199058>@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge")
client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.Culturebridge

# Collections
user_collection = database.get_collection("users")
course_collection = database.get_collection("courses")
user_progress_collection = database.get_collection("user_progress")
reward_collection = database.get_collection("rewards")
post_collection = database.get_collection("posts")

# Utility function to convert MongoDB document to Pydantic model
def document_to_model(document, model):
    if document:
        document["id"] = str(document["_id"])
        return model(**document)
    return None

# Routes
@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to CultureBridge Backend API"}

# User Endpoints
@app.post("/users/", response_model=UserInDB, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(user: UserCreate):
    # Hash password (implement proper hashing in a real app)
    user_dict = user.dict()
    user_dict["hashed_password"] = user.password + "_hashed" # Placeholder
    del user_dict["password"]
    
    new_user = await user_collection.insert_one(user_dict)
    created_user = await user_collection.find_one({"_id": new_user.inserted_id})
    return document_to_model(created_user, UserInDB)

@app.get("/users/{email}", response_model=UserInDB, tags=["Users"])
async def read_user(email: EmailStr):
    user = await user_collection.find_one({"email": email})
    if user:
        return document_to_model(user, UserInDB)
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/users/me/", response_model=UserInDB, tags=["Users"])
async def read_users_me():
    # This is a placeholder for actual authentication
    # In a real app, you'd get the current user from a token
    user = await user_collection.find_one({"email": "test@example.com"}) # Mock user
    if user:
        return document_to_model(user, UserInDB)
    raise HTTPException(status_code=404, detail="Mock user not found, please create one")

@app.put("/users/{email}", response_model=UserInDB, tags=["Users"])
async def update_user(email: EmailStr, user: UserBase):
    update_data = user.dict(exclude_unset=True)
    updated_user = await user_collection.update_one(
        {"email": email}, {"$set": update_data}
    )
    if updated_user.modified_count == 1:
        return await read_user(email)
    raise HTTPException(status_code=404, detail="User not found or no changes")

@app.delete("/users/{email}", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
async def delete_user(email: EmailStr):
    delete_result = await user_collection.delete_one({"email": email})
    if delete_result.deleted_count == 1:
        return
    raise HTTPException(status_code=404, detail="User not found")

# Course Endpoints
@app.post("/courses/", response_model=CourseInDB, status_code=status.HTTP_201_CREATED, tags=["Courses"])
async def create_course(course: CourseBase):
    new_course = await course_collection.insert_one(course.dict())
    created_course = await course_collection.find_one({"_id": new_course.inserted_id})
    return document_to_model(created_course, CourseInDB)

@app.get("/courses/", response_model=List[CourseInDB], tags=["Courses"])
async def list_courses(skip: int = 0, limit: int = 100):
    courses = await course_collection.find().skip(skip).limit(limit).to_list(1000)
    return [document_to_model(course, CourseInDB) for course in courses]

@app.get("/courses/{course_id}", response_model=CourseInDB, tags=["Courses"])
async def read_course(course_id: str):
    course = await course_collection.find_one({"_id": ObjectId(course_id)})
    if course:
        return document_to_model(course, CourseInDB)
    raise HTTPException(status_code=404, detail="Course not found")

# User Progress Endpoints
@app.post("/user-progress/", response_model=UserProgressInDB, status_code=status.HTTP_201_CREATED, tags=["User Progress"])
async def create_user_progress(progress: UserProgressBase):
    new_progress = await user_progress_collection.insert_one(progress.dict())
    created_progress = await user_progress_collection.find_one({"_id": new_progress.inserted_id})
    return document_to_model(created_progress, UserProgressInDB)

@app.get("/user-progress/", response_model=List[UserProgressInDB], tags=["User Progress"])
async def list_user_progress(user_email: Optional[EmailStr] = None, course_id: Optional[str] = None):
    query = {}
    if user_email: query["user_email"] = user_email
    if course_id: query["course_id"] = course_id
    
    progress_records = await user_progress_collection.find(query).to_list(1000)
    return [document_to_model(record, UserProgressInDB) for record in progress_records]

@app.put("/user-progress/{progress_id}", response_model=UserProgressInDB, tags=["User Progress"])
async def update_user_progress(progress_id: str, progress: UserProgressBase):
    update_data = progress.dict(exclude_unset=True)
    updated_progress = await user_progress_collection.update_one(
        {"_id": ObjectId(progress_id)}, {"$set": update_data}
    )
    if updated_progress.modified_count == 1:
        found_progress = await user_progress_collection.find_one({"_id": ObjectId(progress_id)})
        return document_to_model(found_progress, UserProgressInDB)
    raise HTTPException(status_code=404, detail="User progress not found or no changes")

# Reward Endpoints
@app.post("/rewards/", response_model=RewardInDB, status_code=status.HTTP_201_CREATED, tags=["Rewards"])
async def create_reward(reward: RewardBase):
    new_reward = await reward_collection.insert_one(reward.dict())
    created_reward = await reward_collection.find_one({"_id": new_reward.inserted_id})
    return document_to_model(created_reward, RewardInDB)

@app.get("/rewards/", response_model=List[RewardInDB], tags=["Rewards"])
async def list_rewards(skip: int = 0, limit: int = 100):
    rewards = await reward_collection.find().skip(skip).limit(limit).to_list(1000)
    return [document_to_model(reward, RewardInDB) for reward in rewards]

@app.get("/rewards/{reward_id}", response_model=RewardInDB, tags=["Rewards"])
async def read_reward(reward_id: str):
    reward = await reward_collection.find_one({"_id": ObjectId(reward_id)})
    if reward:
        return document_to_model(reward, RewardInDB)
    raise HTTPException(status_code=404, detail="Reward not found")

@app.put("/rewards/{reward_id}", response_model=RewardInDB, tags=["Rewards"])
async def update_reward(reward_id: str, reward: RewardBase):
    update_data = reward.dict(exclude_unset=True)
    updated_reward = await reward_collection.update_one(
        {"_id": ObjectId(reward_id)}, {"$set": update_data}
    )
    if updated_reward.modified_count == 1:
        found_reward = await reward_collection.find_one({"_id": ObjectId(reward_id)})
        return document_to_model(found_reward, RewardInDB)
    raise HTTPException(status_code=404, detail="Reward not found or no changes")

# Post Endpoints
@app.post("/posts/", response_model=PostInDB, status_code=status.HTTP_201_CREATED, tags=["Posts"])
async def create_post(post: PostBase):
    new_post = await post_collection.insert_one(post.dict())
    created_post = await post_collection.find_one({"_id": new_post.inserted_id})
    return document_to_model(created_post, PostInDB)

@app.get("/posts/", response_model=List[PostInDB], tags=["Posts"])
async def list_posts(skip: int = 0, limit: int = 100, sort_by: Optional[str] = None):
    cursor = post_collection.find().skip(skip).limit(limit)
    if sort_by:
        if sort_by.startswith("-"):
            cursor = cursor.sort(sort_by[1:], -1)
        else:
            cursor = cursor.sort(sort_by, 1)
    posts = await cursor.to_list(1000)
    return [document_to_model(post, PostInDB) for post in posts]

@app.get("/posts/{post_id}", response_model=PostInDB, tags=["Posts"])
async def read_post(post_id: str):
    post = await post_collection.find_one({"_id": ObjectId(post_id)})
    if post:
        return document_to_model(post, PostInDB)
    raise HTTPException(status_code=404, detail="Post not found")

@app.put("/posts/{post_id}", response_model=PostInDB, tags=["Posts"])
async def update_post(post_id: str, post: PostBase):
    update_data = post.dict(exclude_unset=True)
    updated_post = await post_collection.update_one(
        {"_id": ObjectId(post_id)}, {"$set": update_data}
    )
    if updated_post.modified_count == 1:
        found_post = await post_collection.find_one({"_id": ObjectId(post_id)})
        return document_to_model(found_post, PostInDB)
    raise HTTPException(status_code=404, detail="Post not found or no changes")


