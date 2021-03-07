#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const fs = require('fs');
const path = require('path');

'*'
  .$dir({ type: 'file', base: '.bin' })
  .$map(x => fs.unlinkSync(x))
  .$collect()
  .$tap(async () => {
    for (const d of ['.bin', 'node_modules/@travetto', 'node_modules/@travetto/boot', 'node_modules/@travetto/boot/bin']) {
      await fs.promises.mkdir(path.resolve(d)).catch(() => { });
    }
  })
  .$forEach(async () =>
    [
      ['module/boot/bin/register.js', 'node_modules/@travetto/boot/bin/register.js'],
      ['module/boot/bin/main.js', 'node_modules/@travetto/boot/bin/main.js'],
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