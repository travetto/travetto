// @ts-check
const fs = require('fs/promises');
const path = require('path');
const { default: multiInput } = require('rollup-plugin-multi-input');
const { default: commonjsRequire } = require('@rollup/plugin-commonjs');
const { default: nodeResolve } = require('@rollup/plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');

/** @type {import('rollup-plugin-sourcemaps')['default']} */
// @ts-expect-error
const sourceMaps = require('rollup-plugin-sourcemaps');

/** @type {import('@travetto/manifest')} */
const { RootIndex } = require(path.resolve('node_modules/@travetto/manifest'));
const modSet = RootIndex.getModuleList('all');

const modules = [...modSet]
  .map(x => RootIndex.manifest.modules[x])
  .filter(m => m.profiles.includes('std'));

const out = path.resolve(process.env.TRV_PACK_OUTPUT ?? 'dist');

/** @type {import('rollup').RollupOptions} */
module.exports = {
  // use glob in the input
  input: [
    ...modules.flatMap(m => [
      `${m.output}/src/**/*.js`,
      `${m.output}/bin/**/*.js`,
      `${m.output}/support/**/*.js`
    ]),
    '!**/support/transformer.*.js',
    '!**/DOC.ts'
  ],
  output: {
    format: 'commonjs',
    sourcemap: true,
    sourcemapExcludeSources: false,
    dir: out
  },
  plugins: [
    {
      async buildStart() {
        await fs.rm(out, { recursive: true });
      },
    },
    multiInput(),
    sourceMaps(),
    commonjsRequire({
      dynamicRequireTargets: [
        ...modules.flatMap(m => [
          `${m.output}/src/**/*.js`,
          `${m.output}/bin/**/*.js`,
          `${m.output}/support/**/*.js`
        ]),
        '!**/support/transformer*.js',
        '!**/DOC.ts'
      ],
    }),
    terser({
      compress: {
        unused: false,
        collapse_vars: false
      },
      output: {
        comments: false
      }
    }),
    nodeResolve({ preferBuiltins: true }),
    {
      async buildEnd() {
        for (const mod of modules) {
          await fs.mkdir(path.resolve(out, mod.output), { recursive: true });
          await fs.copyFile(path.resolve(mod.output, 'package.json'), path.resolve(out, mod.output, 'package.json'));
        }
        const main = RootIndex.manifest.modules[RootIndex.manifest.mainModule];
        await fs.writeFile(path.resolve(out, main.output, 'manifest.json'), JSON.stringify({
          ...RootIndex.manifest,
          outputFolder: path.dirname(out),
          modules: Object.fromEntries(
            Object.entries(RootIndex.manifest.modules)
              .filter(([k, m]) => m.profiles.includes('std'))
          )
        }));
      }
    }
  ],
};