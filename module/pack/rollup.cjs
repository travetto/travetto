// @ts-check
const fs = require('fs/promises');
const path = require('path');
const inp = require('rollup-plugin-multi-input');
const dep = require('@rollup/plugin-commonjs');
const res = require('@rollup/plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');

/** @type {import('@travetto/manifest')} */
const { RootIndex } = require(path.resolve('node_modules/@travetto/manifest'));
const modSet = RootIndex.getModuleList('all');

const modules = [...modSet]
  .map(x => RootIndex.manifest.modules[x])
  .filter(m => m.profiles.includes('std'));

const out = process.env.TRV_PACK_OUTPUT ?? 'dist';

/** @type {import('rollup').RollupOptions} */
module.exports = {
  // use glob in the input
  input: [
    ...modules.flatMap(m => [
      `${m.output}/src/**/*.js`,
      `${m.output}/support/**/*.js`
    ]),
    '!**/support/transformer.*.js',
    '!**/DOC.ts'
  ],
  output: {
    format: 'commonjs',
    exports: 'named',
    dir: out
  },
  plugins: [
    {
      async buildStart() {
        await fs.rm(out, { recursive: true });
      },
    },
    inp.default(),
    terser({
      compress: {
        unused: false,
        collapse_vars: false
      },
      output: {
        comments: false
      }
    }),
    dep.default({
      dynamicRequireTargets: [
        ...modules.flatMap(m => [
          `${m.output}/src/**/*.js`,
          `${m.output}/support/**/*.js`
        ]),
        '!**/support/transformer*.js',
        '!**/DOC.ts'
      ],
    }),
    res.default({ preferBuiltins: true }),
    {
      async buildEnd() {
        for (const mod of modules) {
          await fs.mkdir(path.resolve(out, mod.output), { recursive: true });
          await fs.copyFile(path.resolve(mod.output, 'package.json'), path.resolve(out, mod.output, 'package.json'));
        }
        const main = RootIndex.manifest.modules[RootIndex.manifest.mainModule];
        await fs.copyFile(path.resolve(main.output, 'manifest.json'), path.resolve(out, main.output, 'manifest.json'));
      }
    }
  ],
};