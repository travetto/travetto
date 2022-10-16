#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const { buildManifestModules, root } = require('./manifest');

const staging = `${root}/.trv_compiler_staging`;
const output = `${root}/.trv_compiler`

const modules = buildManifestModules();
const transformingModules = modules
  .filter(x => x.name === '@travetto/transformer' ||
    (x.files.support?.find(([name, type]) => type === 'ts' && name.startsWith('support/transform'))))


const NODE_VERSION = process.env.TRV_NODE_VERSION ?? process.version
  .replace(/^.*?(\d+).*?$/, (_, v) => v);

const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ESNext',
  16: 'ESNext'
})[NODE_VERSION] ?? 'ESNext'; // Default if not found


function buildTsconfig() {
  const transformer = transformingModules.find(x => x.name === '@travetto/transformer');
  const projTsconfig = path.resolve(root, 'tsconfig.json');
  const baseTsconfig = path.resolve(transformer.source, 'tsconfig.trv.json');
  // Fallback to base tsconfig if not found in local folder
  const config = fs.existsSync(projTsconfig) ? projTsconfig : baseTsconfig;

  const tsconfig = {
    extends: config,
    compilerOptions: {
      rootDir: path.resolve(staging),
      outDir: output,
      skipLibCheck: true,
      target: TS_TARGET,
    },
    "files": [
      ...[...transformer.files.src, ...transformer.files.support, ...transformer.files.index]
        .map(x => `${staging}/${transformer.output}/${x[0]}`),
      ...transformingModules.flatMap(x =>
        x.files.support?.
          filter(y => y[0].startsWith('support/transform'))
          .map(y => `${staging}/${x.output}/${y[0]}`))
    ]
  };

  return tsconfig;
}

function setupEnv() {
  fs.rmSync(`${output}`, { recursive: true, force: true });

  fs.rmSync(`${staging}`, { recursive: true, force: true });

  // May only be needed in dev mode
  fs.mkdirSync(`${staging}`, { recursive: true });
  fs.mkdirSync(`${staging}/node_modules/@travetto`, { recursive: true });
  for (const el of transformingModules) {
    if (el.output) {
      fs.symlinkSync(el.source, `${staging}/${el.output}`);
    } else {
      for (const f of ['support']) {
        fs.symlinkSync(`${el.source}/${f}`, `${staging}/${f}`);
      }
    }
  }
  fs.writeFileSync(`${staging}/tsconfig.json`, JSON.stringify(buildTsconfig(), null, 2));
  cp.spawnSync(require.resolve('typescript').replace(/\/lib.*$/, '/bin/tsc'), { cwd: staging });
  fs.writeFileSync(`${output}/manifest.json`, JSON.stringify(modules));
  fs.writeFileSync(`${output}/compile.js`, `require('@travetto/transformer/support/compiler').Compiler.run('${output}');`)
}

setupEnv();