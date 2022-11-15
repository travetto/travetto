#!/usr/bin/env node

// @ts-check
const { path, spawn } = require('@travetto/common');
const fs = require('fs/promises');

const recent = file => fs.stat(file).then(stat => Math.max(stat.ctimeMs, stat.mtimeMs));

async function isProjectStale(tsconfig) {
  const folder = path.dirname(tsconfig);
  const { files } = JSON.parse(await fs.readFile(tsconfig, 'utf8'));
  return Promise.all(files.map(async file => {
    const f = path.resolve(folder, file);
    const [l, r] = await Promise.all([recent(f), recent(f.replace(/[.]ts$/, '.js'))]);
    if (l > r) {
      throw new Error('Stale');
    }
  })).then(() => false, () => true);
}

// @ts-ignore
const log = global['__trv_boot_log__'] = process.env.DEBUG === 'build' ? console.debug.bind(console) : () => { };

/**
 * @param {{outputFolder: string, compilerFolder:string, main?: string, compile?: boolean, watch?: boolean}} cfg
 */
async function boot({ outputFolder, compilerFolder, compile, main, watch }) {
  let compilerTsConfig = undefined;

  // Skip compilation if not installed
  if (compile) {
    try {
      compilerTsConfig = require.resolve('@travetto/compiler/tsconfig.precompile.json');
    } catch { }

    if (compilerTsConfig) {
      if (await isProjectStale(compilerTsConfig)) {
        log(`[1] Bootstrap Rebuilding: ${compilerTsConfig}`);
        const TSC = require.resolve('typescript').replace(/\/lib\/.*/, '/bin/tsc');
        await spawn('Bootstrapping Compiler', TSC, { cwd: path.dirname(compilerTsConfig), args: ['-p', path.basename(compilerTsConfig)] });
      } else {
        log('[1] Bootstrap Rebuild Skipped.');
      }
      await require('@travetto/compiler/support/bin/build').build({
        compilerFolder, outputFolder, watch
      });
    }
  }

  // Only  manipulate if we aren't in the output folder
  if (outputFolder !== process.cwd()) {
    process.env.NODE_PATH = [`${outputFolder}/node_modules`, process.env.NODE_PATH].join(path.delimiter);
    // @ts-expect-error
    require('module').Module._initPaths();
  }

  // Share back so ModuleIndex will pick it up
  process.env.TRV_OUTPUT = outputFolder;

  if (main) {
    require('@travetto/boot/support/init');
    // eslint-disable-next-line no-undef
    ᚕtrv.main(require(main).main);
  }
}

module.exports = { boot };