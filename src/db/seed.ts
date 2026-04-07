import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config();

async function main() {
  console.log('Seeding started...');
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const db = drizzle(connection, { schema, mode: 'default' });

    // 1. Insert Features
    console.log('Inserting features...');
    await db.insert(schema.features).values([
      { id: 1, name: 'recording', label: 'Class Recording', type: 'boolean' },
      { id: 2, name: 'max_students', label: 'Max Students', type: 'limit' },
      { id: 3, name: 'storage', label: 'Cloud Storage', type: 'limit' },
      { id: 4, name: 'whiteboard', label: 'Whiteboard Access', type: 'boolean' },
      { id: 5, name: 'priority_support', label: 'Priority Support', type: 'boolean' },
    ]).onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });

    // 2. Insert Packages
    console.log('Inserting packages...');
    await db.insert(schema.packages).values([
      { 
        id: 1, 
        name: 'Trial', 
        price: 0, 
        description: 'This is for trial period.', 
        status: 1, 
        hide: 0, 
        createdAt: new Date('2026-03-18 12:17:37'), 
        updatedAt: new Date('2026-03-18 16:20:00'), 
        highlighted: 0, 
        paymentCurrency: 'USD' 
      },
      { 
        id: 2, 
        name: 'Basic Plan', 
        price: 999, 
        description: 'Basic features for small classes', 
        status: 1, 
        hide: 0, 
        createdAt: new Date('2026-03-18 14:54:22'), 
        updatedAt: new Date('2026-03-18 15:06:17'), 
        highlighted: 1, 
        paymentCurrency: 'USD' 
      },
      { 
        id: 3, 
        name: 'Pro Plan', 
        price: 1999, 
        description: 'Advanced features for growing educators', 
        status: 1, 
        hide: 0, 
        createdAt: new Date('2026-03-18 14:54:22'), 
        updatedAt: new Date('2026-03-18 14:54:22'), 
        highlighted: 0, 
        paymentCurrency: 'USD' 
      },
    ]).onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });

    // 3. Insert Package Features
    console.log('Inserting package features...');
    await db.insert(schema.packageFeatures).values([
      { id: 1, packageId: 1, featureId: 1, value: 'false' },
      { id: 2, packageId: 1, featureId: 2, value: '20' },
      { id: 3, packageId: 1, featureId: 3, value: '5GB' },
      { id: 4, packageId: 1, featureId: 4, value: 'true' },
      { id: 5, packageId: 1, featureId: 5, value: 'false' },
      { id: 6, packageId: 2, featureId: 1, value: 'true' },
      { id: 7, packageId: 2, featureId: 2, value: '50' },
      { id: 8, packageId: 2, featureId: 3, value: '20GB' },
      { id: 9, packageId: 2, featureId: 4, value: 'true' },
      { id: 10, packageId: 2, featureId: 5, value: 'true' },
    ]).onDuplicateKeyUpdate({ set: { value: sql`VALUES(value)` } });

    console.log('Seeding finished!');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();


