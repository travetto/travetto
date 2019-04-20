const fs = require('fs');

const root = process.env.INIT_CWD || process.cwd();

['tsconfig.json', 'tslint.json']
  .filter(f => !fs.existsSync(`${root}/${f}`))
  .forEach(f => {
    const conf = JSON.stringify({ extends: `./node_modules/@travetto/boot/${f}` });
    fs.writeFileSync(`${root}/${f}`, conf);
  });

require('./init');
require('../src/app-cache').AppCache.clear();