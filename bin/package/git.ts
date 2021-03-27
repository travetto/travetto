import { PathUtil } from '@travetto/boot/src';
import { Modules } from './modules';
import { SemverLevel } from './semver';

export class Git {

  static findLastRelease() {
    return $exec('git', ['log', '--pretty=oneline'])
      .$filter(x => /Publish/.test(x))
      .$first(1)
      .$columns()
      .$map(([hash]) => hash);
  }

  static async * findFilesChanged(hash: string) {
    const byPath = await Object.keys(await Modules.byPath)
      .$replace(`${PathUtil.cwd}/`, '');

    yield* $exec('git', ['diff', '--name-only', `HEAD..${hash}`])
      .$tokens(new RegExp(`(${byPath.join('|')})`))
      .$sort()
      .$unique()
      .$map(f => PathUtil.resolveUnix(f));
  };

  static findModulesChanged(hash: string) {
    return this.findFilesChanged(hash)
      .$flatMap(f => Modules.getDependentModules(f))
      .$sort()
      .$unique();
  }

  static publishCommit(level: SemverLevel) {
    return $exec('git', ['commit', '-m', `Publish ${level}`])
  }
}