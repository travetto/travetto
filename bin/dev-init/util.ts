import * as fs from 'fs';
import * as path from 'path';

import { FsUtil } from '../../module/boot/src/fs';

const F_ROOT = fs.realpathSync(path.resolve(__dirname, '..').replace(/[\\\/]+/g, '/'));
const ROOT = path.dirname(F_ROOT).replace(/[\\\/]+/g, '/'); // Move up from ./bin folder

export class Util {

  static ROOT = ROOT;
  static F_ROOT = F_ROOT;

  static copyTemplateFiles(src: string, base: string) {
    const module = path.basename(base);
    for (const f of fs.readdirSync(src)) {
      const srcFile = [
        path.resolve(src, module, `${f}.keep`),
        path.resolve(src, module, f),
        path.resolve(src, f)
      ].find(x => FsUtil.existsSync(x)?.isFile());

      const destFile = path.resolve(base, f);

      if (srcFile && !srcFile.endsWith('.keep') && FsUtil.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }
}