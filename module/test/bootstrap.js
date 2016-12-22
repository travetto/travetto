require('@encore/bootstrap');

let Configure = require('@encore/config').Configure;
let Ready = require('@encore/lifecycle').Ready;
let bulkRequire = require('@encore/util').bulkRequire;

Configure.initialize(process.env.env || 'local');
Ready.initialize();