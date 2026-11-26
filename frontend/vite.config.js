import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Saat development, permintaan /api diteruskan ke backend di port 3000
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
