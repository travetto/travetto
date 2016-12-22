require('@encore/bootstrap');

let {Configure} = require('@encore/config');
let {Ready} = require('@encore/lifecycle');
let {bulkRequire} = require('@encore/util');

Configure.initialize(process.env.env || 'local');
bulkRequire('src/app/route/**/*.ts');
Ready.onReady(() => Configure.log());
Ready.initialize();