import * as fs from 'fs';
import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';
import { AppEnv } from '@travetto/base';
import { CompilerUtil } from './util';
import { Cache } from '@travetto/base/src/cache';

const stringHash = require('string-hash');

export class SourceManager {
  private sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  private contents = new Map<string, string>();
  private hashes = new Map<string, number>();
  private cache = new Cache(AppEnv.cwd);

  constructor(private config: { cache?: boolean } = {}) {
    Object.assign(config, { ... { cache: true }, config });
  }

  registerSourceMaps() {
    sourcemap.install({
      emptyCacheBetweenOperations: AppEnv.test || AppEnv.debug,
      retrieveFile: (p: string) => this.contents.get(p.replace('.js', '.ts'))!,
      retrieveSourceMap: (source: string) => this.sourceMaps.get(source.replace('.js', '.ts'))!
    });
  }

  transpile(fileName: string, options: ts.TranspileOptions, force = false) {
    if (force || !this.hasCached(fileName)) {
      console.trace('Emitting', fileName);

      const content = fs.readFileSync(fileName).toString();

      let hash = 0;

      if (AppEnv.watch && this.hashes.has(fileName)) {
        // Let's see if they are really different
        hash = stringHash(content);
        if (hash === this.hashes.get(fileName)) {
          console.trace(`Contents Unchanged: ${fileName}`);
          return false;
        }
      }

      const res = ts.transpileModule(content, options);

      if (this.logErrors(fileName, res.diagnostics)) {
        console.error(`Compiling ${fileName} failed`);

        if (!AppEnv.prod) { // If attempting to load an optional require
          console.error(`Unable to import ${fileName}, stubbing out`);
          this.set(fileName, CompilerUtil.EMPTY_MODULE);
          return true;
        } else {
          return false;
        }
      }

      if (AppEnv.watch) {
        this.hashes.set(fileName, hash);
      }

      this.set(fileName, res.outputText);

      return true;
    } else {
      const cached = this.getCached(fileName);
      this.contents.set(fileName, cached);
      return true;
    }
  }

  logErrors(fileName: string, diagnostics?: ts.Diagnostic[]) {
    if (!diagnostics || !diagnostics.length) {
      return false;
    }

    for (const diagnostic of diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start as number);
        console.error(`  Error ${diagnostic.file.fileName}(${line + 1}, ${character + 1}): ${message}`);
      } else {
        console.error(`  Error: ${message}`);
      }
    }

    return diagnostics.length !== 0;
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

  deleteCached(file: string) {
    this.cache.removeEntry(file);
  }

  unload(name: string) {
    if (this.hasCached(name)) {
      this.deleteCached(name);
    }

    if (this.hashes.has(name)) {
      this.hashes.delete(name);
    }
  }
}