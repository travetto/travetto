require('@encore/base/require-ts');

let {Configure} = require('@encore/config');
let {Ready} = require('@encore/lifecycle');
let {bulkRequire} = require('@encore/util');

Configure.initialize(process.env.env || 'local');
Ready.onReady(() => Configure.log());
bulkRequire('src/app/route/**/*.ts');
Ready.initialize();