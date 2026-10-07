import { defineConfig } from 'vitest/config';

// اختبارات قواعد Firestore — تُشغَّل عبر المحاكي: npm run test:rules
export default defineConfig({
  test: { environment: 'node', include: ['rules-tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
});
