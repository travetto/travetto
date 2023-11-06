import fs from 'fs/promises';

import { CompilerClient, FileQueryProvider, TypedObject } from '@travetto/base';
import { EmailCompileSource, EmailCompiled, EmailCompileContext, MailUtil } from '@travetto/email';
import { RootIndex, path } from '@travetto/manifest';
import { ManualAsyncIterator as Queue } from '@travetto/worker';

import { EmailCompileUtil } from './util';

const VALID_FILE = (file: string): boolean => /[.](scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

type WatchEvent = { action: 'create' | 'update' | 'delete', file: string, folder: string };

/**
 * Email compilation support
 */
export class EmailCompiler {

  /**
   * Watch folders as needed
   */
  static async #watchFolders(folders: string[], handler: (ev: WatchEvent) => void, signal: AbortSignal): Promise<void> {
    const lib = await import('@parcel/watcher');
    for (const src of folders) {
      const cleanup = await lib.subscribe(src, async (err, events) => {
        for (const ev of events) {
          handler({ action: ev.type, file: path.toPosix(ev.path), folder: src });
        }
      });
      signal.addEventListener('abort', () => cleanup.unsubscribe());
    }
  }

  /** Load Template */
  static async loadTemplate(file: string): Promise<EmailCompileContext> {
    const entry = RootIndex.getEntry(file);
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
    return RootIndex
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
    const entry = RootIndex.getEntry(file)!;
    const mod = RootIndex.getModule(entry.module)!;
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const all = new FileQueryProvider(
      [...new Set(this.findAllTemplates()
        .map(x => RootIndex.getEntry(x)!.module)
      )].map(x => path.resolve(RootIndex.getModule(x)!.sourcePath, 'resources'))
    );

    const ctrl = new AbortController();
    const stream = new Queue<WatchEvent>([], ctrl.signal);

    // watch resources
    this.#watchFolders(all.searchPaths, ev => stream.add(ev), ctrl.signal);

    // Watch template files
    new CompilerClient().onFileChange(ev => {
      const src = RootIndex.getEntry(ev.file);
      if (src && EmailCompileUtil.isTemplateFile(src.sourceFile)) {
        setTimeout(() => stream.add({ ...ev, file: src.sourceFile }), 100); // Wait for it to be loaded
      }
    });

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
          const mod = RootIndex.getFromSource(rootFile)!.module;
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