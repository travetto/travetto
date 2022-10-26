const Module = require('module');

const og = Module._resolveFilename.bind(Module);
// Hack Node module system to recognize our plugin.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
Module._resolveFilename = (r, ...args) => /plugin-travetto/.test(r) ? require.resolve('./.bin/eslint') : og(r, ...args);

const { ignorePatterns, plugins, rules, overrides, extends: ext, ...rest } = require('./bin/eslint/rules.json');
module.exports = {
  ...rest,
  ignorePatterns: [
    ...ignorePatterns,
    'module/scaffold/templates',
  ],
  extends: [...ext, 'plugin:travetto/all'],
  plugins: [...plugins, 'unused-imports'],
  overrides: [
    ...overrides,
    {
      files: 'module/{transformer,watch}/**',
      rules: {
        'no-restricted-imports': 0
      }
    },
    {
      files: 'module/boot/support/main.compiler.ts',
      rules: {
        'no-restricted-imports': 0
      }
    },
    {
      files: '{module,sample,global-test}/*/support/transform*',
      rules: {
        'no-restricted-imports': 0
      }
    },
    {
      files: '{module,global-test}/*/{test,doc,support/test}/**/*.{ts,js}',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      files: 'module/*/support/test.*.{ts,js}',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      files: 'related/{todo-app,travetto.github.io}/**/*.{ts,js}',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
  ],
  rules: {
    ...rules,
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn'
  }
};