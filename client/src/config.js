// Falls back to the local backend so `npm run dev` works without a .env file.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
