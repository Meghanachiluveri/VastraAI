# Vastra.AI — Fashion, Found Intelligently

> **A luxury artisanal e-commerce platform powered by Gemini 2.5 AI, human-in-the-loop commerce guardrails, real-time shared cart synchronization, Razorpay Test Mode, and an Explainable Merchant Intelligence Dashboard.**

---

## 🏛️ Executive Overview

**Vastra.AI** bridges high-fashion artisanal luxury with safety-critical agentic AI. Rather than a simple chatbot, Vastra.AI features an **agentic shopping concierge** that operates on the exact same authoritative product catalog, stock levels, and shopping cart as the human storefront. Every conversational interaction is bounded by strict backend commerce guardrails, explicit human confirmation gates, idempotent cryptographic payment verification, and an explainability audit trail.

---

## 🌟 Key Features

### 1. 🛍️ Luxury Human Storefront
- **Artisanal Catalog**: 30 luxury garments spanning Indian handlooms, Mulberry silk bandhgalas, Belgian linen shirts, Chanderi silk dresses, and handcrafted accessories.
- **Dynamic Storefront**: Complete category filtering (Men, Women, New Arrivals, Sale), sorting, search modal with debounced query suggestions, and quick-view drawers.
- **Product Gallery**: High-resolution photography with angle selectors, zoom inspection, variant selection (size, color, quantity), and stock badges.

### 2. 🤖 Gemini AI Shopping Concierge
- **Multi-Turn Context**: Maintains conversational memory, intent refinement (*"something cheaper"*, *"more formal"*, *"in size 40"*), and product references (*"the first one"*, *"the black dress"*).
- **Intelligent Recommendations**: Justifies why an item was curated based on style, fit, rating (e.g. 4.9★), and price match.
- **Bounded Upselling**: Proposes a single tasteful accessory under ₹10,000 to complete the look. Respects customer declination immediately.

### 3. 🔄 Real-Time Shared Cart Synchronization
- **One Logical Cart**: Storefront and AI agent operate on the identical SQLite backend cart.
- Items added through the storefront are instantly visible to the AI; items added via voice or conversational prompts update the human cart drawer immediately.
- **Dynamic Price Synchronization**: Live catalog prices override stale client-side caches with automated price-change detection.

### 4. 🛡️ Safety-Critical Commerce Guardrails
- **Spending Limit Cap**: Hard-rejects any order exceeding ₹10,000.
- **Human Confirmation Gate**: Safety gate active for orders $\ge$ ₹500 — the AI cannot charge money on conversational prompts alone (*"Buy it"* prepares a review summary; payment requires explicit human authorization).
- **Atomic Stock Protection**: Real-time inventory checks prevent overselling. Sold-out items trigger graceful AI fallback recommendations.
- **Price Adjustment Interception**: Mandates customer re-confirmation if prices change before payment.

### 5. 💳 Razorpay Test Mode & Settlement Verification
- **Cryptographic HMAC-SHA256**: Server-side signature verification authenticates payments before marking orders `PAID`.
- **Atomic Inventory Decrement**: Inventory is decremented only upon verified settlement with strict idempotency protection against duplicate webhooks.
- **Failure Recovery**: Handles customer cancellation or bank declines gracefully by preserving the cart and prompting alternative payment.

### 6. 📊 Merchant Intelligence & Explainability Dashboard (`/merchant`)
- **Real-Time Revenue Analytics**: Tracks total revenue, human revenue, AI revenue, average order value (AOV), and conversion funnels.
- **AI Explainability & Audit Trail**: Visual chronological timeline detailing searches, recommendations, stock validations, human approvals, and payment authorizations without leaking raw model prompts or payment secrets.
- **Multi-Criteria Filtering**: Filter activity by date ranges (`Today`, `7 days`, `30 days`, `All time`) and categories (`Searches`, `Recommendations`, `Cart Actions`, `Checkout Safety`, `Payments`, `Failures`, `Orders`).

### 7. 🧪 AI Commerce Simulation Engine
- **Predictive Commerce Sandbox**: Simulates 10 to 100 virtual AI shoppers with realistic catalog intents, funnel progression, and top-selling garment analytics.
- **Strict Isolation Guarantee**: Simulations run with `channel = 'simulation'`, zero real Razorpay calls, zero production inventory modifications, and zero revenue contamination.

---

## 🏗️ System Architecture

```
                                 ┌────────────────────────┐
                                 │   CUSTOMER & MERCHANT  │
                                 └───────────┬────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ Human Storefront ]                        [ AI Concierge ]
              • Category Filters                          • Gemini 2.5 Flash
              • Product Details                           • Multi-Turn Context
              • Quick View Modal                          • Bounded Upsell
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             ▼
                               ┌───────────────────────────┐
                               │  SHARED CART & APIS       │
                               │  (/api/cart, /api/agent)  │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  COMMERCE GUARDRAILS      │
                               │  • Spending Limit ≤ ₹10K │
                               │  • Stock Availability     │
                               │  • Price Validation       │
                               │  • Human Confirmation     │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  ORDER & PAYMENT ENGINE   │
                               │  • Razorpay HMAC-SHA256   │
                               │  • Atomic Stock Reduction │
                               └─────────────┬─────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ SQLite WAL DB ]                           [ Merchant Portal ]
              • products, orders                          • Revenue Analytics
              • audit_log, carts                          • Explainability Timeline
              • simulation_runs                           • Simulation Engine
```

