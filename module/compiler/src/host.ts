import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

import { PathUtil, AppCache } from '@travetto/boot';
import { SourceUtil } from '@travetto/boot/src/internal/source-util';
import { SystemUtil } from '@travetto/base/src/internal/system';
import { TranspileUtil } from '@travetto/boot/src-ts/internal/transpile-util';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { AppManifest } from '@travetto/base';

/**
 * Manages the source code and typescript relationship.
 */
export class SourceHost implements ts.CompilerHost {

  private rootFiles = new Set<string>();
  private hashes = new Map<string, number>();
  private sources = new Map<string, ts.SourceFile>();
  readonly contents = new Map<string, string>();

  getCanonicalFileName = (f: string) => f;
  getCurrentDirectory = () => PathUtil.cwd;
  getDefaultLibFileName = (opts: ts.CompilerOptions) => ts.getDefaultLibFileName(opts);
  getNewLine = () => ts.sys.newLine;
  useCaseSensitiveFileNames = () => ts.sys.useCaseSensitiveFileNames;
  getDefaultLibLocation() {
    return path.dirname(ts.getDefaultLibFilePath(TranspileUtil.compilerOptions as ts.CompilerOptions));
  }

  /**
   * Get root files
   */
  getRootFiles() {
    if (!this.rootFiles.size) {
      // Only needed for compilation
      this.rootFiles = new Set(SourceIndex.findByFolders(AppManifest.source, 'required').map(x => x.file));
    }
    return this.rootFiles;
  }

  /**
   * Read file from disk, using the transpile pre-processor on .ts files
   */
  readFile(filename: string) {
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
  writeFile(filename: string, content: string) {
    this.trackFile(filename, content);
    AppCache.writeEntry(filename, content);
  }

  trackFile(filename: string, content: string) {
    filename = PathUtil.toUnixTs(filename);
    this.contents.set(filename, content);
    this.hashes.set(filename, SystemUtil.naiveHash(fs.readFileSync(filename, 'utf8'))); // Get og content for hashing
  }

  /**
   * Get a source file on demand
   * @returns
   */
  getSourceFile(filename: string, _tgt: unknown, _onErr: unknown, force?: boolean) {
    if (!this.sources.has(filename) || force) {
      const content = this.readFile(filename)!;
      this.sources.set(filename, ts.createSourceFile(filename, content ?? '',
        (TranspileUtil.compilerOptions as ts.CompilerOptions).target!
      ));
    }
    return this.sources.get(filename);
  }

  /**
   * See if a file exists
   */
  fileExists(filename: string) {
    return this.contents.has(filename) || ts.sys.fileExists(filename);
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
   * Unload a file from the transpiler
   */
  unload(filename: string, unlink = true) {
    if (this.contents.has(filename)) {
      AppCache.removeExpiredEntry(filename, unlink);

      if (unlink && this.hashes.has(filename)) {
        this.hashes.delete(filename);
      }
      this.rootFiles.delete(filename);
      this.contents.delete(filename);
      this.sources.delete(filename);
    }
  }

  /**
   * Reset the transpiler
   */
  reset() {
    this.contents.clear();
    this.rootFiles.clear();
    this.hashes.clear();
    this.sources.clear();
  }
}