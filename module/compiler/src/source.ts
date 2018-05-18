import * as fs from 'fs';
import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';
import { AppEnv } from '@travetto/base';
import { CompilerUtil } from './util';

const stringHash = require('string-hash');

const CACHE_DIR = process.env.TS_CACHE_DIR!;
const CACHE_SEP = process.env.TS_CACHE_SEP!;

export class SourceManager {
  private sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  private contents = new Map<string, string>();
  private hashes = new Map<string, number>();

  constructor(private config: { cache?: boolean, cacheDir?: string } = {}) {
    Object.assign(config, { ... { cache: true }, config });

    try {
      fs.mkdirSync(this.config.cacheDir!);
    } catch (e) { }
  }

  private resolveCacheName(fileName: string) {
    return `${CACHE_DIR}/${fileName.replace(/[\/\\]/g, CACHE_SEP).replace(/.ts$/, '@ts')}`;
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
      console.debug('Emitting', fileName);

      const content = fs.readFileSync(fileName).toString();

      let hash = 0;

      if (AppEnv.watch && this.hashes.has(fileName)) {
        // Let's see if they are really different
        hash = stringHash(content);
        if (hash === this.hashes.get(fileName)) {
          console.debug(`Contents Unchanged: ${fileName}`);
          return false;
        }
      }

      const res = ts.transpileModule(content, options);

      if (this.logErrors(fileName, res.diagnostics)) {
        console.debug(`Compiling ${fileName} failed`);

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
      fs.writeFileSync(this.resolveCacheName(name), content)
    }
  }

  clear() {
    this.contents.clear();
    this.sourceMaps.clear();
    this.hashes.clear();
  }

  hasCached(file: string) {
    return this.config.cache && fs.existsSync(this.resolveCacheName(file));
  }

  getCached(file: string) {
    return fs.readFileSync(this.resolveCacheName(file)).toString();
  }

  deleteCached(file: string) {
    fs.unlinkSync(this.resolveCacheName(file));
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