require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth');
const companyRoutes = require('./src/routes/companies');
const vendorRoutes = require('./src/routes/vendors');
const itemRoutes = require('./src/routes/items');
const purchaseOrderRoutes = require('./src/routes/purchaseOrders');
const settingsRoutes = require('./src/routes/settings');

const app = express();
const dbReady = connectDB();
const GET_RESPONSE_CACHE_TTL_MS = 30 * 1000;
const GET_RESPONSE_CACHE_MAX_ENTRIES = 500;
const getResponseCache = new Map();

const getCacheKey = (req) => {
  const authHeader = req.headers.authorization || 'anonymous';
  return `${req.originalUrl}::${authHeader}`;
};

const normalizeOrigin = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(',').map((x) => x.trim()).filter(Boolean),
  'http://localhost:5173',
]
  .filter(Boolean)
  .map(normalizeOrigin);

app.use(helmet());
app.use(compression());
const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  // Vercel preview/production frontends (*.vercel.app) when FRONTEND_URL is not updated yet.
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser/server-to-server requests.
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: [
      'Content-Disposition',
      'X-PO-Render-Version',
      'X-PO-Order-Status',
      'X-PO-Stamp-Lens',
      'X-PO-Logo-Lens',
      'X-PO-Doc-Cache',
      'X-PO-Doc-Key',
    ],
  })
);
app.use(morgan('dev'));
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (error) {
    next(error);
  }
});
app.use((req, res, next) => {
  const startNs = process.hrtime.bigint();
  const originalEnd = res.end;

  res.end = function patchedEnd(...args) {
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    if (!res.headersSent) {
      const duration = elapsedMs.toFixed(1);
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('Server-Timing', `app;dur=${duration}`);
    }
    return originalEnd.apply(this, args);
  };

  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const isLiveCrudListRoute =
    req.path.startsWith('/api/items') ||
    req.path.startsWith('/api/vendors') ||
    req.path.startsWith('/api/purchase-orders') ||
    req.path.startsWith('/api/auth/users');

  if (req.method === 'GET' && req.path.startsWith('/api') && !isLiveCrudListRoute) {
    // Short private browser cache for authenticated GET responses.
    // Helps repeated page loads in production without sharing user data.
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  }
  if (req.path === '/api/auth/me' || isLiveCrudListRoute) {
    res.setHeader('Cache-Control', 'no-store');
  }

  // Writes should invalidate read cache to avoid stale responses.
  if (req.method !== 'GET') {
    if (getResponseCache.size > 0) getResponseCache.clear();
    return next();
  }

  // Skip binary download endpoints from JSON cache.
  if (req.path.includes('/download/')) return next();
  // For live CRUD resources, always serve fresh reads.
  if (isLiveCrudListRoute) return next();

  const cacheKey = getCacheKey(req);
  const cached = getResponseCache.get(cacheKey);
  if (cached) {
    const isExpired = Date.now() - cached.createdAt > GET_RESPONSE_CACHE_TTL_MS;
    if (isExpired) {
      getResponseCache.delete(cacheKey);
    } else {
      res.setHeader('X-Cache', 'HIT');
      return res.status(cached.status).json(cached.body);
    }
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      if (getResponseCache.size >= GET_RESPONSE_CACHE_MAX_ENTRIES) {
        const oldestKey = getResponseCache.keys().next().value;
        if (oldestKey) getResponseCache.delete(oldestKey);
      }
      getResponseCache.set(cacheKey, {
        status: res.statusCode,
        body,
        createdAt: Date.now(),
      });
      res.setHeader('X-Cache', 'MISS');
    }
    return originalJson(body);
  };

  return next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PO Software API is running', deployedAt: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}

module.exports = app;
