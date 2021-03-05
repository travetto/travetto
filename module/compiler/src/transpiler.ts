import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

import { FsUtil, AppCache } from '@travetto/boot';
import { ModuleUtil, SourceUtil, TranspileUtil } from '@travetto/boot/src/internal';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { TransformerManager } from './transformer';

/**
 * Handles all transpilation from TS to JS.
 * Manages the source code and typescript relationship.
 * Also registers transformers for use in compilation
 */
export class Transpiler {
  private transformerManager: TransformerManager;
  private host: ts.CompilerHost;

  private contents = new Map<string, string>();
  private sources = new Map<string, ts.SourceFile>();
  private hashes = new Map<string, number>();
  private program: ts.Program | undefined;

  constructor(
    /**
     * App Root paths to load files for
     */
    private rootNames: Set<string>
  ) {
    this.transformerManager = new TransformerManager();
  }

  /**
   * Read file from disk, using the transpile pre-processor on .ts files
   */
  private readFile(filename: string) {
    let content = ts.sys.readFile(filename);
    if (content === undefined) {
      throw new Error(`Unable to read file ${filename}`);
    }
    if (filename.endsWith(SourceUtil.EXT) && !filename.endsWith('.d.ts')) {
      content = SourceUtil.preProcess(filename, content);
    }
    return content;
  }

  /**
   * Write file to disk, and set value in cache as well
   */
  private writeFile(filename: string, content: string) {
    filename = FsUtil.toUnixTs(filename);
    this.contents.set(filename, content);
    this.hashes.set(filename, SystemUtil.naiveHash(content));
    AppCache.writeEntry(filename, content);
  }

  /**
   * See if a file exists
   */
  private fileExists(filename: string) {
    return this.contents.has(filename) || ts.sys.fileExists(filename);
  }

  /**
   * Build typescript compilation host
   */
  private getHost(): ts.CompilerHost {
    const host: ts.CompilerHost = {
      readFile: f => this.readFile(f),
      writeFile: (f, c) => this.writeFile(f, c),
      fileExists: f => this.fileExists(f),
      getDefaultLibFileName: (opts) => ts.getDefaultLibFileName(opts),
      getCurrentDirectory: () => FsUtil.cwd,
      getCanonicalFileName: x => x,
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      getSourceFile: (filename: string, languageVersion: ts.ScriptTarget, _, shouldCreateNewSourceFile?: boolean) => {
        if (!this.sources.has(filename) || shouldCreateNewSourceFile) {
          const content = this.readFile(filename)!;
          this.sources.set(filename, ts.createSourceFile(filename, content ?? '', languageVersion));
        }
        return this.sources.get(filename);
      },
      getDefaultLibLocation: () => path.dirname(ts.getDefaultLibFilePath(
        TranspileUtil.compilerOptions as ts.CompilerOptions
      )),
    };
    return host;
  }

  /**
   * Build typescript program
   *
   * @param forFile If this file is new, force a recompilation
   */
  private getProgram(forFile?: string): ts.Program {
    if (!this.program || (forFile && !this.rootNames.has(forFile))) {
      console.debug('Loading program', { size: this.rootNames.size, src: forFile });
      if (forFile) {
        this.rootNames.add(forFile);
      }
      this.program = ts.createProgram({
        rootNames: [...this.rootNames],
        options: TranspileUtil.compilerOptions as ts.CompilerOptions,
        host: this.host,
        oldProgram: this.program
      });

      this.transformerManager.build(this.program.getTypeChecker());
    }
    return this.program;
  }

  /**
   * Perform actual transpilation
   */
  private _transpile(filename: string, force = false) {
    if (force || !AppCache.hasEntry(filename)) {
      console.debug('Emitting', { filename: filename.replace(FsUtil.cwd, '.') });

      const prog = this.getProgram(filename);
      const result = prog.emit(
        prog.getSourceFile(filename),
        undefined,
        undefined,
        false,
        this.transformerManager.getTransformers()
      );

      TranspileUtil.checkTranspileErrors(filename, result.diagnostics as []);
      // Save writing for typescript program (`writeFile`)
    } else {
      const cached = AppCache.readEntry(filename);
      this.contents.set(filename, cached);
    }

    return this.contents.get(filename)!;
  }

  /**
   * Initialize
   */
  async init() {
    this.host = this.getHost();
    await this.transformerManager.init();
  }

  /**
   * See if a file's hash code has changed
   */
  hashChanged(filename: string, content?: string) {
    content ??= fs.readFileSync(filename, 'utf8');
    // Let's see if they are really different
    const hash = SystemUtil.naiveHash(content);
    if (hash === this.hashes.get(filename)) {
      console.debug('Contents Unchanged', { filename });
      return false;
    }
    return true;
  }

  /**
   * Determine if file has been transpiled yet
   */
  hasContents(file: string) {
    return this.contents.has(file);
  }

  /**
   * Get contents
   */
  getContents(file: string) {
    return this.contents.get(file);
  }

  /**
   * Get the transpiled content
   */
  transpile(filename: string, force = false) {
    try {
      return this._transpile(filename, force);
    } catch (err) {
      const errContent = ModuleUtil.handlePhaseError('transpile', filename, err);
      this.contents.set(filename, errContent);
      return errContent;
    }
  }

  /**
   * Unload a file from the transpiler
   */
  unload(filename: string, unlink = true) {
    if (this.contents.has(filename)) {
      console.debug('Unloading', { filename: filename.replace(FsUtil.cwd, '.'), unlink });

      AppCache.removeExpiredEntry(filename, unlink);

      if (unlink && this.hashes.has(filename)) {
        this.hashes.delete(filename);
      }
      this.sources.delete(filename);
      this.rootNames.delete(filename);
    }
  }

  /**
   * Reset the transpiler
   */
  reset() {
    this.transformerManager.reset();
    this.contents.clear();
    // this.rootNames.clear();
    this.sources.clear();
    this.hashes.clear();
    delete this.program;
  }
}