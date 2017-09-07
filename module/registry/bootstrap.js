require('@encore2/config/bootstrap');
require('@encore2/compiler/bootstrap');

let { RootRegistry } = require('./src/service/root');
let reg = new RootRegistry();

module.exports = { init: reg.initialize.bind(reg) };
