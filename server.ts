import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { setupRealtimeWebSocket, createCommunicationRouter } from './server/realtimeServer.js';
import { createAuthRouter } from './server/authRouter.js';
import { createStorageRouter } from './server/storageRouter.js';
import { createMeetRouter } from './server/meetRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '20mb' }));

// Mount Communication API, Auth API, Storage API & Google Meet API
app.use('/api/comm', createCommunicationRouter());
app.use('/api/auth', createAuthRouter());
app.use('/api/storage', createStorageRouter());
app.use('/api/meet', createMeetRouter());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

export default app;

// If running locally or directly
if (process.env.NODE_ENV !== 'production' || process.argv[1] === fileURLToPath(import.meta.url)) {
  async function startServer() {
    const PORT = Number(process.env.PORT) || 3000;
    const server = http.createServer(app);

    const commWss = new WebSocketServer({ noServer: true });
    setupRealtimeWebSocket(commWss);

    server.on('upgrade', (request, socket, head) => {
      try {
        const forwardedHost =
          (request.headers['x-forwarded-host'] as string) ||
          request.headers.host ||
          'localhost';
        const url = new URL(request.url || '', `http://${forwardedHost}`);
        if (url.pathname === '/api/ws' || url.pathname === '/ws') {
          commWss.handleUpgrade(request, socket, head, (ws) => {
            commWss.emit('connection', ws, request);
          });
        }
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
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Everly server running on http://0.0.0.0:${PORT}`);
    });
  }

  startServer();
}
