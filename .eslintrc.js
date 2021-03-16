require('@travetto/boot/bin/register');

// Hack Node module system to recognize our plugin.
const Module = require('module');
Module._resolveFilename = (original => function (request) {
  return request.startsWith('eslint-plugin-travetto') ?
    require.resolve('./bin/eslint/local') :
    original.apply(this, arguments);
})(Module._resolveFilename);

const all = require('./bin/eslint/core');
module.exports = {
  ...all,
  extends: [...all.extends, 'plugin:travetto/all'],
  plugins: [...all.plugins, 'unused-imports'],
  rules: { ...all.rules, 'unused-imports/no-unused-imports': 'error' }
};