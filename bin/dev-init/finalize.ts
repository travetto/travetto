import * as fs from 'fs';
import { DepResolver } from './resolver';
import { FsUtil } from '../../module/boot/src/fs';

export class Finalize {
  static ROOT = FsUtil.resolveUnix(fs.realpathSync(__dirname), '..', '..'); // Move up from ./bin folder;
  static MOD_ROOT = `${Finalize.ROOT}/module`;
  static NM_ROOT = `${Finalize.ROOT}/node_modules`;
  static COMMON_LIBS = [];

  /**
   * Symlink, with some platform specific support
   */
  static makeLinkSync(actual: string, linkPath: string) {
    try {
      fs.lstatSync(linkPath);
    } catch (e) {
      const file = fs.statSync(actual).isFile();
      fs.symlinkSync(actual, linkPath, process.platform === 'win32' ? (file ? 'file' : 'junction') : undefined);
      fs.lstatSync(linkPath); // Ensure created
    }
  }

  static linkCommon(base: string) {
    for (const dep of this.COMMON_LIBS) {
      this.makeLinkSync(`${this.NM_ROOT}/${dep}`, `${base}/${dep}`);
    }
  }

  static linkFramework(base: string, modules: Set<string>) {
    for (const dep of new Set([...modules, ...(DepResolver.resolve('test', base).regular), '@travetto/cli'])) {
      const [, sub] = dep.split('@travetto/');
      if (FsUtil.existsSync(`${this.MOD_ROOT}/${sub}`)) {
        this.makeLinkSync(`${this.MOD_ROOT}/${sub}`, `${base}/${dep}`);
      }
    }
  }

  static linkScripts(base: string, mod: string, bin: Record<string, Record<string, string>>) {
    // Link common binary scripts
    for (const smod of Object.keys(bin)) {
      for (const name of Object.keys(bin[smod])) {
        const src = bin[smod][name];

        if (FsUtil.existsSync(`${base}/.bin/${name}.cmd`)) {
          fs.unlinkSync(`${base}/.bin/${name}.cmd`);
          fs.unlinkSync(`${base}/.bin/${name}`);
        }

        try {
          this.makeLinkSync(`${this.MOD_ROOT}/${smod}/${src}`, `${base}/.bin/${name}`);
        } catch (e) {
        }
      }
    }
  }

  static finalize(mod: string, base: string) {
    // Fetch deps
    const deps = DepResolver.resolve(mod, base);
    // deps.regular.add(`@travetto/${mod}`);
    deps.regular.add('@travetto/test');
    deps.regular.add('@travetto/doc');

    Object.assign(deps.bin, DepResolver.resolve('cli', base).bin);
    Object.assign(deps.bin, DepResolver.resolve('test', base).bin);

    // wrt to module's node_modules
    const NM_MOD = `${base}/${mod}/node_modules`;

    // Create necessary directories
    FsUtil.mkdirpSync(NM_MOD);
    FsUtil.mkdirpSync(`${NM_MOD}/@travetto`);
    FsUtil.mkdirpSync(`${NM_MOD}/.bin`);

    this.linkCommon(NM_MOD);
    this.linkFramework(NM_MOD, deps.regular);
    this.linkScripts(NM_MOD, mod, deps.bin);
  }
}