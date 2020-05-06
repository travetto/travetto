import * as ts from 'typescript';
import * as path from 'path';

import { FileCache, TranspileUtil, FsUtil } from '@travetto/boot';

import { ScanApp } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { TransformerManager } from './transformer';

const SIMPLE_COMPILATION = /support\/(transformer|phase)[.].+/;

/**
 * Handles all transpilation from TS to JS.
 * Manages the source code and typescript relationship.
 * Also registers transformers for use in compilation
 */
export class Transpiler {
  private transformerManager: TransformerManager;

  private rootNames = new Set<string>();
  private contents = new Map<string, string>();
  private sources = new Map<string, ts.SourceFile>();
  private hashes = new Map<string, number>();
  private program: ts.Program;

  private get compilerOptions() {
    return {
      ...TranspileUtil.compilerOptions,
      rootDir: this.cwd,
      outDir: this.cwd
    };
  }

  constructor(
    /**
     * Root directory
     */
    private cwd: string,
    /**
     * Cache for transpilation
     */
    private cache: FileCache,
    /**
     * Root paths to load files for
     */
    private rootPaths: string[]
  ) {
    this.transformerManager = new TransformerManager(this.cwd);

    // Provide a new source lookup
    TranspileUtil.addSourceResolver(p => this.contents.get(p));
  }

  /**
   * Read file from disk, using the transpile pre-processor on .ts files
   */
  private readFile(fileName: string) {
    let content = ts.sys.readFile(fileName);
    if (!content) {
      throw new Error(`Unable to read file ${fileName}`);
    }
    if (ScanApp.TS_TESTER.test(fileName)) {
      content = TranspileUtil.preProcess(fileName, content);
    }
    return content;
  }

  /**
   * Write file to disk, and set value in cache as well
   */
  private writeFile(fileName: string, content: string) {
    fileName = FsUtil.toTS(fileName);
    this.contents.set(fileName, content);
    this.hashes.set(fileName, SystemUtil.naiveHash(content));
    this.cache.writeEntry(fileName, content);
  }

  /**
   * See if a file exists
   */
  private fileExists(fileName: string) {
    return this.contents.has(fileName) || ts.sys.fileExists(fileName);
  }

  /**
   * Build typescript compilation host
   */
  private getHost(): ts.CompilerHost {
    const host: ts.CompilerHost = {
      readFile: this.readFile,
      realpath: x => /* @check:devResolve */ x /* @end */, // @line-if $TRV_DEV
      writeFile: this.writeFile,
      fileExists: this.fileExists,
      getDefaultLibFileName: ts.getDefaultLibFileName,
      getCurrentDirectory: () => this.cwd,
      getCanonicalFileName: x => x,
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      getSourceFile(this: Transpiler, fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean) {
        if (!this.sources.has(fileName) || shouldCreateNewSourceFile) {
          const content = this.readFile(fileName)!;
          this.sources.set(fileName, ts.createSourceFile(fileName, content ?? '', languageVersion));
        }
        return this.sources.get(fileName);
      },
      getDefaultLibLocation(this: Transpiler) {
        return path.dirname(ts.getDefaultLibFilePath(this.compilerOptions));
      },
    };
    for (const [k, v] of Object.entries(host)) {
      (host as any)[k] = v.bind(this);
    }
    return host;
  }

  /**
   * Build typescript program
   *
   * @param forFile If this file is new, force a recompilation
   */
  private getProgram(forFile?: string): ts.Program {
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
      this.transformerManager.build(this.program.getTypeChecker());
    }
    return this.program;
  }

  /**
   * Perform actual transpilation
   */
  private transpile(fileName: string, force = false) {
    if (force || !this.cache.hasEntry(fileName)) {
      console.trace('Emitting', fileName.replace(this.cwd, ''));

      const prog = this.getProgram(fileName);
      const result = prog.emit(
        prog.getSourceFile(fileName),
        undefined,
        undefined,
        false,
        this.transformerManager.getTransformers()
      );

      TranspileUtil.checkTranspileErrors(this.cwd, fileName, result.diagnostics);
      // Save writing for typescript program (`writeFile`)
    } else {
      const cached = this.cache.readEntry(fileName);
      this.contents.set(fileName, cached);
    }

    return this.contents.get(fileName)!;
  }

  /**
   * Initialize
   */
  init() {
    // Find all active app files
    ScanApp.findAppFiles(this.rootPaths, undefined, this.cwd)
      .forEach(x => this.rootNames.add(x));

    this.transformerManager.init();
  }

  /**
   * Return all root files for the ts compiler
   */
  getRootFiles() {
    return [...this.rootNames];
  }

  /**
   * See if a file's hash code has changed
   */
  hashChanged(fileName: string, content: string) {
    // Let's see if they are really different
    const hash = SystemUtil.naiveHash(content);
    if (hash === this.hashes.get(fileName)) {
      console.trace(`Contents Unchanged: ${fileName}`);
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
   * Get the transpiled content
   */
  getTranspiled(fileName: string, force = false) {
    // Do not typecheck the support code
    if (SIMPLE_COMPILATION.test(fileName)) {
      return TranspileUtil.transpile(fileName, force);
    }

    try {
      return this.transpile(fileName, force);
    } catch (err) {
      const errContent = TranspileUtil.handlePhaseError('transpile', fileName, err);
      this.contents.set(fileName, errContent);
      return errContent;
    }
  }

  /**
   * Unload a file from the transpiler
   */
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

  /**
   * Reset the transpiler
   */
  reset() {
    this.transformerManager.reset();
    this.contents.clear();
    this.rootNames.clear();
    this.sources.clear();
    this.hashes.clear();
    delete this.program;
  }
}