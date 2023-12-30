import fs from 'node:fs/promises';

import { FileLoader, TypedObject, WatchEvent, watchCompiler } from '@travetto/base';
import { EmailCompileSource, EmailCompiled, EmailCompileContext, MailUtil } from '@travetto/email';
import { RuntimeIndex, path } from '@travetto/manifest';
import { WorkQueue } from '@travetto/worker';

import { EmailCompileUtil } from './util';

const VALID_FILE = (file: string): boolean => /[.](scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

/**
 * Email compilation support
 */
export class EmailCompiler {

  /**
   * Watch folders as needed
   */
  static async #watchFolders(folders: string[], handler: (ev: WatchEvent) => void, signal: AbortSignal): Promise<void> {
    for (const src of folders) {
      (async (): Promise<void> => {
        for await (const ev of fs.watch(src, {
          recursive: true,
          signal,
          persistent: false
        })) {
          const exists = ev.filename ? await fs.stat(ev.filename).catch(() => false) : false;
          handler({ action: !!exists ? 'create' : 'delete', file: path.toPosix(ev.filename!), folder: src });
        }
      })();
    }
  }

  /** Load Template */
  static async loadTemplate(file: string): Promise<EmailCompileContext> {
    const entry = RuntimeIndex.getEntry(file);
    if (!entry) {
      throw new Error(`Unable to find template for ${file}`);
    }
    const root = (await import(entry.outputFile)).default;
    const og: EmailCompileSource = await root.wrap();
    const res: EmailCompileContext = {
      file: entry.sourceFile,
      module: entry.module,
      images: {},
      styles: {},
      ...og
    };
    return res;
  }

  /**
   * Grab list of all available templates
   */
  static findAllTemplates(mod?: string): string[] {
    return RuntimeIndex
      .find({
        module: m => !mod ? m.roles.includes('std') : mod === m.name,
        folder: f => f === 'support',
        file: f => EmailCompileUtil.isTemplateFile(f.sourceFile)
      })
      .map(x => x.sourceFile);
  }

  /**
   * Get output files
   */
  static getOutputFiles(file: string): EmailCompiled {
    const entry = RuntimeIndex.getEntry(file)!;
    const mod = RuntimeIndex.getModule(entry.module)!;
    return EmailCompileUtil.getOutputs(file, path.join(mod.sourcePath, 'resources'));
  }

  /**
   * Get the sending email key from a template file
   */
  static async templateFileToKey(file: string): Promise<string> {
    return EmailCompileUtil.buildOutputPath(file, '');
  }

  /**
   * Write template to file
   */
  static async writeTemplate(file: string, msg: EmailCompiled): Promise<void> {
    const outs = this.getOutputFiles(file);
    await Promise.all(TypedObject.keys(outs).map(async k => {
      if (msg[k]) {
        await fs.mkdir(path.dirname(outs[k]), { recursive: true });
        await fs.writeFile(outs[k], MailUtil.buildBrand(file, msg[k], 'trv email:compile'), { encoding: 'utf8' });
      } else {
        await fs.unlink(outs[k]).catch(() => { }); // Remove file if data not provided
      }
    }));
  }

  /**
   * Compile a file given a resource provider
   */
  static async compile(file: string, persist: boolean = false): Promise<EmailCompiled> {
    const src = await this.loadTemplate(file);
    const compiled = await EmailCompileUtil.compile(src);
    if (persist) {
      await this.writeTemplate(file, compiled);
    }
    return compiled;
  }

  /**
   * Compile all
   */
  static async compileAll(mod?: string): Promise<string[]> {
    const keys = this.findAllTemplates(mod);
    await Promise.all(keys.map(src => this.compile(src, true)));
    return keys;
  }

  /**
   * Watch compilation
   */
  static async * watchCompile(): AsyncIterable<string> {
    const all = FileLoader.resolvePaths(
      this.findAllTemplates().map(x => `${RuntimeIndex.getEntry(x)!.module}#resources`)
    );

    const ctrl = new AbortController();
    const stream = new WorkQueue<WatchEvent>([], ctrl.signal);

    // watch resources
    this.#watchFolders(all, ev => stream.add(ev), ctrl.signal);

    // Watch template files
    watchCompiler(ev => {
      const src = RuntimeIndex.getEntry(ev.file);
      if (src && EmailCompileUtil.isTemplateFile(src.sourceFile)) {
        setTimeout(() => stream.add({ ...ev, file: src.sourceFile }), 100); // Wait for it to be loaded
      }
    }, { signal: ctrl.signal });

    for await (const { file, action } of stream) {
      if (action === 'delete') {
        continue;
      }

      try {
        if (EmailCompileUtil.isTemplateFile(file)) {
          await this.compile(file, true);
          console.log(`Successfully compiled ${1} templates`, { changed: [file] });
          yield file;
        } else if (VALID_FILE(file)) {
          const rootFile = file.replace(/\/resources.*/, '/package.json');
          const mod = RuntimeIndex.getFromSource(rootFile)!.module;
          const changed = await this.compileAll(mod);
          console.log(`Successfully compiled ${changed.length} templates`, { changed, file });
          yield* changed;
        }
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    }
  }
}