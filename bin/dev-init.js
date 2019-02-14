#!/usr/bin/env node

// @ts-check

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const F_ROOT = fs.realpathSync(__dirname).replace(/[\\\/]+/g, '/');
const ROOT = path.dirname(F_ROOT).replace(/[\\\/]+/g, '/'); // Move up from ./bin folder

function makeDir(dir) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir.replace(/[\\\/]+/g, path.sep));
    } catch (e) {
      // Do nothing
    }
  }
}

function makeLink(actual, linkPath) {
  try {
    fs.lstatSync(linkPath);
  } catch (e) {
    const local = fs.statSync(actual);
    const file = local.isFile();
    fs.symlinkSync(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
    fs.lstatSync(linkPath);
  }
}

function lernaSetup() {
  cp.spawnSync('npx', ['lerna', 'clean', '--yes'], { stdio: [undefined, process.stdout, process.stderr], shell: true });
  cp.spawnSync('npx', ['lerna', 'bootstrap', '--hoist'], { stdio: [undefined, process.stdout, process.stderr], shell: true });

  try {
    fs.unlinkSync(`${ROOT}/package-lock.json`);
  } catch (e) {}
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
  const NM_ROOT = `${ROOT}/node_modules`;
  const COMMON_LIBS = ['typescript', 'tslib'];
  const COMMON_BIN_SCRIPTS = [
    ['cli', 'travetto-cli'],
    ['test', 'travetto-cli-test'],
    ['base', 'travetto-cli-clean'],
    ['di', 'travetto-cli-run'],
    ['email-template', 'travetto-cli-email-template'],
    ['compiler', 'travetto-cli-compile'],
    ['rest-aws-lambda', 'travetto-cli-aws-lambda'],
    ['swagger', 'travetto-cli-swagger-client']
  ];

  function copyTemplateFiles(src, base) {
    for (const f of fs.readdirSync(src)) {
      const srcFile = `${src}/${f}`;
      const destFile = `${base}/${f}`;
      if (fs.statSync(srcFile).isFile() && fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }

  function finalize(mod, base, onlyModules) {
    // Fetch deps
    const deps = resolveDeps(mod, base);
    // deps.regular.add(`@travetto/${mod}`);
    deps.regular.add('@travetto/test');

    // wrt to module's node_modules
    const NM_MOD = `${base}/${mod}/node_modules`;

    // Copy over all files that match from template
    if (!onlyModules) {
      copyTemplateFiles(MOD_TPL_ROOT, `${base}/${mod}`);
    }
    // copyTemplateFiles(`${MOD_TPL_ROOT}/test`, `${base}/${mod}/test`);

    // Create necessary directories
    makeDir(NM_MOD);
    makeDir(`${NM_MOD}/@travetto`);
    makeDir(`${NM_MOD}/.bin`);

    // Link common libraries
    for (const dep of COMMON_LIBS) {
      makeLink(`${NM_ROOT}/${dep}`, `${NM_MOD}/${dep}`);
    }

    // Link framework dependent modules
    for (const dep of new Set([...deps.regular, ...(resolveDeps('test', base).regular), '@travetto/cli'])) {
      const sub = dep.split('@travetto/')[1];
      if (fs.existsSync(`${MOD_ROOT}/${sub}`)) {
        makeLink(`${MOD_ROOT}/${sub}`, `${NM_MOD}/${dep}`);
      }
    }

    // Link common binary scripts
    for (const [smod, script] of COMMON_BIN_SCRIPTS) {

      if (fs.existsSync(`${NM_MOD}/.bin/${script}.cmd`)) {
        fs.unlinkSync(`${NM_MOD}/.bin/${script}.cmd`);
        fs.unlinkSync(`${NM_MOD}/.bin/${script}`);
      }

      try {
        if (fs.existsSync(`${NM_MOD}/@travetto/${smod}`) || mod === smod) {
          makeLink(`${MOD_ROOT}/${smod}/bin/${script}.js`, `${NM_MOD}/.bin/${script}`);
        }
      } catch (e) {}
    }

    // Link travetto cli
    for (const f of fs.readdirSync(`${MOD_ROOT}/cli/bin`)) {
      makeLink(`${MOD_ROOT}/cli/bin/${f}`, `${NM_MOD}/.bin/${f.replace(/[.][jt]s$/, '')}`);
    }
  }

  return finalize;
})();

function init() {
  lernaSetup();

  for (const dir of ['module']) {
    const base = `${ROOT}/${dir}`;
    for (const mod of fs.readdirSync(base)) {
      lernaModuleFinalize(mod, base, true);
    }
  }
}

if (require.main === module) {
  init();
}