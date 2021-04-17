require('@travetto/boot/bin/register');
const Module = require('module');

const og = Module._resolveFilename.bind(Module);
// Hack Node module system to recognize our plugin.
Module._resolveFilename = (r, ...args) => /plugin-travetto/.test(r) ? require.resolve('./bin/eslint') : og(r, ...args);

const { ignorePatterns, plugins, rules, extends: ext, ...rest } = require('./bin/eslint/rules.json');
module.exports = {
  ...rest,
  ignorePatterns: [
    ...ignorePatterns,
    'module/boot/src',
    'module/scaffold/templates'
  ],
  extends: [...ext, 'plugin:travetto/all'],
  plugins: [...plugins, 'unused-imports'],
  rules: { ...rules, 'unused-imports/no-unused-imports': 'error' }
};