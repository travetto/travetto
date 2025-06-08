const cp = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const toPosix = pth => pth.replaceAll('\\', '/');
const loadPackage = (file) => ({ ...JSON.parse(readFileSync(file, 'utf8')), path: toPosix(path.dirname(file)) });

function findPackage(base, pred) {
  let folder = `${base}/.`;
  let prev;
  let pkg;
  const packages = [];

  do {
    pkg && packages.push(pkg);
    prev = folder;
    folder = path.dirname(folder);
    const folderPkg = path.resolve(folder, 'package.json');
    pkg = existsSync(folderPkg) ? loadPackage(folderPkg) : pkg;
  } while (
    prev !== folder && // Not at root
    !pred(pkg) && // Matches criteria
    !existsSync(path.resolve(folder, '.git')) // Not at source root
  );

  if (!pkg) {
    return;
  } else if (!pred(pkg) && packages.length) {
    // We never matched, lets fallback to the first package.json found
    pkg = packages[0];
  }

  return pkg;
}

function collectModules() {
  const workspaceRoot = findPackage(process.cwd(), pkg => !!pkg && existsSync(path.resolve(pkg.path, 'pnpm-workspace.yaml')))?.path;
  if (!workspaceRoot) {
    return {};
  }
  const json = cp.execSync('pnpm ls -r --depth -1 --json', { cwd: workspaceRoot, encoding: 'utf8' });
  const mods = Object.fromEntries(JSON.parse(json).map(x => [x.name, x]));
  for (const k of Object.keys(mods)) {
    if (mods[k].path === workspaceRoot) {
      mods[k].root = true;
    }
  }
  return mods;
}

let WORKSPACE_MODULES;

function readPackage(pkg, context) {
  const workspacesMods = WORKSPACE_MODULES ??= collectModules();
  if (!(pkg.name in workspacesMods)) {
    return pkg;
  }

  if (workspacesMods[pkg.name].root) { // Monorepo root
    for (const name of Object.keys(workspacesMods)) {
      if (name !== pkg.name) {
        (pkg.dependencies ??= {})[name] = 'workspace:*';
      }
    }
  } else {
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const name of Object.keys(pkg[key] ?? {})) {
        if (name in workspacesMods) {
          delete pkg[key][name];
        }
      }
    }
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};