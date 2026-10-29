import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleGenerate, handleStatus } from './api/generate';

function apiPlugin(): Plugin {
  const attach = (middlewares: { use: (route: string, fn: (req: any, res: any) => void) => void }) => {
    middlewares.use('/api/generate', async (req, res) => {
      if (req.method === 'GET') {
        const response = handleStatus(process.env);
        res.statusCode = response.status;
        res.setHeader('content-type', 'application/json');
        res.end(await response.text());
        return;
      }
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers.set(k, v);
        }
        const request = new Request('http://localhost:3000/api/generate', {
          method: 'POST',
          headers,
          body,
        });
        const response = await handleGenerate(request, process.env);
        res.statusCode = response.status;
        res.setHeader('content-type', 'application/json');
        res.end(await response.text());
        return;
      }
      res.statusCode = 405;
      res.end();
    });
  };
  return {
    name: 'studymode-api',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { port: 3000, host: '0.0.0.0' },
});
