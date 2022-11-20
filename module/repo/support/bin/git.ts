import { ExecUtil } from '@travetto/base';
import { path } from '@travetto/manifest';

import { RepoModule, Repo } from './repo';

export class Git {

  static async findLastRelease(): Promise<string> {
    const { result } = ExecUtil.spawn('git', ['log', '--pretty=oneline']);
    const res = await result;
    if (!res.valid) {
      throw new Error(res.stderr);
    }
    return res
      .stdout.split(/\n/)
      .find(x => /Publish /.test(x))!
      .replace(/(?:.*)([a-f0-9]{8,64})/i, (_, hash) => hash);
  }

  static async findFoldersChanged(hash: string): Promise<string[]> {
    const root = await Repo.repoRoot;

    const folders = (await Repo.publicModules)
      .map(f => f.folder);

    const patt = new RegExp(`(${folders.join('|')})\/`);
    const testPatt = new RegExp(`(${folders.join('|')})\/(test|doc)\/`); // Exclude tests and docs

    const result = await ExecUtil.spawn('git', ['diff', '--name-only', `HEAD..${hash}`]).result;
    if (!result.valid) {
      throw new Error(result.stderr);
    }

    const unique = [...new Set(result.stdout
      .split(/\n/g)
      .filter(x => !testPatt.test(x))
      .map(line => line.replace(patt, (_, t) => t))
    )];

    return unique
      .map(f => path.resolve(root, f))
      .sort();
  }

  static async findChangedModules(hash?: string, transitive = process.env.TRV_FLAT !== '1'): Promise<RepoModule[]> {
    if (!hash) {
      hash = await this.findLastRelease();
    }

    const out: RepoModule[] = [];
    for (const folder of await this.findFoldersChanged(hash)) {
      if (transitive) {
        out.push(...await Repo.getDependentModules(folder));
      }
      out.push(await Repo.getModuleByFolder(folder));
    }
    return out
      .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
  }

  static async publishCommit(tag: string): Promise<string> {
    const { result } = ExecUtil.spawn('git', ['commit', '.', '-m', `Publish ${tag}`]);
    const res = await result;
    if (!res.valid) {
      throw new Error(res.stderr);
    }
    return res.stdout;
  }

  static async checkWorkspaceDirty(errorMessage: string): Promise<void> {
    const res1 = await ExecUtil.spawn('git', ['diff', '--quiet', '-exit-code']).result;
    const res2 = await ExecUtil.spawn('git', ['diff', '--quiet', '-exit-code', '--cached']).result;
    if (!res1.valid || !res2.valid) {
      console.error(errorMessage);
      process.exit(1);
    }
  }
}