# sabate

E-commerce platform for a business in Sabate, Valera, Trujillo State.

## Tech Stack

| Layer       | Technology                       |
| ----------- | -------------------------------- |
| Frontend    | Next.js 14+ (App Router)         |
| Styling     | Tailwind CSS                     |
| Backend     | Express.js (separate API server) |
| Database    | PostgreSQL                       |
| ORM         | Drizzle                          |
| Auth        | NextAuth.js (Auth.js)            |
| Payments    | PayPal                           |
| Images      | Cloudinary                       |
| Hosting     | AWS EC2 (free tier → paid tier)  |

## Architecture

This is a monorepo with three packages:

```
apps/web       → Next.js frontend (App Router, Tailwind)
apps/api       → Express.js REST API
packages/db    → Drizzle schema, migrations, shared DB client
```

Next.js calls the Express API for all data operations — **no API routes or server actions for business logic** in the web app.

## Getting Started

```bash
npm install
docker compose up db          # local PostgreSQL
npm run db:push               # sync Drizzle schema to local DB
npm run dev                   # runs both web and api concurrently
```

## Environment

Each app has its own `.env`. Key variables:

```
DATABASE_URL=postgresql://user:pass@host:5432/sabate
NEXTAUTH_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_SECRET_KEY=
CLOUDINARY_URL=
```

## Deploy to AWS

**Free tier setup:**
- EC2 t2.micro (750 hrs/month for 12 months)
- RDS PostgreSQL db.t3.micro (free tier)
- nginx reverse proxy → Express on port 3001, Next.js on port 3000
- PM2 process manager for both apps

**Roadmap:**
1. Launch on free tier with single EC2 instance
2. Migrate to paid tier (larger instances, RDS scaling) as traffic grows
3. Add CloudFront CDN, load balancer if needed

## Features

- Product listing with search, filter, pagination, sort
- Shopping cart and PayPal checkout
- User profile management (name, password, avatar)
- Admin panel: manage users, products, categories, permissions
- Multiple image uploads via Cloudinary

## License

Private
