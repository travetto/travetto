// Hack Node module system to recognize our plugin.
const Module = require('module');
Module._resolveFilename = (original => function (request) {
  return request.startsWith('eslint-plugin-travetto') ?
    require.resolve(`./bin-dist/eslint/${request.split('eslint-plugin-travetto')[1]}`) :
    original.apply(this, arguments);
})(Module._resolveFilename);

const all = require('./bin/eslint/core');
module.exports = {
  ...all,
  extends: [...all.extends, 'plugin:travetto-import-order/all'],
  plugins: [...all.plugins, 'unused-imports'],
  rules: { ...all.rules, 'unused-imports/no-unused-imports': 'error' }
};