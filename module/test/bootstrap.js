require('@encore/base/require-ts');
require('@encore/config').Configure.initialize(process.env.env || 'test');
require('@encore/lifecycle').Ready.initialize();