import { PathUtil } from '@travetto/boot';

import { Modules } from './modules';
import { Packages } from './packages';

export class Git {

  static findLastRelease() {
    return $exec('git', ['log', '--pretty=oneline'])
      .$filter(x => /Publish /.test(x))
      .$first(1)
      .$columns()
      .$map(([hash]) => hash);
  }

  static async * findFoldersChanged(hash: string) {
    const byFolder = await Packages.yieldPublicPackages()
      .$map(p => p._.folderRelative);
    const patt = new RegExp(`(${byFolder.join('|')})\/`);
    const testPatt = new RegExp(`(${byFolder.join('|')})\/test\/`); // Exclude tests

    yield* $exec('git', ['diff', '--name-only', `HEAD..${hash}`])
      .$filter(x => !testPatt.test(x))
      .$tokens(patt)
      .$sort()
      .$unique()
      .$map(f => PathUtil.resolveUnix(f));
  }

  static async * yieldChangedPackges(hash?: string) {
    if (!hash) {
      hash = await this.findLastRelease().$value;
    }

    yield* this.findFoldersChanged(hash)
      .$flatMap(f => Modules.getDependentModules(f).$concat(
        Packages.yieldByFolder(f)
      ))
      .$sort((a, b) => a.name.localeCompare(b.name))
      .$unique();
  }

  static publishCommit(tag: string) {
    return $exec('git', { args: ['commit', '.', '-m', `Publish ${tag}`] });
  }

  static checkWorkspaceDirty(errorMessage: string) {
    return $exec('git', ['diff', '--quiet', '--exit-code'])
      .$concat($exec('git', ['diff', '--quiet', '--exit-code', '--cached']))
      .$onError(() => {
        console.error(errorMessage);
        process.exit(1);
      });
  }
}