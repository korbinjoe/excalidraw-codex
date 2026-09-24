import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageSource, registeredTarget, syncSource, verifyTree } from '../scripts/lib/deployment.mjs';
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
function setup(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-deploy-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
test('deployment propagates changes and deletions while preserving drawings and excluding development state', t => {
  const dir = setup(t), source = path.join(dir, 'repo'), stage = path.join(dir, 'stage'), target = path.join(dir, 'plugin');
  write(path.join(source, 'runtime/server.mjs'), 'new-code'); write(path.join(source, '.codex-plugin/plugin.json'), '{}');
  for (const name of ['node_modules', '.git', 'release', 'diagrams', 'examples', '.codex-update.lock', '.codex-build']) write(path.join(source, name, 'private'), 'excluded');
  write(path.join(source, '.local-deploy.json'), 'excluded');
  write(path.join(target, 'runtime/server.mjs'), 'old-code'); write(path.join(target, 'runtime/deleted.mjs'), 'obsolete'); write(path.join(target, 'examples/user.excalidraw'), 'keep me');
  stageSource(source, stage); syncSource(stage, target);
  assert.equal(fs.readFileSync(path.join(target, 'runtime/server.mjs'), 'utf8'), 'new-code');
  assert.equal(fs.existsSync(path.join(target, 'runtime/deleted.mjs')), false);
  assert.equal(fs.readFileSync(path.join(target, 'examples/user.excalidraw'), 'utf8'), 'keep me');
  assert.equal(fs.existsSync(path.join(target, 'diagrams')), false); assert.equal(fs.existsSync(path.join(target, '.codex-build')), false); assert.equal(fs.existsSync(path.join(target, 'node_modules')), false); assert.equal(fs.existsSync(path.join(target, '.local-deploy.json')), false);
  assert.equal(verifyTree(stage, target), 2);
  write(path.join(target, 'runtime/server.mjs'), 'different'); assert.throws(() => verifyTree(stage, target), /differs/);
});
test('unexpected marketplace destinations are rejected before synchronization', t => {
  const dir = setup(t), catalog = path.join(dir, '.agents/plugins/marketplace.json');
  write(catalog, JSON.stringify({plugins:[{name:'excalidraw-codex',source:{source:'local',path:'./plugins/excalidraw-codex'}}]}));
  assert.equal(registeredTarget(catalog, 'excalidraw-codex', path.join(dir, 'plugins/excalidraw-codex')), path.join(dir, 'plugins/excalidraw-codex'));
  assert.throws(() => registeredTarget(catalog, 'excalidraw-codex', path.join(dir, 'some-other-plugin')), /expected/);
});

test('first registration and rename preserve unrelated catalog data and entry order', async () => {
  const { registerPlugin } = await import('../scripts/lib/marketplace.mjs');
  const options = { name: 'excalidraw-codex', root: '/home/user', target: '/home/user/work/repo/.codex-build/excalidraw-codex' };
  const unrelated = { name: 'other', source: { source: 'local', path: './other' } };
  const empty = { name: 'personal', interface: { displayName: 'My tools' }, plugins: [unrelated] };
  const created = registerPlugin(empty, options);
  assert.equal(empty.plugins.length, 1);
  assert.deepEqual(created.plugins[0], unrelated);
  assert.equal(created.plugins[1].policy.installation, 'AVAILABLE');
  assert.equal(created.plugins[1].source.path, './work/repo/.codex-build/excalidraw-codex');
  const original = { ...empty, plugins: [{ ...created.plugins[1], name: 'old-plugin', extra: 'preserve' }, unrelated] };
  const renamed = registerPlugin(original, { ...options, renameFrom: 'old-plugin' });
  assert.equal(original.plugins[0].name, 'old-plugin');
  assert.equal(renamed.plugins[0].name, 'excalidraw-codex');
  assert.equal(renamed.plugins[0].extra, 'preserve');
  assert.deepEqual(renamed.plugins[1], unrelated);
  assert.deepEqual(renamed.interface, original.interface);
  assert.deepEqual(registerPlugin(renamed, options), renamed);
});

test('registration refuses name collisions, ambiguous entries, remote sources, and escaping paths', async () => {
  const { registerPlugin } = await import('../scripts/lib/marketplace.mjs');
  const options = { name: 'excalidraw-codex', root: '/home/user', target: '/home/user/work/repo/.codex-build/excalidraw-codex', renameFrom: 'old-plugin' };
  const old = { name: 'old-plugin', source: { source: 'local', path: './old' } };
  assert.throws(() => registerPlugin({ plugins: [old, { ...old, name: options.name }] }, options), /already registered/);
  assert.throws(() => registerPlugin({ plugins: [old, old] }, options), /Duplicate/);
  assert.throws(() => registerPlugin({ plugins: [] }, options), /not registered/);
  assert.throws(() => registerPlugin({ plugins: [{ ...old, source: { source: 'remote' } }] }, options), /non-local/);
  assert.throws(() => registerPlugin({ plugins: [old] }, { ...options, target: '/home/user-other/repo' }), /inside/);
  assert.throws(() => registerPlugin({ plugins: [old] }, { ...options, name: '../escape' }), /Invalid/);
});
