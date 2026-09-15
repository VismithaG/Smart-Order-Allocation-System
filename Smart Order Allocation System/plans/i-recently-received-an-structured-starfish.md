# Context

The user received a 72-hour technical assessment from DartCodes (Pvt) Ltd for a Software Engineer Intern position. The brief requires building a **Smart Order Allocation System** — a multi-branch business app that automatically routes customer orders to the best-suited branch. An optional AI/ML bonus (message classifier) is also available, with a labeled CSV dataset provided.

The current workspace is a React + Vite + Tailwind CSS v4 Figma Make project (frontend only). The plan is to build a polished, complete frontend demo with simulated data and in-browser logic — covering all evaluation criteria visibly in the UI.

---

# Recommended Application: Smart Order Allocation System + AI Message Classifier

## Why this scope
- Covers all 9 evaluation criteria from the PDF
- The AI bonus (classifier) can be fully implemented client-side using the CSV dataset
- A frontend-only demo with realistic mock data is entirely appropriate — the PDF says "not expecting production-ready commercial system"
- Figma Make's React/Vite environment is ideal for a polished, responsive UI

---

## Application Structure (Pages/Views)

### 1. Auth Pages
- `/login` — email + password login (two roles: `admin`, `customer`)
- Protected route guard — customers can't reach admin pages; simulated JWT in localStorage

### 2. Customer Flow
- `/order/new` — Order creation form: product selection, quantity, customer name, delivery address/location
- `/order/status` — Order status tracker showing branch assigned, estimated time, current status (Pending → Allocated → Preparing → Delivered)
- `/orders` — Customer's order history with search/filter

### 3. Branch Allocation Engine (client-side logic)
- Scoring algorithm per branch:
  - Stock availability for requested products (hard filter)
  - Proximity score (distance from customer location to branch)
  - Workload score (inverse of current active orders)
  - Combined weighted score → auto-select best branch
- Edge cases handled: no stock, all branches busy, partial stock

### 4. Admin Dashboard (`/admin`)
- Overview stats: total orders, active orders, branch utilization
- Branch management table: each branch's stock levels, active orders, location
- Order management: list all orders, search/filter by status/branch/customer, manual override of allocation
- Branch selector for reassigning an order

### 5. AI Message Classifier (`/admin/classifier` or as a widget)
- Text input for a customer message
- One-click classify → shows predicted category + confidence bar
- Low-confidence warning (< 60%) with suggestion to escalate to human
- Category options match the 8 labels from the CSV
- Implementation: keyword frequency / TF-IDF scoring from the CSV data, compiled into a static lookup at build time

---

## Key Technical Decisions

| Area | Approach |
|---|---|
| State | React `useState` / `useContext` — no external state library needed |
| Routing | React Router v6 with protected route wrapper |
| Auth simulation | Role stored in `localStorage`; route guard checks role before render |
| Data persistence | `localStorage` for orders/branches — survives page reload in demo |
| Allocation logic | Pure TypeScript function: score each branch, return highest scorer |
| AI classifier | Pure JS TF-IDF trained on the CSV at app startup; no external API |
| Styling | Tailwind CSS v4 utility classes; dark-friendly palette |
| Responsiveness | Mobile-first layout; admin dashboard collapses to cards on small screens |

---

## Files to Create/Modify

- `src/App.tsx` — router setup, auth context provider
- `src/index.css` — global styles, font import
- `src/pages/Login.tsx`
- `src/pages/customer/NewOrder.tsx`
- `src/pages/customer/OrderStatus.tsx`
- `src/pages/customer/OrderHistory.tsx`
- `src/pages/admin/Dashboard.tsx`
- `src/pages/admin/BranchManagement.tsx`
- `src/pages/admin/OrderManagement.tsx`
- `src/pages/admin/MessageClassifier.tsx`
- `src/lib/auth.ts` — login logic, role check, localStorage helpers
- `src/lib/allocation.ts` — branch scoring algorithm
- `src/lib/classifier.ts` — TF-IDF classifier built from CSV data
- `src/lib/store.ts` — mock data store (branches, products, orders)
- `src/components/` — shared: Navbar, ProtectedRoute, StatusBadge, BranchCard, etc.

---

## Verification
1. Log in as customer → place an order → verify branch auto-assigned with reason shown
2. Log in as admin → view dashboard stats → reassign an order → confirm change reflected
3. Enter a customer message in classifier → confirm category + confidence score appear
4. Try edge cases: order item out of stock at all branches → verify "unavailable" message
5. Try accessing `/admin` as a customer → verify redirect to login
