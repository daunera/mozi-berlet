import React, { useState } from 'react';

interface Showtime {
    id: number;
    cinema_name: string;
    start_time: string; // ISO string
    ticket_url: string | null;
    details_type: string | null;
    age_restriction_url: string | null;
}

interface Movie {
    title: string;
    movie_url: string | null;
    poster_url: string | null;
    genre: string | null;
    age_restriction: string | null;
    age_restriction_url: string | null;
    showtimes: Showtime[];
    isFavorite: boolean;
}

interface MovieListRowProps {
    movie: Movie;
    onToggleFavorite: (title: string) => void;
}

const StarIcon = ({ filled, onClick }: { filled: boolean; onClick: () => void }) => (
    <button
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }}
        className="flex-shrink-0 focus:outline-none group/star"
        title={filled ? "Eltávolítás a kedvencekből" : "Hozzáadás a kedvencekhez"}
    >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-6 h-6 transition-all duration-200 ${filled
                ? "text-yellow-400 fill-yellow-400"
                : "text-muted-foreground group-hover/star:text-yellow-400"
                }`}
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    </button>
);

const AgeIcon = ({ url, age }: { url: string | null, age: string }) => {
    const [error, setError] = useState(false);

    if (error || !url) {
        return (
            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-800 bg-yellow-400 rounded-full border border-yellow-500 flex-shrink-0">
                {age}
            </span>
        );
    }

    return (
        <img
            src={url}
            alt={age}
            className="h-6 w-6 object-contain"
            onError={(e) => {
                console.log('Image load error for:', url);
                setError(true);
            }}
        />
    );
};

export default function MovieListRow({ movie, onToggleFavorite }: MovieListRowProps) {
    // Group showtimes by Cinema
    const showtimesByCinema = movie.showtimes.reduce((acc, st) => {
        if (!acc[st.cinema_name]) {
            acc[st.cinema_name] = [];
        }
        acc[st.cinema_name].push(st);
        return acc;
    }, {} as Record<string, Showtime[]>);

    const genres = movie.genre ? movie.genre.split(',').map(g => g.trim()) : [];

    return (
        <div className="flex flex-col md:flex-row glass-card rounded-lg p-4 gap-4 transition-colors relative">
            {/* Top/Left Section: Poster + Info (Side-by-side on mobile) */}
            <div className="flex flex-row gap-4 flex-grow min-w-0">
                {/* Poster */}
                <div className="flex-shrink-0">
                    <a href={movie.movie_url || '#'} target="_blank" rel="noreferrer" className="block relative group">
                        <div className="w-[100px] h-[150px] relative rounded-md overflow-hidden bg-muted transition-all duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary group-hover:ring-offset-2 group-hover:ring-offset-background">
                            {movie.poster_url ? (
                                <img
                                    src={movie.poster_url}
                                    alt={movie.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center p-1">
                                    Nincs kép
                                </div>
                            )}
                        </div>
                    </a>
                </div>

                {/* Info */}
                <div className="flex-grow flex flex-col justify-start min-w-0">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2 w-full">
                            <a href={movie.movie_url || '#'} target="_blank" rel="noreferrer" className="transition-colors duration-200 hover:text-primary flex-grow min-w-0 block">
                                <h3 className="text-lg font-bold leading-tight mb-1" title={movie.title}>
                                    {movie.title}
                                </h3>
                            </a>
                            <div className="md:absolute md:top-4 md:right-4 flex-shrink-0">
                                <StarIcon
                                    filled={movie.isFavorite}
                                    onClick={() => onToggleFavorite(movie.title)}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {movie.age_restriction && (
                                <AgeIcon
                                    url={movie.age_restriction_url}
                                    age={movie.age_restriction}
                                />
                            )}
                            <div className="flex flex-wrap gap-1.5">
                                {genres.map((genre, idx) => (
                                    <span key={idx} className="text-xs font-medium text-muted-foreground border border-border px-2 py-0.5 rounded-full whitespace-nowrap bg-muted/30">
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right/Bottom: Showtimes */}
            <div className="flex-shrink-0 md:w-1/2 flex flex-col gap-3 mt-2 md:mt-0">
                {Object.entries(showtimesByCinema).map(([cinemaName, times]) => (
                    <div key={cinemaName} className="flex flex-col sm:flex-row sm:items-baseline gap-2 border-b border-border/50 last:border-0 pb-2 last:pb-0">
                        <div className="text-sm font-medium text-muted-foreground min-w-[120px] shrink-0">
                            {cinemaName}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {times
                                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                .map(st => (
                                    <a
                                        key={st.id}
                                        href={st.ticket_url || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground text-base font-bold rounded hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                                        title={st.details_type || ''}
                                    >
                                        {new Date(st.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {st.details_type && (
                                            <span className="ml-1.5 text-[10px] font-normal opacity-80 uppercase tracking-wider border border-current px-1 rounded">
                                                {st.details_type}
                                            </span>
                                        )}
                                    </a>
                                ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
