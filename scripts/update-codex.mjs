#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stageSource, registeredTarget, syncSource, verifyTree } from './lib/deployment.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const creator = process.env.CODEX_PLUGIN_CREATOR_DIR || path.join(codexHome, 'skills', '.system', 'plugin-creator');
const helper = name => path.join(creator, 'scripts', name);
const marketplaceFile = path.join(os.homedir(), '.agents', 'plugins', 'marketplace.json');
const lock = path.join(source, '.codex-update.lock');
let temporary, acquired = false;

function run(command, args, quiet = false) {
  const result = spawnSync(command, args, { cwd: source, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!quiet || result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}). Installation was not reported as successful.`);
  return result.stdout.trim();
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(source, '.codex-plugin', 'plugin.json')));
  if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(manifest.name)) throw new Error('Invalid plugin name.');
  for (const name of ['read_marketplace_name.py', 'validate_plugin.py', 'update_plugin_cachebuster.py']) {
    if (!fs.existsSync(helper(name))) throw new Error(`Missing Codex plugin-creator helper: ${helper(name)}. Set CODEX_PLUGIN_CREATOR_DIR if it moved.`);
  }
  const marketplace = run('python3', [helper('read_marketplace_name.py')], true);
  if (!/^[A-Za-z0-9_-]+$/.test(marketplace)) throw new Error('Invalid marketplace name.');
  const target = registeredTarget(marketplaceFile, manifest.name, path.join(source, '.codex-build', manifest.name));
  if (source === target) throw new Error('The generated package must not replace the source repository.');
  if (!fs.existsSync(path.join(source, 'node_modules', 'vite', 'package.json'))) throw new Error('Install build dependencies first: npm ci');
  try { fs.mkdirSync(lock); acquired = true; fs.writeFileSync(path.join(lock, 'pid'), String(process.pid)); }
  catch { throw new Error(`Another update may be running. Check ${lock}/pid before removing a stale lock.`); }

  console.log('1/5 Test and build the maintenance repository');
  run('npm', ['test']);
  run('npm', ['run', 'build'], true);
  console.log('Frontend build completed.');

  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-codex-update-'));
  const stage = path.join(temporary, manifest.name);
  stageSource(source, stage);
  console.log('2/5 Validate package and generate the Codex update version');
  run('python3', [helper('validate_plugin.py'), stage]);
  run('python3', [helper('update_plugin_cachebuster.py'), stage]);
  run('python3', [helper('validate_plugin.py'), stage]);

  console.log(`3/5 Generate marketplace package: ${target}`);
  syncSource(stage, target);
  verifyTree(stage, target);
  run('python3', [helper('validate_plugin.py'), target]);
  console.log(`4/5 Install ${manifest.name}@${marketplace}`);
  const output = run('codex', ['plugin', 'add', `${manifest.name}@${marketplace}`]);
  const installedRoot = output.match(/^Installed plugin root:\s*(.+)$/m)?.[1]?.trim();
  if (!installedRoot) throw new Error('Codex did not report the installed root; inspect codex plugin list.');
  console.log('5/5 Verify the installed copy matches the built package');
  const fileCount = verifyTree(stage, installedRoot);
  const installed = JSON.parse(fs.readFileSync(path.join(installedRoot, '.codex-plugin', 'plugin.json')));
  const report = { source, target, installedRoot, version: installed.version, fileCount, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(source, '.local-deploy.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Updated ${installed.version}; verified ${fileCount} files.\nStart a new Codex task to load the updated skill. Existing canvas processes continue running their old server code; reopen/restart the relevant canvas when testing runtime changes.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  if (acquired) fs.rmSync(lock, { recursive: true, force: true });
}
