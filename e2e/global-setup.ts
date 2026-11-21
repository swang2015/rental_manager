import { execSync } from 'node:child_process';

/**
 * Runs before the dev server and the tests: rebuilds the test schema and loads
 * the deterministic demo fixture so every run starts from the same state.
 */
export default function globalSetup(): void {
  execSync('pnpm exec dotenv run -q -f .env.test -- prisma migrate reset --force --skip-seed', {
    stdio: 'inherit',
  });
  execSync('pnpm db:test:seed', { stdio: 'inherit' });
}
