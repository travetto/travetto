import { $AsyncIterable } from '@arcsine/nodesh/dist/types';

import { Modules } from './modules';
import { Packages, Pkg } from './packages';
import { Util } from './util';

export class Git {

  static findLastRelease(): $AsyncIterable<string> {
    return $exec('git', ['log', '--pretty=oneline'])
      .$filter(x => /Publish /.test(x))
      .$first(1)
      .$columns()
      .$map(([hash]) => hash);
  }

  static async * findFoldersChanged(hash: string): $AsyncIterable<string> {
    const byFolder = await Packages.yieldPublicPackages()
      .$map(p => p._.folderRelative);
    const patt = new RegExp(`(${byFolder.join('|')})\/`);
    const testPatt = new RegExp(`(${byFolder.join('|')})\/(test|doc)\/`); // Exclude tests

    yield* $exec('git', ['diff', '--name-only', `HEAD..${hash}`])
      .$filter(x => !testPatt.test(x))
      .$tokens(patt)
      .$sort()
      .$unique()
      .$map(f => Util.resolveUnix(f));
  }

  static async * yieldChangedPackages(hash?: string, transitive = process.env.TRV_FLAT !== '1'): $AsyncIterable<Pkg> {
    if (!hash) {
      hash = await this.findLastRelease().$value;
    }

    yield* this.findFoldersChanged(hash)
      .$flatMap(f =>
        transitive ? Modules.getDependentModules(f).$concat(
          Packages.yieldByFolder(f)
        ) :
          Packages.yieldByFolder(f)
      )
      .$sort((a, b) => a.name.localeCompare(b.name))
      .$unique();
  }

  static publishCommit(tag: string): $AsyncIterable<string> {
    return $exec('git', { args: ['commit', '.', '-m', `Publish ${tag}`] });
  }

  static checkWorkspaceDirty(errorMessage: string): $AsyncIterable<string> {
    return $exec('git', ['diff', '--quiet', '--exit-code'])
      .$concat($exec('git', ['diff', '--quiet', '--exit-code', '--cached']))
      .$onError(() => {
        console.error(errorMessage);
        process.exit(1);
      });
  }
}