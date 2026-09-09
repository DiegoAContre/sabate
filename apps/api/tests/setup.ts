// Runs before every test file's imports, so these values beat apps/api/.env
// (dotenv never overrides already-set vars).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://sabate:sabate@localhost:5432/sabate_test';
process.env.JWT_SECRET = 'test-secret-0123456789-32-chars-long-ok';
process.env.CORS_ORIGIN = 'http://localhost:3000';
// Forces the "Stripe unconfigured" path so tests never touch the network.
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
