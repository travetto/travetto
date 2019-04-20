const fs = require('fs');

['tsconfig.json', 'tslint.json']
  .filter(f => !fs.existsSync(`${process.cwd()}/${f}`))
  .forEach(f => {
    const conf = JSON.stringify({ extends: `./node_modules/@travetto/boot/${f}` });
    fs.writeFileSync(`${process.cwd()}/${f}`, conf);
  });

require('./init');
require('../src/app-cache').AppCache.clear();