# Hafa Market Backend API

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your values
cp .env.example .env

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations
npm run db:migrate

# 5. Seed the database
npm run db:seed

# 6. Start development server
npm run dev
```

## API Base URL
`http://localhost:5000/api/v1`

## Key Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login |
| POST | /auth/refresh | Refresh access token |
| GET  | /products | List products (with filters) |
| GET  | /products/:slug | Single product |
| POST | /products | Create product (seller) |
| GET  | /categories | All categories |
| GET  | /cart | Get cart |
| POST | /cart | Add to cart |
| POST | /orders | Place order |
| GET  | /orders | My orders |
| GET  | /search?q=mango | Search |

## Stack
- Node.js + Express
- PostgreSQL + Prisma ORM
- Redis (caching)
- Socket.io (real-time)
- JWT Auth
- Cloudinary (images)
- M-Pesa + Flutterwave (payments)
- Firebase FCM (push notifications)
- SendGrid (email)
- Africa's Talking (SMS)
