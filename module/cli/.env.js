const path = require('path');
// For docs, to expose the echo command
process.env.TRV_MODULES = `doc-test=${path.resolve('./doc')}`;