import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { handleHorizons } from './api/_lib/horizons-handler';

/**
 * Runs the same handler as the deployed serverless function (api/horizons.ts)
 * so `/api/horizons` behaves identically in `npm run dev` and in production.
 */
function horizonsDevApi(): Plugin {
  return {
    name: 'horizons-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/horizons', async (req, res) => {
        try {
          const request = new Request(`http://localhost${req.originalUrl ?? req.url}`);
          const response = await handleHorizons(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), horizonsDevApi()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
});
