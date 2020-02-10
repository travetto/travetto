import * as ts from 'typescript';
import * as path from 'path';
import * as sourcemap from 'source-map-support';

import { FileCache, RegisterUtil } from '@travetto/boot';
import { Env, SystemUtil, ScanApp } from '@travetto/base';

import { CompilerUtil } from './util';
import { TransformerManager } from './transformer/manager';

export class SourceManager {
  private transformerManager: TransformerManager;

  private sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  private contents = new Map<string, string>();
  private sources = new Map<string, ts.SourceFile>();
  private hashes = new Map<string, number>();
  private cache: FileCache;
  private compilerOptions: ts.CompilerOptions;
  private program: ts.Program;

  constructor(private cwd: string, private config: { cache?: boolean }) {
    Object.assign(config, { ... { cache: true }, config });
    this.cache = new FileCache(this.cwd);
    this.transformerManager = new TransformerManager(this.cwd);
  }

  private getHost(): ts.CompilerHost {
    const host: ts.CompilerHost = {
      getCurrentDirectory(this: SourceManager) {
        return this.cwd;
      },
      getSourceFile(this: SourceManager, fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean) {
        // fileName = RegisterUtil.resolveFrameworkDevFile(fileName);
        if (!this.sources.has(fileName) || shouldCreateNewSourceFile) {
          const content = host.readFile(fileName)!;
          this.sources.set(fileName, ts.createSourceFile(fileName, content ?? '', languageVersion));
        }
        return this.sources.get(fileName);
      },
      readFile(this: SourceManager, fileName: string) {
        // fileName = RegisterUtil.resolveFrameworkDevFile(fileName);
        let content = ts.sys.readFile(fileName);
        if (!content) {
          throw new Error(`Unable to read file  ${fileName}`);
        }
        if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')) {
          content = RegisterUtil.prepareTranspile(fileName, content);
        }
        return content;
      },
      realpath(this: SourceManager, file: string) {
        return RegisterUtil.resolveFrameworkDevFile(file);
      },
      writeFile(this: SourceManager, fileName: string, data: string) {
        // fileName = RegisterUtil.resolveFrameworkDevFile(fileName);
        if (this.config.cache) {
          this.cache.writeEntry(fileName, data);
        }
      },
      fileExists(this: SourceManager, fileName: string) {
        // fileName = RegisterUtil.resolveFrameworkDevFile(fileName);
        return this.contents.has(fileName) || ts.sys.fileExists(fileName);
      },
      getDefaultLibFileName(this: SourceManager, opts) {
        return ts.getDefaultLibFileName(this.compilerOptions);
      },
      getDefaultLibLocation(this: SourceManager) {
        return path.dirname(ts.getDefaultLibFilePath(this.compilerOptions));
      },
      getCanonicalFileName(this: SourceManager, x) {
        return x;
      },
      useCaseSensitiveFileNames(this: SourceManager) {
        return ts.sys.useCaseSensitiveFileNames;
      },
      getNewLine(this: SourceManager) {
        return ts.sys.newLine;
      }
    };
    for (const [k, v] of Object.entries(host)) {
      (host as any)[k] = v.bind(this);
    }
    return host;
  }

  private getProgram() {
    if (!this.compilerOptions) {
      this.compilerOptions = CompilerUtil.resolveOptions(this.cwd);
    }

    if (!this.program) {
      this.program = ts.createProgram({
        rootNames: ScanApp.getStandardAppFiles()
          .filter(x => !require.cache[x])
          .filter(x => !/support\/transformer/.test(x)),
        options: this.compilerOptions,
        host: this.getHost()
      });
    }
    return this.program;
  }

  private transpileFile(fileName: string, force = false) {
    if (force || !(this.config.cache && this.cache.hasEntry(fileName))) {
      console.trace('Emitting', fileName.replace(this.cwd, ''));

      const prog = this.getProgram();

      const result = prog.emit(
        prog.getSourceFile(fileName),
        (file, contents) => {
          console.error('Completed', file);
          this.contents.set(file, contents);
          this.hashes.set(file, SystemUtil.naiveHash(contents));
        },
        undefined,
        false,
        this.transformerManager.transformers
      );

      console.error('Done', fileName, this.contents.get(fileName)?.length);

      CompilerUtil.checkTranspileErrors(this.cwd, fileName, result.diagnostics);
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

  transpile(fileName: string, force = false) {
    console.trace('Transpiling', fileName.replace(this.cwd, ''));
    try {
      return this.transpileFile(fileName, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        const errContent = CompilerUtil.getErrorModuleProxySource(err.message);
        this.contents.set(fileName, errContent);
        return this.transpileFile(fileName, true);
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
    this.sources.clear();
    this.hashes.clear();
  }
}