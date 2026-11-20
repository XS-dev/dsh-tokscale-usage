// Run the native panel's isolated rendering and request lifecycle tests.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tests = ['client-render.test.mjs', 'catalog-ui.test.mjs']
  .map(name => fileURLToPath(new URL(`../test/${name}`, import.meta.url)));
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
