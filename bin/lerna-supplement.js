#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const F_ROOT = fs.realpathSync(__dirname);
const ROOT = path.dirname(F_ROOT); // Move up from ./bin folder

const MOD_ROOT = `${ROOT}/module`;
const MOD_TPL_ROOT = `${ROOT}/module-template`;
const SAMPLE_ROOT = `${ROOT}/sample`;
const NM_ROOT = `${ROOT}/node_modules`;

const PEER_DEPS = `${process.argv[2]}`.trim() !== '';

const DEP_CACHE = {};
const CORE_SCOPE = new Set(['dependencies', 'devDependencies']);
const PEER_SCOPE = new Set(['peerDependencies', 'optionalExtensionDependencies']);
const SCOPE = PEER_DEPS ? new Set([...CORE_SCOPE, ...PEER_SCOPE]) : CORE_SCOPE;
const COMMON_LIBS = new Set(['typescript', 'tslib']);
const TEST_DEPS = resolveDeps('test', MOD_ROOT);

const GLOBAL_PEER = new Set();

function resolveDeps(mod, base) {
  if (DEP_CACHE[mod]) {
    return DEP_CACHE[mod];
  }
  const out = {
    peer: new Set(),
    regular: new Set()
  };
  const pkg = require(`${base}/${mod}/package.json`);

  for (const scope of SCOPE) {
    if (!pkg[scope]) {
      continue;
    }
    for (const dep of Object.keys(pkg[scope])) {
      if (dep.includes('@travetto')) {
        const sub = resolveDeps(dep.split('/')[1], MOD_ROOT);
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

function init(mod, base) {
  const deps = resolveDeps(mod, base);
  deps.regular.add(`@travetto/${mod}`);
  deps.regular.add('@travetto/test');
  const NM_MOD = `${base}/${mod}/node_modules`;

  for (const f of fs.readdirSync(MOD_TPL_ROOT)) {
    const destFile = `${base}/${mod}/${f}`;
    if (fs.existsSync(destFile)) {
      fs.copyFileSync(`${MOD_TPL_ROOT}/${f}`, destFile);
    }
  }

  if (!fs.existsSync(NM_MOD)) { fs.mkdirSync(NM_MOD); }
  if (!fs.existsSync(`${NM_MOD}/@travetto`)) { fs.mkdirSync(`${NM_MOD}/@travetto`); }
  if (!fs.existsSync(`${NM_MOD}/.bin`)) { fs.mkdirSync(`${NM_MOD}/.bin`); }

  for (const dep of COMMON_LIBS) {
    makeLink(`${NM_ROOT}/${dep}`, `${NM_MOD}/${dep}`);
  }

  for (const dep of new Set([...deps.regular, ...TEST_DEPS.regular])) {
    const sub = dep.split('@travetto/')[1];
    if (fs.existsSync(`${MOD_ROOT}/${sub}`)) {
      makeLink(`${MOD_ROOT}/${sub}`, `${NM_MOD}/${dep}`);
    } else if (fs.existsSync(`${SAMPLE_ROOT}/${sub}`)) {
      makeLink(`${SAMPLE_ROOT}/${sub}`, `${NM_MOD}/${dep}`);
    }
  }

  const scripts = [
    ['test', 'travetto-cli-test'],
    ['base', 'travetto-cli-clean'],
    ['base', 'travetto-cli-run'],
    ['swagger', 'travetto-cli-swagger-client'],
    ['base', 'travetto']
  ];

  for (const [smod, script] of scripts) {
    try {
      if (fs.existsSync(`${NM_MOD}/@travetto/${smod}`) || mod === smod) {
        makeLink(`${MOD_ROOT}/${smod}/bin/${script}.js`, `${NM_MOD}/.bin/${script}`);
      }
    } catch (e) {}
  }

}

function initAll() {
  for (const base of [MOD_ROOT, SAMPLE_ROOT]) {
    for (const mod of fs.readdirSync(base)) {
      init(mod, base);
    }
  }
}

if (require.main === module) {
  initAll();
}