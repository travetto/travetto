import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';

import { FileCache, RegisterUtil } from '@travetto/boot';
import { Env, SystemUtil, ScanApp } from '@travetto/base';

import { CompilerUtil } from './util';
import { TransformerManager } from './transformer/manager';

export class SourceManager {
  private transformerManager: TransformerManager;

  private sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  private contents = new Map<string, string>();
  private hashes = new Map<string, number>();
  private cache: FileCache;
  private compilerOptions: ts.CompilerOptions;

  constructor(private cwd: string, private config: { cache?: boolean }) {
    Object.assign(config, { ... { cache: true }, config });
    this.cache = new FileCache(this.cwd);
    this.transformerManager = new TransformerManager(this.cwd);
  }

  private getProgram(opts: any) {
    const resolved = { ...this.compilerOptions, ...opts };
    const host = ts.createCompilerHost(resolved);
    return ts.createProgram({
      rootNames: ScanApp.getStandardAppFiles(),
      options: resolved,
      host
    });
  }

  private transpileFile(fileName: string, content: string, options: ts.TranspileOptions, force = false) {
    if (force || !(this.config.cache && this.cache.hasEntry(fileName))) {
      console.trace('Emitting', fileName.replace(this.cwd, ''));

      content = RegisterUtil.prepareTranspile(fileName, content);

      if (!this.compilerOptions) {
        this.compilerOptions = CompilerUtil.resolveOptions(this.cwd);
      }

      const prog = this.getProgram({
        ...options,
        transformers: this.transformerManager.transformers || {},
        compilerOptions: this.compilerOptions
      });

      const emittedFiles = prog.emit(prog.getSourceFile(fileName));
      CompilerUtil.checkTranspileErrors(this.cwd, fileName, emittedFiles.diagnostics);

      const outputText =;
      this.contents.set(fileName, outputText);
      this.hashes.set(fileName, SystemUtil.naiveHash(content));

      if (this.config.cache) {
        this.cache.writeEntry(fileName, outputText);
      }
    } else {
      const cached = this.cache.readEntry(fileName);
      this.contents.set(fileName, cached);
    }

    return this.contents.get(fileName)!;
  }

  init() {
    // register source maps
    sourcemap.install({
      emptyCacheBetweenOperations: !Env.prod, // Be less strict in non-dev
      retrieveFile: (p: string) => this.contents.get(p.replace('.js', '.ts'))!,
      retrieveSourceMap: (source: string) => this.sourceMaps.get(source.replace('.js', '.ts'))!
    });

    this.transformerManager.init();
  }

  hashChanged(fileName: string, content: string) {
    // Let's see if they are really different
    const hash = SystemUtil.naiveHash(content);
    if (hash === this.hashes.get(fileName)) {
      console.trace(`Contents Unchanged: ${fileName}`);
      return false;
    }
    return true;
  }

  transpile(fileName: string, content: string, force = false) {
    console.trace('Transpiling', fileName.replace(this.cwd, ''));
    try {
      return this.transpileFile(fileName, content, {
        fileName,
        reportDiagnostics: true
      }, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        const errContent = CompilerUtil.getErrorModuleProxySource(err.message);
        return this.transpileFile(fileName, errContent, { fileName }, true);
      } else {
        throw err;
      }
    }
  }

  unload(fileName: string, unlink = true) {
    if (this.contents.has(fileName)) {
      console.trace('Unloading', fileName.replace(this.cwd, ''), unlink);

      if (this.config.cache) {
        this.cache.removeExpiredEntry(fileName, unlink);
      }

      if (unlink && this.hashes.has(fileName)) {
        this.hashes.delete(fileName);
      }
    }
  }

  reset() {
    this.contents.clear();
    this.sourceMaps.clear();
    this.hashes.clear();
  }
}