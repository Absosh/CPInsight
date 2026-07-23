import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        aiCoach: 'pages/ai-coach.html'
      }
    }
  }
});
