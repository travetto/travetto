import fs from 'node:fs';

/**
 * Scans for installed node modules from package lock files or package.json.
 *
 * @returns An array of module names and package identifiers.
 */
function findInstalledNodeModules() {
  for (const file of [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'package.json',
  ]) {
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      const found = text.matchAll(/[a-z][a-z\-_0-9]+/gi);
      return [...new Set([...found].map(match => match[0]))];
    }
  }
  return [];
}

export default {
  dictionaryDefinitions: [
    {
      name: 'installed-node-modules',
      words: findInstalledNodeModules()
    }
  ],
  dictionaries: ['installed-node-modules']
};
