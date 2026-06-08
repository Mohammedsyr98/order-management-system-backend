import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vitestPath = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url)
);

const withSystemCa = (nodeOptions = '') => {
  const options = nodeOptions.split(/\s+/).filter(Boolean);

  if (!options.includes('--use-system-ca')) {
    options.push('--use-system-ca');
  }

  return options.join(' ');
};

const testEnv = {
  ...process.env,
  NODE_OPTIONS: withSystemCa(process.env.NODE_OPTIONS),
};

const result = spawnSync(
  process.execPath,
  [vitestPath, ...process.argv.slice(2)],
  {
    env: testEnv,
    stdio: 'inherit',
  }
);

if (result.error) {
  throw result.error;
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(result.status ?? 1);
