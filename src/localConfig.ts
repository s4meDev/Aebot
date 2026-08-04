const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;

const envApiKey = typeof env?.VITE_GEMINI_API_KEY === 'string' ? env.VITE_GEMINI_API_KEY.trim() : '';

// No hardcoded key — each user configures their own key via the extension settings.
export const GEMINI_API_KEY = envApiKey || '';
export const GEMINI_MODEL = 'gemini-2.5-flash';
