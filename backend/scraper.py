
import os
import logging
import re
import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from database import SessionLocal, Showtime, Favorite, AppSettings, get_db
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_cinema_urls():
    """Retrieve cinema URLs from environment variable."""
    urls = os.getenv("MOVIE_THEATER_URLS", "")
    return [url.strip() for url in urls.split(",") if url.strip()]

def get_skip_keywords():
    """Retrieve skip keywords from environment variable."""
    keywords = os.getenv("SKIP_MOVIE_KEYWORDS", "")
    return [k.strip().lower() for k in keywords.split(",") if k.strip()]

def clean_movie_title(title):
    """
    Clean movie title by removing specific phrases and normalizing whitespace.
    """
    phrases_to_remove = [
        "- Original language with Hungarian subtitles",
        "- With english subtitles",
        "(original language with Hungarian subtitles)"
    ]
    
    cleaned_title = title
    for phrase in phrases_to_remove:
        cleaned_title = cleaned_title.replace(phrase, "")
    
    # Replace double spaces and trim
    cleaned_title = re.sub(r'\s+', ' ', cleaned_title).strip()
    return cleaned_title

def get_details_type(type_text):
    """Normalize detail type (e.g. M -> Dubbed, F -> Subtitled)."""
    if not type_text:
        return 'szinkronizált'
    type_text = type_text.strip().upper()
    if type_text == 'M':
        return 'magyar nyelvű'
    if type_text == 'F':
        return 'feliratos'
    return 'szinkronizált'

HU_MONTHS = {
    "január": 1, "február": 2, "március": 3, "április": 4, "május": 5, "június": 6,
    "július": 7, "augusztus": 8, "szeptember": 9, "október": 10, "november": 11, "december": 12
}

