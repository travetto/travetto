require('@encore/bootstrap');
require('@encore/config').Configure.initialize(process.env.env || 'test');
require('@encore/lifecycle').Ready.initialize();