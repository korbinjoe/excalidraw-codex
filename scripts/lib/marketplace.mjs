import path from 'node:path';

const validName = value => /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value);

export function registerPlugin(catalog, { name, target, root, renameFrom }) {
  if (!validName(name) || (renameFrom && !validName(renameFrom))) throw new Error('Invalid plugin name.');
  if (!Array.isArray(catalog.plugins)) throw new Error('Invalid marketplace plugins list.');
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Repository must be inside the personal marketplace root (home directory).');
  }
  const next = structuredClone(catalog);
  const matches = next.plugins.filter(entry => entry.name === (renameFrom || name));
  if (matches.length > 1) throw new Error('Duplicate marketplace entries; refusing an ambiguous update.');
  if (renameFrom && matches.length !== 1) throw new Error('The plugin to rename is not registered.');
  if (renameFrom && renameFrom !== name && next.plugins.some(entry => entry.name === name)) {
    throw new Error('The new plugin name is already registered.');
  }
  let entry = matches[0];
  if (entry && entry.source?.source !== 'local') throw new Error('Refusing to replace a non-local source.');
  if (!entry) {
    entry = {
      name,
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Productivity',
    };
    next.plugins.push(entry);
  }
  entry.name = name;
  entry.source = { source: 'local', path: './' + relative.split(path.sep).join('/') };
  return next;
}
