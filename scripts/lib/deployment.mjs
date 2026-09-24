import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// User drawings and old release archives are not owned by the code synchronizer.
export const excluded = new Set(['node_modules', '.git', 'release', 'artifacts', 'diagrams', 'examples', '.local-deploy.json', '.codex-update.lock', '.codex-build', '.DS_Store', '.playwright-cli']);

export function stageSource(source, stage) {
  fs.cpSync(source, stage, {
    recursive: true,
    filter: candidate => {
      const relative = path.relative(source, candidate);
      return !relative.split(path.sep).some(part => excluded.has(part));
    },
  });
}

export function registeredTarget(marketplaceFile, name, expectedTarget) {
  const catalog = JSON.parse(fs.readFileSync(marketplaceFile, 'utf8'));
  const entry = catalog.plugins?.find(item => item.name === name);
  if (!entry || entry.source?.source !== 'local') throw new Error(`${name} is not registered as a local plugin in ${marketplaceFile}`);
  const root = path.resolve(path.dirname(marketplaceFile), '../..');
  const target = path.resolve(root, entry.source.path);
  if (target !== path.resolve(expectedTarget)) throw new Error(`Marketplace points at ${target}; expected ${expectedTarget}. No files changed.`);
  return target;
}

export function syncSource(stage, target) {
  fs.mkdirSync(target, { recursive: true });
  execFileSync('rsync', ['-a', '--checksum', '--delete', ...[...excluded].map(name => `--exclude=${name}`), stage + path.sep, target + path.sep], { stdio: 'inherit' });
}

export function verifyTree(source, target) {
  let count = 0;
  function walk(relative = '') {
    for (const item of fs.readdirSync(path.join(source, relative), { withFileTypes: true })) {
      const name = path.join(relative, item.name);
      if (item.isDirectory()) walk(name);
      else if (item.isFile()) {
        const counterpart = path.join(target, name);
        if (!fs.existsSync(counterpart) || !fs.readFileSync(path.join(source, name)).equals(fs.readFileSync(counterpart))) throw new Error(`Installed copy differs: ${name}`);
        count++;
      } else throw new Error(`Unsupported package entry: ${name}`);
    }
  }
  walk();
  return count;
}
