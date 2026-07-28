import { run } from './pipeline.js';

run().catch((err) => {
  console.error('[run] fatal:', err);
  process.exitCode = 1;
});
