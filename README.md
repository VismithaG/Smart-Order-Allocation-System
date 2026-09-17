# Smart Order Allocation System (SOAS)
**Software Engineer Intern Technical Assessment — DartCodes (Pvt) Ltd**

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-v19-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-blue.svg)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15+-blue.svg)](https://www.postgresql.org)
[![Python ML](https://img.shields.io/badge/scikit--learn-88.0%25%20CV-orange.svg)](https://scikit-learn.org)
[![Test Suite](https://img.shields.io/badge/Integration%20Tests-100%25%20Passing-brightgreen.svg)](https://github.com/VismithaG/Smart-Order-Allocation-System)

A full-stack, distributed order management and intelligent branch routing platform designed to automatically evaluate multi-branch inventories, geospatial distance, and kitchen workload levels in real time to dispatch customer orders to the optimal branch. Persisted in **PostgreSQL** with complete **Admin Supervisory CRUD** capabilities for products, customer accounts, and branch locations. Includes an AI/ML customer inquiry classification and automated triage engine trained on the provided assessment dataset.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Technologies Used](#technologies-used)
3. [System Architecture](#system-architecture)
4. [Smart Branch Allocation Logic](#smart-branch-allocation-logic)
5. [Authentication & Security Architecture](#authentication--security-architecture)
6. [AI / ML Challenge: Customer Inquiry Classifier](#ai--ml-challenge-customer-inquiry-classifier)
7. [REST API Documentation](#rest-api-documentation)
8. [Setup & Running Instructions](#setup--running-instructions)
9. [Automated Verification & Test Suite](#automated-verification--test-suite)
10. [Assumptions & Limitations](#assumptions--limitations)
11. [Candidate Notes & Interview Preparation](#candidate-notes--interview-preparation)

---

## Key Features

- **Multi-Factor Branch Allocation Engine**: Evaluates stock fulfillment, spherical great-circle (Haversine) distance, and active kitchen capacity with tie-breaking rules and partial-stock diagnostics.
- **PostgreSQL Persistence & ACID State Management**: Stock deductions, order routing, and branch workload adjustments execute atomically using PostgreSQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`).
- **Full Admin Supervisory Control**: Complete CRUD capabilities for Products (with LKR pricing), Branch Locations (coordinates & capacity), and Customer Accounts (order metrics & lifetime spend).
- **Automatic Inventory & Workload Rollback**: Cancelling an order immediately restores reserved stock back to the allocated branch in PostgreSQL and frees queue capacity.
- **AI / ML Customer Inquiry Classifier**: `TfidfVectorizer` + `LogisticRegression` pipeline achieving **88.03% 5-fold cross-validation accuracy** across 8 categories with confidence calibration and human escalation flags for scores under 60%.
- **Dual AI Integration**: Real-time note triage during customer order placement and an interactive Admin Triage Workbench with pre-loaded challenge dataset queries.
- **Multi-Step Customer Ordering Journey**: Progressive 3-stage checkout (`Product Selection` -> `Order Summary & Destination` -> `Simulated Payment Gateway`) with live AI note analysis and immediate algorithmic routing diagnostics.
- **Responsive Web Interface**: Modern UI with customer ordering flow, live order tracker, admin analytics dashboard, real-time branch capacity meters, live stock editor, product catalog manager, user directory manager, and manual branch reassignment overrides.

---

## Technologies Used

| Layer | Technologies | Rationale |
|---|---|---|
| **Backend** | Node.js (v22), Express, TypeScript | High-performance asynchronous REST API with strong type safety. |
| **Database** | PostgreSQL (v15 Alpine via Docker / `pg.Pool`) | Persistent relational database with connection pooling, foreign key cascading, JSONB payloads, and ACID transactions. |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` | Stateless cryptographically signed JWT auth with role-based claims (`customer`, `admin`) and salt-hashed passwords. |
| **Security** | `helmet`, `cors`, `express-rate-limit` | Defense-in-depth security headers, CORS origin restrictions, and brute-force protection. |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 | High-performance reactive UI with responsive layout, real-time feedback, and accessible styling. |
| **AI / ML** | Python 3.11, `scikit-learn`, `pandas`, `numpy` | Sublinear TF-IDF n-gram vectorization with balanced multinomial logistic regression, exported for sub-millisecond in-process inference. |

---

## System Architecture

```
[ Customer / Admin Browser ]
           │
           │ (REST / JSON + JWT Bearer)
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SOAS Backend (Express)                   │
│                                                             │
│   ┌────────────────────┐      ┌─────────────────────────┐   │
│   │ Security & Auth    │      │ Rate Limiting & Helmet  │   │
│   │ (JWT / bcrypt/RBAC)│      │ (DDoS / Brute-force)    │   │
│   └─────────┬──────────┘      └────────────┬────────────┘   │
│             │                              │                │
│   ┌─────────▼──────────────────────────────▼────────────┐   │
│   │               REST API Route Controllers            │   │
│   │  /auth  •  /products  •  /branches  •  /users  •    │   │
│   │  /orders •  /dashboard/stats  •  /ai/classify         │   │
│   └─────────┬──────────────────────────────┬────────────┘   │
│             │                              │                │
│   ┌─────────▼──────────────┐   ┌───────────▼────────────┐   │
│   │ Smart Allocation Engine│   │ AI Triage Classifier   │   │
│   │ (Stock / Haversine /   │   │ (TF-IDF + Softmax      │   │
│   │  Workload Scoring)     │   │  Model Weights JSON)   │   │
│   └─────────┬──────────────┘   └────────────────────────┘   │
│             │                                               │
│   ┌─────────▼───────────────────────────────────────────┐   │
│   │       PostgreSQL Relational Persistence Layer       │   │
│   │   (users, branches, products, branch_stocks,        │   │
│   │    orders, order_items — Docker & ACID Transactions)│   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Smart Branch Allocation Logic

The allocation engine solves the problem: **Which branch should fulfill a customer order to maximize fulfillment success, minimize delivery delay, and prevent kitchen bottlenecks?**

### 1. Mathematical Scoring Formulation
When an order $O = \{i_1, i_2, \dots, i_n\}$ is submitted from location $L_c = (\text{lat}_c, \text{lng}_c)$, every active branch $B$ is scored using a multi-criteria weighted formula:

$$\text{Composite Score} = (W_{\text{stock}} \times S_{\text{stock}}) + (W_{\text{proximity}} \times S_{\text{proximity}}) + (W_{\text{workload}} \times S_{\text{workload}})$$

#### Weight Distribution
- **Stock Availability Weight ($W_{\text{stock}}$)** = `0.45` (45%)
- **Geographic Proximity Weight ($W_{\text{proximity}}$)** = `0.35` (35%)
- **Workload Capacity Weight ($W_{\text{workload}}$)** = `0.20` (20%)

---

## REST API Documentation

### Base URL: `http://localhost:5000/api`

#### Authentication & Users
- `POST /auth/register` — Register a customer account (`{ name, email, password, city, lat, lng }`)
- `POST /auth/login` — Login user (`{ email, password }` -> returns `{ token, user }`)
- `GET /auth/me` — Return current authenticated session user (Requires `Bearer` token)
- `GET /users` — **[Admin]** List all customer and admin accounts with order statistics and lifetime spend
- `POST /users` — **[Admin]** Create customer or admin user account with bcrypt hashing
- `PUT /users/:id` — **[Admin]** Update user profile, contact info, role, or reset password
- `DELETE /users/:id` — **[Admin]** Delete user account (protected against self-deletion)

#### Products Catalog Management
- `GET /products` — Retrieve all available beverages and add-ons with LKR pricing
- `POST /products` — **[Admin]** Create product and auto-initialize stock records across all branches
- `PUT /products/:id` — **[Admin]** Update product name, category, price, and image URL
- `DELETE /products/:id` — **[Admin]** Delete product (cascades branch stock records)

#### Locations & Branch Management
- `GET /branches` — Retrieve branches with live inventory, active orders, and status
- `POST /branches` — **[Admin]** Add new branch location with spherical coordinates and capacity
- `PUT /branches/:id` — **[Admin]** Update branch details, location coordinates, or max capacity
- `DELETE /branches/:id` — **[Admin]** Delete branch location
- `GET /branches/:id/stock` — Get itemized stock for a branch
- `PUT /branches/:id/stock` — **[Admin]** Update product stock quantity (`{ productId, quantity }`)
- `PATCH /branches/:id/toggle` — **[Admin]** Open or close a branch

#### Orders & Allocation
- `POST /orders` — Create order with auto-allocation (`{ items, customerLocation, note }`)
- `GET /orders` — List orders with filters (`status`, `branchId`, `search`). Customers see their orders; Admins see all.
- `GET /orders/:id` — Retrieve detailed order breakdown with allocation rationale
- `PATCH /orders/:id/status` — **[Admin]** Advance order status (`allocated` -> `preparing` -> `out_for_delivery` -> `delivered`)
- `POST /orders/:id/cancel` — Cancel order, restoring stock and workload automatically
- `POST /orders/:id/reassign` — **[Admin]** Manually override order to another branch (`{ newBranchId }`)

#### Analytics & AI
- `GET /dashboard/stats` — **[Admin]** Operational KPIs, branch utilization, recent orders
- `POST /ai/classify` — Classify message (`{ message, threshold? }` -> `{ category, confidence, allScores }`)
- `GET /ai/challenge-samples` — Pre-loaded challenge queries for instant UI testing
- `GET /ai/metrics` — Model training statistics and validation accuracy

---

## Setup & Running Instructions

### Prerequisites
- **Node.js** v20+ or v22+ (tested on Node v22.14.0)
- **PostgreSQL** v15+ (running via Docker container `soas-postgres` on `localhost:5432`)
- **Python** 3.10+ or 3.11+ (with `scikit-learn`, `pandas`, `numpy`)
- **npm** v10+

### 1. Database Setup (PostgreSQL)
Ensure PostgreSQL is running on `localhost:5432` (or launch via Docker):
```bash
docker run --name soas-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -e POSTGRES_DB=soas_db \
  -p 5432:5432 -d postgres:15-alpine
```

### 2. Installation & Dependency Setup
Clone the repository and install dependencies:
```bash
# Clone repository
git clone https://github.com/VismithaG/Smart-Order-Allocation-System.git
cd Smart-Order-Allocation-System

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd "../Smart Order Allocation System"
npm install

cd ..
```

### 3. Database Schema Initialization & Seeding
```bash
# Initializes PostgreSQL schema and seeds initial branches, products, stock, demo accounts, and sample orders
npm run seed
```

### 4. Running the Full Application
Start both the backend API and frontend development server:

**Terminal 1 (Backend REST API - Port 5000):**
```bash
npm run dev
```

**Terminal 2 (Frontend React App - Port 5173):**
```bash
npm run dev:frontend
```

Now open your browser and navigate to:
👉 **`http://localhost:5173`**

### 5. Pre-Configured Demo Accounts
The database comes seeded with two ready-to-use accounts:

| Role | Email | Password | Access Capabilities |
|---|---|---|---|
| **Customer** | `customer@demo.com` | `customer123` | Place orders, view allocation breakdown, cancel order |
| **Admin** | `admin@demo.com` | `admin123` | Full Supervisory CRUD (Products, Locations, Users), live DOM dashboard, inventory editor, order overrides, AI workbench |

*(Note: The login screen also includes convenient one-click demo autofill buttons).*

---

## Automated Verification & Test Suite

The repository includes an automated integration and security test suite covering health checks, JWT generation, RBAC endpoint barriers, Admin Product/Branch/User CRUD, atomic PostgreSQL stock deduction, rollback on cancellation, and AI classification.

Run the test suite directly:
```bash
npm test
```

Expected Output:
```text
=================================================
🧪 RUNNING SOAS POSTGRESQL FULL-STACK & CRUD TEST SUITE
=================================================
[TEST 1] Health Check Endpoint
✓ Health Check passed: Smart Order Allocation System (SOAS) API (PostgreSQL active)

[TEST 2] Authentication & JWT Generation
✓ Customer login passed. JWT token received.
✓ Admin login passed. Admin JWT token received.

[TEST 3] Security & Role-Based Access Control (RBAC)
✓ RBAC successfully blocked customer from admin dashboard (403 Forbidden).
✓ Unauthenticated request blocked (401 Unauthorized).
✓ Admin access to dashboard granted (200 OK). Total orders: 5

[TEST 4] Admin Supervisory Product CRUD
✓ Admin created product: Super Lychee Fizz
✓ Product stock entries automatically seeded across branches.
✓ Admin updated product price to Rs. 620.
✓ Admin deleted product successfully.

[TEST 5] Admin Supervisory Branch / Location CRUD
✓ Admin created branch location: Kurunegala Central Branch
✓ Admin updated branch details.
✓ Admin deleted branch location.

[TEST 6] Admin Supervisory User & Customer Management
✓ Admin listed users with order metrics. Total users: 4
✓ Admin created user: Kasun Jayasuriya (kasun@demo.com)
✓ Admin updated user profile.
✓ Admin deleted user account.

[TEST 7] Smart Multi-Factor Order Allocation Engine (PostgreSQL)
✓ Order placed successfully in PostgreSQL! (Score: 94/100, Branch: Colombo Fort Branch)
✓ ACID Stock Deduction verified in PostgreSQL: 45 -> 43
✓ Branch Workload updated: 4 -> 5

[TEST 8] Order Cancellation & Stock/Workload Rollback (PostgreSQL)
✓ Inventory Rollback verified: Stock restored to 45
✓ Workload Release verified: Workload returned to 4

[TEST 9] AI / ML Customer Inquiry Classifier
✓ Test sample 1 (PDF Example): 'My payment was deducted...' -> Payment Issue (94.1%)
✓ Test sample 2: 'Is this item available at the Kandy branch today?' -> Product/Stock Inquiry (81.3%)
✓ Test sample 3: 'The rider has not arrived and tracking is stuck' -> Delivery Issue (78.0%)
✓ Test sample 4 (Ambiguous): Flagged as lowConfidence: true - Escalate to Human Review (Confidence 25% < 60%)

=================================================
🎉 ALL 9 INTEGRATION, CRUD & SECURITY TESTS PASSED 100%!
=================================================
```

### Running the Python ML Pipeline
To re-train the model or test CLI predictions:
```bash
# Run 5-fold cross-validation training and export weights:
npm run ml:train

# Test inference via CLI:
python ml/predict.py --message "Where is my delivery?"
```

---

## Assumptions & Limitations

1. **Geodesic Distance vs Road Routing**: Proximity is currently calculated using the Haversine formula (as-the-crow-flies distance). In a large-scale commercial production deployment, this would be augmented with a road-network matrix API (e.g., Google Distance Matrix / OSRM) to account for live traffic and physical terrain.
2. **PostgreSQL Container Setup**: The system is pre-configured to connect to PostgreSQL running on `localhost:5432`. Standard environment variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) can be customized in `backend/.env`.
3. **Inquiry Dataset Size**: The classification model was trained on 426 clean samples across 8 categories (~53 samples per class). While TF-IDF + Logistic Regression achieves 88% accuracy, training on 10,000+ customer transcripts would further increase robustness against slang, colloquial language, and regional spelling variants.

---

## Candidate Notes & Interview Preparation

- **Why PostgreSQL with `pg.Pool`?** PostgreSQL provides enterprise-grade relational features, ACID transactional guarantees (`BEGIN`, `COMMIT`, `ROLLBACK`), foreign key cascades, and scale-ready connection pooling for concurrent API workloads.
- **Why TF-IDF + Logistic Regression over Deep Learning?** For a 450-sample dataset, lightweight models with sublinear TF-IDF avoid overfitting, train in under 2 seconds, and produce well-calibrated probabilities via softmax for confidence thresholding. Exporting parameters to JSON allows the Express backend to perform sub-millisecond in-process inference without needing an external Python process.
- **Security Decisions**: Passwords hashed with bcrypt (10 rounds); JWT tokens stored securely and validated on all sensitive endpoints; strict RBAC preventing customers from tampering with branch stocks or accessing administrative metrics.

---
*Created by Vismitha for the DartCodes (Pvt) Ltd Software Engineer Intern Technical Assessment.*
