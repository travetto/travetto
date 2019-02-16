import * as fs from 'fs';
import * as path from 'path';

const F_ROOT = fs.realpathSync(path.resolve(__dirname, '..').replace(/[\\\/]+/g, '/');
const ROOT = path.dirname(F_ROOT).replace(/[\\\/]+/g, '/'); // Move up from ./bin folder

export class Util {

  static ROOT = ROOT;
  static F_ROOT = F_ROOT;

  static copyTemplateFiles(src, base) {
    for (const f of fs.readdirSync(src)) {
      const srcFile = `${src}/${f}`;
      const destFile = `${base}/${f}`;
      if (fs.statSync(srcFile).isFile() && fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }

  static makeDir(dir: string) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir.replace(/[\\\/]+/g, path.sep));
      } catch (e) {
        // Do nothing
      }
    }
  }

  static makeLink(actual: string, linkPath: string) {
    try {
      fs.lstatSync(linkPath);
    } catch (e) {
      const local = fs.statSync(actual);
      const file = local.isFile();
      fs.symlinkSync(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
      fs.lstatSync(linkPath);
    }
  }
}