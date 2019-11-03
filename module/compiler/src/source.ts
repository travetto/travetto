import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';

import { FileCache, RegisterUtil } from '@travetto/boot';
import { Env, AppError, SystemUtil } from '@travetto/base';

import { CompilerUtil } from './util';
import { TransformerManager } from './transformer/manager';
import { Compiler } from './compiler';

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

  private transpileFile(fileName: string, options: ts.TranspileOptions, force = false) {
    if (force || !(this.config.cache && this.cache.hasEntry(fileName))) {
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

      const res = ts.transpileModule(content, {
        ...options,
        transformers: this.transformerManager.transformers || {},
        compilerOptions: this.compilerOptions
      });

      CompilerUtil.checkTranspileErrors(this.cwd, fileName, res);

      if (Env.watch) {
        this.hashes.set(fileName, hash);
      }

      this.set(fileName, res.outputText);
      if (this.config.cache) {
        this.cache.writeEntry(fileName, res.outputText);
      }
    } else {
      const cached = this.cache.readEntry(fileName);
      this.contents.set(fileName, cached);
    }
    return true;
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

  transpile(fileName: string, force = false) {
    console.trace('Transpiling', fileName);
    let changed: boolean = false;
    try {
      changed = this.transpileFile(fileName, {
        fileName,
        reportDiagnostics: true
      }, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        this.set(fileName, CompilerUtil.getErrorModuleProxySource(err.message));
        changed = this.transpileFile(fileName, { fileName }, true);
      } else {
        throw err;
      }
    }

    return changed;
  }

  compileModule(m: NodeModule, tsf: string) {
    const content = this.get(tsf)!;
    return CompilerUtil.compile(this.cwd, m, tsf, content);
  }

  unloadModule(fileName: string, unlink = true) {
    console.trace('Unloading', fileName);

    if (this.has(fileName)) {
      if (this.config.cache) {
        this.cache.removeExpiredEntry(fileName, unlink);
      }

      if (unlink && this.hashes.has(fileName)) {
        this.hashes.delete(fileName);
      }
    }
  }

  has(name: string) {
    return this.contents.has(name);
  }

  get(name: string) {
    return this.contents.get(name);
  }

  set(name: string, content: string) {
    this.contents.set(name, content);
  }

  clear() {
    this.contents.clear();
    this.sourceMaps.clear();
    this.hashes.clear();
  }
}