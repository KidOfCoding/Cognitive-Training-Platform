import { defineConfig } from 'vite';
import dotenv from 'dotenv';
import dns from 'dns';
dotenv.config();

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

export default defineConfig({
  plugins: [
    {
      name: 'local-api-server',
      configureServer(server) {
        // Serve welcome.html as landing page for root requests
        server.middlewares.use((req, res, next) => {
          const host = req.headers.host || 'localhost:5173';
          const urlObj = new URL(req.url, `http://${host}`);
          if (urlObj.pathname === '/' || urlObj.pathname === '') {
            req.url = '/welcome.html' + urlObj.search;
          }
          next();
        });

        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith('/api/')) {
            return next();
          }

          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const routeName = urlObj.pathname.replace(/^\/api\//, '').replace(/\/$/, '');

          try {
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              await new Promise(resolve => req.on('end', resolve));
              try {
                req.body = JSON.parse(bodyStr);
              } catch {
                req.body = bodyStr;
              }
            }

            req.query = Object.fromEntries(urlObj.searchParams);

            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };

            const moduleMap = {
              'user': './api/user.js',
              'play': './api/play.js',
              'create-order': './api/create-order.js',
              'verify-payment': './api/verify-payment.js',
              'session': './api/session.js',
              'request-college': './api/request-college.js',
              'admin': './api/admin.js',
              'grievance': './api/grievance.js',
            };

            if (moduleMap[routeName]) {
              const handlerModule = await import(`${moduleMap[routeName]}?t=${Date.now()}`);
              const handler = handlerModule.default;
              await handler(req, res);
            } else {
              res.status(404).json({ error: 'API endpoint not found' });
            }
          } catch (err) {
            console.error('API Dev Middleware Error:', err);
            res.status(500).json({ error: err.message || 'Internal Server Error' });
          }
        });
      }
    }
  ]
});
