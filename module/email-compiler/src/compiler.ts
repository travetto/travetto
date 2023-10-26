import fs from 'fs/promises';

import { FileQueryProvider, TypedObject } from '@travetto/base';
import { EmailCompileSource, EmailCompiled, EmailCompileContext, MailUtil } from '@travetto/email';
import { RootIndex, path } from '@travetto/manifest';
import { DynamicFileLoader } from '@travetto/base/src/internal/file-loader';

import { EmailCompileUtil } from './util';
import { watchFolders } from './watch';

const VALID_FILE = (file: string): boolean => /[.](scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

/**
 * Email compilation support
 */
export class EmailCompiler {

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
      .findSupport({ filter: f => EmailCompileUtil.isTemplateFile(f) })
      .filter(x => !mod || x.module === mod)
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

    // watch resources
    const stream = await watchFolders(all.paths);

    // Watch template files
    DynamicFileLoader.onLoadEvent((ev) => {
      const src = RootIndex.getEntry(ev.file);
      if (src && EmailCompileUtil.isTemplateFile(src.sourceFile)) {
        stream.add({ ...ev, file: src.sourceFile });
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