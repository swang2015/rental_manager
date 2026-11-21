import { config } from 'dotenv';

config({ path: '.env.test', override: true });

if (!process.env.DATABASE_URL?.includes('rental_manager_test')) {
  throw new Error('Tests must run against the rental_manager_test database.');
}

