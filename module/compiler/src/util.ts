import * as ts from 'typescript';
import { Env } from '@travetto/boot';

export class CompilerUtil {

  static getErrorModuleProxySource(err: string = 'Module is not found') {
    return this.getErrorModuleProxy.toString().split(/[(]err[)]\s*[{]/)[1]
      .replace(/[}]$/, '')
      .replace('err', `\`${err.replace(/[`]/g, `'`)}\``)
      .replace('return ', 'module.exports = ');
  }

  static getErrorModuleProxy(err: string) {
    const onError = () => {
      throw new Error(err);
    };
    return new Proxy({}, {
      enumerate: () => [],
      isExtensible: () => false,
      getOwnPropertyDescriptor: () => ({}),
      preventExtensions: () => true,
      apply: onError,
      construct: onError,
      setPrototypeOf: onError,
      getPrototypeOf: onError,
      get: onError,
      has: onError,
      set: onError,
      ownKeys: onError,
      deleteProperty: onError,
      defineProperty: onError
    });
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
}