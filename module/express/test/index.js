let run = require('@encore2/registry/bootstrap').init()
require('@encore2/di/src/service/registry').DependencyRegistry.initialize();
require('./simple-controller');