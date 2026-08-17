import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { categories, db, users } from '@sabate/db';

async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sabate.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.SEED_ADMIN_NAME || 'Admin';

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });
  if (!existingAdmin) {
    await db.insert(users).values({
      email: adminEmail,
      name: adminName,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'admin',
    });
    console.log(`Admin user created: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  const sampleCategories = ['Alimentos', 'Bebidas', 'Limpieza', 'Hogar'];
  for (const name of sampleCategories) {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    const exists = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });
    if (!exists) {
      await db.insert(categories).values({ name, slug });
      console.log(`Category created: ${name}`);
    } else {
      console.log(`Category already exists: ${name}`);
    }
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
