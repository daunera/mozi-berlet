from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# Docker volume path or local path
DB_URL = "sqlite:///data/movies.db"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Showtime(Base):
    __tablename__ = "showtimes"

    id = Column(Integer, primary_key=True, index=True)
    cinema_name = Column(String, index=True)
    movie_title = Column(String, index=True)
    start_time = Column(DateTime)
    date_str = Column(String)  # YYYY-MM-DD
    ticket_url = Column(String, nullable=True)
    movie_url = Column(String, nullable=True)
    poster_url = Column(String, nullable=True)
    genre = Column(String, nullable=True)
    age_restriction = Column(String, nullable=True)
    details_type = Column(String, nullable=True) # e.g. "sub", "synchronized"
    age_restriction_url = Column(String, nullable=True)

class Favorite(Base):
    __tablename__ = "favorites"

    movie_title = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AppSettings(Base):
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
