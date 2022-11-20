import { path } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

import { DepGroup } from './types';
import { Repo, RepoModule } from './repo';

export class Packages {

  static async findPublishedVersion(folder: string, dep: string, version: string): Promise<string | undefined> {
    const root = await Repo.repoRoot;
    const proc = ExecUtil.spawn('npm', ['show', `${dep}@${version}`, 'version', '--json'], {
      cwd: path.resolve(root, folder), stdio: 'pipe'
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

  static async upgrade(mod: RepoModule, groups: DepGroup[] | readonly DepGroup[]): Promise<string[]> {
    const modules = await Repo.modulesByName;
    const upgradable = groups
      .flatMap(type =>
        Object.entries<string | true>(mod.pkg[type] || {})
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          .map(([name, version]) => ({ name, type, version: version as string }))
      )
      .filter(x => !(x.name in modules))
      .filter(x => /^[\^~<>]/.test(x.version)); // Is a range

    const out: string[] = [];

    for (const d of upgradable) {
      const top = await this.findPublishedVersion(mod.folder, d.name, d.version);
      if (top) {
        const curr = mod.pkg[d.type]![d.name];
        const next = d.version.replace(/\d.*$/, top);
        if (next !== curr) {
          mod.pkg[d.type]![d.name] = next;
          out.push(`${d.name}@(${curr} -> ${next})`);
          continue;
        }
      }
    }

    return out;
  }
}