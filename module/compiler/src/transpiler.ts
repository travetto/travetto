import * as ts from 'typescript';
import * as path from 'path';

import { FileCache, TranspileUtil, FsUtil } from '@travetto/boot';
import { FrameworkUtil } from '@travetto/boot/src/framework';
import { ScanApp, Util } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';

import { TransformerManager } from './transformer';

const SIMPLE_COMPILATION = /support\/(transformer|phase|watch|lib)[.].+/;

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

  constructor(
    /**
     * Cache for transpilation
     */
    private cache: FileCache,
    /**
     * App Root paths to load files for
     */
    private roots: string[]
  ) {
    this.transformerManager = new TransformerManager();
  }

  /**
   * Read file from disk, using the transpile pre-processor on .ts files
   */
  private readFile(fileName: string) {
    let content = ts.sys.readFile(fileName);
    if (!content) {
      throw new Error(`Unable to read file ${fileName}`);
    }
    if (!fileName.endsWith('.d.ts') && fileName.endsWith('.ts')) {
      content = TranspileUtil.preProcess(fileName, content);
    }
    return content;
  }

  /**
   * Write file to disk, and set value in cache as well
   */
  private writeFile(fileName: string, content: string) {
    // @ts-ignore
    fileName = fileName.ᚕunix;
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
      realpath: FrameworkUtil.resolvePath,
      writeFile: this.writeFile,
      fileExists: this.fileExists,
      getDefaultLibFileName: ts.getDefaultLibFileName,
      getCurrentDirectory: () => FsUtil.cwd,
      getCanonicalFileName: x => x,
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      getSourceFile(this: Transpiler, fileName: string, languageVersion: ts.ScriptTarget, _, shouldCreateNewSourceFile?: boolean) {
        if (!this.sources.has(fileName) || shouldCreateNewSourceFile) {
          const content = this.readFile(fileName)!;
          this.sources.set(fileName, ts.createSourceFile(fileName, content ?? '', languageVersion));
        }
        return this.sources.get(fileName);
      },
      getDefaultLibLocation(this: Transpiler) {
        return path.dirname(ts.getDefaultLibFilePath(TranspileUtil.compilerOptions));
      },
    };
    for (const [k, v] of Object.entries(host) as [(keyof ts.CompilerHost), any][]) {
      if (Util.isFunction(v)) {
        host[k] = v.bind(this);
      }
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
        options: TranspileUtil.compilerOptions,
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
  private _transpile(fileName: string, force = false) {
    if (force || !this.cache.hasEntry(fileName)) {
      console.debug('Emitting', fileName.replace(`${FsUtil.cwd}/`, ''));

      const prog = this.getProgram(fileName);
      const result = prog.emit(
        prog.getSourceFile(fileName),
        undefined,
        undefined,
        false,
        this.transformerManager.getTransformers()
      );

      TranspileUtil.checkTranspileErrors(fileName, result.diagnostics);
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
    ScanApp.findAppSourceFiles({ roots: this.roots })
      .forEach(x => this.rootNames.add(x.file));

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
      console.debug(`Contents Unchanged: ${fileName}`);
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
  transpile(fileName: string, force = false) {
    // Do not typecheck the support code
    if (SIMPLE_COMPILATION.test(fileName)) {
      return TranspileUtil.transpile(fileName, force);
    }

    try {
      return this._transpile(fileName, force);
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
      console.debug('Unloading', fileName.replace(FsUtil.cwd, ''), unlink);

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