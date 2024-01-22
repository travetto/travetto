import fs from 'node:fs/promises';

import { TypedObject, Util, watchCompiler } from '@travetto/base';
import { EmailCompiled, MailUtil, EmailTemplateImport, EmailTemplateModule } from '@travetto/email';
import { RuntimeIndex, path } from '@travetto/manifest';

import { EmailCompileUtil } from './util';

/**
 * Email compilation support
 */
export class EmailCompiler {

  /**
   * Load Template
   */
  static async loadTemplate(file: string): Promise<EmailTemplateModule> {
    const entry = RuntimeIndex.getEntry(file);
    const mod = entry ? RuntimeIndex.getModule(entry.module) : undefined;
    if (!entry || !mod) {
      throw new Error(`Unable to find template for ${file}`);
    }
    const root: EmailTemplateImport = (await import(entry.outputFile)).default;
    return await root.prepare({ file, module: mod.name });
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
        const content = MailUtil.buildBrand(file, msg[k], 'trv email:compile');
        await Util.bufferedFileWrite(outs[k], content);
      } else {
        await fs.rm(outs[k], { force: true }); // Remove file if data not provided
      }
    }));
  }

  /**
   * Compile a file given a resource provider
   */
  static async compile(file: string): Promise<EmailCompiled> {
    const tpl = await this.loadTemplate(file);
    const compiled = await EmailCompileUtil.compile(tpl);
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
  static async * watchCompile(signal?: AbortSignal): AsyncIterable<string> {
    // Watch template files
    for await (const { file, action } of watchCompiler({ signal })) {
      const src = RuntimeIndex.getEntry(file);
      if (!src || !EmailCompileUtil.isTemplateFile(src.sourceFile) || action === 'delete') {
        continue;
      }
      try {
        await this.compile(file);
        console.log('Successfully compiled template', { changed: [file] });
        yield file;
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    }
  }
}