import { path } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

export class Packages {

  static async findPublishedVersion(folder: string, dep: string, version: string): Promise<string | undefined> {
    const proc = ExecUtil.spawn('npm', ['show', `${dep}@${version}`, 'version', '--json'], {
      cwd: path.resolve(folder), stdio: 'pipe'
    });
    return proc.result
      .catchAsResult!()
      .then(res => {
        if (!res.valid && !res.stderr.includes('E404')) {
          throw new Error(res.stderr);
        }
        const item = res.stdout ? JSON.parse(res.stdout) : [];
        return Array.isArray(item) ? item.pop() : item;
      });
  }
}