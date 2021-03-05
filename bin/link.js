#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const fs = require('fs');
const path = require('path');

async function mkdirp(d) {
  const parts = d.split(path.sep);
  for (let i = 1; i < parts.length; i++) {
    try {
      await fs.promises.mkdir(parts.slice(0, i + 1).join(path.sep));
    } catch { }
  }
}

'*'
  .$dir({ type: 'file', base: '.bin' })
  .$map(x => fs.unlinkSync(x))
  .$collect()
  .$forEach(async () =>
    [
      ['module/boot/register.js', 'node_modules/@travetto/boot/register.js'],
      ['module/cli/bin/trv.js', '.bin/trv'],
    ]
      .$concat('*.js'.$dir({ type: 'file', base: 'bin' }).$map(f => [f, `.bin/trv-${f.split(/[\\\/]/).pop().replace(/.js$/, '')}`]))
      .$map(a => a.map(v => path.resolve(v)))
      .$map(async ([s, d]) => {
        await mkdirp(path.dirname(d));
        try {
          await fs.promises.stat(d);
        } catch {
          await fs.promises.symlink(s, d);
        }
      })
  );