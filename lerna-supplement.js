#!/usr/bin/env node

const fs = require('fs');

const ROOT = fs.realpathSync(__dirname);
const PEER_DEPS = `${process.argv[2]}`.trim() !== '';

const DEP_CACHE = {};
const CORE_SCOPE = new Set(['dependencies', 'devDependencies']);
const PEER_SCOPE = new Set(['peerDependencies', 'optionalExtensionDependencies']);
const SCOPE = PEER_DEPS ? new Set([...CORE_SCOPE, ...PEER_SCOPE]) : CORE_SCOPE;
const COMMON_LIBS = new Set(['typescript', 'tslib']);
const TEST_DEPS = resolveDeps('test');

const GLOBAL_PEER = new Set();

function resolveDeps(mod) {
  if (DEP_CACHE[mod]) {
    return DEP_CACHE[mod];
  }
  const out = {
    peer: new Set(),
    regular: new Set()
  };
  const pkg = require(`${ROOT}/module/${mod}/package.json`);

  for (const scope of SCOPE) {
    if (!pkg[scope]) {
      continue;
    }
    for (const dep of Object.keys(pkg[scope])) {
      if (dep.includes('@travetto')) {
        const sub = resolveDeps(dep.split('/')[1]);
        out.regular = new Set([...out.regular, ...sub.regular]);
        out.regular.add(dep);
      } else if (PEER_SCOPE.has(scope)) {
        if (!GLOBAL_PEER.has(dep)) {
          out.peer.add(dep);
          GLOBAL_PEER.add(dep);
        }
      }
    }
  }
  return DEP_CACHE[mod] = out;
}

function makeLink(actual, linkPath) {
  try {
    fs.lstatSync(linkPath);
  } catch (e) {
    fs.symlinkSync(actual, linkPath);
    fs.lstatSync(linkPath);
  }
}

function init(mod) {
  const deps = resolveDeps(mod);
  deps.regular.add(`@travetto/${mod}`);
  deps.regular.add('@travetto/test');
  const modNM = `${ROOT}/module/${mod}/node_modules`;

  if (!fs.existsSync(modNM)) { fs.mkdirSync(modNM); }
  if (!fs.existsSync(`${modNM}/@travetto`)) { fs.mkdirSync(`${modNM}/@travetto`); }
  if (!fs.existsSync(`${modNM}/.bin`)) { fs.mkdirSync(`${modNM}/.bin`); }

  for (const dep of COMMON_LIBS) {
    makeLink(`${ROOT}/node_modules/${dep}`, `${modNM}/${dep}`);
  }

  for (const dep of new Set([...deps.regular, ...TEST_DEPS.regular])) {
    makeLink(`${ROOT}/module/${dep.split('@travetto/')[1]}`, `${modNM}/${dep}`);
  }

  try {
    makeLink(`${ROOT}/module/test/bin/travetto-test.js`, `${modNM}/.bin/travetto-test`);
  } catch (e) {}
}

function initAll() {
  for (const mod of fs.readdirSync(`${ROOT}/module`)) {
    init(mod);
  }
}

if (require.main === module) {
  initAll();
}