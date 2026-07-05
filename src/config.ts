export const STAGE_W = 2560;
export const STAGE_H = 1440;

export const LCD_W = 320;   // native LCD canvas pixels
export const LCD_H = 96;    // CSS upscales the canvas 4x -> 1280x384 on stage

export const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
export const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
export const SCOPE = 'user-read-currently-playing';
export const POLL_INTERVAL_MS = 5000;