def scrape_cinema_site(url_base):
    """
    Generic scraper for Webstyles-based cinema sites.
    Updated to target 'musorlista' tab specifically.
    """
    # Clean URL
    url = url_base.split('#')[0]
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract cinema name from title
        cinema_name = soup.title.string.strip()
        logger.info(f"Scraping {cinema_name} at {url}")

    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return []

    showtimes = []
    
    skip_keywords = get_skip_keywords()

    # 1. Find the 'musorlista' tab ID
    # <div class="swiper-slide" data-tab="8" data-date="musorlista">
    tabs_wrapper = soup.find(id="day-tabs-wrapper")
    if not tabs_wrapper:
        logger.warning(f"[{cinema_name}] Could not find #day-tabs-wrapper")
        return []

    target_tab_id = None
    for slide in tabs_wrapper.find_all("div", class_="swiper-slide"):
        if slide.get("data-date") == "musorlista":
            target_tab_id = slide.get("data-tab")
            break
            
    if not target_tab_id:
        logger.warning(f"[{cinema_name}] Could not find 'musorlista' tab")
        return []
    
    # 2. Extract content for the target tab
    container = soup.find("div", class_=f"tab-{target_tab_id}")
    if not container:
        logger.warning(f"[{cinema_name}] Could not find container for tab-{target_tab_id}")
        return []

    # 3. Iterate over days in the list
    # The structure:
    # <div class="day-wrapper">
    #    <div class="day"><span class="date">február 23.</span>...</div>
    #    <table class="movie-wrapper">...</table>
    # </div>
    
    for day_block in container.find_all("div", class_="day-wrapper"):
        # Parse Date
        date_div = day_block.find("div", class_="day")
        date_str_fmt = None
        if date_div:
            date_span = date_div.find("span", class_="date")
            if date_span:
                # "február 23." or "Ma" or "Holnap"
                d_text = date_span.text.strip().replace('.', '')
                
                if d_text.lower() == "ma":
                    now = datetime.now()
                    date_str_fmt = now.strftime("%Y-%m-%d")
                elif d_text.lower() == "holnap":
                    now = datetime.now()
                    tomorrow = now + timedelta(days=1)
                    date_str_fmt = tomorrow.strftime("%Y-%m-%d")
                else:
                    # Regular date: "február 23"
                    parts = d_text.split()
                    if len(parts) >= 2:
                        month_name = parts[0].lower()
                        day_num = int(parts[1])
                        month = HU_MONTHS.get(month_name, datetime.now().month)
                        
                        # Assume current year, handle year rollover if needed
                        now = datetime.now()
                        year = now.year
                        if month < now.month and (now.month - month) > 6:
                             year += 1
                        
                        date_str_fmt = f"{year}-{month:02d}-{day_num:02d}" 
        
        if not date_str_fmt:
            # Fallback or skip
            continue

        # Parse Movies Tables (Handle multiple wrappers in one day)
        movie_tables = day_block.find_all("table", class_="movie-wrapper")
        
        for movie_table in movie_tables:
            # Iterate rows (Outer TR contains poster and info/times table)
            for row in movie_table.find_all("tr"):
                # Ensure it's a movie row (has poster)
                if not row.find("td", class_="poster"):
                    continue

                try:
                    # Poster
                    poster_td = row.find("td", class_="poster")
                    poster_img = poster_td.find("img")
                    poster_url = poster_img.get("src") if poster_img else None
                    if poster_url and not poster_url.startswith("http"):
                         poster_url = f"{url.rstrip('/')}/{poster_url.lstrip('/')}"
                    
                    # Info & Times are in the sibling TD -> nested table -> tr -> td.info / td.times
                    # We can find them recursively in the 'row'
                    info_td = row.find("td", class_="info")
                    if not info_td:
                        continue

                    # Title
                    title_div = info_td.find("div", class_="title")
                    # Title might be text inside div or inside 'a' inside div
                    # Step 192: <div class="title">Halott ember...</div> wrapped in <a>
                    # Or <div class="title"><a ...>...</a></div>
                    # Let's handle both
                    movie_title = "Unknown"
                    movie_url = None
                    
                    if title_div:
                        raw_title = title_div.text.strip()
                        movie_title = clean_movie_title(raw_title)
                        # Check if wrapped in A or contains A
                        parent_a = title_div.find_parent("a")
                        child_a = title_div.find("a")
                        
                        link = parent_a or child_a
                        if link and link.has_attr("href"):
                            href = link["href"]
                            movie_url = f"{url.rstrip('/')}/{href.lstrip('/')}"
                    
                    # Filter by keywords
                    if any(k in movie_title.lower() for k in skip_keywords):
                        continue

                    # Meta
                    meta_div = info_td.find("div", class_="meta")
                    genres = []
                    age_restriction = None
                    
                    # Age Map (Copied)
                    AGE_MAP = {
                        "1": "KN", "2": "6", "3": "12", "4": "16", "5": "18", "6": "X",
                        "7": "?", "8": "KN", "9": "6", "10": "12", "11": "16", "12": "18", "13": "X"
                    }

                    if meta_div:
                        age_restriction_url = None
                        for genre_div in meta_div.find_all("div", class_="genre"):
                            genres.append(genre_div.text.strip())
                        
                        age_img = meta_div.find("img")
                        if age_img and "ages" in age_img.get("src", ""):
                            src = age_img["src"]
                            match = re.search(r'ages/(\d+)', src)
                            if match:
                                age_id = match.group(1)
                                age_restriction = AGE_MAP.get(age_id, age_id)
                                age_restriction_url = f"{url.rstrip('/')}/{src.lstrip('/')}"
                                if not src.startswith("http"):
                                    age_restriction_url = f"{url.rstrip('/')}/{src.lstrip('/')}"
                                else:
                                    age_restriction_url = src
                    
                    genre_str = ", ".join(genres) if genres else None

                    # Showtimes
                    times_td = row.find("td", class_="times")
                    if times_td:
                        for time_div in times_td.find_all("div", class_="movie-time"):
                            a_tag = time_div.find("a")
                            if not a_tag: continue
                            
                            ticket_url_suffix = a_tag.get("href")
                            ticket_url = f"{url.rstrip('/')}/{ticket_url_suffix.lstrip('/')}" if ticket_url_suffix else None
                            
                            time_span = a_tag.find("span", class_="time")
                            start_time_str = time_span.text.strip() if time_span else ""
                            
                            type_span = a_tag.find("span", class_="type")
                            details_type_code = type_span.text.strip() if type_span else None
                            details_type = get_details_type(details_type_code)

                            # Parse DateTime
                            full_start_time = None
                            try:
                                full_start_time = datetime.strptime(f"{date_str_fmt} {start_time_str}", "%Y-%m-%d %H:%M")
                            except ValueError:
                                logger.warning(f"Failed to parse time: {date_str_fmt} {start_time_str}")
                                continue

                            st = Showtime(
                                cinema_name=cinema_name,
                                movie_title=movie_title,
                                start_time=full_start_time,
                                date_str=date_str_fmt,
                                ticket_url=ticket_url,
                                movie_url=movie_url,
                                poster_url=poster_url,
                                genre=genre_str,
                                age_restriction=age_restriction,
                                details_type=details_type,
                                age_restriction_url=age_restriction_url
                            )
                            showtimes.append(st)

                except Exception as e:
                    logger.error(f"Error parsing movie row in musorlista: {e}")
                    continue

    return showtimes

