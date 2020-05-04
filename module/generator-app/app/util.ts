import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as mustache from 'mustache';
import { FsUtil } from '@travetto/boot/src/fs';

const fsRead = util.promisify(fs.readFile);

export const verifyDestination = (target: string) => {
  if (FsUtil.existsSync(target)) {
    throw new Error(`Cannot create project inside of an existing folder: ${path.dirname(target)}`);
  }

  let base = path.dirname(target);
  while (base) {
    if (FsUtil.existsSync(`${base}/package.json`)) {
      throw new Error(`Cannot create project inside of an existing node project ${base}`);
    }
    const next = path.dirname(base);
    if (next === base) {
      break;
    }
    base = next;
  }
};

export function meetsRequirement(modules: string[], desired: string[]) {
  let valid = true;
  for (const mod of desired) {
    if (mod.endsWith('-')) {
      valid = valid && !!modules.find(m => m.startsWith(mod));
    } else {
      valid = valid && modules.includes(mod);
    }
    if (!valid) {
      break;
    }
  }
  return valid;
}

export async function template(file: string, context: any) {
  const contents = await fsRead(file, 'utf-8');
  return mustache.render(contents, context).replace(/^\s*(\/\/|#)\s*\n/gsm, '');
}