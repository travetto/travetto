import * as fs from 'fs';
import { Util } from './util';
import { DepResolver } from './resolver';

export class Finalize {
  static MOD_ROOT = `${Util.ROOT}/module`;
  static MOD_TPL_ROOT = `${Util.ROOT}/module-template`;
  static NM_ROOT = `${Util.ROOT}/node_modules`;
  static COMMON_LIBS = ['typescript', 'tslib'];

  static linkCommon(base: string) {
    for (const dep of this.COMMON_LIBS) {
      Util.makeLink(`${this.NM_ROOT}/${dep}`, `${base}/${dep}`);
    }
  }

  static linkFramework(base: string, modules: Set<string>) {
    for (const dep of new Set([...modules, ...(DepResolver.resolve('test', base).regular), '@travetto/cli'])) {
      const sub = dep.split('@travetto/')[1];
      if (fs.existsSync(`${this.MOD_ROOT}/${sub}`)) {
        Util.makeLink(`${this.MOD_ROOT}/${sub}`, `${base}/${dep}`);
      }
    }
  }

  static linkScripts(base: string, mod: string, bin: Record<string, Record<string, string>>) {
    // Link common binary scripts
    for (const smod of Object.keys(bin)) {
      for (const name of Object.keys(bin[smod])) {
        const src = bin[smod][name];

        if (fs.existsSync(`${base}/.bin/${name}.cmd`)) {
          fs.unlinkSync(`${base}/.bin/${name}.cmd`);
          fs.unlinkSync(`${base}/.bin/${name}`);
        }

        try {
          Util.makeLink(`${this.MOD_ROOT}/${smod}/${src}`, `${base}/.bin/${name}`);
        } catch (e) {
        }
      }
    }
  }

  static finalize(mod: string, base: string, onlyModules: boolean = false) {
    // Fetch deps
    const deps = DepResolver.resolve(mod, base);
    // deps.regular.add(`@travetto/${mod}`);
    deps.regular.add('@travetto/test');

    Object.assign(deps.bin, DepResolver.resolve('cli', base).bin);
    Object.assign(deps.bin, DepResolver.resolve('test', base).bin);

    // wrt to module's node_modules
    const NM_MOD = `${base}/${mod}/node_modules`;

    // Copy over all files that match from template
    if (!onlyModules) {
      Util.copyTemplateFiles(this.MOD_TPL_ROOT, `${base}/${mod}`);
    }

    // Create necessary directories
    Util.makeDir(NM_MOD);
    Util.makeDir(`${NM_MOD}/@travetto`);
    Util.makeDir(`${NM_MOD}/.bin`);

    this.linkCommon(NM_MOD);
    this.linkFramework(NM_MOD, deps.regular);
    this.linkScripts(NM_MOD, mod, deps.bin);
  }
}