
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api, { getFavorites, addFavorite, removeFavorite, getStatus, triggerScrape } from '@/lib/api';
import { logout } from '@/app/actions/auth';
import DateTabs from '@/components/DateTabs';
import MovieListRow from '@/components/MovieListRow';
import { format } from 'date-fns';
import { useTranslation } from '@/components/I18nProvider';

// Icons removed as requested, using fallback or none

interface Showtime {
  id: number;
  cinema_name: string;
  movie_title: string;
  start_time: string;
  date_str: string;
  ticket_url: string | null;
  movie_url: string | null;
  poster_url: string | null;
  genre: string | null;
  age_restriction: string | null;
  age_restriction_url: string | null;
  details_type: string | null;
}

interface Favorite {
  movie_title: string;
}

export default function Home() {
  const { dict } = useTranslation();
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCinema, setSelectedCinema] = useState<string | null>(null);
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [showtimesRes, favoritesRes, statusRes] = await Promise.all([
          api.get<Showtime[]>('/movies'),
          getFavorites(),
          getStatus()
        ]);

        setShowtimes(showtimesRes.data);
        setFavorites(new Set(favoritesRes.map((f: Favorite) => f.movie_title)));
        setLastScraped(statusRes.last_scrape_time);

        // Select first available date by default
        if (showtimesRes.data.length > 0) {
          // Find earliest unique date
          const sorted = [...showtimesRes.data].sort((a, b) => new Date(a.date_str).getTime() - new Date(b.date_str).getTime());
          setSelectedDate(sorted[0].date_str);
        } else {
          setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggleFavorite = useCallback(async (movieTitle: string) => {
    const isFav = favorites.has(movieTitle);

    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(movieTitle);
      else next.add(movieTitle);
      return next;
    });

    try {
      if (isFav) {
        await removeFavorite(movieTitle);
      } else {
        await addFavorite(movieTitle);
      }
    } catch (error) {
      console.error("Failed to update favorite", error);
      // Revert on error
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(movieTitle);
        else next.delete(movieTitle);
        return next;
      });
    }
  }, [favorites]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await triggerScrape();
      // Wait a bit for background scrape to start, then poll or just wait
      // For simplicity, we'll just wait 5 seconds and refresh
      setTimeout(async () => {
        const [showtimesRes, statusRes] = await Promise.all([
          api.get<Showtime[]>('/movies'),
          getStatus()
        ]);
        setShowtimes(showtimesRes.data);
        setLastScraped(statusRes.last_scrape_time);
        setIsSyncing(false);
      }, 5000);
    } catch (error) {
      console.error("Sync failed", error);
      setIsSyncing(false);
    }
  };

  const handleLogoutClick = () => {
    setIsLogoutOpen(true);
  };

  const confirmLogout = async () => {
    await logout();
    window.location.reload();
  };

  // Process data for view
  const { dates, favoritesList, otherMovies, cinemas } = useMemo(() => {
    // Extract unique dates
    const uniqueDates = Array.from(new Set(showtimes.map(st => st.date_str))).sort();

    // Filter by selected date
    const showtimesForDate = showtimes.filter(st => st.date_str === selectedDate);

    // Extract unique cinemas for the selected date
    const uniqueCinemas = Array.from(new Set(showtimesForDate.map(st => st.cinema_name))).sort();

    // Filter by selected cinema
    const filteredShowtimes = selectedCinema
      ? showtimesForDate.filter(st => st.cinema_name === selectedCinema)
      : showtimesForDate;

    // Group by Movie
    const moviesMap = new Map();

    filteredShowtimes.forEach(st => {
      if (!moviesMap.has(st.movie_title)) {
        moviesMap.set(st.movie_title, {
          title: st.movie_title,
          poster_url: st.poster_url,
          movie_url: st.movie_url,
          genre: st.genre,
          age_restriction: st.age_restriction,
          age_restriction_url: st.age_restriction_url,
          showtimes: [],
          isFavorite: favorites.has(st.movie_title)
        });
      }
      // Add showtime
      const movie = moviesMap.get(st.movie_title);
      movie.showtimes.push({
        id: st.id,
        cinema_name: st.cinema_name,
        start_time: st.start_time,
        ticket_url: st.ticket_url,
        details_type: st.details_type
      });
    });

    // Sort alphabetical within groups
    const sortFn = (a: any, b: any) => a.title.localeCompare(b.title, 'hu');

    const favoriteMovies: any[] = [];
    const regularMovies: any[] = [];

    Array.from(moviesMap.values()).forEach(m => {
      if (m.isFavorite) favoriteMovies.push(m);
      else regularMovies.push(m);
    });

    return {
      dates: uniqueDates,
      favoritesList: favoriteMovies.sort(sortFn),
      otherMovies: regularMovies.sort(sortFn),
      cinemas: uniqueCinemas
    };
  }, [showtimes, selectedDate, favorites, selectedCinema]);


  return (
    <main className="min-h-screen pb-10 bg-background text-foreground">
      {/* Header */}
      <header className="glass shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / App Name */}
          <div className="flex items-center gap-4 mr-2 md:mr-8 flex-shrink-0">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
                {dict.metadata.title}
              </h1>
              {lastScraped && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium opacity-70">
                  {dict.common.updated} {format(new Date(lastScraped), 'yyyy-MM-dd HH:mm')}
                </span>
              )}
            </div>


          </div>

          <div className="flex-1 flex justify-end gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isSyncing
                ? "bg-primary/80 text-primary-foreground cursor-wait"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                }`}
              title={dict.common.refreshTooltip}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isSyncing ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>{dict.common.refresh}</span>
            </button>

            <button
              onClick={handleLogoutClick}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title={dict.common.logoutTooltip}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div>{dict.common.loading}</div>
          </div>
        ) : (favoritesList.length === 0 && otherMovies.length === 0) ? (
          <div className="text-center py-20 opacity-50">
            {dict.common.noData}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Date Tabs (moved to content) */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md mb-0 -mx-4 px-4 md:mx-0 md:px-0">
              <DateTabs
                dates={dates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                cinemas={cinemas}
                selectedCinema={selectedCinema}
                onSelectCinema={setSelectedCinema}
              />
            </div>

            {favoritesList.map((movie) => (
              <MovieListRow
                key={movie.title}
                movie={movie}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}

            {favoritesList.length > 0 && otherMovies.length > 0 && (
              <hr className="my-2 border-border" />
            )}

            {otherMovies.map((movie) => (
              <MovieListRow
                key={movie.title}
                movie={movie}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{dict.auth.logoutConfirmTitle}</h3>
            <p className="text-muted-foreground">
              {dict.auth.logoutConfirmMessage}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsLogoutOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                {dict.common.cancel}
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-md transition-colors"
              >
                {dict.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
