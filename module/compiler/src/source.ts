import * as ts from 'typescript';
import * as path from 'path';

import { FileCache, RegisterUtil } from '@travetto/boot';
import { Env, SystemUtil, ScanApp } from '@travetto/base';

import { CompilerUtil } from './util';
import { TransformerManager } from './transformer';

export class SourceManager {
  private transformerManager: TransformerManager;

  private rootNames = new Set<string>();
  private sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  private contents = new Map<string, string>();
  private sources = new Map<string, ts.SourceFile>();
  private hashes = new Map<string, number>();
  private compilerOptions: ts.CompilerOptions;
  private program: ts.Program;

  constructor(
    private cwd: string,
    private cache: FileCache,
    private rootPaths: string[]
  ) {
    this.transformerManager = new TransformerManager(this.cwd);
  }

  private readFile(fileName: string) {
    let content = ts.sys.readFile(fileName);
    if (!content) {
      throw new Error(`Unable to read file ${fileName}`);
    }
    if (ScanApp.TS_TESTER.test(fileName)) {
      content = RegisterUtil.prepareTranspile(fileName, content);
    }
    return content;
  }

  private writeFile(fileName: string, content: string) {
    fileName = fileName.replace(/[.]js$/, '.ts');
    this.contents.set(fileName, content);
    this.hashes.set(fileName, SystemUtil.naiveHash(content));
    this.cache.writeEntry(fileName, content);
  }

  private fileExists(fileName: string) {
    return this.contents.has(fileName) || ts.sys.fileExists(fileName);
  }

  private getHost(): ts.CompilerHost {
    const host: ts.CompilerHost = {
      readFile: this.readFile,
      realpath: RegisterUtil.devResolve, // @TRV_DEV
      writeFile: this.writeFile,
      fileExists: this.fileExists,
      getDefaultLibFileName: ts.getDefaultLibFileName,
      getCurrentDirectory: () => this.cwd,
      getCanonicalFileName: x => x,
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      getSourceFile(this: SourceManager, fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean) {
        if (!this.sources.has(fileName) || shouldCreateNewSourceFile) {
          const content = this.readFile(fileName)!;
          this.sources.set(fileName, ts.createSourceFile(fileName, content ?? '', languageVersion));
        }
        return this.sources.get(fileName);
      },
      getDefaultLibLocation(this: SourceManager) {
        return path.dirname(ts.getDefaultLibFilePath(this.compilerOptions));
      },
    };
    for (const [k, v] of Object.entries(host)) {
      (host as any)[k] = v.bind(this);
    }
    return host;
  }

  private getProgram(forFile?: string) {
    if (!this.compilerOptions) {
      this.compilerOptions = CompilerUtil.resolveOptions(this.cwd);
    }

    if (!this.program || (forFile && !this.rootNames.has(forFile))) {
      console.debug(`Loading program ${this.rootNames.size}`, forFile);
      if (forFile) {
        this.rootNames.add(forFile);
      }
      this.program = ts.createProgram({
        rootNames: [...this.rootNames],
        options: this.compilerOptions,
        host: this.getHost(),
        oldProgram: this.program
      });
      this.transformerManager.checker = this.program.getTypeChecker();
    }
    return this.program;
  }

  private transpile(fileName: string, force = false) {
    if (force || !this.cache.hasEntry(fileName)) {
      console.trace('Emitting', fileName.replace(this.cwd, ''));

      const prog = this.getProgram(fileName);

      const result = prog.emit(
        prog.getSourceFile(fileName),
        undefined,
        undefined,
        false,
        this.transformerManager.transformers
      );

      CompilerUtil.checkTranspileErrors(this.cwd, fileName, result.diagnostics);
      // Save writing for typescript program (`writeFile`)
    } else {
      const cached = this.cache.readEntry(fileName);
      this.contents.set(fileName, cached);
    }

    return this.contents.get(fileName)!;
  }

  init() {
    // Find all active app files
    ScanApp.findActiveAppFiles(this.rootPaths,
      f => f.includes('@travetto/test') && // Exclude test unless in test mode, and it's a src file
        (Env.env !== 'test' || !f.includes('src/')),
      this.cwd
    )
      .filter(x => !require.cache[x])
      .forEach(x => this.rootNames.add(x));

    this.transformerManager.init();

    for (const root of this.rootNames) {
      require(root);
    }
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

  hasContents(file: string) {
    return this.contents.has(file);
  }

  getTranspiled(fileName: string, force = false) {
    // Do not typecheck the support code
    if (/\/support\/(transformer|phase).+/.test(fileName)) {
      return RegisterUtil.transpile(fileName, force);
    }

    try {
      return this.transpile(fileName, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        const errContent = CompilerUtil.getErrorModuleProxySource(err.message);
        this.contents.set(fileName, errContent);
        return this.transpile(fileName, true);
      } else {
        throw err;
      }
    }
  }

  unload(fileName: string, unlink = true) {
    if (this.contents.has(fileName)) {
      console.trace('Unloading', fileName.replace(this.cwd, ''), unlink);

      this.cache.removeExpiredEntry(fileName, unlink);

      if (unlink && this.hashes.has(fileName)) {
        this.hashes.delete(fileName);
      }
      this.sources.delete(fileName);
      this.rootNames.delete(fileName);
    }
  }

  reset() {
    this.contents.clear();
    this.rootNames.clear();
    this.sourceMaps.clear();
    this.sources.clear();
    this.hashes.clear();
    delete this.program;
    delete this.compilerOptions;
  }

  getSourceMapHandler() {
    return {
      emptyCacheBetweenOperations: !Env.prod, // Be less strict in non-dev
      retrieveFile: (p: string) => this.contents.get(p.replace('.js', '.ts'))!,
      retrieveSourceMap: (source: string) => this.sourceMaps.get(source.replace('.js', '.ts'))!
    };
  }
}