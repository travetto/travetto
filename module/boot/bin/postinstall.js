const fs = require('fs');

const root = process.cwd();

// TODO: Document
if (!fs.existsSync(`${root}/tsconfig.json`)) {
  fs.writeFileSync(`${root}/tsconfig.json`,
    JSON.stringify({
      extends: './node_modules/@travetto/boot/tsconfig.json'
    })
  );
}

require('./init');
require('../src/app-cache').AppCache.clear();