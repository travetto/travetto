import * as ts from 'typescript';

import { Env, AppError, ScanApp } from '@travetto/base';
import { RegisterUtil, AppCache } from '@travetto/boot';

export class CompilerUtil {

  static getErrorModuleProxySource(err: string = 'Module is not found') {
    return RegisterUtil.getErrorModuleProxy.toString().split(/[(]err[)]\s*[{]/)[1]
      .replace(/[}]$/, '')
      .replace('err', `\`${err.replace(/[`]/g, `'`)}\``)
      .replace('return ', 'module.exports = ');
  }

  static resolveOptions(dir: string, name: string = 'tsconfig.json') {
    const out = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(`${dir}/${name}`, ts.sys.readFile), ts.sys, dir,
      {
        rootDir: dir,
        sourceMap: false,
        inlineSourceMap: true,
        outDir: dir,
      }, `${dir}/${name}`);
    return Object.assign(out.options, {
      importHelpers: true,
      noEmitOnError: false,
      noErrorTruncation: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs
    });
  }

  static checkTranspileErrors(cwd: string, fileName: string, diagnostics: readonly ts.Diagnostic[]) {

    if (diagnostics && diagnostics.length) {
      const errors = diagnostics.slice(0, 5).map(diag => {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start as number);
          return ` @ ${diag.file.fileName.replace(`${cwd}/`, '')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new AppError(`Transpiling ${fileName.replace(`${cwd}/`, '')} failed`, 'unavailable', { errors });
    }
  }

  static handleCompileError(e: Error, cwd: string, modName: string, tsf: string) {
    if (e.message.startsWith('Cannot find module') || e.message.startsWith('Unable to load')) {
      modName = modName.replace(`${cwd}/`, '');
      e = new AppError(`${e.message} ${e.message.includes('from') ? `[via ${modName}]` : `from ${modName}`}`, 'general');
    }

    const file = tsf.replace(`${cwd}/`, '');
    if (tsf.includes('/extension/')) { // If errors out on extension loading
      console.debug(`Ignoring load for ${file}:`, e.message.split(/( from )|\n/)[0]);
    } else if (Env.watch) {
      console.error(`Stubbing out with error proxy due to error in compiling ${file}: `, e.message);
      return this.getErrorModuleProxySource(e.message);
    } else {
      throw e;
    }
  }

  /**
   * Find all uncompiled files
   */
  static findAllUncompiledFiles(roots: string[] = ['.']) {
    return ScanApp.findActiveAppFiles(roots).filter(x => !AppCache.hasEntry(x));
  }
}