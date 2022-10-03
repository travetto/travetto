import * as ts from 'typescript';
import { readFileSync } from 'fs';
import * as path from 'path';

import { Host, PathUtil } from '@travetto/boot';
import { TranspileCache } from '@travetto/boot/src/internal/transpile-cache';
import { SystemUtil } from '@travetto/boot/src/internal/system';
import { TranspileUtil } from '@travetto/boot/src/internal/transpile-util';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { AppManifest } from '@travetto/base';

/**
 * Manages the source code and typescript relationship.
 */
export class SourceHost implements ts.CompilerHost {

  #rootFiles = new Set<string>();
  #hashes = new Map<string, number>();
  #sources = new Map<string, ts.SourceFile>();
  readonly contents = new Map<string, string>();

  #trackFile(filename: string, content: string): void {
    this.contents.set(filename, content);
    this.#hashes.set(filename, SystemUtil.naiveHash(readFileSync(filename, 'utf8'))); // Get og content for hashing
  }

  getCanonicalFileName: (file: string) => string = (f: string) => f;
  getCurrentDirectory: () => string = () => PathUtil.cwd;
  getDefaultLibFileName: (opts: ts.CompilerOptions) => string = (opts: ts.CompilerOptions) => ts.getDefaultLibFileName(opts);
  getNewLine: () => string = () => ts.sys.newLine;
  useCaseSensitiveFileNames: () => boolean = () => ts.sys.useCaseSensitiveFileNames;
  getDefaultLibLocation(): string {
    return path.dirname(ts.getDefaultLibFilePath(TranspileUtil.compilerOptions));
  }

  /**
   * Get root files
   */
  getRootFiles(): Set<string> {
    if (!this.#rootFiles.size) {
      // Only needed for compilation
      this.#rootFiles = new Set(SourceIndex.findByFolders(AppManifest.source, 'required').map(x => x.file));
    }
    return this.#rootFiles;
  }

  /**
   * Read file from disk, using the transpile pre-processor on .ts files
   */
  readFile(filename: string): string {
    filename = PathUtil.toUnixSource(filename);
    let content = ts.sys.readFile(filename);
    if (content === undefined) {
      throw new Error(`Unable to read file ${filename}`);
    }
    if (Host.EXT.inputMatcher(filename)) {
      content = TranspileUtil.preProcess(filename, content);
    }
    return content;
  }

  /**
   * Write file to disk, and set value in cache as well
   */
  writeFile(filename: string, content: string): void {
    filename = PathUtil.toUnixSource(filename);
    this.#trackFile(filename, content);
    TranspileCache.writeEntry(filename, content);
  }

  /**
   * Fetch file
   */
  fetchFile(filename: string): void {
    filename = PathUtil.toUnixSource(filename);
    const cached = TranspileCache.readEntry(filename);
    this.#trackFile(filename, cached);
  }

  /**
   * Get a source file on demand
   * @returns
   */
  getSourceFile(filename: string, __tgt: unknown, __onErr: unknown, force?: boolean): ts.SourceFile {
    if (!this.#sources.has(filename) || force) {
      const content = this.readFile(filename)!;
      this.#sources.set(filename, ts.createSourceFile(filename, content ?? '',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (TranspileUtil.compilerOptions as ts.CompilerOptions).target!
      ));
    }
    return this.#sources.get(filename)!;
  }

  /**
   * See if a file exists
   */
  fileExists(filename: string): boolean {
    filename = PathUtil.toUnixSource(filename);
    return this.contents.has(filename) || ts.sys.fileExists(filename);
  }

  /**
   * See if a file's hash code has changed
   */
  hashChanged(filename: string, content?: string): boolean {
    content ??= readFileSync(filename, 'utf8');
    // Let's see if they are really different
    const hash = SystemUtil.naiveHash(content);
    if (hash === this.#hashes.get(filename)) {
      console.debug('Contents Unchanged', { filename });
      return false;
    }
    return true;
  }

  /**
   * Unload a file from the transpiler
   */
  unload(filename: string, unlink = true): void {
    if (this.contents.has(filename)) {
      TranspileCache.removeExpiredEntry(filename, unlink);

      if (unlink && this.#hashes.has(filename)) {
        this.#hashes.delete(filename);
      }
      this.#rootFiles.delete(filename);
      this.contents.delete(filename);
      this.#sources.delete(filename);
    }
  }

  /**
   * Reset the transpiler
   */
  reset(): void {
    this.contents.clear();
    this.#rootFiles.clear();
    this.#hashes.clear();
    this.#sources.clear();
  }
}