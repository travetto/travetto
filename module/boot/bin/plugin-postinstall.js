const fs = require('fs');

const root = process.cwd();

/**
 * Set the tsconfig to point to the boot/tsconfig if it doesn't exist
 */
if (!fs.existsSync(`${root}/tsconfig.json`)) {
  fs.writeFileSync(`${root}/tsconfig.json`,
    JSON.stringify({
      extends: './node_modules/@travetto/boot/tsconfig.json'
    })
  );
}

// Initialize the app and clear the cache
require('../register');
require('../src/app-cache').AppCache.clear();