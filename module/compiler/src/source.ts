import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';

import { FileCache, RegisterUtil } from '@travetto/boot';
import { Env, AppError, SystemUtil } from '@travetto/base';

import { CompilerUtil } from './util';

export class SourceManager {
  private sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  private contents = new Map<string, string>();
  private hashes = new Map<string, number>();
  private cache: FileCache;
  private compilerOptions: ts.CompilerOptions;

  constructor(private cwd: string, private config: { cache?: boolean }) {
    Object.assign(config, { ... { cache: true }, config });
    this.cache = new FileCache(this.cwd);
  }

  registerSourceMaps() {
    sourcemap.install({
      emptyCacheBetweenOperations: !Env.prod, // Be less strict in non-dev
      retrieveFile: (p: string) => this.contents.get(p.replace('.js', '.ts'))!,
      retrieveSourceMap: (source: string) => this.sourceMaps.get(source.replace('.js', '.ts'))!
    });
  }

  checkTranspileErrors(fileName: string, res: ts.TranspileOutput) {

    if (res.diagnostics && res.diagnostics.length) {

      const errors = res.diagnostics.slice(0, 5).map(diag => {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start as number);
          return ` @ ${diag.file.fileName.replace(`${this.cwd}/`, '')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (res.diagnostics.length > 5) {
        errors.push(`${res.diagnostics.length - 5} more ...`);
      }

      throw new AppError(`Transpiling ${fileName.replace(`${this.cwd}/`, '')} failed`, 'unavailable', { errors });
    }
  }

  transpile(fileName: string, options: ts.TranspileOptions, force = false) {
    if (force || !this.hasCached(fileName)) {
      console.trace('Emitting', fileName);

      const content = RegisterUtil.prepareTranspile(fileName);

      let hash = 0;

      if (Env.watch && this.hashes.has(fileName)) {
        // Let's see if they are really different
        hash = SystemUtil.naiveHash(content);
        if (hash === this.hashes.get(fileName)) {
          console.trace(`Contents Unchanged: ${fileName}`);
          return false;
        }
      }

      if (!this.compilerOptions) {
        this.compilerOptions = CompilerUtil.resolveOptions(this.cwd);
      }

      const res = ts.transpileModule(content, { ...options, compilerOptions: this.compilerOptions });

      this.checkTranspileErrors(fileName, res);

      if (Env.watch) {
        this.hashes.set(fileName, hash);
      }

      this.set(fileName, res.outputText);
    } else {
      const cached = this.getCached(fileName);
      this.contents.set(fileName, cached);
    }
    return true;
  }

  has(name: string) {
    return this.contents.has(name);
  }

  get(name: string) {
    return this.contents.get(name);
  }

  set(name: string, content: string) {
    this.contents.set(name, content);
    if (this.config.cache) {
      this.cache.writeEntry(name, content);
    }
  }

  clear() {
    this.contents.clear();
    this.sourceMaps.clear();
    this.hashes.clear();
  }

  hasCached(file: string) {
    return this.config.cache && this.cache.hasEntry(file);
  }

  getCached(file: string) {
    return this.cache.readEntry(file);
  }

  unload(name: string, unlink: boolean = true) {
    if (this.config.cache) {
      this.cache.removeExpiredEntry(name, unlink);
    }

    if (unlink && this.hashes.has(name)) {
      this.hashes.delete(name);
    }
  }
}