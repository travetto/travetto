#!/usr/bin/env node

const fs = require('fs');

const root = process.cwd().replace(/[\\]/g, '/');

function collectPackages(folder, seen = new Set()) {
  const { name, dependencies = {}, devDependencies = {}, peerDependencies = {}, travettoModule = false } = JSON.parse(fs.readFileSync(`${folder}/package.json`, 'utf8'));
  if (seen.has(name)) {
    return [];
  }
  const isModule = name.startsWith('@travetto') || travettoModule;
  const out = [{ name, folder, isModule }];
  seen.add(name);
  const searchSpace = [
    ...Object.keys(dependencies),
    ...[...Object.keys(devDependencies)].filter(x => x.startsWith('@travetto/')),
    ...[...Object.keys(peerDependencies)].filter(x => x.startsWith('@travetto/')),
  ].sort();

  for (const el of searchSpace) {
    try {
      const next = require.resolve(el).replace(/[\\]/g, '/')
        .replace(new RegExp(`^(.*node_modules/${el})(.*)$`), (_, first) => first);
      out.push(...collectPackages(next, seen));
    } catch (e) {
      if (process.env.TRV_DEV && el.startsWith('@travetto')) {
        out.push(...collectPackages(el.replace('@travetto', process.env.TRV_DEV), seen));
      }
    }
  }
  return out;
}

/**
 *
 * @param {string} folder
 * @returns {string[]}
 */
function scanFolder(folder, includeTopFolders = new Set()) {
  const out = [];
  if (!fs.existsSync(folder)) {
    return out;
  }
  const stack = [[folder, 0]];
  while (stack.length) {
    const [top, depth] = stack.pop();
    for (const sub of fs.readdirSync(top)) {
      const stat = fs.statSync(`${top}/${sub}`);
      if (stat.isFile()) {
        out.push(`${top}/${sub}`);
      } else {
        if (!sub.includes('node_modules') && !sub.startsWith('.') && (depth > 0 || !includeTopFolders.size || includeTopFolders.has(sub))) {
          stack.push([`${top}/${sub}`, depth + 1]);
        }
      }
    }
  }
  return out;
}

/**
 *
 * @param {string} file
 * @returns {[string, string]}
 */
function transformFile(file) {
  return [file, file.endsWith('.d.ts') ? 'd.ts' : (
    file.endsWith('.ts') ? 'ts' : (
      (file.endsWith('.js') || file.endsWith('mjs') || file.endsWith('.cjs')) ? 'js' :
        (file.endsWith('.json') ? 'json' : 'unknown')
    ))];
}

function describeModule({ name, folder }) {
  const files = scanFolder(folder, folder !== root ? new Set(['src', 'bin', 'support']) : new Set())
    .reduce((acc, p) => {
      // Group by top folder
      const rel = p.replace(`${folder}/`, '');
      if (!rel.includes('/')) { // If a file
        if (rel === 'index.ts') {
          acc.index = [transformFile(rel)];
        } else if (rel === 'doc.ts') {
          acc.docIndex = [transformFile(rel)];
        } else {
          (acc['rootFiles'] ??= []).push(transformFile(rel));
        }
      } else {
        const sub = rel.match(/^((?:test\/resources)|[^/]+)/)[0];
        (acc[sub] ??= []).push(transformFile(rel));
      }
      return acc;
    }, {});

  // Refine non-main module
  if (folder !== root) {
    files.rootFiles = files.rootFiles.filter(([file, type]) => type !== 'ts');
  }

  return {
    name,
    source: folder,
    output: folder === root ? '' : `node_modules/${name}`,
    files
  };
}

function buildManifestModules() {
  const modules = collectPackages(root)
    .filter(x => x.isModule);
  if (process.env.TRV_DEV) {
    modules.unshift({
      name: '@travetto/cli',
      folder: `${process.env.TRV_DEV}/cli`,
      isModule: true,
    });
  }
  return modules.map(x => describeModule(x));
}

if (require.main === module) {
  console.log(JSON.stringify(buildManifestModules()));
}

module.exports = {
  root,
  buildManifestModules
};