import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { organizations } from './schema/organizations.js';
import { users } from './schema/users.js';
import { userModulePermissions } from './schema/user-module-permissions.js';
import { hashPassword } from '../lib/password.js';
import { MODULES } from '@company-hub/shared';
import { eq } from 'drizzle-orm';

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@company-hub.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  // Check if org already exists
  const existingOrgs = await db.select().from(organizations).limit(1);
  if (existingOrgs.length > 0) {
    console.log('Seed: Organization already exists, skipping.');
    await pool.end();
    return;
  }

  // Create default organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Company Hub',
      slug: 'company-hub',
      primaryColor: '#6366f1',
      secondaryColor: '#1e1b4b',
      accentColor: '#f59e0b',
    })
    .returning();

  console.log(`Seed: Created organization "${org.name}" (${org.id})`);

  // Create admin user
  const passwordHash = await hashPassword(adminPassword);
  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail,
      passwordHash,
      role: 'super_admin',
      firstName: 'Admin',
      lastName: 'User',
      orgId: org.id,
    })
    .returning();

  console.log(`Seed: Created admin user "${adminEmail}" (${admin.id})`);

  // Grant all modules to admin
  const modulePermissions = MODULES.map((m) => ({
    userId: admin.id,
    moduleId: m.id,
    isEnabled: true,
    grantedBy: admin.id,
  }));

  await db.insert(userModulePermissions).values(modulePermissions);
  console.log(`Seed: Granted ${modulePermissions.length} modules to admin.`);

  await pool.end();
  console.log('Seed completed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
