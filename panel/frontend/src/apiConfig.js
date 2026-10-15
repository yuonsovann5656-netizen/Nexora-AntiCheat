// Universal API base configuration
// In production (Render/Supabase) or when served by backend, relative URL '' routes to same domain.
// In local dev with Vite proxy, it defaults to '' or VITE_API_BASE.
export const API_BASE = import.meta.env.VITE_API_BASE || '';
