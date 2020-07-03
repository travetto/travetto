import * as path from 'path';
import { CompileCliUtil } from '@travetto/compiler/bin/lib';
import type { Renderer } from '../../src/render';
import { FsUtil } from '@travetto/boot';

export class CliDocUtil {
  /**
   * Initialize for doc gen
   */
  static async init() {
    await CompileCliUtil.compile();

    process.env.TRV_DEBUG = '0';
    process.env.TRV_LOG_PLAIN = '1';

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();
  }

  /**
   * Retrieve the doc renderer
   * @param fmt
   */
  static async getRenderer(fmt: string) {
    const { Renderers } = await import('../..');
    const renderer = Renderers[fmt as keyof typeof Renderers];
    if (!renderer) {
      console.error('Format unknown', fmt);
      process.exit(1);
    }
    return renderer;
  }

  /**
   * Generate the text
   * @param renderer
   */
  static async generate(renderer: Renderer) {
    const { Header } = await import('../..');

    const doc = await import(FsUtil.resolveUnix(FsUtil.cwd, 'README.ts'));
    let content = '';
    if (doc.header !== false) {
      content = `${renderer.render(Header(FsUtil.cwd))}\n`;
    }
    content = `${content}${renderer.render(doc.default)}`.replace(/\n{3,100}/msg, '\n\n');
    content = await renderer.wrap(content, this.getPackageName());
    return content;
  }

  static getPackageName() {
    return path.basename(FsUtil.cwd);
  }

  /**
   * Get the output location
   * @param output
   */
  static async getOutputLoc(output: string) {
    const root = FsUtil.resolveUnix(FsUtil.cwd, output);
    const name = this.getPackageName();
    return root.replace(/%MOD/g, name);
  }

  /**
   * Watch a file
   * @param file
   * @param cb
   */
  static async watchFile(file: string, cb: (ev: any) => void) {
    const { Watcher } = await import('@travetto/watch');
    const { Compiler } = await import('@travetto/compiler');

    new Watcher({ interval: 250 })
      .on('all', e => {
        console.log('Recompiling', e);
        Compiler.unload(require.resolve(FsUtil.resolveUnix(FsUtil.cwd, file)));
        cb(e);
      })
      .add([{ testFile: f => f.endsWith(file), testDir: x => true }])
      .run(true);
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }
}