---

## 💻 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Axios, Zustand.
- **Backend**: Node.js, Express, TypeScript, SQLite (`better-sqlite3`), `@google/genai` (Gemini 2.5 Flash), Razorpay SDK, Crypto.
- **Aesthetic System**: Dusty Rose (`#A95D5B`), Warm Linen (`#FBF6F4`), Espresso Obsidian (`#2A211F`), Brand Sage (`#8AA48A`).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone & Configure Environment

```bash
# Clone the repository
git clone https://github.com/your-username/Vastra.AI.git
cd Vastra.AI

# 1. Configure Frontend Environment (.env in root)
cp .env.example .env

# 2. Configure Backend Environment (.env in vastra-backend)
cd vastra-backend
cp .env.example .env
cd ..
```

#### Backend Environment Variables (`vastra-backend/.env`)
```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
RAZORPAY_KEY_ID=rzp_test_vastra_dev
RAZORPAY_KEY_SECRET=dev_secret_vastra_123
DB_PATH=vastra.db
```

#### Frontend Environment Variables (`.env`)
```env
VITE_API_URL=http://localhost:4000/api
VITE_RAZORPAY_KEY_ID=rzp_test_vastra_dev
```

---

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd vastra-backend
npm install
cd ..
```

---

### 3. Run Applications

```bash
# Terminal 1 — Start Backend Server (Port 4000)
cd vastra-backend
npm run dev

# Terminal 2 — Start Frontend Application (Port 5173)
npm run dev
```

Visit the application at:
- **Human Storefront**: `http://localhost:5173/`
- **AI Shopping Concierge**: `http://localhost:5173/agent`
- **Merchant Login Portal**: `http://localhost:5173/merchant/login`
- **Protected Merchant Dashboard**: `http://localhost:5173/merchant` (Requires merchant authentication)

---

## 🔐 Merchant Authentication & Access Control

The Merchant Portal is protected by a dedicated role-based authentication system:
- **Merchant Login URL**: `/merchant/login`
- **Role Enforcement**: Only users authenticated with role `merchant` and a valid cryptographically signed HMAC token can access `/merchant` or merchant API endpoints (`/api/merchant/*`).
- **Customer vs. Merchant Separation**: Customer storefront sessions (`authStore`) are logically separated from merchant administrative credentials (`merchantAuthStore`).
- **Demo Account Setup**: Configure backend variables in `vastra-backend/.env`:
  ```env
  MERCHANT_EMAIL=merchant@vastra.ai
  MERCHANT_PASSWORD=your_secure_merchant_password
  MERCHANT_JWT_SECRET=your_jwt_signing_secret
  ```

---

## 🧪 Comprehensive Automated Test Suites

Vastra.AI includes a complete automated test suite covering safety guardrails, shared cart synchronization, payment verification, merchant authentication, merchant analytics, simulation isolation, and explainability.

Run tests inside `vastra-backend/`:

```bash
cd vastra-backend

# Merchant Authentication & Access Control Suite (Pass 12B)
npx ts-node test-merchant-auth.ts

# Bug Fix Verification Suite (Pass 12A)
npx ts-node test-pass12a-fixes.ts

# Master End-to-End Consolidated QA Suite (Phase 11)
npx ts-node test-phase11-consolidation.ts

# Explainability & AI Audit Trail Suite (Phase 10)
npx ts-node test-phase10-explainability.ts

# AI Commerce Simulation Sandbox Suite (Phase 9)
npx ts-node test-phase9-simulation.ts

# Merchant Dashboard & Analytics Suite (Phase 8)
npx ts-node test-phase8-merchant.ts

# Human + AI Shared Cart Synchronization Suite (Phase 7)
npx ts-node test-phase7-shared-cart.ts
```

---

## 🔒 Security & Guardrail Specifications

1. **Role-Based Access Control**: Merchant API routes require valid `Authorization: Bearer <token>` signed via HMAC-SHA256. Unauthenticated requests return `401 Unauthorized`; non-merchant roles return `403 Forbidden`.
2. **Authoritative Backend**: Prices and inventory are exclusively managed in SQLite. Client requests cannot dictate prices or bypass stock validation.
3. **Order Value Cap**: Hard enforcement of `MAX_ORDER_VALUE = ₹10,000`.
4. **Confirmation Threshold**: Orders $\ge ₹500$ enforce `requiresConfirmation = true`.
5. **HMAC Signature Check**: Razorpay payments require valid SHA256 signatures (`order_id|payment_id`) signed with `RAZORPAY_KEY_SECRET`.
6. **Zero Secret Leakage**: API keys, payment signatures, card details, database credentials, and raw LLM chain-of-thought are strictly excluded from API responses and audit timelines.

---

## 📄 License

MIT © 2026 Vastra.AI Team. Crafted with luxury, intelligence, and safety.
