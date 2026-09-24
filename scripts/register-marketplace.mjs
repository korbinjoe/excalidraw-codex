#!/usr/bin/env node
// Explicit registration, relocation, or rename. Normal updates never modify the catalog.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { registerPlugin } from './lib/marketplace.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--rename-from' || !args[1])) {
  throw new Error('Usage: npm run codex:register -- [--rename-from old-plugin-name]');
}
const manifest = JSON.parse(fs.readFileSync(path.join(source, '.codex-plugin/plugin.json')));
const creator = process.env.CODEX_PLUGIN_CREATOR_DIR || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills/.system/plugin-creator');
const file = path.join(os.homedir(), '.agents/plugins/marketplace.json');
const exists = fs.existsSync(file);
if (exists) execFileSync('python3', [path.join(creator, 'scripts/read_marketplace_name.py')], { stdio: 'inherit' });
const catalog = exists ? JSON.parse(fs.readFileSync(file)) : {
  name: 'personal', interface: { displayName: 'Personal' }, plugins: [],
};
const target = path.join(source, '.codex-build', manifest.name);
const next = registerPlugin(catalog, { name: manifest.name, target, root: os.homedir(), renameFrom: args[1] });
if (JSON.stringify(next) === JSON.stringify(catalog)) {
  console.log('Marketplace already points at ' + target);
  process.exit(0);
}
if (exists) {
  const backupDir = path.join(source, 'artifacts/marketplace-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, Date.now() + '.json'));
}
fs.mkdirSync(path.dirname(file), { recursive: true });
const temp = file + '.' + process.pid + '.tmp';
fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
fs.renameSync(temp, file);
console.log('Registered ' + manifest.name + ': ' + target);
