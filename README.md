# PO Software - Purchase Order Management System

A full-stack Purchase Order management system built with React + Redux Toolkit (client) and Node.js + Express + MongoDB (server).

## Features

- **Purchase Order Creation** — Generate POs with vendor info, line items, automatic cost calculation
- **Auto Cost Calculation** — Subtotal, tax, shipping, discount computed in real-time
- **PDF Export** — Download professionally formatted PDF for each PO
- **Excel Export** — Download spreadsheet version of each PO
- **Vendor Management** — CRUD for vendor profiles
- **Item Catalog** — Reusable product/service catalog for quick PO line item entry
- **Status Workflow** — Draft → Pending → Approved / Rejected → Completed / Cancelled
- **Dashboard** — Summary stats and recent activity
- **Authentication** — JWT-based login/register
- **Company Settings** — Company info embedded in generated POs

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Redux Toolkit, React Router v6, Tailwind CSS |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| PDF | Puppeteer / PDFKit |
| Excel | ExcelJS |
| Tooling | pnpm workspaces |
| Deployment | Vercel (client + server) or AWS |

---

## Project Structure

```
PO-Software/
├── client/              # React frontend (Vite)
├── server/              # Express API
├── pnpm-workspace.yaml
├── package.json         # Root scripts
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- MongoDB (local or Atlas)

### 1. Install dependencies

```bash
cd PO-Software
pnpm install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env   # optional for local dev (Vite proxy is default)
```

Edit `server/.env`:

```env
PORT=5003
MONGODB_URI=mongodb://localhost:27017/po-software
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5175
NODE_ENV=development
```

### 3. Run development servers

Both in parallel:

```bash
pnpm dev
```

Or separately:

```bash
pnpm dev:server   # API on port 5003
pnpm dev:client   # Vite on port 5175 (proxies /api → server)
```

Open http://localhost:5175 and register an account.

### 4. Production build

```bash
pnpm build        # builds client → client/dist
pnpm start        # runs server
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/change-password` | Change password |

### Purchase Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/purchase-orders` | List all POs |
| POST | `/api/purchase-orders` | Create PO |
| GET | `/api/purchase-orders/:id` | Get PO detail |
| PUT | `/api/purchase-orders/:id` | Update PO |
| DELETE | `/api/purchase-orders/:id` | Delete draft PO |
| PATCH | `/api/purchase-orders/:id/status` | Update status |
| GET | `/api/purchase-orders/:id/download/pdf` | Download PDF |
| GET | `/api/purchase-orders/:id/download/excel` | Download Excel |
| GET | `/api/purchase-orders/dashboard` | Dashboard stats |

### Vendors & Items
See `server/src/routes/` for full route definitions.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run client + server in parallel |
| `pnpm dev:client` | Vite dev server |
| `pnpm dev:server` | API with nodemon |
| `pnpm build` | Build client for production |
| `pnpm start` | Start production API |
| `pnpm seed:dummy` | Seed sample data |
| `pnpm migrate:to-admin` | Migrate data to admin user |
| `pnpm migrate:item-departments` | Migrate item departments |

---

## Deployment

### Render (recommended — same pattern as Mer-App)

1. **Push** this repo to GitHub (`main` branch) with `render.yaml` at the root.
2. In [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect `Baid-Inbest-LLP/PO-Software`.
3. On **po-server**, set `MONGODB_URI` (MongoDB Atlas connection string for `po-software` DB).
4. In **MongoDB Atlas** → Network Access → allow `0.0.0.0/0` (or Render egress IPs).
5. Deploy. Note the live URLs (e.g. `https://po-server.onrender.com`, `https://po-client.onrender.com`).
6. If your static site URL differs from `https://po-client.onrender.com`, update on **po-server**:
   - `FRONTEND_URL` = your static site URL (no trailing slash)
7. If you rename services in Render, update **po-client** env:
   - `VITE_API_BASE_URL` = `https://<your-api-host>/api`
8. Redeploy both services after env changes.

| Service | Type | Health check |
|---------|------|----------------|
| po-server | Node web | `/api/health` |
| po-client | Static site | SPA rewrite → `index.html` |

**Do not** use `corepack enable` in build commands — Render already provides pnpm.

**PDF generation** uses `@sparticuz/chromium` on Render (via `RENDER=true`).

### Vercel (legacy)

Deploy **two** Vercel projects from this monorepo:

| Project | Root directory | Build command |
|---------|----------------|---------------|
| API | `server` | (uses `server/vercel.json`) |
| UI | `client` | `pnpm build` |

Set `VITE_API_BASE_URL` on the client to your API URL. Set `FRONTEND_URL` on the server to your client URL.

### AWS (alternative)

- **Backend:** EC2 or ECS with `pnpm --filter server start`
- **Frontend:** Build `client/dist` and host on S3 + CloudFront
- **Database:** MongoDB Atlas

---

## License

Private / internal use.
