require('@encore2/config/bootstrap');
const { Compiler } = require('@encore2/compiler');
Compiler.workingSets = ['!']; // Reduce worksets to load nothing by default
require('@encore2/registry/bootstrap').init().then(() =>
  require('mocha/bin/_mocha')
);