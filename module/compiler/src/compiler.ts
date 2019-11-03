import { FsUtil } from '@travetto/boot';
import { Env, AppError, Shutdown } from '@travetto/base';

import { TransformerManager } from './transformer/manager';
import { SourceManager } from './source';
import { CompilerUtil } from './util';

class $Compiler {

  sourceManager: SourceManager;
  transformerManager: TransformerManager;
  active = false;

  constructor(public cwd: string) {

    // Get Files proper like
    this.transformerManager = new TransformerManager(this.cwd);
    this.sourceManager = new SourceManager(this.cwd, {});

    if (Env.watch) {
      Shutdown.onUnhandled(err => {
        if (err && (err.message || '').includes('Cannot find module')) { // Handle module reloading
          console.error(err);
          return true;
        }
      }, 0);
    }
  }

  init() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.sourceManager.registerSourceMaps();
    this.transformerManager.init();
    require.extensions['.ts'] = this.requireHandler.bind(this);

    const start = Date.now();
    console.debug('Initialized', (Date.now() - start) / 1000);
  }

  reset() {
    this.sourceManager.clear();
    this.active = false;

    this.init();
  }

  requireHandler(m: NodeModule, tsf: string) {
    const jsf = tsf.replace(/\.ts$/, '.js');

    // Log transpiled content as needed
    const content = this.sourceManager.get(tsf)!;
    try {
      return (m as any)._compile(content, jsf);
    } catch (e) {

      if (e.message.startsWith('Cannot find module') || e.message.startsWith('Unable to load')) {
        const modName = m.filename.replace(`${this.cwd}/`, '');
        e = new AppError(`${e.message} ${e.message.includes('from') ? `[via ${modName}]` : `from ${modName}`}`, 'general');
      }

      const file = tsf.replace(`${Env.cwd}/`, '');
      if (tsf.includes('/extension/')) { // If errored out on extension loading
        console.debug(`Ignoring load for ${file}:`, e.message.split(' from ')[0]);
      } else if (Env.watch) {
        console.error(`Stubbing out with error proxy due to error in compiling ${file}: `, e.message);
        const content = CompilerUtil.getErrorModuleProxySource(e.message);
        return (m as any)._compile(content, jsf)
      } else {
        throw e;
      }
    }
  }

  unload(fileName: string, unlink = true) {
    console.trace('Unloading', fileName);

    if (this.sourceManager.has(fileName)) {
      this.sourceManager.unload(fileName, unlink);
    }

    const native = FsUtil.toNative(fileName);
    if (native in require.cache) {
      delete require.cache[native];
    }
  }

  transpile(fileName: string, force = false) {
    let changed: boolean = false;
    try {
      changed = this.sourceManager.transpile(fileName, {
        fileName,
        reportDiagnostics: true,
        transformers: this.transformerManager.transformers ?? {}
      }, force);
    } catch (err) {
      if (Env.watch) { // Handle transpilation errors
        this.sourceManager.set(fileName, CompilerUtil.getErrorModuleProxySource(err.message));
        changed = this.sourceManager.transpile(fileName, { fileName }, true);
      } else {
        throw err;
      }
    }

    return changed;
  }
}

export const Compiler = new $Compiler(Env.cwd);