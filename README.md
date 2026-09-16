# Smart Order Allocation System (SOAS)
**Software Engineer Intern Technical Assessment — DartCodes (Pvt) Ltd**

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-v19-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-blue.svg)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-blue.svg)](https://sqlite.org)
[![Python ML](https://img.shields.io/badge/scikit--learn-88.0%25%20CV-orange.svg)](https://scikit-learn.org)
[![Test Suite](https://img.shields.io/badge/Integration%20Tests-100%25%20Passing-brightgreen.svg)](https://github.com/VismithaG/Smart-Order-Allocation-System)

A full-stack, distributed order management and intelligent branch routing platform designed to automatically evaluate multi-branch inventories, geospatial distance, and kitchen workload levels in real time to dispatch customer orders to the optimal branch. Includes an AI/ML customer inquiry classification and automated triage engine trained on the provided assessment dataset.

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
- **ACID Transaction State Management**: Stock deductions and branch workload adjustments execute atomically in SQLite.
- **Automatic Inventory & Workload Rollback**: Cancelling an order immediately restores reserved stock back to the allocated branch and frees queue capacity.
- **AI / ML Customer Inquiry Classifier**: `TfidfVectorizer` + `LogisticRegression` pipeline achieving **88.03% 5-fold cross-validation accuracy** across 8 categories with confidence calibration and human escalation flags for scores under 60%.
- **Dual AI Integration**: Real-time note triage during customer order placement and an interactive Admin Triage Workbench with pre-loaded challenge dataset queries.
- **Multi-Step Customer Ordering Journey**: Progressive 3-stage checkout (`Product Selection` -> `Order Summary & Destination` -> `Simulated Payment Gateway`) with live AI note analysis and immediate algorithmic routing diagnostics.
- **Responsive Web Interface**: Modern UI with customer ordering flow, live order tracker, admin analytics dashboard, real-time branch capacity meters, live stock editor, and manual branch reassignment overrides.

---

## Technologies Used

| Layer | Technologies | Rationale |
|---|---|---|
| **Backend** | Node.js (v22), Express, TypeScript | High-performance asynchronous REST API with strong type safety. |
| **Database** | SQLite (Node 22 native `node:sqlite`) | Persistent relational database with WAL (Write-Ahead Logging) mode, foreign keys, and zero external compilation dependencies. |
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
│   │  /auth  •  /products  •  /branches  •  /orders  •   │   │
│   │  /dashboard/stats     •  /ai/classify               │   │
│   └─────────┬──────────────────────────────┬────────────┘   │
│             │                              │                │
│   ┌─────────▼──────────────┐   ┌───────────▼────────────┐   │
│   │ Smart Allocation Engine│   │ AI Triage Classifier   │   │
│   │ (Stock / Haversine /   │   │ (TF-IDF + Softmax      │   │
│   │  Workload Scoring)     │   │  Model Weights JSON)   │   │
│   └─────────┬──────────────┘   └────────────────────────┘   │
│             │                                               │
│   ┌─────────▼───────────────────────────────────────────┐   │
│   │        SQLite Relational Persistence Layer          │   │
│   │   (users, branches, products, branch_stocks,        │   │
│   │    orders, order_items — WAL Mode & ACID)           │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Smart Branch Allocation Logic

The allocation engine solves the problem: **Which branch should fulfill a customer order to maximize fulfillment success, minimize delivery delay, and prevent kitchen bottlenecks?**

### 1. Mathematical Scoring Formulation
When an order $O = \{i_1, i_2, \dots, i_n\}$ is submitted from location $L_c = (\text{lat}_c, \text{lng}_c)$, every active branch $B$ is scored using a multi-criteria weighted formula:

$$\text{Composite Score} = (W_{\text{stock}} \times S_{\text{stock}}) + (W_{\text{proximity}} \times S_{\text{proximity}}) + (W_{\text{workload}} \times S_{\text{workload}})$$

$$\text{Score} = \text{round}(\text{Composite Score} \times 100)$$

#### Weights Selected:
- **$W_{\text{stock}} = 0.45$ (45%)**: Stock fulfillment is the primary physical prerequisite. A branch cannot fulfill an order if items are missing.
- **$W_{\text{proximity}} = 0.35$ (35%)**: Proximity minimizes delivery transit time, courier costs, and ensures food freshness.
- **$W_{\text{workload}} = 0.20$ (20%)**: Workload load-balancing prevents order pile-ups and kitchen delay during peak hours.

### 2. Component Normalization
1. **Stock Fulfillment Ratio ($S_{\text{stock}}$)**:
   $$S_{\text{stock}} = \frac{\sum_{k=1}^{n} \mathbb{I}(\text{Stock}(B, i_k) \ge \text{Quantity}(i_k))}{n}$$
   *(Note: Auto-dispatch enforces a hard constraint requiring $S_{\text{stock}} = 1.0$)*.

2. **Proximity Score ($S_{\text{proximity}}$)**:
   Computed using the **Haversine Great-Circle formula**:
   $$d = 2 R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_c)\cos(\text{lat}_B)\sin^2\left(\frac{\Delta \text{lng}}{2}\right)}\right)$$
   $$S_{\text{proximity}} = \max\left(0, 1 - \frac{d}{d_{\max}}\right) \quad (\text{where } d_{\max} = 250\text{ km})$$

3. **Workload & Capacity Score ($S_{\text{workload}}$)**:
   $$U = \frac{\text{ActiveOrders}_B}{\text{MaxCapacity}_B}$$
   $$S_{\text{workload}} = \max\left(0, 1 - U\right)$$

### 3. Edge-Case Handling & Priority Rules
- **Branch Closed**: Branches with `isOpen = false` are immediately excluded.
- **Branch Saturated**: If $\text{ActiveOrders} \ge \text{MaxCapacity}$, the branch is bypassed to prevent order delays.
- **Tie-Breaking Rule**: If two branches have equal composite scores within 1 point:
  1. Branch with lower absolute distance ($d$) is selected (faster delivery).
  2. If distances are identical, branch with lower active queue is selected.
- **Complete Stock Out**: If no branch can fulfill the order, the system records the order as rejected/cancelled and provides the customer with a breakdown of missing items per branch.
- **Cancellation Stock Rollback**: When an order is cancelled by the customer or admin, the system executes an atomic transaction restoring the exact reserved quantities to the branch inventory and decrementing the active queue count.
- **Admin Manual Override**: Administrators can reassign an order to a different branch via the dashboard; stock and capacity automatically transfer from the source branch to the target branch.

---

## Authentication & Security Architecture

### 1. Password Hashing
- Utilizes `bcryptjs` with **10 salt rounds** for all user passwords. Raw passwords are never stored.

### 2. JWT Authentication & Expiry
- Stateless JSON Web Tokens signed with a secure server-side secret (`JWT_SECRET`).
- Token payload includes `id`, `email`, `role`, and geographic coordinates.
- Tokens expire in **8 hours** (`expiresIn: "8h"`).

### 3. Role-Based Access Control (RBAC)
- **`customer`**: Can browse products and branches, create orders, view personal order history, and cancel eligible pending orders.
- **`admin`**: Full administrative access to operational metrics, branch status toggles, stock quantity overrides, all customer orders, status progression, manual branch reassignment, and AI triage testing.
- **API Guard**: Calling an admin endpoint without an admin token immediately returns `403 Forbidden`. Attempting an unauthenticated call returns `401 Unauthorized`.

### 4. Defense-in-Depth Protection
- **Rate Limiting**: Global limiter sets a threshold of 200 requests / 15 minutes. Sensitive auth endpoints (`/api/auth/*`) are restricted to 30 requests / 15 minutes to prevent brute-force attacks.
- **Security Headers**: `helmet` sets secure HTTP headers (XSS filter, frameguard, noSniff).
- **Environment Isolation**: Secrets, ports, and database paths are loaded from `.env` via `dotenv`.

---

## AI / ML Challenge: Customer Inquiry Classifier

As specified in the assessment challenge, an AI/ML solution was developed to analyze and classify customer messages and order notes into categories with calibrated confidence scores.

### 1. Dataset Preprocessing & Cleaning
- **Raw dataset**: `dataset/customer_inquiries.csv` (450 rows).
- **Cleaning pipeline**:
  - Removed 15 empty/corrupted messages.
  - Separated the **10 unlabelled evaluation test queries** (IDs 441–450) provided in the challenge.
  - Identified 426 clean, balanced training samples (~53 samples per class across all 8 classes).
  - Normalized case, stripped noisy punctuation, and regularized whitespace.

### 2. Model Pipeline & Cross-Validation Results
- **Feature Extraction**: `TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)` extracting unigrams and bigrams.
- **Classifier**: `LogisticRegression(C=5.0, class_weight='balanced', max_iter=1000)`.
- **5-Fold Stratified Cross-Validation Accuracy**: **88.03% (+/- 3.77%)**.

#### Classification Report:
```
                             precision    recall  f1-score   support

       Account/Login Issue     0.9259    0.9434    0.9346        53
            Delivery Issue     0.9130    0.7925    0.8485        53
           General Inquiry     0.8571    0.8889    0.8727        54
      Order Status Inquiry     0.8033    0.9245    0.8596        53
             Payment Issue     0.8929    0.9434    0.9174        53
     Product/Stock Inquiry     0.8909    0.9245    0.9074        53
Promotion/Discount Inquiry     0.8980    0.8148    0.8544        54
       Refund/Cancellation     0.8776    0.8113    0.8431        53

                  accuracy                         0.8803       426
                 macro avg     0.8823    0.8804    0.8797       426
              weighted avg     0.8823    0.8803    0.8796       426
```

### 3. Confidence Thresholding & Human Escalation
- Softmax output provides calibrated posterior probabilities $P(c \mid x)$.
- **Confidence Safety Threshold = 60%**:
  - If $\max_c P(c \mid x) \ge 0.60$: Flagged as `Auto-Triage Confirmed`.
  - If $\max_c P(c \mid x) < 0.60$: Flagged as `lowConfidence: true` with status `Escalate to Human Review`.

### 4. Challenge Dataset Evaluation (Sample of IDs 441–450)
| ID | Challenge Message | Predicted Category | Confidence | Status |
|---|---|---|---|---|
| **441** | *"My payment is still pending"* | **Payment Issue** | 91.6% | Auto-Triage |
| **442** | *"Where is my delivery?"* | **Delivery Issue** | 87.2% | Auto-Triage |
| **443** | *"I want a refund for this order"* | **Refund/Cancellation** | 95.8% | Auto-Triage |
| **444** | *"Is this product available today?"* | **Product/Stock Inquiry** | 83.5% | Auto-Triage |
| **445** | *"Can you check my order status?"* | **Order Status Inquiry** | 93.9% | Auto-Triage |
| **446** | *"I cannot log into my account"* | **Account/Login Issue** | 86.2% | Auto-Triage |
| **447** | *"Why is my promo code not working?"* | **Account/Login Issue** | 43.4% | **Escalate to Human** |
| **448** | *"" (Empty message)* | **General Inquiry** | 0.0% | **Escalate to Human** |
| **449** | *"I was charged twice"* | **Payment Issue** | 76.7% | Auto-Triage |
| **450** | *"Can I change my delivery address?"* | **Delivery Issue** | 79.6% | Auto-Triage |
| **PDF** | *"My payment was deducted, but my order is not showing."* | **Payment Issue** | **94.1%** | Auto-Triage |

---

## REST API Documentation

### Base URL: `http://localhost:5000/api`

#### Authentication & Users
- `POST /auth/register` — Register a customer account (`{ name, email, password, city, lat, lng }`)
- `POST /auth/login` — Login user (`{ email, password }` -> returns `{ token, user }`)
- `GET /auth/me` — Return current authenticated session user (Requires `Bearer` token)

#### Products & Branches
- `GET /products` — Retrieve all available beverages and add-ons
- `GET /branches` — Retrieve branches with live inventory, active orders, and status
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
- **Python** 3.10+ or 3.11+ (with `scikit-learn`, `pandas`, `numpy`)
- **npm** v10+

### 1. Installation
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

### 2. Database Initialization & Seeding
```bash
# Seeds initial branches, products, stock, demo accounts, and sample orders
npm run seed
```

### 3. Running the Full Application
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

### 4. Pre-Configured Demo Accounts
The database comes seeded with two ready-to-use accounts:

| Role | Email | Password | Access Capabilities |
|---|---|---|---|
| **Customer** | `customer@demo.com` | `customer123` | Place orders, view allocation breakdown, cancel order |
| **Admin** | `admin@demo.com` | `admin123` | Live DOM dashboard, inventory editor, order overrides, AI workbench |

*(Note: The login screen also includes convenient one-click demo autofill buttons).*

---

## Automated Verification & Test Suite

The repository includes an automated integration and security test suite covering health checks, JWT generation, RBAC endpoint barriers, atomic stock deduction, rollback on cancellation, and AI classification.

Run the test suite directly:
```bash
npm test
```

Expected Output:
```
🧪 RUNNING SOAS FULL-STACK BACKEND & ML TEST SUITE
=================================================
✓ Health Check passed: Smart Order Allocation System (SOAS) API
✓ Customer login passed. JWT token received.
✓ Admin login passed. Admin JWT token received.
✓ RBAC successfully blocked customer from admin dashboard (403 Forbidden).
✓ Unauthenticated request blocked (401 Unauthorized).
✓ Admin access to dashboard granted (200 OK). Total orders: 5
✓ Products catalog returned 8 items.
✓ 4 branches returned with live inventory.
✓ Order placed successfully! Auto-allocated to Colombo Fort Branch (Score: 94/100)
✓ ACID Stock Deduction verified: Stock reduced from 45 to 43
✓ Branch Workload updated: Workload increased from 4 to 5
✓ Inventory Rollback verified: Stock restored to 45 upon cancellation
✓ Workload Release verified: Workload returned to 4
✓ AI Classifier test passed: 'My payment was deducted, but my order is not showing.' -> Payment Issue (94.1%)
✓ AI Classifier test passed: Ambiguous text escalated to human review (Confidence 25% < 60%)

=================================================
🎉 ALL 7 INTEGRATION & SECURITY TESTS PASSED 100%!
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
2. **Synchronous Single-Node State**: The system uses SQLite with WAL mode, suitable for high read throughput and consistent transactional writes on a single server. In a distributed multi-region cluster, PostgreSQL with read replicas or Redis queue workers would be recommended.
3. **Inquiry Dataset Size**: The classification model was trained on 426 clean samples across 8 categories (~53 samples per class). While TF-IDF + Logistic Regression achieves 88% accuracy, training on 10,000+ customer transcripts would further increase robustness against slang, colloquial language, and regional spelling variants.

---

## Candidate Notes & Interview Preparation

- **Why SQLite with WAL mode?** It provides ACID guarantees with zero operational overhead and no native compilation risks on Windows/macOS/Linux.
- **Why TF-IDF + Logistic Regression over Deep Learning?** For a 450-sample dataset, lightweight models with sublinear TF-IDF avoid overfitting, train in under 2 seconds, and produce well-calibrated probabilities via softmax for confidence thresholding. Exporting parameters to JSON allows the Express backend to perform sub-millisecond in-process inference without needing an external Python process.
- **Security Decisions**: Passwords hashed with bcrypt (10 rounds); JWT tokens stored securely and validated on all sensitive endpoints; strict RBAC preventing customers from tampering with branch stocks or accessing administrative metrics.

---
*Created by Vismitha for the DartCodes (Pvt) Ltd Software Engineer Intern Technical Assessment.*
