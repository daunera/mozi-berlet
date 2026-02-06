
import os
import logging
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Header, Query, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel
from datetime import datetime

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from database import init_db, get_db, Showtime, Favorite, AppSettings
from scraper import scrape_all

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Mozi Berlet API",
    description="API for movie showtimes. Requires 'X-API-Key' header.",
    version="1.0.0",
    # This ensures the Authorize button is available for the defined security scheme
    swagger_ui_parameters={"defaultModelsExpandDepth": -1} 
)

# CORS configuration
# strictly speaking, if we only allow access from internal docker network (frontend), 
# CORS might not be strictly necessary for server-to-server, but good to keep for safety or dev.
origins = [
    "http://localhost:3000",
    "http://localhost",
    "*" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key Security
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

def get_api_key(api_key: str = Security(api_key_header)):
    env_api_key = os.getenv("API_KEY")
    if not env_api_key:
        # If API_KEY is not set on server, fail securely
        logger.error("API_KEY environment variable not set!")
        raise HTTPException(status_code=500, detail="Server configuration error")
        
    if api_key != env_api_key:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key

# Scheduler
scheduler = BackgroundScheduler()

@app.on_event("startup")
def on_startup():
    init_db()
    
    # Schedule scraping daily at 7:00 AM
    scheduler.add_job(scrape_all, 'cron', hour=7, minute=0)
    scheduler.start()
    logger.info("Scheduler started. Scraping job set for 7:00 AM daily.")

@app.on_event("shutdown")
def on_shutdown():
    scheduler.shutdown()

# Pydantic Models
class ShowtimeSchema(BaseModel):
    id: int
    cinema_name: str
    movie_title: str
    start_time: datetime
    date_str: str
    ticket_url: Optional[str]
    movie_url: Optional[str]
    poster_url: Optional[str]
    genre: Optional[str]
    age_restriction: Optional[str]
    details_type: Optional[str]
    age_restriction_url: Optional[str]

    class Config:
        from_attributes = True

class FavoriteSchema(BaseModel):
    movie_title: str
    created_at: datetime

    class Config:
        from_attributes = True

class FavoriteCreate(BaseModel):
    movie_title: str

class StatusSchema(BaseModel):
    last_scrape_time: Optional[datetime]

# Endpoints

@app.get("/api/movies", response_model=List[ShowtimeSchema], dependencies=[Depends(get_api_key)])
def get_movies(
    db: Session = Depends(get_db)
):
    """
    Get all showtimes from today onwards.
    """
    query = db.query(Showtime)
    
    # Showtimes from today onwards
    today = datetime.now().strftime("%Y-%m-%d")
    query = query.filter(Showtime.date_str >= today)
        
    return query.order_by(Showtime.start_time).all()

@app.post("/api/scrape", dependencies=[Depends(get_api_key)])
def trigger_scrape(
    background_tasks: BackgroundTasks
):
    """
    Trigger manual scrape. Protected by API Key.
    """
    background_tasks.add_task(scrape_all)
    return {"message": "Scraping triggered in background"}

@app.get("/api/status", response_model=StatusSchema, dependencies=[Depends(get_api_key)])
def get_status(db: Session = Depends(get_db)):
    last_scrape = db.query(AppSettings).filter(AppSettings.key == "last_scrape_time").first()
    return {
        "last_scrape_time": datetime.fromisoformat(last_scrape.value) if last_scrape else None
    }

@app.get("/api/favorites", response_model=List[FavoriteSchema], dependencies=[Depends(get_api_key)])
def get_favorites(db: Session = Depends(get_db)):
    return db.query(Favorite).all()

@app.post("/api/favorites", dependencies=[Depends(get_api_key)])
def add_favorite(fav: FavoriteCreate, db: Session = Depends(get_db)):
    existing = db.query(Favorite).filter(Favorite.movie_title == fav.movie_title).first()
    if existing:
        return existing
    
    new_fav = Favorite(movie_title=fav.movie_title)
    db.add(new_fav)
    db.commit()
    db.refresh(new_fav)
    return new_fav

@app.delete("/api/favorites/{movie_title}", dependencies=[Depends(get_api_key)])
def remove_favorite(movie_title: str, db: Session = Depends(get_db)):
    db.query(Favorite).filter(Favorite.movie_title == movie_title).delete()
    db.commit()
    return {"message": "Favorite removed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
