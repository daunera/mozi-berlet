
import axios from 'axios';

const api = axios.create({
    baseURL: '/backend', // Requests go to Next.js middleware -> Backend
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getFavorites = async () => {
    const response = await api.get('/favorites');
    return response.data;
};

export const addFavorite = async (movieTitle: string) => {
    const response = await api.post('/favorites', { movie_title: movieTitle });
    return response.data;
};

export const removeFavorite = async (movieTitle: string) => {
    const response = await api.delete(`/favorites/${encodeURIComponent(movieTitle)}`);
    return response.data;
};

export const getStatus = async () => {
    const response = await api.get('/status');
    return response.data;
};

export const triggerScrape = async () => {
    const response = await api.post('/scrape');
    return response.data;
};

export default api;
