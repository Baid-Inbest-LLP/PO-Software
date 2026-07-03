import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;

const normalizeApiBaseUrl = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
};

// Dev: use Vite proxy (/api). Production: normalize env URL (append /api/v1 when missing).
// Production: set VITE_API_URL at build time (Render). Docker/nginx uses same-origin /api/v1.
const baseURL = isDev
  ? (envBaseUrl || '/api/v1')
  : (normalizeApiBaseUrl(envBaseUrl) || '/api/v1');

if (!baseURL) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_API_URL. Set it in frontend environment variables (example: https://your-backend.onrender.com/api/v1).'
  );
}

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const GET_CACHE_TTL_MS = 15000;
const getCache = new Map();

const stableStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return String(value);
};

const buildGetCacheKey = (url, params) => {
  const token = localStorage.getItem('token') || 'anonymous';
  return `${token}::${url}?${stableStringify(params || {})}`;
};

const clearGetCache = () => {
  getCache.clear();
};

const cachedGet = async (url, config = {}) => {
  const params = config?.params || {};
  const key = buildGetCacheKey(url, params);
  const hit = getCache.get(key);
  if (hit && Date.now() - hit.at < GET_CACHE_TTL_MS) {
    return hit.response;
  }
  const response = await api.get(url, config);
  getCache.set(key, { at: Date.now(), response });
  return response;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = String(config.method || 'get').toLowerCase();
  if (method !== 'get') {
    clearGetCache();
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isLoginRequest = requestUrl.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Companies
export const companiesAPI = {
  getAll: (params) => cachedGet('/companies', { params }),
  getOne: (id) => cachedGet(`/companies/${id}`),
  getStamp: (id) => api.get(`/companies/${id}/stamp`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  delete: (id) => api.delete(`/companies/${id}`),
  addLocation: (id, data) => api.post(`/companies/${id}/locations`, data),
  updateLocation: (id, locationId, data) => api.put(`/companies/${id}/locations/${locationId}`, data),
  deleteLocation: (id, locationId) => api.delete(`/companies/${id}/locations/${locationId}`),
};

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  createUser: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => cachedGet('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  // Keep user list uncached so edit/delete reflects immediately.
  getUsers: (options = {}) => api.get('/auth/users', {
    params: options?.fresh ? { _ts: Date.now() } : undefined,
    headers: options?.fresh ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined,
  }),
  getUserSignature: (id) => api.get(`/auth/users/${id}/signature`),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};

// Vendors
export const vendorsAPI = {
  // Keep vendor reads uncached so create/update/delete reflects immediately.
  getAll: (params) => api.get('/vendors', { params }),
  getOne: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

// Items
export const itemsAPI = {
  // Keep item reads uncached so create/update/delete reflects immediately.
  getAll: (params) => api.get('/items', { params }),
  getOne: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
  getCategories: () => api.get('/items/categories'),
};

// Purchase Orders
export const purchaseOrdersAPI = {
  // Keep PO reads uncached so status transitions reflect immediately in UI.
  getAll: (params, options = {}) => api.get('/purchase-orders', {
    params: options?.fresh ? { ...(params || {}), _ts: Date.now() } : params,
    headers: options?.fresh ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined,
  }),
  getOne: (id, options = {}) => api.get(`/purchase-orders/${id}`, {
    params: options?.fresh ? { _ts: Date.now() } : undefined,
    headers: options?.fresh ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined,
  }),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  updateStatus: (id, body) => api.patch(`/purchase-orders/${id}/status`, body),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  getDashboard: (params) => api.get('/purchase-orders/dashboard', { params }),
  downloadPDF: (id) =>
    api.get(`/purchase-orders/${id}/download/pdf`, {
      responseType: 'blob',
      timeout: 120000,
    }),
  downloadExcel: (id) =>
    api.get(`/purchase-orders/${id}/download/excel`, {
      responseType: 'blob',
      timeout: 120000,
    }),
};

// Settings
export const settingsAPI = {
  getCompany: () => cachedGet('/settings/company'),
  updateCompany: (data) => api.put('/settings/company', data),
};

export default api;
