import * as fs from 'fs';
import { Util } from './util';
import { DepResolver } from './resolver';

const CLI = 'travetto-cli';

export class Finalize {
  static MOD_ROOT = `${Util.ROOT}/module`;
  static MOD_TPL_ROOT = `${Util.ROOT}/module-template`;
  static NM_ROOT = `${Util.ROOT}/node_modules`;
  static COMMON_LIBS = ['typescript', 'tslib'];
  static COMMON_BIN_SCRIPTS = [
    ['cli', CLI],
    ['test', `${CLI}-test`],
    ['boot', `${CLI}-clean`],
    ['di', `${CLI}-run`],
    ['email-template', `${CLI}-email-template`],
    ['compiler', `${CLI}-compile`],
    ['model-elasticsearch', `${CLI}-es_schema`],
    ['rest-aws-lambda', `${CLI}-rest-aws-lambda_deploy`],
    ['rest-aws-lambda', `${CLI}-rest-aws-lambda_build-zip`],
    ['rest-aws-lambda', `${CLI}-rest-aws-lambda_build-sam`],
    ['swagger', `${CLI}-swagger-client`]
  ];

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

  static linkScripts(base: string, mod: string) {
    // Link common binary scripts
    for (const [smod, script] of this.COMMON_BIN_SCRIPTS) {

      if (fs.existsSync(`${base}/.bin/${script}.cmd`)) {
        fs.unlinkSync(`${base}/.bin/${script}.cmd`);
        fs.unlinkSync(`${base}/.bin/${script}`);
      }

      try {
        if (fs.existsSync(`${base}/@travetto/${smod}`) || mod === smod) {
          Util.makeLink(`${this.MOD_ROOT}/${smod}/bin/${script}.ts`, `${base}/.bin/${script}`);
        }
      } catch (e) { }
    }
  }

  static linkCLI(base: string) {
    // Link travetto cli
    for (const f of fs.readdirSync(`${this.MOD_ROOT}/cli/bin`)) {
      Util.makeLink(`${this.MOD_ROOT}/cli/bin/${f}`, `${base}/.bin/${f.replace(/[.][jt]s$/, '')}`);
    }
  }

  static finalize(mod: string, base: string, onlyModules: boolean = false) {
    // Fetch deps
    const deps = DepResolver.resolve(mod, base);
    // deps.regular.add(`@travetto/${mod}`);
    deps.regular.add('@travetto/test');

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
    this.linkScripts(NM_MOD, mod);
    this.linkCLI(NM_MOD);
  }
}