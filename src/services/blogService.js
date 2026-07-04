import { supabase } from '../config/supabase.js';

export const blogService = {
  /**
   * Fetch only published blogs for the public site.
   */
  async getPublishedBlogs() {
    if (!supabase) return { data: [], error: 'Supabase not initialized' };
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });
    return { data, error: error ? error.message : null };
  },

  /**
   * Fetch all blogs (for admin dashboard).
   */
  async getAllBlogs() {
    if (!supabase) return { data: [], error: 'Supabase not initialized' };
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error: error ? error.message : null };
  },

  /**
   * Fetch a single blog by ID
   */
  async getBlogById(id) {
    if (!supabase) return { data: null, error: 'Supabase not initialized' };
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error: error ? error.message : null };
  },

  /**
   * Create a new blog
   */
  async createBlog(blogData) {
    if (!supabase) return { data: null, error: 'Supabase not initialized' };
    const { data, error } = await supabase
      .from('blogs')
      .insert([blogData])
      .select()
      .single();
    return { data, error: error ? error.message : null };
  },

  /**
   * Update an existing blog
   */
  async updateBlog(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not initialized' };
    const { data, error } = await supabase
      .from('blogs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error: error ? error.message : null };
  },

  /**
   * Delete a blog
   */
  async deleteBlog(id) {
    if (!supabase) return { error: 'Supabase not initialized' };
    const { error } = await supabase
      .from('blogs')
      .delete()
      .eq('id', id);
    return { error: error ? error.message : null };
  }
};
