#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const fs = require('fs');
const path = require('path');

'*'
  .$map(async (v) => {
    await fs.promises.mkdir(path.resolve('.bin')).catch(() => { });
    await fs.promises.mkdir(path.resolve('node_modules/@travetto')).catch(() => { });
    await fs.promises.mkdir(path.resolve('node_modules/@travetto/boot')).catch(() => { });
    return v;
  })
  .$dir({ type: 'file', base: '.bin' })
  .$map(x => fs.unlinkSync(x))
  .$collect()
  .$forEach(async () =>
    [
      ['module/boot/register.js', 'node_modules/@travetto/boot/register.js'],
      ['module/cli/bin/trv.js', '.bin/trv'],
    ]
      .$concat(
        '*'.$dir({ type: 'file', base: 'bin' })
          .$filter(x => !x.includes('publish'))
          .$filter(x => !/(link|clean|compress-js|opt-deps)[.]js$/.test(x))
          .$map(f => [f, `.bin/trv-${f.split(/[\\\/]/).pop().replace(/[.](js|sh)$/, '')}`])
      )
      .$map(a => a.map(v => path.resolve(v)))
      .$map(async ([s, d]) => {
        if (d.includes('trv-') && s.endsWith('.js')) {
          await fs.promises.writeFile(d, `
#!/bin/sh
cd \$(dirname \`dirname \$0\`)
./bin/${s.split('/').pop()} \${@}
`.trim(), { mode: 0o755 });
        } else {
          try {
            await fs.promises.symlink(s, d); // Direct link
          } catch { }
        }
      })
  );