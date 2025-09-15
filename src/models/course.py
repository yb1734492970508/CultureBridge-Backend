from sqlalchemy import Column, Integer, String, Text, Enum, ARRAY, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY

Base = declarative_base()

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text)
    country = Column(Enum("china", "usa", "japan", "france", "germany", "italy", "spain", "korea", "india", "brazil", name="country_enum"), nullable=False)
    difficulty = Column(Enum("beginner", "intermediate", "advanced", name="difficulty_enum"), default="beginner")
    points_reward = Column(Integer, nullable=False)
    image_url = Column(String)
    content = Column(Text, nullable=False)
    duration_minutes = Column(Integer)
    tags = Column(PG_ARRAY(String))


