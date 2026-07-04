import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        blogs: resolve(__dirname, 'blogs.html'),
        admin: resolve(__dirname, 'admin.html'),
        computation: resolve(__dirname, 'computation.html')
      }
    }
  }
});
