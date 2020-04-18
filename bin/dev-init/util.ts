import * as fs from 'fs';
import * as path from 'path';

const F_ROOT = fs.realpathSync(path.resolve(__dirname, '..').replace(/[\\\/]+/g, '/'));
const ROOT = path.dirname(F_ROOT).replace(/[\\\/]+/g, '/'); // Move up from ./bin folder

export class Util {

  static ROOT = ROOT;
  static F_ROOT = F_ROOT;

  static copyTemplateFiles(src: string, base: string) {
    const module = path.basename(base);
    for (const f of fs.readdirSync(src)) {
      const resolved = path.resolve(src, f);
      if (fs.statSync(resolved).isFile()) {
        const resolvedModule = path.resolve(src, module, f);
        const srcFile = fs.existsSync(resolvedModule) ? resolvedModule : resolved;
        const destFile = path.resolve(base, f);

        if (fs.statSync(srcFile).isFile() && fs.existsSync(destFile)) {
          fs.copyFileSync(srcFile, destFile);
        }
      }
    }
  }
}