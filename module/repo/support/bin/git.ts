import { ExecUtil } from '@travetto/base';
import { path } from '@travetto/manifest';
import { type Worker } from '@travetto/worker';

import { RepoModule, Repo } from './repo';

type RepoTrie = {
  children: Record<string, RepoTrie>;
  folder: string;
  value?: RepoModule;
};

export class Git {

  static async findLastRelease(): Promise<string> {
    const { result } = ExecUtil.spawn('git', ['log', '--pretty=oneline']);
    return (await result)
      .stdout.split(/\n/)
      .find(x => /Publish /.test(x))!
      .split(/\s+/)[0]!;
  }

  static async findModulesChanged(hash: string): Promise<RepoModule[]> {
    const root = await Repo.root;
    const mods = await Repo.modules;

    const trie: RepoTrie = { children: {}, folder: '' };
    for (const mod of mods) {
      let sub = trie;
      for (const part of mod.rel.split('/')) {
        const next = (sub.children[part] ??= { children: {}, folder: path.join(sub.folder, part) });
        sub = next;
      }
      sub.value = mod;
    }

    const result = await ExecUtil.spawn('git', ['diff', '--name-only', `HEAD..${hash}`]).result;
    const out = new Set<RepoModule>();
    for (const line of result.stdout.split(/\n/g)) {
      const parts = line.replace(root.full, '').split('/');
      let sub = trie;
      for (const part of parts) {
        sub = sub.children[part];
        if (!sub) {
          break;
        }
        if (sub.value) { // we have a match
          const subRel = line.replace(path.resolve(root.full, sub.folder), '');
          if (!/^test\//.test(subRel)) {
            out.add(sub.value);
          }
          break;
        }
      }
    }

    return [...out].sort((a, b) => a.name.localeCompare(b.name));
  }

  static async findChangedModulesRecursive(hash?: string, transitive = process.env.TRV_FLAT !== '1'): Promise<RepoModule[]> {
    if (!hash) {
      hash = await this.findLastRelease();
    }

    const out = new Set<RepoModule>();
    for (const mod of await this.findModulesChanged(hash)) {
      out.add(mod);
      if (transitive) {
        for (const sub of await Repo.getDependentModules(mod)) {
          out.add(sub);
        }
      }
    }

    return [...out]
      .sort((a, b) => a.name.localeCompare(b.name));
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
    const res1 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code']).result.catchAsResult();
    const res2 = await ExecUtil.spawn('git', ['diff', '--quiet', '--exit-code', '--cached']).result.catchAsResult();
    if (!res1.valid || !res2.valid) {
      console.error!(errorMessage);
      process.exit(1);
    }
  }
}