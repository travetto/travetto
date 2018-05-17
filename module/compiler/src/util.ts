import * as ts from 'typescript';
import { AppEnv } from '@travetto/base';

export class CompilerUtil {
  static LIBRARY_PATH = 'node_modules';

  static EMPTY_MODULE = 'module.exports = {}';

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
    out.options.noEmitOnError = AppEnv.prod;
    out.options.moduleResolution = ts.ModuleResolutionKind.NodeJs;

    return out.options;
  }
}