def scrape_all():
    """
    Main scraping function:
    1. Scrape all configured URLs.
    2. Sync data with DB (Upsert).
    3. Prune old/missing showtimes.
    """
    db: Session = SessionLocal()
    try:
        urls = get_cinema_urls()
        all_showtimes = []

        for url in urls:
            logger.info(f"Processing URL: {url}")
            all_showtimes.extend(scrape_cinema_site(url))

        if not all_showtimes:
            logger.info("No showtimes found to sync.")
            return

        # --- Sync Logic (Upsert & Prune) ---
        
        # 1. Get IDs of showtimes found in this scrape
        # We need a way to identify uniqueness.
        # Combined key: cinema_name + movie_title + start_time
        # But we want to UPSERT (update extras if they changed, e.g. ticket_url).
        
        # Strategy:
        # Iterate all scraped showtimes.
        # Check if exists in DB (by cinema, title, start_time).
        # If exists -> Update attributes.
        # If not -> Insert.
        # Keep track of all processed/found DB IDs.
        # Finally, delete all DB rows for these cinemas that were NOT in the found list AND are in the future?
        # Or just prune everything for the dates we scraped?
        # "Delete any showtimes from the database that were *not* found in this scrape session"
        # This implies we should prune everything that is NOT in `all_showtimes`.
        # SAFEGUARD: Only prune for the DATES that we actually scraped?
        # Actually, the user requirement is "delete all data from db which is not fetched".
        # This is simple but aggressive. If a scrape fails partially, we might lose data.
        # But let's follow instructions: Sync the state.

        found_ids = []
        
        for st in all_showtimes:
            existing = db.query(Showtime).filter(
                Showtime.cinema_name == st.cinema_name,
                Showtime.movie_title == st.movie_title,
                Showtime.start_time == st.start_time
            ).first()

            if existing:
                # Update fields
                existing.ticket_url = st.ticket_url
                existing.movie_url = st.movie_url
                existing.genre = st.genre
                existing.age_restriction = st.age_restriction
                existing.details_type = st.details_type
                existing.age_restriction_url = st.age_restriction_url
                db.flush() # Get ID if needed, but existing.id is there
                found_ids.append(existing.id)
            else:
                db.add(st)
                db.flush() # Generating ID
                found_ids.append(st.id)
        
        db.commit()

        # 2. Prune
        # Delete showtimes NOT in found_ids
        # We should probably only prune for the related cinemas to avoid wiping other cinemas if we ever add more?
        # But specs say "Delete ... not found in this scrape session".
        # If we scrape ALL configured URLs, then `all_showtimes` represents the entire valid state.
        # So we can delete everything else.
        
        # Optimization: Delete where ID not in found_ids
        if found_ids:
             db.query(Showtime).filter(Showtime.id.notin_(found_ids)).delete(synchronize_session=False)
        else:
             # Scrape returned empty list? If so, should we wipe DB?
             # Probably safer to only wipe if we are sure scrape succeeded.
             # But function says "No showtimes found to sync" -> returns early.
             pass

        db.commit()
        
        # 3. Prune Favorites
        # Remove movies from favorites that are no longer in the theaters
        all_scraped_titles = set(st.movie_title for st in all_showtimes)
        if all_scraped_titles:
             db.query(Favorite).filter(Favorite.movie_title.notin_(all_scraped_titles)).delete(synchronize_session=False)
             db.commit()
        
        # 4. Update Last Scrape Time
        now_str = datetime.now().isoformat()
        last_scrape = db.query(AppSettings).filter(AppSettings.key == "last_scrape_time").first()
        if last_scrape:
            last_scrape.value = now_str
        else:
            db.add(AppSettings(key="last_scrape_time", value=now_str))
        db.commit()

        logger.info(f"Scraping completed. Synced {len(found_ids)} showtimes.")

    except Exception as e:
        db.rollback()
        logger.error(f"Scraping failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    scrape_all()
