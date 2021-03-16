import * as fs from 'fs';
import * as path from 'path';

const parts = 'node_modules/@travetto/boot/bin'.split('/');

for (let i = 0; i < parts.length; i++) {
  try {
    fs.mkdirSync(path.resolve(...parts.slice(0, i + 1)));
  } catch { }
}

for (const [s, d] of [
  ['module/boot/bin/register.js', 'node_modules/@travetto/boot/bin/register.js'],
  ['module/boot/bin/main.js', 'node_modules/@travetto/boot/bin/main.js'],
  ['module/cli/bin/trv.js', 'bin-dist/trv'],
]) {
  try { fs.unlinkSync(path.resolve(d)); } catch { }
  try {
    fs.symlinkSync(path.resolve(s), path.resolve(d)); // Direct link
  } catch (e) { }
}