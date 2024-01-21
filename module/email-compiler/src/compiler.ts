import fs from 'node:fs/promises';

import { AppError, Env, FileLoader, TypedObject, WatchEvent, watchCompiler } from '@travetto/base';
import { EmailTemplatePrepared, EmailCompiled, MailUtil, EmailTemplateImport } from '@travetto/email';
import { RuntimeIndex, path } from '@travetto/manifest';
import { WorkQueue } from '@travetto/worker';

import { EmailCompileUtil } from './util';

const VALID_FILE = (file: string): boolean => /[.](scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

/**
 * Email compilation support
 */
export class EmailCompiler {


  static #getLoader(moduleResources: string[], globalResources: string[]): FileLoader {
    return new FileLoader([
      ...Env.TRV_RESOURCES.list ?? [], '@#resources',
      ...moduleResources, '@@#resources',
      ...globalResources
    ]);
  }

  /**
   * Watch folders as needed
   */
  static async #watchFolders(folders: string[], handler: (ev: WatchEvent) => void, signal: AbortSignal): Promise<void> {
    for (const src of folders) {
      (async (): Promise<void> => {
        for await (const ev of fs.watch(src, { recursive: true, signal, persistent: false })) {
          if (ev.filename && VALID_FILE(ev.filename) && await fs.stat(ev.filename).catch(() => { })) {
            await handler({ file: path.toPosix(ev.filename!), action: 'update' });
          }
        }
      })();
    }
  }

  /** Load Template */
  static async loadTemplate(file: string): Promise<EmailTemplatePrepared> {
    const entry = RuntimeIndex.getEntry(file);
    const mod = entry ? RuntimeIndex.getModule(entry.module) : undefined;
    if (!entry || !mod) {
      throw new Error(`Unable to find template for ${file}`);
    }
    const root: EmailTemplateImport<unknown> = (await import(entry.outputFile)).default;
    const og = await root.prepare({ file, module: mod.name });
    const moduleResources = RuntimeIndex.getDependentModules(mod, 'children').map(x => `${x.name}#resources`);
    const res: EmailTemplatePrepared = {
      ...og,
      images: { ...og.images ?? {}, loader: this.#getLoader(moduleResources, og.images?.resources ?? []) },
      styles: { ...og.styles ?? {}, loader: this.#getLoader(moduleResources, og.styles?.resources ?? []) },
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
  static async compile(file: string): Promise<EmailCompiled> {
    const src = await this.loadTemplate(file);

    const mod = RuntimeIndex.getModuleFromSource(file);
    if (!mod) {
      throw new AppError('Unknown file attempting to be compiled', 'data', { file });
    }

    const compiled = await EmailCompileUtil.compile(src, { file, module: mod.name });
    await this.writeTemplate(file, compiled);
    return compiled;
  }

  /**
   * Compile all
   */
  static async compileAll(mod?: string): Promise<string[]> {
    const keys = this.findAllTemplates(mod);
    await Promise.all(keys.map(src => this.compile(src)));
    return keys;
  }

  /**
   * Watch compilation
   */
  static async * watchCompile(signal: AbortSignal): AsyncIterable<string> {
    const all = FileLoader.resolvePaths(
      this.findAllTemplates().map(x => `${RuntimeIndex.getEntry(x)!.module}#resources`)
    );

    const stream = new WorkQueue<string>([], signal);

    // watch resources
    this.#watchFolders(all, async ({ file }) => {
      try {
        const changed = await this.compileAll();
        console.log('Successfully compiled templates', { changed, source: file });
        stream.addAll(changed);
      } catch (err) {
        console.error('Error in compiling all templates', err && err instanceof Error ? err.message : `${err}`);
      }
    }, signal);

    // Watch template files
    watchCompiler(async ({ file, action }) => {
      const src = RuntimeIndex.getEntry(file);
      if (!src || !EmailCompileUtil.isTemplateFile(src.sourceFile) || action === 'delete') {
        return;
      }
      try {
        await this.compile(file);
        console.log('Successfully compiled template', { changed: [file] });
        stream.add(file);
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    }, { signal });

    yield* stream;
  }

  /**
   * Read template parts, compiling if necessary
   */
  static async readTemplateParts(file: string): Promise<EmailCompiled> {
    const files = this.getOutputFiles(file);
    const missing = await Promise.all(Object.values(files).map(x => fs.stat(file).catch(() => { })));

    if (missing.some(x => x === undefined)) {
      await this.compile(file);
    }

    const parts = await Promise.all(
      TypedObject.entries(files).map(
        ([key, partFile]) => fs.readFile(partFile, 'utf8')
          .then(content => [key, content] as const)
      )
    );
    return TypedObject.fromEntries<keyof EmailCompiled, string>(parts);
  }
}