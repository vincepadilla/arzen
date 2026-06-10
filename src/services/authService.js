import { supabase } from '../config/supabase.js';

export const authService = {
  /**
   * Returns the currently logged in user from Supabase Session.
   */
  async getCurrentUser() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error.message);
      return null;
    }
    return session?.user || null;
  },

  /**
   * Logs a user in with Supabase
   */
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    return { data, error: error ? error.message : null };
  },

  /**
   * Logs the current user out
   */
  async logout() {
    const { error } = await supabase.auth.signOut();
    return { error: error ? error.message : null };
  }
};
