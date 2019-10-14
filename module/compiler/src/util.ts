import * as ts from 'typescript';
import { Env, AppError } from '@travetto/base';
import { RegisterUtil } from '@travetto/boot';

export class CompilerUtil {

  static getErrorModuleProxySource(err: string = 'Module is not found') {
    return RegisterUtil.getErrorModuleProxy.toString().split(/[(]err[)]\s*[{]/)[1]
      .replace(/[}]$/, '')
      .replace('err', `\`${err.replace(/[`]/g, `'`)}\``)
      .replace('return ', 'module.exports = ');
  }

  static resolveOptions(dir: string, name: string = 'tsconfig.json') {
    const out = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(`${dir}/${name}`, ts.sys.readFile), ts.sys, dir, {
      rootDir: `${dir}`,
      sourceMap: false,
      inlineSourceMap: true,
      outDir: `${dir}`
    }, `${dir}/${name}`
    );
    out.options.importHelpers = true;
    out.options.noEmitOnError = !Env.watch;
    out.options.noErrorTruncation = true;
    out.options.moduleResolution = ts.ModuleResolutionKind.NodeJs;

    return out.options;
  }

  static resolveAsType<T>(fn: () => T, text: string): T {
    try {
      return fn();
    } catch {
      throw new AppError(`Cannot use interface '${text}' when a class is required`);
    }
  }
}