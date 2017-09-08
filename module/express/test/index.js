let run = require('@encore2/registry/bootstrap').init()
require('../src/service/registry').ControllerRegistry.init();
require('./simple-controller');