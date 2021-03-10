import * as path from 'path';
import * as fs from 'fs';

import { PathUtil } from '@travetto/boot';

export class DocBinUtil {

  /**
   * Watch a file
   * @param file
   * @param cb
   */
  static async watchFile(file: string, cb: (ev: unknown) => void) {
    const { Watcher } = await import('@travetto/watch');
    const { Compiler } = await import('@travetto/compiler');

    new Watcher(__dirname, { interval: 250, exclude: { testDir: () => false, testFile: f => f === file } })
      .on('all', e => {
        Compiler.unload(PathUtil.resolveUnix(file));
        cb(e);
      });
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }

  static async generate(config: { output?: string[], format?: string, watch?: boolean }) {
    const { PhaseManager } = await import('@travetto/base');
    // Standard compile
    await PhaseManager.run('init');


    const { GenerateUtil } = await import('../../src/generate');

    if (config.output) {

      const writers = await Promise.all(config.output.map(async (out) => {
        const renderer = await GenerateUtil.getRenderer(path.extname(out) ?? config.format);
        const finalName = await GenerateUtil.getOutputLocation(out);
        return { renderer, finalName };
      }));

      const write = async () => {
        for (const { renderer, finalName } of writers) {
          const content = await GenerateUtil.generate('doc.ts', renderer);
          fs.writeFileSync(finalName, content, 'utf8');
        }
      };

      if (config.watch) {
        await DocBinUtil.watchFile('doc.ts', write);
      } else {
        try {
          await write();
        } catch (err) {
          console.log(PathUtil.cwd, err);
        }
      }
    } else {
      console.log(await GenerateUtil.getRenderer(config.format!));
    }

  }
}