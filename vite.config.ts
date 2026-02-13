import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

function redditProxy(): Plugin {
  return {
    name: 'reddit-proxy',
    configureServer(server) {
      server.middlewares.use('/reddit-api', async (req: IncomingMessage, res: ServerResponse) => {
        const target = `https://old.reddit.com${req.url}`;
        console.log(`[proxy] → ${req.method} ${target}`);
        try {
          const upstream = await fetch(target, {
            headers: {
              'User-Agent': 'even-realities-g1/1.0 (AR glasses reddit reader; contact: fuutott)',
              'Accept': 'application/json',
            },
          });
          console.log(`[proxy] ← ${upstream.status} ${upstream.statusText} for ${req.url}`);
          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          const body = await upstream.arrayBuffer();
          res.end(Buffer.from(body));
        } catch (err: any) {
          console.error(`[proxy] ✖ ERROR for ${req.url}: ${err.message}`);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  // Use relative URLs so the packaged app can load assets correctly.
  base: './',
  plugins: [redditProxy()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // evenhub-cli pack appears to expect assets referenced from index.html
    // to live at the dist root (not dist/assets).
    assetsDir: '',
  },
});
