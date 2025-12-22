import fs from 'node:fs/promises';
import path from 'node:path';

import { TypedObject, RuntimeIndex, watchCompiler, Runtime, BinaryUtil, ExecUtil } from '@travetto/runtime';
import { EmailCompiled, MailUtil, EmailTemplateImport, EmailTemplateModule } from '@travetto/email';

import { EmailCompileUtil } from './util.ts';

/**
 * Email compilation support
 */
export class EmailCompiler {

  /**
   * Load Template
   */
  static async loadTemplate(file: string): Promise<EmailTemplateModule> {
    const root = (await Runtime.importFrom<{ default: EmailTemplateImport }>(file)).default;
    const entry = RuntimeIndex.getEntry(file)!;
    return await root.prepare({ file, module: entry.module });
  }

  /**
   * Grab list of all available templates
   */
  static findAllTemplates(moduleName?: string): string[] {
    return RuntimeIndex
      .find({
        module: mod => !moduleName ? mod.roles.includes('std') : moduleName === mod.name,
        folder: folder => folder === 'support',
        file: file => EmailCompileUtil.isTemplateFile(file.sourceFile)
      })
      .map(file => file.sourceFile);
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
  static async writeTemplate(file: string, message: EmailCompiled): Promise<void> {
    const outs = this.getOutputFiles(file);
    await Promise.all(TypedObject.keys(outs).map(async key => {
      if (message[key]) {
        const content = MailUtil.buildBrand(file, message[key], 'trv email:compile');
        await BinaryUtil.bufferedFileWrite(outs[key], content);
      } else {
        await fs.rm(outs[key], { force: true }); // Remove file if data not provided
      }
    }));
  }

  /**
   * Compile a file given a resource provider
   */
  static async compile(file: string): Promise<EmailCompiled> {
    const template = await this.loadTemplate(file);
    const compiled = await EmailCompileUtil.compile(template);
    await this.writeTemplate(file, compiled);
    return compiled;
  }

  /**
   * Compile all
   */
  static async compileAll(mod?: string): Promise<string[]> {
    const keys = this.findAllTemplates(mod);
    await Promise.all(keys.map(key => this.compile(key)));
    return keys;
  }

  /**
   * Watch compilation
   */
  static async * watchCompile(signal?: AbortSignal): AsyncIterable<string> {
    // Watch template files
    for await (const { file, action } of watchCompiler({ signal })) {
      if (!EmailCompileUtil.isTemplateFile(file) || action === 'delete' || RuntimeIndex.findModuleForArbitraryFile(file) === undefined) {
        continue;
      }

      const child = ExecUtil.spawnTrv('email:compile', [file], {
        cwd: Runtime.mainSourcePath,
        env: { ...process.env },
      });

      const result = await ExecUtil.getResult(child, { catch: true });

      if (!result.valid) {
        console.error('Error compiling template', { file, stderr: result.stderr });
      } else {
        console.log('Successfully compiled template', { changed: [file] });
      }
      yield file;
    }
  }
}