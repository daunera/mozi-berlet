
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api, { getFavorites, addFavorite, removeFavorite, getStatus, triggerScrape } from '@/lib/api';
import DateTabs from '@/components/DateTabs';
import MovieListRow from '@/components/MovieListRow';
import { format } from 'date-fns';

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
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);


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

  // Process data for view
  const { dates, favoritesList, otherMovies } = useMemo(() => {
    // Extract unique dates
    const uniqueDates = Array.from(new Set(showtimes.map(st => st.date_str))).sort();

    // Filter by selected date
    const filteredShowtimes = showtimes.filter(st => st.date_str === selectedDate);

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
      otherMovies: regularMovies.sort(sortFn)
    };
  }, [showtimes, selectedDate, favorites]);


  return (
    <main className="min-h-screen pb-20 bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 glass shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / App Name */}
          <div className="flex items-center gap-4 mr-2 md:mr-8 flex-shrink-0">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
                {process.env.NEXT_PUBLIC_APP_NAME || 'Mi megy a moziba?'}
              </h1>
              {lastScraped && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium opacity-70">
                  Frissítve: {format(new Date(lastScraped), 'yyyy-MM-dd HH:mm')}
                </span>
              )}
            </div>

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`p-2 rounded-full transition-all duration-300 ${isSyncing
                ? "animate-spin text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              title="Műsor frissítése"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>

          {/* Date Tabs (integrated into header) */}
          <div className="flex-1 flex justify-end">
            <DateTabs
              dates={dates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div>Műsor betöltése...</div>
          </div>
        ) : (favoritesList.length === 0 && otherMovies.length === 0) ? (
          <div className="text-center py-20 opacity-50">
            Nincs elérhető műsor.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {favoritesList.map((movie) => (
              <MovieListRow
                key={movie.title}
                movie={movie}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}

            {favoritesList.length > 0 && otherMovies.length > 0 && (
              <hr className="my-6 border-border" />
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
    </main>
  );
}
