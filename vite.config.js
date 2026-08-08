import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5500,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        aiCoach: 'pages/ai-coach.html',
        dashboard: 'pages/dashboard.html',
        analytics: 'pages/analytics.html'
      }
    }
  }
});
