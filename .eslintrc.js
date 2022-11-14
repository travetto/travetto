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
    'module/boot/support/bin/*.js'
  ],
  extends: [...ext, 'plugin:travetto/all'],
  plugins: [...plugins, 'unused-imports'],
  overrides: [
    ...overrides,
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn'
      }
    },
    {
      files: 'module/{transformer,watch}/**',
      rules: {
        'no-restricted-imports': 0
      }
    },
    {
      files: 'module/boot/support/bin/compiler*.ts',
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
      files: '{module,related}/*/doc/**/*.ts',
      rules: {
        'max-len': 0,
        '@typescript-eslint/quotes': 'warn',
        '@typescript-eslint/indent': 0,
      }
    },
    {
      files: '{module,global-test}/*/{test,doc,support/test}/**/*.ts',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      files: 'sample/*/**/*.ts',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      files: 'module/scaffold/support/resources/**/*.ts',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      files: 'module/*/support/test.*.ts',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      files: 'related/{todo-app,travetto.github.io}/**/*.ts',
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
  ],
  rules: {
    ...rules,
    'unused-imports/no-unused-imports': 'error',
  }
};