import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, users } from '../db/client';

async function main() {
  const username = process.env.SEED_OWNER_USERNAME;
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!username || !password) {
    console.error(
      'SEED_OWNER_USERNAME and SEED_OWNER_PASSWORD are required in apps/pos/.env',
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_OWNER_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (existing) {
    console.log(`Owner "${username}" already exists — nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    username,
    passwordHash,
    name: 'Propietario',
    role: 'owner',
  });
  console.log(`Owner "${username}" created.`);
}

main();
