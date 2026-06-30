# PO Software - Purchase Order Management System

A full-stack Purchase Order management system built with React + Redux Toolkit (frontend) and Node.js + Express + MongoDB (backend).

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
| PDF | PDFKit |
| Excel | ExcelJS |
| Deployment | AWS (EC2 / ECS + MongoDB Atlas) |

---

## Project Structure

```
PO-Software/
├── backend/
│   ├── src/
│   │   ├── config/       # MongoDB connection
│   │   ├── controllers/  # Route handlers
│   │   ├── models/       # Mongoose schemas
│   │   ├── routes/       # Express routers
│   │   ├── middleware/   # Auth, error handler
│   │   └── utils/        # PDF/Excel generators, helpers
│   ├── server.js
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/          # Redux store
│   │   ├── features/     # Redux slices (auth, vendors, items, POs)
│   │   ├── components/   # Layout, Navbar, Sidebar
│   │   ├── pages/        # All page components
│   │   ├── services/     # Axios API layer
│   │   └── utils/        # Helpers, formatters
│   └── vite.config.js
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/po-software
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Start Development Servers

**Backend** (runs on port 5000):
```bash
cd backend
npm run dev
```

**Frontend** (runs on port 5173, proxies /api → backend):
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 and register an account.

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

### Vendors
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/vendors` | List vendors |
| POST | `/api/vendors` | Create vendor |
| PUT | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |

### Items
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/items` | List items |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |

---

## AWS Deployment

### Backend (EC2 or ECS)
1. Use MongoDB Atlas as your database (update `MONGODB_URI`)
2. Build and deploy backend to EC2 or containerize with Docker for ECS
3. Use PM2 for process management on EC2: `pm2 start server.js`
4. Set environment variables via AWS Secrets Manager or EC2 user data

### Frontend (S3 + CloudFront)
1. Build: `cd frontend && npm run build`
2. Upload `dist/` to S3 bucket (static website hosting)
3. Create CloudFront distribution pointing to S3
4. Update `vite.config.js` proxy or use environment variable for API URL

### Recommended AWS Services
- **EC2** or **ECS (Fargate)** — Backend API
- **MongoDB Atlas** — Database (or Amazon DocumentDB)
- **S3 + CloudFront** — Frontend hosting
- **Route 53** — Custom domain
- **ACM** — SSL certificates
- **ALB** — Load balancer for backend
