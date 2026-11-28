import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/lib/db.ts',
      'src/lib/db/**',
      'src/lib/auth/**',
      // Sign-in, sign-up and onboarding resolve a user before an organization is
      // known, and the cron route iterates every organization.
      'src/app/(auth)/**',
      'src/app/onboarding/**',
      // The platform admin console lists and creates organizations globally.
      'src/app/admin/**',
      // Vendors only read work orders assigned to their own vendor accounts.
      'src/lib/domain/vendor-portal.ts',
      // The vendor directory is platform-wide, not owned by a single owner.
      'src/lib/domain/vendors.ts',
      'src/app/api/cron/**',
      // The health probe only runs `SELECT 1`, it reads no organization data.
      'src/app/api/health/**',
      'prisma/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/db',
              message: 'Use scopedDb(orgId) from @/lib/db/scoped for organization data.',
            },
          ],
        },
      ],
    },
  },
);
