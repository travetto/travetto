#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const fs = require('fs');
const path = require('path');

async function mkdirp(d) {
  const parts = d.split(path.sep);
  for (let i = 1; i < parts.length; i++) {
    try {
      await fs.promises.mkdir(parts.slice(0, i + 1).join(path.sep))
    } catch { }
  }
}

[
  ['module/boot/register.js', 'node_modules/@travetto/boot/register.js'],
  ['module/boot/travetto.js', '.bin/trv'],
  ['bin/util/npmr.js', '.bin/npmr']
]
  .$map(a => a.map(v => path.resolve(v)))
  .$forEach(async ([s, d]) => {
    await mkdirp(path.dirname(d));
    try {
      await fs.promises.stat(d);
    } catch {
      await fs.promises.symlink(s, d);
    }
  });