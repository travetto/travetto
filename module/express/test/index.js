let run = require('@encore2/registry/bootstrap').init()
require('../src/service/registry').ControlleryRegistry.init();
require('./simple-controller');