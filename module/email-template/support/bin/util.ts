import * as fs from 'fs/promises';

import { FsUtil } from '@travetto/boot';
import type { MailTemplateEngine } from '@travetto/email';

import type { CompileParts } from '../../src/util';

export class TemplateUtil {
  /**
   * Resolve template
   */
  static async resolveTemplate(file: string, format: CompileParts, context: Record<string, unknown>): Promise<string> {
    const { CompileUtil } = await import('../../src/util');

    const files = CompileUtil.getOutputs(file);
    const missing = await Promise.all(files.map(x => FsUtil.exists(x[1])));

    if (missing.some(x => x === undefined)) {
      await CompileUtil.compileToDisk(file);
    }

    const compiled = Object.fromEntries(await Promise.all(files.map(([k, f]) => fs.readFile(f, 'utf8').then(c => [k, c]))));

    // Let the engine template
    const { MailTemplateEngineTarget } = await import('@travetto/email/src/internal/types');
    const { DependencyRegistry } = await import('@travetto/di');

    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);
    return engine.template(compiled[format], context);
  }

  /**
   * Render
   * @param file
   */
  static async resolveCompiledTemplate(file: string, context: Record<string, unknown>): Promise<Record<CompileParts, string>> {
    const { CompileUtil, COMPILE_PARTS } = await import('../../src/util');

    const entries = await Promise.all(
      COMPILE_PARTS.map(k =>
        this.resolveTemplate(file, k, context)
          .then(c => [k, c])
      )
    );
    return Object.fromEntries(entries);
  }


  /**
   * Watch compilation
   */
  static async watchCompile(cb?: (file: string) => void): Promise<void> {
    const { ResourceManager, Util } = await import('@travetto/base');
    const { FilePresenceManager } = await import('@travetto/watch');
    const { CompileUtil } = await import('../../src/util');

    new FilePresenceManager(ResourceManager.getRelativePaths().map(x => `${x}/email`), {
      ignoreInitial: true,
      validFile: x =>
        !/[.]compiled[.]/.test(x) && (
          /[.](html|scss|css|png|jpe?g|gif|ya?ml)$/.test(x)
        )
    }).on('changed', async ({ file }) => {
      try {
        console.log('Contents changed', { file });
        if (CompileUtil.TPL_EXT.test(file)) {
          await CompileUtil.compileToDisk(file);
          if (cb) {
            cb(file);
          }
        } else {
          await CompileUtil.compileAllToDisk();
          if (cb) {
            for (const el of await CompileUtil.findAllTemplates()) {
              cb(el.path);
            }
          }
        }
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    });
    await Util.wait('1d');
  }
}