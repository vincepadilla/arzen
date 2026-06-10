// Environment configuration for Supabase
// When using a real bundler (like Vite), these would be replaced by import.meta.env
// For this vanilla JS setup, we store them here.
// IMPORTANT: Do not commit the actual secrets to source control.

export const ENV = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
