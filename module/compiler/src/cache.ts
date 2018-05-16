import * as fs from 'fs';

export class FileCache {
  static DIST_DIR = `${process.cwd()}/dist`;

  constructor(private cwd: string = FileCache.DIST_DIR) {
    try {
      fs.mkdirSync(cwd);
    } catch (e) { }
  }

  resolveName(fileName: string) {
    return `${this.cwd}/${fileName.replace(/[\/\\.]/g, '_')}`;
  }

  has(file: string) {
    return fs.existsSync(this.resolveName(file));
  }

  get(file: string) {
    return fs.readFileSync(this.resolveName(file)).toString();
  }

  set(file: string, content: string) {
    return fs.writeFileSync(this.resolveName(file), content);
  }

  delete(file: string) {
    fs.unlinkSync(this.resolveName(file));
  }
}
