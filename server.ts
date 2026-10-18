import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { setupRealtimeWebSocket, createCommunicationRouter } from './server/realtimeServer.js';
import { createAuthRouter } from './server/authRouter.js';
import { createStorageRouter } from './server/storageRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '20mb' }));

  // Mount Communication API, Auth API & Storage API
  app.use('/api/comm', createCommunicationRouter());
  app.use('/api/auth', createAuthRouter());
  app.use('/api/storage', createStorageRouter());

  const server = http.createServer(app);

  // Dedicated WebSocket server for Real-time Messaging and WebRTC Signaling on /api/ws
  const commWss = new WebSocketServer({ noServer: true });
  setupRealtimeWebSocket(commWss);

  server.on('upgrade', (request, socket, head) => {
    try {
      const forwardedHost =
        (request.headers['x-forwarded-host'] as string) ||
        request.headers.host ||
        'localhost';
      const url = new URL(request.url || '', `http://${forwardedHost}`);
      if (url.pathname === '/api/ws') {
        commWss.handleUpgrade(request, socket, head, (ws) => {
          commWss.emit('connection', ws, request);
        });
      }
      // Non-/api/ws upgrades are handled by Vite's HMR server registered on the same HTTP server
    } catch (err) {
      console.error('[Server Upgrade] Error handling websocket upgrade:', err);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const isHostedPreview = Boolean(
      process.env.APPLET_ID ||
      process.env.K_SERVICE ||
      process.env.NG_ALLOWED_HOSTS
    );

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        cors: true,
        hmr: isHostedPreview
          ? false
          : {
              server,
            },
      },
      legacy: {
        skipWebSocketTokenCheck: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Everly server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
