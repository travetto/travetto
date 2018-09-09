#!/usr/bin/env node

// @ts-check

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const F_ROOT = fs.realpathSync(__dirname);
const ROOT = path.dirname(F_ROOT); // Move up from ./bin folder

function makeLink(actual, linkPath) {
  try {
    fs.lstatSync(linkPath);
  } catch (e) {
    fs.symlinkSync(actual, linkPath);
    fs.lstatSync(linkPath);
  }
}

function lernaSetup() {
  const config = require(`${ROOT}/lerna.json`);
  const configNew = { ...config,
    packages: config.packages.slice(0)
  };
  configNew.packages.push("sample/*");
  fs.writeFileSync(`${ROOT}/lerna.json`, JSON.stringify(configNew));

  cp.spawnSync('npx', ['lerna', 'clean', '--yes'], { stdio: [undefined, process.stdout, process.stderr] });
  cp.spawnSync('npx', ['lerna', 'bootstrap', '--hoist'], { stdio: [undefined, process.stdout, process.stderr] });

  fs.writeFileSync(`${ROOT}/lerna.json`, JSON.stringify(config, undefined, 2));

  fs.unlinkSync(`${ROOT}/package-lock.json`);
}

const resolveDeps = (function() {
  const PEER_DEPS = `${process.argv[2]}`.trim() !== '';
  const DEP_CACHE = {};
  const CORE_SCOPE = new Set(['dependencies', 'devDependencies']);
  const PEER_SCOPE = new Set(['peerDependencies', 'optionalExtensionDependencies']);
  const SCOPE = PEER_DEPS ? new Set([...CORE_SCOPE, ...PEER_SCOPE]) : CORE_SCOPE;
  const GLOBAL_PEER = new Set();

  function resolve(mod, base) {
    // Grab from cache
    if (DEP_CACHE[mod]) {
      return DEP_CACHE[mod];
    }

    const out = {
      peer: new Set(),
      regular: new Set()
    };

    // Open package.json
    const pkg = require(`${base}/${mod}/package.json`);

    // Loop through scopes
    for (const scope of SCOPE) {
      if (!pkg[scope]) {
        continue;
      }
      // Loop through dependencies
      for (const dep of Object.keys(pkg[scope])) {
        // If module
        if (dep.includes('@travetto')) {
          // Recurse
          const sub = resolve(dep.split('/')[1], base);

          // Share regular, but not peer
          out.regular = new Set([...out.regular, ...sub.regular]);
          out.regular.add(dep);

        } else if (PEER_SCOPE.has(scope)) { // If dealing with peer
          if (!GLOBAL_PEER.has(dep)) { // Load it once
            out.peer.add(dep);
            GLOBAL_PEER.add(dep);
          }
        }
      }
    }

    //Store
    return DEP_CACHE[mod] = out;
  }

  return resolve;
})();

const lernaModuleFinalize = (function() {
  const MOD_ROOT = `${ROOT}/module`;
  const MOD_TPL_ROOT = `${ROOT}/module-template`;
  const SAMPLE_ROOT = `${ROOT}/sample`;
  const NM_ROOT = `${ROOT}/node_modules`;
  const COMMON_LIBS = ['typescript', 'tslib'];
  const COMMON_BIN_SCRIPTS = [
    ['test', 'travetto-cli-test'],
    ['base', 'travetto-cli-clean'],
    ['base', 'travetto-cli-run'],
    ['compiler', 'travetto-cli-compile'],
    ['rest-aws-lambda', 'travetto-cli-aws-lambda'],
    ['swagger', 'travetto-cli-swagger-client']
  ];

  function finalize(mod, base) {
    // Fetch deps
    const deps = resolveDeps(mod, base);
    // deps.regular.add(`@travetto/${mod}`);
    deps.regular.add('@travetto/test');

    // wrt to module's node_modules
    const NM_MOD = `${base}/${mod}/node_modules`;

    // Copy over all files that match from template
    for (const f of fs.readdirSync(MOD_TPL_ROOT)) {
      const destFile = `${base}/${mod}/${f}`;
      if (fs.existsSync(destFile)) {
        fs.copyFileSync(`${MOD_TPL_ROOT}/${f}`, destFile);
      }
    }

    // Create necessary directories
    if (!fs.existsSync(NM_MOD)) { fs.mkdirSync(NM_MOD); }
    if (!fs.existsSync(`${NM_MOD}/@travetto`)) { fs.mkdirSync(`${NM_MOD}/@travetto`); }
    if (!fs.existsSync(`${NM_MOD}/.bin`)) { fs.mkdirSync(`${NM_MOD}/.bin`); }

    // Link common libraries
    for (const dep of COMMON_LIBS) {
      makeLink(`${NM_ROOT}/${dep}`, `${NM_MOD}/${dep}`);
    }

    // Link framework dependent modules
    for (const dep of new Set([...deps.regular, ...(resolveDeps('test', base).regular)])) {
      const sub = dep.split('@travetto/')[1];
      if (fs.existsSync(`${MOD_ROOT}/${sub}`)) {
        makeLink(`${MOD_ROOT}/${sub}`, `${NM_MOD}/${dep}`);
      } else if (fs.existsSync(`${SAMPLE_ROOT}/${sub}`)) {
        makeLink(`${SAMPLE_ROOT}/${sub}`, `${NM_MOD}/${dep}`);
      }
    }

    // Link common binary scripts
    for (const [smod, script] of COMMON_BIN_SCRIPTS) {
      try {
        if (fs.existsSync(`${NM_MOD}/@travetto/${smod}`) || mod === smod) {
          makeLink(`${MOD_ROOT}/${smod}/bin/${script}.js`, `${NM_MOD}/.bin/${script}`);
        }
      } catch (e) {}
    }

    // Link travetto cli
    makeLink(`${MOD_ROOT}/cli/bin/travetto.js`, `${NM_MOD}/.bin/travetto`);
  }

  return finalize;
})();

function init() {
  lernaSetup();

  for (const dir of ['module', 'sample']) {
    const base = `${ROOT}/${dir}`;
    for (const mod of fs.readdirSync(base)) {
      lernaModuleFinalize(mod, base);
    }
  }
}

if (require.main === module) {
  init();
}